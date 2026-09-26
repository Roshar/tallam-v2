import { query } from "../db/pool.js";
import { ensureSubscriptionRenewalSchema } from "./subscription-renewal.service.js";

export const ACCOUNTANT_ARCHIVE_LIMIT = 200;

const HIDDEN_SCHOOL_EMAILS = [
  "test@test.ru",
  "test2@test.ru",
  "test3@test.ru",
  "v2.newschool@tallam.test",
];

function hiddenSchoolFilter(schoolIdSql = "s.id_school") {
  const placeholders = HIDDEN_SCHOOL_EMAILS.map(() => "?").join(", ");
  return {
    sql: `NOT EXISTS (
      SELECT 1
      FROM users u
      WHERE u.school_id = ${schoolIdSql}
        AND u.role = 'school_admin'
        AND LOWER(u.email) IN (${placeholders})
    )`,
    params: [...HIDDEN_SCHOOL_EMAILS],
  };
}

export interface AccountantRenewalRow {
  id: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  status: "paid";
  contractNumber: string | null;
}

export interface AccountantArea {
  id: number;
  title: string;
}

function likeTerm(search: string): string | null {
  const value = search.trim().slice(0, 100);
  return value ? `%${value}%` : null;
}

function filters(areaId: number, search: string) {
  const hidden = hiddenSchoolFilter();
  const conditions = ["rr.status = 'paid'", hidden.sql];
  const params: unknown[] = [...hidden.params];
  if (Number.isInteger(areaId) && areaId > 0) {
    conditions.push("s.area_id = ?");
    params.push(areaId);
  }
  const like = likeTerm(search);
  if (like) {
    conditions.push("s.school_name LIKE ?");
    params.push(like);
  }
  return { where: conditions.join(" AND "), params };
}

const LIST_SQL = `
  SELECT
    rr.id,
    s.id_school AS schoolId,
    s.school_name AS schoolName,
    a.title_area AS area,
    (
      SELECT u.email
      FROM users u
      WHERE u.school_id = s.id_school AND u.role = 'school_admin'
      ORDER BY u.status = 'on' DESC, u.id ASC
      LIMIT 1
    ) AS email,
    rr.status,
    rr.contract_number AS contractNumber
  FROM subscription_renewal_requests rr
  JOIN schools s ON s.id_school = rr.school_id
  LEFT JOIN area a ON a.id_area = s.area_id
`;

export async function listAccountantRenewals(input: {
  areaId: number;
  search: string;
}): Promise<AccountantRenewalRow[]> {
  await ensureSubscriptionRenewalSchema();
  const { where, params } = filters(input.areaId, input.search);
  const rows = await query<AccountantRenewalRow[]>(
    `${LIST_SQL}
     WHERE ${where}
     ORDER BY rr.paid_at DESC, rr.id DESC`,
    params,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    schoolName: row.schoolName,
    area: row.area,
    email: row.email,
    status: "paid",
    contractNumber: row.contractNumber,
  }));
}

export async function findVisibleAccountantRenewal(
  requestId: number,
): Promise<(AccountantRenewalRow & { schoolId: number }) | null> {
  await ensureSubscriptionRenewalSchema();
  const hidden = hiddenSchoolFilter();
  const rows = await query<(AccountantRenewalRow & { schoolId: number })[]>(
    `${LIST_SQL}
     WHERE rr.id = ? AND rr.status = 'paid' AND ${hidden.sql}
     LIMIT 1`,
    [requestId, ...hidden.params],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    schoolId: Number(row.schoolId),
    schoolName: row.schoolName,
    area: row.area,
    email: row.email,
    status: "paid",
    contractNumber: row.contractNumber,
  };
}

export async function listAccountantAreas(): Promise<AccountantArea[]> {
  await ensureSubscriptionRenewalSchema();
  const hidden = hiddenSchoolFilter();
  const rows = await query<{ id: number; title: string }[]>(
    `SELECT DISTINCT a.id_area AS id, a.title_area AS title
     FROM area a
     JOIN schools s ON s.area_id = a.id_area
     JOIN subscription_renewal_requests rr
       ON rr.school_id = s.id_school AND rr.status = 'paid'
     WHERE ${hidden.sql}
     ORDER BY a.title_area`,
    hidden.params,
  );
  return rows.map((row) => ({ id: Number(row.id), title: row.title }));
}
