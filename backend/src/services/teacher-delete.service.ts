import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool, query } from "../db/pool.js";

/**
 * Удаление одного работника школы вместе со всеми его следами.
 *
 * Логика повторяет `school-purge.service.ts` (полная очистка школы), но для
 * одного учителя. Файл намеренно не переиспользует helpers purge: тот сервис
 * разрушительный, и трогать его ради общего кода не стоит.
 *
 * Важно: `id_card` пересекается между `card_from_project_teacher_mark2` и
 * `card_from_project_teacher_mark3`, поэтому зависимые строки нельзя удалять
 * по списку идентификаторов — только через JOIN с конкретной таблицей карт.
 */

export interface TeacherDeletionSummary {
  teacherId: string;
  fullName: string;
  evaluations: number;
  comments: number;
  projects: number;
}

export class TeacherDeletionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const PROTECTED_TABLES = new Set([
  "users",
  "schools",
  "school_subscriptions",
  "subscription_renewal_requests",
  "middleware_project_school",
  "sessions",
  "audit_logs",
  "password_reset_tokens",
  "teachers",
  "teachers_old",
]);

/** Таблицы карт, у которых `teacher_id` — строка с UUID учителя. */
const CARD_TABLES = [
  "card_from_project_teacher_mark3",
  "card_from_project_teacher_mark2",
] as const;

/**
 * `cards` сюда не входит намеренно. В унаследованной схеме у неё
 * `teacher_id int` (легаси-нумерация), а не UUID: сравнение со строкой
 * превратилось бы в `teacher_id = 0` и задело бы чужие строки. Таблица пуста
 * и в проде, и локально, кабинет школы в неё не пишет. Полная очистка школы
 * (`school-purge.service.ts`) по-прежнему чистит её по `school_id`.
 */

function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_NO_SUCH_TABLE"
  );
}

function sanitizeTableName(name: string): string {
  const safe = name.replace(/[^a-z0-9_]/gi, "");
  if (!safe || safe !== name) {
    throw new Error("Invalid table name");
  }
  return safe;
}

