import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import type { SessionUser, UserRole } from "../types/session.js";

interface DbUser {
  id: number;
  id_user: string | null;
  email: string;
  password: string;
  status: "on" | "off";
  school_id: number;
  role: string;
}

interface DbMethodist {
  id: number;
  id_user: string;
  email: string;
  password: string;
  status: "on" | "off";
  role: string;
  firstname: string;
  surname: string;
  patronymic: string;
}

function mapSchoolUser(row: DbUser): SessionUser {
  return {
    id: row.id,
    idUser: row.id_user,
    email: row.email,
    role: row.role as UserRole,
    schoolId: row.school_id,
    status: row.status,
    accountType: row.role === "admin" ? "admin" : "school",
  };
}

function mapMethodist(row: DbMethodist): SessionUser {
  return {
    id: row.id,
    idUser: row.id_user,
    email: row.email,
    role: "methodist",
    schoolId: 0,
    status: row.status,
    accountType: "methodist",
    firstname: row.firstname,
    surname: row.surname,
    patronymic: row.patronymic,
  };
}

export async function findSchoolUserByEmail(
  email: string,
): Promise<DbUser | null> {
  const rows = await query<DbUser[]>(
    "SELECT id, id_user, email, password, status, school_id, role FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0] ?? null;
}

export async function findMethodistByEmail(
  email: string,
): Promise<DbMethodist | null> {
  const rows = await query<DbMethodist[]>(
    "SELECT id, id_user, email, password, status, role, firstname, surname, patronymic FROM methodists WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0] ?? null;
}

export async function authenticate(
  email: string,
  password: string,
  accountType: "school" | "methodist",
): Promise<SessionUser | null> {
  if (accountType === "school") {
    const user = await findSchoolUserByEmail(email);
    if (!user || user.status !== "on") {
      return null;
    }
    const valid = await bcrypt.compare(password, user.password);
    return valid ? mapSchoolUser(user) : null;
  }

  const methodist = await findMethodistByEmail(email);
  if (!methodist || methodist.status !== "on") {
    return null;
  }
  const valid = await bcrypt.compare(password, methodist.password);
  return valid ? mapMethodist(methodist) : null;
}

export async function getSchoolName(schoolId: number): Promise<string | null> {
  const rows = await query<{ school_name: string }[]>(
    "SELECT school_name FROM schools WHERE id_school = ? LIMIT 1",
    [schoolId],
  );
  return rows[0]?.school_name ?? null;
}

export async function countTeachers(schoolId: number): Promise<number> {
  const rows = await query<{ count: number }[]>(
    "SELECT COUNT(*) AS count FROM teachers WHERE school_id = ?",
    [schoolId],
  );
  return Number(rows[0]?.count ?? 0);
}
