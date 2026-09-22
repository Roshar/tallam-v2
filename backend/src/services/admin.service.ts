import { query } from "../db/pool.js";
import { config } from "../config.js";
import { ensureAuditLogSchema } from "./audit-log.service.js";
import {
  findLessonAnalysisProject,
  resolveProjectMiddlewareTable,
} from "./project.service.js";
import { getSchoolAccessState, syncSchoolCabinetAccess } from "./school-access.service.js";

interface CountRow {
  count: number;
}

interface RecentSchoolRow {
  id: number;
  name: string;
  area: string | null;
  email: string | null;
  status: "on" | "off" | "" | null;
}

interface SubscriptionStatsRow {
  total: number;
  active: number;
  expiring_soon: number;
  expired: number;
  starts_later: number;
}

export interface SubscriptionListRow {
  id: number | null;
  schoolId: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  accountStatus: "on" | "off" | "" | null;
  phone: string | null;
  startsOn: string | null;
  endsOn: string | null;
  subscriptionStatus:
    | "active"
    | "expiring"
    | "expired"
    | "scheduled"
    | "missing";
}

interface SubscriptionAreaRow {
  id: number;
  title: string;
}

interface AdminSchoolRow {
  id: number;
  name: string;
  area: string | null;
  email: string | null;
  accountStatus: "on" | "off" | "" | null;
}

interface AdminSchoolSubscriptionRow {
  id: number;
  startsOn: string;
  endsOn: string;
  phone: string | null;
  isCancelled: number;
  sourceLabel: string | null;
  note: string | null;
  createdAt: string;
  status: "active" | "expiring" | "expired" | "scheduled" | "cancelled";
}

interface AdminSchoolProjectRow {
  id: number;
  name: string;
}

interface AdminSchoolEvaluationYearRow {
  year: number;
  count: number;
  projectTeachers: number;
}

export type SubscriptionStatusFilter =
  | "all"
  | "active"
  | "expiring"
  | "expired"
  | "scheduled"
  | "missing"
  | "unpaid";

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const rows = await query<CountRow[]>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

const ONLINE_WINDOW_SECONDS = 5 * 60;

export async function countOnlineSchools(): Promise<number> {
  const lifetimeSec = Math.max(1, Math.round(config.session.lifetime / 1000));
  const minRemaining = Math.max(lifetimeSec - ONLINE_WINDOW_SECONDS, 0);

  try {
    return await count(
      `SELECT COUNT(DISTINCT CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.user.schoolId')) AS UNSIGNED)) AS count
       FROM sessions
       WHERE expires >= UNIX_TIMESTAMP() + ?
         AND JSON_VALID(data)
         AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.user.accountType')) = 'school'
         AND JSON_EXTRACT(data, '$.impersonator') IS NULL
         AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.user.schoolId')) AS UNSIGNED) > 0`,
      [minRemaining],
    );
  } catch (error) {
    console.error("Online schools count error:", error);
    return 0;
  }
}

