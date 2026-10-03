import { query } from "../db/pool.js";

const HIDDEN_SCHOOL_EMAILS = [
  "test@test.ru",
  "test2@test.ru",
  "test3@test.ru",
  "v2.newschool@tallam.test",
];

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface VisitPeriod {
  schools: number;
  visits: number;
  from: string;
  to: string;
}

export interface VisitSchoolRank {
  schoolId: number;
  schoolName: string;
  areaName: string | null;
  visits: number;
}

export interface VisitAreaRank {
  areaName: string;
  schools: number;
  visits: number;
}

export interface SchoolVisitStats {
  day: VisitPeriod;
  week: VisitPeriod;
  month: VisitPeriod;
  schools: VisitSchoolRank[];
  areas: VisitAreaRank[];
}

let schemaReady: Promise<void> | null = null;

export async function ensureSchoolVisitSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS school_presence_days (
        school_id bigint(20) UNSIGNED NOT NULL,
        visited_on date NOT NULL,
        last_seen_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (school_id, visited_on),
        KEY idx_school_presence_day (visited_on)
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

function moscowDate(offsetDays = 0): string {
  const shifted = new Date(Date.now() + MOSCOW_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

function weekStart(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function hiddenSchoolSql(schoolColumn: string) {
  const placeholders = HIDDEN_SCHOOL_EMAILS.map(() => "?").join(", ");
  return {
    sql: `NOT EXISTS (
      SELECT 1
      FROM users u
      WHERE u.school_id = ${schoolColumn}
        AND u.role = 'school_admin'
        AND LOWER(u.email) IN (${placeholders})
    )`,
    params: [...HIDDEN_SCHOOL_EMAILS],
  };
}

async function periodStats(from: string, to: string): Promise<VisitPeriod> {
  const hidden = hiddenSchoolSql("p.school_id");
  const rows = await query<{ schools: number; visits: number }[]>(
    `SELECT COUNT(DISTINCT p.school_id) AS schools, COUNT(*) AS visits
     FROM school_presence_days p
     WHERE p.visited_on >= ? AND p.visited_on <= ?
       AND ${hidden.sql}`,
    [from, to, ...hidden.params],
  );
  return {
    schools: Number(rows[0]?.schools ?? 0),
    visits: Number(rows[0]?.visits ?? 0),
    from,
    to,
  };
}

export async function recordSchoolPresence(schoolId: number): Promise<void> {
  if (!Number.isInteger(schoolId) || schoolId <= 0) return;
  await ensureSchoolVisitSchema();
  const today = moscowDate();
  await query(
    `INSERT INTO school_presence_days (school_id, visited_on, last_seen_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE last_seen_at = NOW()`,
    [schoolId, today],
  );
}

export async function getSchoolVisitStats(): Promise<SchoolVisitStats> {
  await ensureSchoolVisitSchema();
  const today = moscowDate();
  const monthFrom = `${today.slice(0, 8)}01`;
  const weekFrom = weekStart(today);
  const hidden = hiddenSchoolSql("p.school_id");

  const [day, week, month, schools, areas] = await Promise.all([
    periodStats(today, today),
    periodStats(weekFrom, today),
    periodStats(monthFrom, today),
    query<VisitSchoolRank[]>(
      `SELECT
         s.id_school AS schoolId,
         s.school_name AS schoolName,
         NULLIF(TRIM(a.title_area), '') AS areaName,
         COUNT(*) AS visits
       FROM school_presence_days p
       JOIN schools s ON s.id_school = p.school_id
       LEFT JOIN area a ON a.id_area = s.area_id
       WHERE p.visited_on >= ? AND p.visited_on <= ?
         AND ${hidden.sql}
       GROUP BY s.id_school, s.school_name, a.title_area
       ORDER BY visits DESC, s.school_name ASC
       LIMIT 8`,
      [monthFrom, today, ...hidden.params],
    ),
    query<{ areaName: string; schools: number; visits: number }[]>(
      `SELECT
         COALESCE(NULLIF(TRIM(a.title_area), ''), 'Район не указан') AS areaName,
         COUNT(DISTINCT p.school_id) AS schools,
         COUNT(*) AS visits
       FROM school_presence_days p
       JOIN schools s ON s.id_school = p.school_id
       LEFT JOIN area a ON a.id_area = s.area_id
       WHERE p.visited_on >= ? AND p.visited_on <= ?
         AND ${hidden.sql}
       GROUP BY IFNULL(a.id_area, 0), COALESCE(NULLIF(TRIM(a.title_area), ''), 'Район не указан')
       ORDER BY visits DESC, schools DESC, areaName ASC
       LIMIT 8`,
      [monthFrom, today, ...hidden.params],
    ),
  ]);

  return {
    day,
    week,
    month,
    schools: schools.map((item) => ({
      schoolId: Number(item.schoolId),
      schoolName: item.schoolName,
      areaName: item.areaName,
      visits: Number(item.visits),
    })),
    areas: areas.map((item) => ({
      areaName: item.areaName,
      schools: Number(item.schools),
      visits: Number(item.visits),
    })),
  };
}
