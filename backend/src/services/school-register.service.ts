import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import { pool, query } from "../db/pool.js";
import { appendSchoolPasswordNote } from "./password-notebook.service.js";
import { validatePassword } from "./password-reset.service.js";
import {
  parseSubscriptionPeriod,
  syncSchoolCabinetAccess,
} from "./school-access.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SCHOOL_TYPE_ID = 1;

export class SchoolRegisterError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SchoolRegisterError";
    this.status = status;
  }
}

export interface CreatedSchool {
  schoolId: number;
  schoolName: string;
  email: string;
  areaId: number;
  areaTitle: string;
}

interface AreaRow extends RowDataPacket {
  id: number;
  title: string;
}

interface IdRow extends RowDataPacket {
  id: number;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export async function getAllAreas() {
  return query<AreaRow[]>(
    `SELECT id_area AS id, title_area AS title
     FROM area
     ORDER BY title_area ASC`,
  );
}

export async function isUserEmailAvailable(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const rows = await query<IdRow[]>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [normalized],
  );
  return rows.length === 0;
}

export async function createSchoolWithCabinet(input: {
  schoolName: string;
  areaId: number;
  email: string;
  password: string;
  confirmPassword: string;
  startsOn: string;
  endsOn: string;
  actor: string;
}): Promise<CreatedSchool> {
  const schoolName = input.schoolName.trim().replace(/\s+/g, " ");
  const email = normalizeEmail(input.email);
  const areaId = Number(input.areaId);
  let startsOn: string;
  let endsOn: string;

  try {
    ({ startsOn, endsOn } = parseSubscriptionPeriod(
      input.startsOn,
      input.endsOn,
    ));
  } catch (error) {
    throw new SchoolRegisterError(
      error instanceof Error ? error.message : "Укажите срок подписки",
    );
  }

  if (schoolName.length < 5) {
    throw new SchoolRegisterError(
      "Наименование образовательной организации должно содержать не менее 5 символов",
    );
  }
  if (schoolName.length > 255) {
    throw new SchoolRegisterError("Слишком длинное наименование школы");
  }
  if (!Number.isInteger(areaId) || areaId <= 0) {
    throw new SchoolRegisterError("Выберите район");
  }
  if (!isValidEmail(email)) {
    throw new SchoolRegisterError("Укажите корректный email");
  }
  if (input.password !== input.confirmPassword) {
    throw new SchoolRegisterError("Пароли не совпадают");
  }

  const passwordError = validatePassword(input.password);
  if (passwordError) {
    throw new SchoolRegisterError(passwordError);
  }

  const areas = await query<AreaRow[]>(
    "SELECT id_area AS id, title_area AS title FROM area WHERE id_area = ? LIMIT 1",
    [areaId],
  );
  const area = areas[0];
  if (!area) {
    throw new SchoolRegisterError("Указанный район не найден");
  }

  if (!(await isUserEmailAvailable(email))) {
    throw new SchoolRegisterError("Этот email уже зарегистрирован");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const idUser = uuidv4();
  const connection = await pool.getConnection();

  let schoolId = 0;
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query<IdRow[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    if (existing.length) {
      throw new SchoolRegisterError("Этот email уже зарегистрирован");
    }

    const [schoolResult] = await connection.execute<ResultSetHeader>(
      "INSERT INTO schools (area_id, school_name, type_id) VALUES (?, ?, ?)",
      [areaId, schoolName, DEFAULT_SCHOOL_TYPE_ID],
    );
    schoolId = Number(schoolResult.insertId);
    if (!schoolId) {
      throw new SchoolRegisterError("Не удалось создать школу", 500);
    }

    await connection.execute(
      `INSERT INTO users (id_user, email, password, status, school_id, role)
       VALUES (?, ?, ?, 'off', ?, 'school_admin')`,
      [idUser, email, passwordHash, schoolId],
    );

    await connection.execute(
      `INSERT INTO school_subscriptions (
         school_id, starts_on, ends_on, contact_phone, is_cancelled, source_label, note
       ) VALUES (?, ?, ?, NULL, 0, 'admin-register', NULL)`,
      [schoolId, startsOn, endsOn],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  try {
    await syncSchoolCabinetAccess(schoolId);
  } catch (error) {
    console.error("School access sync after register failed:", error);
  }

  try {
    await appendSchoolPasswordNote({
      action: "created",
      schoolId,
      schoolName,
      email,
      password: input.password,
      actor: input.actor,
    });
  } catch (error) {
    console.error("School password notebook write failed:", error);
  }

  return {
    schoolId,
    schoolName,
    email,
    areaId: area.id,
    areaTitle: area.title,
  };
}
