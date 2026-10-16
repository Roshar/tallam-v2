import { query } from "../db/pool.js";
import { hashPassword } from "./auth.service.js";

/**
 * Аккаунты учителей для личного кабинета.
 *
 * Связь: `teacher_accounts` (логин и пароль) → `teachers.id_teacher` (карточка,
 * в которой уже есть ФИО, школа, предметы). Ничего не копируем: кабинет читает
 * данные из карточки учителя.
 *
 * Таблица отдельная от `users`, потому что `users.school_id` уникален и рассчитан
 * на одну запись школы, а `users.role` — ENUM под школьные роли. Методисты в этом
 * проекте тоже живут в своей таблице (`methodists`).
 */

export interface TeacherAccountRow {
  id: number;
  id_teacher: string;
  email: string;
  password: string;
  status: "on" | "off" | "";
}

let schemaReady: Promise<void> | null = null;

export async function ensureTeacherAccountSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS teacher_accounts (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        id_teacher varchar(150) NOT NULL,
        email varchar(150) NOT NULL,
        password varchar(200) NOT NULL,
        status enum('on','off','') NOT NULL DEFAULT 'on',
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_teacher_accounts_email (email),
        UNIQUE KEY uq_teacher_accounts_teacher (id_teacher),
        KEY idx_teacher_accounts_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

export async function findTeacherAccountByEmail(
  email: string,
): Promise<TeacherAccountRow | null> {
  await ensureTeacherAccountSchema();
  const rows = await query<TeacherAccountRow[]>(
    `SELECT id, id_teacher, email, password, status
     FROM teacher_accounts
     WHERE email = ?
     LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

/**
 * Создание аккаунта. Используется скриптом первичной настройки, а в будущем —
 * приглашениями. Сам регистрации учителей наружу пока нет.
 */
export async function createTeacherAccount(input: {
  teacherId: string;
  email: string;
  password: string;
}): Promise<{ id: number; email: string; teacherId: string }> {
  await ensureTeacherAccountSchema();

  const teacher = await query<{ id_teacher: string }[]>(
    "SELECT id_teacher FROM teachers WHERE id_teacher = ? LIMIT 1",
    [input.teacherId],
  );
  if (!teacher[0]) {
    throw new Error(`Учитель ${input.teacherId} не найден`);
  }

  const passwordHash = await hashPassword(input.password);
  const email = input.email.trim().toLowerCase();

  await query(
    `INSERT INTO teacher_accounts (id_teacher, email, password, status)
     VALUES (?, ?, ?, 'on')
     ON DUPLICATE KEY UPDATE password = VALUES(password), email = VALUES(email), status = 'on'`,
    [input.teacherId, email, passwordHash],
  );

  const saved = await findTeacherAccountByEmail(email);
  if (!saved) {
    throw new Error("Не удалось создать аккаунт учителя");
  }
  return {
    id: Number(saved.id),
    email: saved.email,
    teacherId: saved.id_teacher,
  };
}

export interface TeacherCabinetContext {
  teacherId: string;
  schoolId: number;
  fullName: string;
  shortName: string;
  schoolName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  disciplines: string[];
}

/** Карточка учителя и школа — источник всех данных кабинета. */
export async function getTeacherCabinetContext(
  teacherId: string,
): Promise<TeacherCabinetContext | null> {
  const rows = await query<
    {
      id_teacher: string;
      school_id: number;
      surname: string;
      firstname: string;
      patronymic: string | null;
      school_name: string | null;
      title_position: string | null;
      email: string | null;
      phone: string | null;
    }[]
  >(
    `SELECT t.id_teacher, t.school_id, t.surname, t.firstname, t.patronymic,
            t.email, t.phone,
            s.school_name, p.title_position
     FROM teachers t
     LEFT JOIN schools s ON s.id_school = t.school_id
     LEFT JOIN position p ON t.position = p.id_position
     WHERE t.id_teacher = ?
     LIMIT 1`,
    [teacherId],
  );

  const row = rows[0];
  if (!row) return null;

  const disciplines = await query<{ title_discipline: string }[]>(
    `SELECT dt.title_discipline
     FROM discipline_middleware dm
     INNER JOIN discipline_title dt ON dt.id_discipline = dm.discipline_id
     WHERE dm.teacher_id = ?
     ORDER BY dt.title_discipline`,
    [teacherId],
  );

  const fullName = [row.surname, row.firstname, row.patronymic]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return {
    teacherId: row.id_teacher,
    schoolId: Number(row.school_id),
    fullName,
    shortName: [row.firstname, row.patronymic]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" "),
    schoolName: row.school_name?.trim() || "",
    position: row.title_position?.trim() || null,
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    disciplines: disciplines.map((item) => item.title_discipline.trim()),
  };
}