export async function getAdminDashboard() {
  const currentYear = new Date().getFullYear();
  await syncSchoolCabinetAccess();

  const [
    schools,
    activeSchoolAccounts,
    blockedSchoolAccounts,
    teachers,
    evaluations,
    evaluationsCurrentYear,
    methodists,
    projects,
    recentSchools,
    subscriptionRows,
    onlineSchools,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS count FROM schools"),
    count(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'school_admin' AND status = 'on'",
    ),
    count(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'school_admin' AND status = 'off'",
    ),
    count("SELECT COUNT(*) AS count FROM teachers"),
    count("SELECT COUNT(*) AS count FROM card_from_project_teacher_mark3"),
    count(
      "SELECT COUNT(*) AS count FROM card_from_project_teacher_mark3 WHERE YEAR(create_mark_date) = ?",
      [currentYear],
    ),
    count("SELECT COUNT(*) AS count FROM methodists WHERE service = 1"),
    count("SELECT COUNT(*) AS count FROM projects WHERE id_project <> 1"),
    query<RecentSchoolRow[]>(
      `SELECT
         s.id_school AS id,
         s.school_name AS name,
         a.title_area AS area,
         u.email,
         u.status
       FROM schools s
       LEFT JOIN area a ON a.id_area = s.area_id
       LEFT JOIN users u
         ON u.school_id = s.id_school
        AND u.role = 'school_admin'
       ORDER BY s.id_school DESC
       LIMIT 5`,
    ),
    query<SubscriptionStatsRow[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(
           CASE
             WHEN CURDATE() BETWEEN starts_on AND ends_on THEN 1
             ELSE 0
           END
         ) AS active,
         SUM(
           CASE
             WHEN CURDATE() BETWEEN starts_on AND ends_on
              AND ends_on <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
             THEN 1
             ELSE 0
           END
         ) AS expiring_soon,
         SUM(CASE WHEN ends_on < CURDATE() THEN 1 ELSE 0 END) AS expired,
         SUM(CASE WHEN starts_on > CURDATE() THEN 1 ELSE 0 END) AS starts_later
       FROM (
         SELECT school_id, starts_on, ends_on
         FROM (
           SELECT
             school_id,
             starts_on,
             ends_on,
             ROW_NUMBER() OVER (
               PARTITION BY school_id
               ORDER BY ends_on DESC, id DESC
             ) AS subscription_rank
           FROM school_subscriptions
           WHERE is_cancelled = 0
         ) ranked
         WHERE subscription_rank = 1
       ) latest`,
    ),
    countOnlineSchools(),
  ]);

  const subscriptionStats = subscriptionRows[0];

  return {
    schools,
    activeSchoolAccounts,
    blockedSchoolAccounts,
    teachers,
    evaluations,
    evaluationsCurrentYear,
    methodists,
    projects,
    currentYear,
    onlineSchools,
    recentSchools,
    subscriptions: {
      total: Number(subscriptionStats?.total ?? 0),
      active: Number(subscriptionStats?.active ?? 0),
      expiringSoon: Number(subscriptionStats?.expiring_soon ?? 0),
      expired: Number(subscriptionStats?.expired ?? 0),
      startsLater: Number(subscriptionStats?.starts_later ?? 0),
    },
  };
}

const LATEST_SUBSCRIPTIONS_CTE = `
  WITH ranked_subscriptions AS (
    SELECT
      id,
      school_id,
      starts_on,
      ends_on,
      contact_phone,
      ROW_NUMBER() OVER (
        PARTITION BY school_id
        ORDER BY ends_on DESC, id DESC
      ) AS subscription_rank
    FROM school_subscriptions
    WHERE is_cancelled = 0
  ),
  latest_subscriptions AS (
    SELECT id, school_id, starts_on, ends_on, contact_phone
    FROM ranked_subscriptions
    WHERE subscription_rank = 1
  )
`;

function subscriptionStatusCondition(status: SubscriptionStatusFilter) {
  switch (status) {
    case "active":
      return "ss.id IS NOT NULL AND CURDATE() BETWEEN ss.starts_on AND ss.ends_on";
    case "expiring":
      return `ss.id IS NOT NULL
        AND CURDATE() BETWEEN ss.starts_on AND ss.ends_on
        AND ss.ends_on <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`;
    case "expired":
      return "ss.id IS NOT NULL AND ss.ends_on < CURDATE()";
    case "scheduled":
      return "ss.id IS NOT NULL AND ss.starts_on > CURDATE()";
    case "missing":
      return "ss.id IS NULL";
    case "unpaid":
      return `u.id IS NOT NULL
        AND IFNULL(u.status, '') <> 'on'
        AND (ss.id IS NULL OR ss.ends_on < CURDATE())`;
    default:
      return "1 = 1";
  }
}

export async function getAdminSubscriptions(input: {
  page: number;
  limit: number;
  search: string;
  status: SubscriptionStatusFilter;
  areaId: number | null;
}) {
  await syncSchoolCabinetAccess();
  const page = Math.max(1, input.page);
  const limit = Math.min(100, Math.max(10, input.limit));
  const offset = (page - 1) * limit;
  const params: Array<string | number> = [];
  const conditions = [subscriptionStatusCondition(input.status)];

  if (input.areaId) {
    conditions.push("s.area_id = ?");
    params.push(input.areaId);
  }

  if (input.search) {
    const search = `%${input.search.trim()}%`;
    conditions.push(`(
      s.school_name LIKE ?
      OR a.title_area LIKE ?
      OR u.email LIKE ?
      OR ss.contact_phone LIKE ?
    )`);
    params.push(search, search, search, search);
  }

  const fromAndWhere = `
    FROM schools s
    LEFT JOIN latest_subscriptions ss ON ss.school_id = s.id_school
    LEFT JOIN area a ON a.id_area = s.area_id
    LEFT JOIN users u
      ON u.school_id = s.id_school
     AND u.role = 'school_admin'
    WHERE ${conditions.join(" AND ")}
  `;

  const [rows, countRows] = await Promise.all([
    query<SubscriptionListRow[]>(
      `${LATEST_SUBSCRIPTIONS_CTE}
       SELECT
         ss.id,
         s.id_school AS schoolId,
         s.school_name AS schoolName,
         a.title_area AS area,
         u.email,
         u.status AS accountStatus,
         ss.contact_phone AS phone,
         DATE_FORMAT(ss.starts_on, '%Y-%m-%d') AS startsOn,
         DATE_FORMAT(ss.ends_on, '%Y-%m-%d') AS endsOn,
         CASE
           WHEN ss.id IS NULL THEN 'missing'
           WHEN ss.starts_on > CURDATE() THEN 'scheduled'
           WHEN ss.ends_on < CURDATE() THEN 'expired'
           WHEN ss.ends_on <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
             THEN 'expiring'
           ELSE 'active'
         END AS subscriptionStatus
       ${fromAndWhere}
       ORDER BY
         CASE
           WHEN ss.id IS NULL THEN 3
           WHEN ss.ends_on < CURDATE() THEN 2
           WHEN ss.starts_on > CURDATE() THEN 1
           ELSE 0
         END,
         ss.ends_on ASC,
         s.school_name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    query<CountRow[]>(
      `${LATEST_SUBSCRIPTIONS_CTE}
       SELECT COUNT(*) AS count
       ${fromAndWhere}`,
      params,
    ),
  ]);

  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getAdminSubscriptionAreas() {
  return query<SubscriptionAreaRow[]>(
    `SELECT DISTINCT a.id_area AS id, a.title_area AS title
     FROM schools s
     JOIN area a ON a.id_area = s.area_id
     ORDER BY a.title_area ASC`,
  );
}

export type SchoolCabinetStatusFilter = "all" | "active" | "blocked" | "none";

export interface AdminSchoolListRow {
  schoolId: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  accountStatus: "on" | "off" | "" | null;
  cabinetStatus: "active" | "blocked" | "none";
  teachersCount: number;
}

function schoolCabinetStatusCondition(status: SchoolCabinetStatusFilter) {
  switch (status) {
    case "active":
      return "u.status = 'on'";
    case "blocked":
      return "u.id IS NOT NULL AND u.status <> 'on'";
    case "none":
      return "u.id IS NULL";
    default:
      return "1 = 1";
  }
}

export async function getAdminSchools(input: {
  page: number;
  limit: number;
  search: string;
  areaId: number | null;
  cabinetStatus: SchoolCabinetStatusFilter;
}) {
  const page = Math.max(1, input.page);
  const limit = Math.min(100, Math.max(10, input.limit));
  const offset = (page - 1) * limit;
  const params: Array<string | number> = [];
  const conditions = [schoolCabinetStatusCondition(input.cabinetStatus)];

  if (input.areaId) {
    conditions.push("s.area_id = ?");
    params.push(input.areaId);
  }

  if (input.search) {
    const search = `%${input.search.trim()}%`;
    conditions.push(`(
      s.school_name LIKE ?
      OR a.title_area LIKE ?
      OR u.email LIKE ?
    )`);
    params.push(search, search, search);
  }

  const fromAndWhere = `
    FROM schools s
    LEFT JOIN area a ON a.id_area = s.area_id
    LEFT JOIN users u
      ON u.id = (
        SELECT u2.id
        FROM users u2
        WHERE u2.school_id = s.id_school
          AND u2.role = 'school_admin'
        ORDER BY u2.status = 'on' DESC, u2.id ASC
        LIMIT 1
      )
    WHERE ${conditions.join(" AND ")}
  `;

  const [rows, countRows] = await Promise.all([
    query<AdminSchoolListRow[]>(
      `SELECT
         s.id_school AS schoolId,
         s.school_name AS schoolName,
         a.title_area AS area,
         u.email,
         u.status AS accountStatus,
         CASE
           WHEN u.id IS NULL THEN 'none'
           WHEN u.status = 'on' THEN 'active'
           ELSE 'blocked'
         END AS cabinetStatus,
         (
           SELECT COUNT(*)
           FROM teachers th
           WHERE th.school_id = s.id_school
         ) AS teachersCount
       ${fromAndWhere}
       ORDER BY a.title_area ASC, s.school_name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    query<CountRow[]>(
      `SELECT COUNT(DISTINCT s.id_school) AS count ${fromAndWhere}`,
      params,
    ),
  ]);

  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows.map((row) => ({
      ...row,
      schoolId: Number(row.schoolId),
      teachersCount: Number(row.teachersCount),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function countLessonAnalysisTeachers(schoolId: number): Promise<number> {
  const project = await findLessonAnalysisProject(schoolId);
  if (!project) return 0;
  const table = await resolveProjectMiddlewareTable(project.id_project);
  if (!table) return 0;
  const safeTable = table.replace(/[^a-z0-9_]/gi, "");
  if (safeTable !== table) return 0;
  return count(
    `SELECT COUNT(*) AS count
     FROM \`${safeTable}\` m
     INNER JOIN teachers t ON t.id_teacher = m.teacher_id
     WHERE t.school_id = ?
       AND m.in_project_status = 2
       AND m.project_id = ?`,
    [schoolId, project.id_project],
  );
}

async function getSchoolLastLoginAt(
  schoolId: number,
  email: string | null,
): Promise<string | null> {
  await ensureAuditLogSchema();
  const params: Array<string | number> = [schoolId];
  let emailClause = "";
  if (email) {
    emailClause = "OR actor_email = ?";
    params.push(email.trim().toLowerCase());
  }
  const rows = await query<{ lastLoginAt: string }[]>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS lastLoginAt
     FROM audit_logs
     WHERE action = 'auth.login'
       AND status = 'success'
       AND (school_id = ? ${emailClause})
     ORDER BY created_at DESC
     LIMIT 1`,
    params,
  );
  return rows[0]?.lastLoginAt ?? null;
}

function pickCurrentSubscription(
  subscriptions: AdminSchoolSubscriptionRow[],
) {
  const live = subscriptions.filter(
    (subscription) => Number(subscription.isCancelled) === 0,
  );
  return (
    live.find(
      (subscription) =>
        subscription.status === "active" || subscription.status === "expiring",
    ) ??
    live.find((subscription) => subscription.status === "scheduled") ??
    live[0] ??
    null
  );
}

export async function getAdminSchoolDetail(schoolId: number) {
  await syncSchoolCabinetAccess(schoolId);

  const schoolRows = await query<AdminSchoolRow[]>(
    `SELECT
       s.id_school AS id,
       s.school_name AS name,
       a.title_area AS area,
       u.email,
       u.status AS accountStatus
     FROM schools s
     LEFT JOIN area a ON a.id_area = s.area_id
     LEFT JOIN users u
       ON u.school_id = s.id_school
      AND u.role = 'school_admin'
     WHERE s.id_school = ?
     ORDER BY u.id ASC
     LIMIT 1`,
    [schoolId],
  );

  const school = schoolRows[0];
  if (!school) return null;

  const currentYear = new Date().getFullYear();
  const [
    teachers,
    evaluations,
    evaluationsCurrentYear,
    subscriptions,
    projects,
    years,
    projectTeachers,
    lastLoginAt,
  ] = await Promise.all([
      count("SELECT COUNT(*) AS count FROM teachers WHERE school_id = ?", [
        schoolId,
      ]),
      count(
        "SELECT COUNT(*) AS count FROM card_from_project_teacher_mark3 WHERE school_id = ?",
        [schoolId],
      ),
      count(
        `SELECT COUNT(*) AS count
         FROM card_from_project_teacher_mark3
         WHERE school_id = ? AND YEAR(create_mark_date) = ?`,
        [schoolId, currentYear],
      ),
      query<AdminSchoolSubscriptionRow[]>(
        `SELECT
           id,
           DATE_FORMAT(starts_on, '%Y-%m-%d') AS startsOn,
           DATE_FORMAT(ends_on, '%Y-%m-%d') AS endsOn,
           contact_phone AS phone,
           is_cancelled AS isCancelled,
           source_label AS sourceLabel,
           note,
           DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
           CASE
             WHEN is_cancelled = 1 THEN 'cancelled'
             WHEN starts_on > CURDATE() THEN 'scheduled'
             WHEN ends_on < CURDATE() THEN 'expired'
             WHEN ends_on <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
               THEN 'expiring'
             ELSE 'active'
           END AS status
         FROM school_subscriptions
         WHERE school_id = ?
         ORDER BY ends_on DESC, id DESC`,
        [schoolId],
      ),
      query<AdminSchoolProjectRow[]>(
        `SELECT DISTINCT p.id_project AS id, p.name_project AS name
         FROM middleware_project_school mps
         JOIN projects p ON p.id_project = mps.project_id
         WHERE mps.school_id = ? AND p.id_project > 1
         ORDER BY p.name_project ASC`,
        [schoolId],
      ),
      query<AdminSchoolEvaluationYearRow[]>(
        `SELECT
           YEAR(create_mark_date) AS year,
           COUNT(*) AS count,
           COUNT(DISTINCT teacher_id) AS projectTeachers
         FROM card_from_project_teacher_mark3
         WHERE school_id = ?
           AND YEAR(create_mark_date) BETWEEN ? AND ?
         GROUP BY YEAR(create_mark_date)
         ORDER BY year DESC`,
        [schoolId, currentYear - 1, currentYear],
      ),
      countLessonAnalysisTeachers(schoolId),
      getSchoolLastLoginAt(schoolId, school.email),
    ]);

  const yearsByKey = new Map(
    years.map((item) => [
      Number(item.year),
      {
        evaluations: Number(item.count),
        projectTeachers: Number(item.projectTeachers),
      },
    ]),
  );
  const access = await getSchoolAccessState(schoolId);
  const yearlyActivity = [currentYear, currentYear - 1].map((year) => ({
    year,
    evaluations: yearsByKey.get(year)?.evaluations ?? 0,
    projectTeachers: yearsByKey.get(year)?.projectTeachers ?? 0,
  }));

  return {
    school,
    access,
    lastLoginAt,
    stats: {
      teachers,
      projectTeachers,
      evaluations,
      evaluationsCurrentYear,
      projects: projects.length,
      currentYear,
    },
    currentSubscription: pickCurrentSubscription(subscriptions),
    subscriptions,
    projects,
    yearlyActivity,
    evaluationsByYear: yearlyActivity.map((item) => ({
      year: item.year,
      count: item.evaluations,
    })),
  };
}
