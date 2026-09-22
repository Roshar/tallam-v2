import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool, query } from "../db/pool.js";
import { getSchoolName } from "./auth.service.js";

export interface SchoolPurgeResult {
  schoolId: number;
  schoolName: string;
  teachers: number;
  evaluations: number;
}

function normalizeSchoolName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_NO_SUCH_TABLE"
  );
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

async function countForSchool(
  sql: string,
  schoolId: number,
): Promise<number> {
  try {
    const rows = await query<{ count: number }[]>(sql, [schoolId]);
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

async function middlewareTables(): Promise<string[]> {
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

async function tablesWithTeacherId(tables: string[]): Promise<string[]> {
  if (tables.length === 0) return [];
  const rows = await query<{ table_name: string }[]>(
    `SELECT TABLE_NAME AS table_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND COLUMN_NAME = 'teacher_id'
       AND TABLE_NAME IN (${tables.map(() => "?").join(", ")})`,
    tables,
  );
  return rows.map((row) => row.table_name);
}

export async function purgeSchoolTeachersAndEvaluations(
  schoolId: number,
  confirmName: string,
): Promise<SchoolPurgeResult> {
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw new Error("Некорректный идентификатор школы");
  }

  const schoolName = (await getSchoolName(schoolId))?.trim() ?? "";
  if (!schoolName) {
    throw new Error("Школа не найдена");
  }

  if (normalizeSchoolName(confirmName) !== normalizeSchoolName(schoolName)) {
    throw new Error("Введите точное название школы для подтверждения");
  }

  const [teachers, evaluationsMark3, evaluationsMark2, evaluationsLegacy] =
    await Promise.all([
      countForSchool(
        "SELECT COUNT(*) AS count FROM teachers WHERE school_id = ?",
        schoolId,
      ),
      countForSchool(
        "SELECT COUNT(*) AS count FROM card_from_project_teacher_mark3 WHERE school_id = ?",
        schoolId,
      ),
      countForSchool(
        "SELECT COUNT(*) AS count FROM card_from_project_teacher_mark2 WHERE school_id = ?",
        schoolId,
      ),
      countForSchool(
        "SELECT COUNT(*) AS count FROM cards WHERE school_id = ?",
        schoolId,
      ),
    ]);
  const evaluations = evaluationsMark3 + evaluationsMark2 + evaluationsLegacy;
  const tables = await tablesWithTeacherId(await middlewareTables());

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [locked] = await connection.query<{
      id_school: number;
      school_name: string;
    }[]>(
      "SELECT id_school, school_name FROM schools WHERE id_school = ? FOR UPDATE",
      [schoolId],
    );
    if (!locked[0]) {
      throw new Error("Школа не найдена");
    }
    if (
      normalizeSchoolName(confirmName) !==
      normalizeSchoolName(locked[0].school_name)
    ) {
      throw new Error("Введите точное название школы для подтверждения");
    }

    await connection.query(
      "SELECT id_tbl FROM teachers WHERE school_id = ? FOR UPDATE",
      [schoolId],
    );

    await exec(
      connection,
      "DELETE FROM evaluation_comments WHERE school_id = ?",
      [schoolId],
    );
    await exec(
      connection,
      `DELETE ec FROM evaluation_comments ec
       INNER JOIN card_from_project_teacher_mark3 c
         ON c.id_card = ec.card_id AND c.school_id = ?`,
      [schoolId],
    );
    await exec(
      connection,
      `DELETE ec FROM evaluation_comments ec
       INNER JOIN card_from_project_teacher_mark2 c
         ON c.id_card = ec.card_id AND c.school_id = ?`,
      [schoolId],
    );

    await exec(
      connection,
      `DELETE oc FROM outside_card2 oc
       INNER JOIN card_from_project_teacher_mark3 c
         ON c.id_card = oc.card_id AND c.school_id = ?`,
      [schoolId],
    );
    await exec(
      connection,
      `DELETE oc FROM outside_card2 oc
       INNER JOIN card_from_project_teacher_mark2 c
         ON c.id_card = oc.card_id AND c.school_id = ?`,
      [schoolId],
    );
    await exec(
      connection,
      `DELETE oc FROM outside_card oc
       INNER JOIN card_from_project_teacher_mark3 c
         ON c.id_card = oc.card_id AND c.school_id = ?`,
      [schoolId],
    );
    await exec(
      connection,
      `DELETE oc FROM outside_card oc
       INNER JOIN card_from_project_teacher_mark2 c
         ON c.id_card = oc.card_id AND c.school_id = ?`,
      [schoolId],
    );
    await exec(
      connection,
      `DELETE oc FROM outside_card oc
       INNER JOIN cards c
         ON c.id_card = oc.card_id AND c.school_id = ?`,
      [schoolId],
    );

    await exec(
      connection,
      `DELETE ms FROM methodist_static ms
       INNER JOIN card_from_project_teacher_mark3 c
         ON c.id_card = ms.card_id AND c.school_id = ?`,
      [schoolId],
    );
    await exec(
      connection,
      `DELETE ms FROM methodist_static ms
       INNER JOIN card_from_project_teacher_mark2 c
         ON c.id_card = ms.card_id AND c.school_id = ?`,
      [schoolId],
    );

    await exec(
      connection,
      "DELETE FROM card_from_project_teacher_mark3 WHERE school_id = ?",
      [schoolId],
    );
    await exec(
      connection,
      "DELETE FROM card_from_project_teacher_mark2 WHERE school_id = ?",
      [schoolId],
    );
    await exec(
      connection,
      "DELETE FROM cards WHERE school_id = ?",
      [schoolId],
    );

    await exec(
      connection,
      `DELETE ms FROM methodist_static ms
       INNER JOIN teachers t
         ON CONVERT(t.id_teacher USING utf8mb4) = CONVERT(ms.teacher_id USING utf8mb4)
       WHERE t.school_id = ?`,
      [schoolId],
    );

    for (const table of tables) {
      await exec(
        connection,
        `DELETE m FROM \`${table}\` m
         INNER JOIN teachers t
           ON CONVERT(t.id_teacher USING utf8mb4) = CONVERT(m.teacher_id USING utf8mb4)
         WHERE t.school_id = ?`,
        [schoolId],
      );
    }

    await exec(
      connection,
      `DELETE kpk FROM training_kpk kpk
       INNER JOIN teachers t
         ON CONVERT(t.id_teacher USING utf8mb4) = CONVERT(kpk.teacher_id USING utf8mb4)
       WHERE t.school_id = ?`,
      [schoolId],
    );
    await exec(
      connection,
      `DELETE dm FROM discipline_middleware dm
       INNER JOIN teachers t
         ON CONVERT(t.id_teacher USING utf8mb4) = CONVERT(dm.teacher_id USING utf8mb4)
       WHERE t.school_id = ?`,
      [schoolId],
    );

    await exec(
      connection,
      "DELETE FROM teachers_old WHERE school_id = ?",
      [schoolId],
    );
    await exec(
      connection,
      "DELETE FROM teachers WHERE school_id = ?",
      [schoolId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    schoolId,
    schoolName,
    teachers,
    evaluations,
  };
}