async function exec(
  connection: PoolConnection,
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  try {
    const [result] = await connection.query<ResultSetHeader>(sql, params);
    return Number(result.affectedRows ?? 0);
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

async function count(
  connection: PoolConnection,
  sql: string,
  params: unknown[],
): Promise<number> {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(sql, params);
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

/** Таблицы связки «учитель ↔ проект»: список ведётся в `project_middleware_names`. */
async function projectLinkTables(): Promise<string[]> {
  const names = new Set<string>();

  try {
    const rows = await query<{ tbl_name: string }[]>(
      "SELECT tbl_name FROM project_middleware_names",
    );
    for (const row of rows) {
      if (!row.tbl_name) continue;
      const table = sanitizeTableName(row.tbl_name);
      if (!PROTECTED_TABLES.has(table)) names.add(table);
    }
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  for (const fallback of [
    "middleware_project_without_any_project",
    "middleware_teachers_project_name_mark",
    "middleware_teachers_project_name_test",
    "middleware_project_teachers",
  ]) {
    if (!PROTECTED_TABLES.has(fallback)) names.add(fallback);
  }

  return [...names];
}

async function findTeacher(
  connection: PoolConnection,
  schoolId: number,
  teacherId: string,
): Promise<TeacherDeletionSummary> {
  const [rows] = await connection.query<
    (RowDataPacket & {
      id_teacher: string;
      surname: string;
      firstname: string;
      patronymic: string | null;
    })[]
  >(
    `SELECT id_teacher, surname, firstname, patronymic
     FROM teachers
     WHERE id_teacher = ? AND school_id = ?
     FOR UPDATE`,
    [teacherId, schoolId],
  );

  const row = rows[0];
  if (!row) {
    throw new TeacherDeletionError("Работник не найден", 404);
  }

  const fullName = [row.surname, row.firstname, row.patronymic]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return {
    teacherId: row.id_teacher,
    fullName,
    evaluations: 0,
    comments: 0,
    projects: 0,
  };
}

async function countEvaluations(
  connection: PoolConnection,
  schoolId: number,
  teacherId: string,
): Promise<number> {
  let total = 0;

  for (const table of CARD_TABLES) {
    total += await count(
      connection,
      `SELECT COUNT(*) AS count FROM \`${table}\`
       WHERE teacher_id = ? AND school_id = ?`,
      [teacherId, schoolId],
    );
  }

  return total;
}

async function countComments(
  connection: PoolConnection,
  schoolId: number,
  teacherId: string,
): Promise<number> {
  let total = 0;

  for (const table of CARD_TABLES) {
    total += await count(
      connection,
      `SELECT COUNT(*) AS count FROM evaluation_comments ec
       INNER JOIN \`${table}\` c
         ON c.id_card = ec.card_id AND c.teacher_id = ? AND c.school_id = ?`,
      [teacherId, schoolId],
    );
  }

  return total;
}

async function countProjectLinks(
  connection: PoolConnection,
  teacherId: string,
): Promise<number> {
  let total = 0;

  for (const table of await projectLinkTables()) {
    total += await count(
      connection,
      `SELECT COUNT(*) AS count FROM \`${table}\` WHERE teacher_id = ?`,
      [teacherId],
    );
  }

  return total;
}

export async function previewTeacherDeletion(
  schoolId: number,
  teacherId: string,
): Promise<TeacherDeletionSummary> {
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw new TeacherDeletionError("Некорректный идентификатор школы");
  }
  if (!teacherId.trim()) {
    throw new TeacherDeletionError("Не указан идентификатор работника");
  }

  const teacher = await query<
    {
      id_teacher: string;
      surname: string;
      firstname: string;
      patronymic: string | null;
    }[]
  >(
    `SELECT id_teacher, surname, firstname, patronymic
     FROM teachers
     WHERE id_teacher = ? AND school_id = ?
     LIMIT 1`,
    [teacherId, schoolId],
  );

  const row = teacher[0];
  if (!row) {
    throw new TeacherDeletionError("Работник не найден", 404);
  }

  const connection = await pool.getConnection();
  try {
    const [evaluations, comments, projects] = await Promise.all([
      countEvaluations(connection, schoolId, teacherId),
      countComments(connection, schoolId, teacherId),
      countProjectLinks(connection, teacherId),
    ]);

    return {
      teacherId: row.id_teacher,
      fullName: [row.surname, row.firstname, row.patronymic]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join(" "),
      evaluations,
      comments,
      projects,
    };
  } finally {
    connection.release();
  }
}

export async function deleteSchoolTeacher(
  schoolId: number,
  teacherId: string,
): Promise<TeacherDeletionSummary> {
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw new TeacherDeletionError("Некорректный идентификатор школы");
  }
  if (!teacherId.trim()) {
    throw new TeacherDeletionError("Не указан идентификатор работника");
  }

  const connection = await pool.getConnection();
  let summary: TeacherDeletionSummary;

  try {
    await connection.beginTransaction();

    summary = await findTeacher(connection, schoolId, teacherId);
    summary.evaluations = await countEvaluations(connection, schoolId, teacherId);
    summary.comments = await countComments(connection, schoolId, teacherId);
    summary.projects = await countProjectLinks(connection, teacherId);

    // 1. Зависимые строки карт: только через JOIN с картой этого учителя,
    //    потому что id_card пересекается между таблицами карт.
    for (const table of CARD_TABLES) {
      await exec(
        connection,
        `DELETE ec FROM evaluation_comments ec
         INNER JOIN \`${table}\` c
           ON c.id_card = ec.card_id AND c.teacher_id = ? AND c.school_id = ?`,
        [teacherId, schoolId],
      );
      await exec(
        connection,
        `DELETE oc FROM outside_card2 oc
         INNER JOIN \`${table}\` c
           ON c.id_card = oc.card_id AND c.teacher_id = ? AND c.school_id = ?`,
        [teacherId, schoolId],
      );
      await exec(
        connection,
        `DELETE oc FROM outside_card oc
         INNER JOIN \`${table}\` c
           ON c.id_card = oc.card_id AND c.teacher_id = ? AND c.school_id = ?`,
        [teacherId, schoolId],
      );
      await exec(
        connection,
        `DELETE ms FROM methodist_static ms
         INNER JOIN \`${table}\` c
           ON c.id_card = ms.card_id AND c.teacher_id = ? AND c.school_id = ?`,
        [teacherId, schoolId],
      );
      await exec(
        connection,
        `DELETE es FROM evaluation_email_sends es
         INNER JOIN \`${table}\` c
           ON c.id_card = es.card_id AND c.teacher_id = ? AND c.school_id = ?`,
        [teacherId, schoolId],
      );
      await exec(
        connection,
        `DELETE FROM \`${table}\` WHERE teacher_id = ? AND school_id = ?`,
        [teacherId, schoolId],
      );
    }

    // 2. Данные самого учителя, не связанные с картами.
    await exec(
      connection,
      "DELETE FROM methodist_static WHERE teacher_id = ?",
      [teacherId],
    );
    await exec(
      connection,
      "DELETE FROM training_kpk WHERE teacher_id = ?",
      [teacherId],
    );
    await exec(
      connection,
      "DELETE FROM discipline_middleware WHERE teacher_id = ?",
      [teacherId],
    );

    for (const table of await projectLinkTables()) {
      await exec(
        connection,
        `DELETE FROM \`${table}\` WHERE teacher_id = ?`,
        [teacherId],
      );
    }

    await exec(
      connection,
      "DELETE FROM teachers_old WHERE id_teacher = ? AND school_id = ?",
      [teacherId, schoolId],
    );
    await exec(
      connection,
      "DELETE FROM teachers WHERE id_teacher = ? AND school_id = ?",
      [teacherId, schoolId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return summary;
}
