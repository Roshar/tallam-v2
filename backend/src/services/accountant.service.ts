import { query } from "../db/pool.js";
import {
  ensureContractSettlementSchema,
  toSettlementRef,
  type SettlementFilter,
  type SettlementRef,
} from "./contract-settlement.service.js";
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
  afterIncident: boolean;
  activationDate: string | null;
  settlement: SettlementRef | null;
}


function isoDateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export interface AccountantStats {
  activated: number;
  paid: number;
  contracts: number;
  sinceSeptember: {
    purchased: number;
    paid: number;
    contracts: number;
    settlements: Array<{
      id: number;
      contractNumber: string | null;
      settlementDate: string;
      schools: number;
    }>;
  };
}

export async function getAccountantStats(): Promise<AccountantStats> {
  await ensureSubscriptionRenewalSchema();
  const hidden = hiddenSchoolFilter();
  const [activatedRows, paidRows, contractRows, periodRows, settlementRows] =
    await Promise.all([
    query<{ count: number }[]>(
      `SELECT COUNT(DISTINCT ss.school_id) AS count
       FROM school_subscriptions ss
       JOIN schools s ON s.id_school = ss.school_id
       WHERE ss.is_cancelled = 0
         AND ss.ends_on >= CURDATE()
         AND ${hidden.sql}`,
      hidden.params,
    ),
    query<{ count: number }[]>(
      `SELECT COUNT(*) AS count
       FROM subscription_renewal_requests rr
       JOIN schools s ON s.id_school = rr.school_id
       WHERE rr.status = 'paid' AND ${hidden.sql}`,
      hidden.params,
    ),
    query<{ count: number }[]>(
      `SELECT COUNT(*) AS count
       FROM subscription_renewal_requests rr
       JOIN schools s ON s.id_school = rr.school_id
       WHERE rr.status = 'paid'
         AND rr.contract_number IS NOT NULL
         AND ${hidden.sql}`,
      hidden.params,
    ),
    query<{ purchased: number; paid: number }[]>(
      `SELECT COUNT(*) AS purchased,
              SUM(rr.status = 'paid') AS paid
       FROM subscription_renewal_requests rr
       JOIN schools s ON s.id_school = rr.school_id
       WHERE rr.created_at >= '2026-09-01'
         AND ${hidden.sql}`,
      hidden.params,
    ),
    query<
      Array<{
        id: number;
        contractNumber: string | null;
        settlementDate: Date | string;
        schools: number;
      }>
    >(
      `SELECT cs.id,
              cs.contract_number AS contractNumber,
              cs.settlement_date AS settlementDate,
              COUNT(csi.id) AS schools
       FROM contract_settlements cs
       LEFT JOIN contract_settlement_items csi ON csi.settlement_id = cs.id
       WHERE cs.settlement_date >= '2026-08-31'
       GROUP BY cs.id, cs.contract_number, cs.settlement_date
       ORDER BY cs.settlement_date, cs.id`,
    ),
  ]);
  return {
    activated: Number(activatedRows[0]?.count ?? 0),
    paid: Number(paidRows[0]?.count ?? 0),
    contracts: Number(contractRows[0]?.count ?? 0),
    sinceSeptember: {
      purchased: Number(periodRows[0]?.purchased ?? 0),
      paid: Number(periodRows[0]?.paid ?? 0),
      contracts: settlementRows.length,
      settlements: settlementRows.map((row) => ({
        id: Number(row.id),
        contractNumber: row.contractNumber,
        settlementDate: isoDateOnly(row.settlementDate) ?? "",
        schools: Number(row.schools ?? 0),
      })),
    },
  };
}

export interface AccountantArea {
  id: number;
  title: string;
}

function likeTerm(search: string): string | null {
  const value = search.trim().slice(0, 100);
  return value ? `%${value}%` : null;
}

function filters(
  areaId: number,
  search: string,
  settlement: SettlementFilter,
  settlementId = 0,
) {
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
  if (settlement === "pending") conditions.push("csi.id IS NULL");
  if (settlement === "settled") conditions.push("csi.id IS NOT NULL");
  if (Number.isInteger(settlementId) && settlementId > 0) {
    conditions.push("csi.settlement_id = ?");
    params.push(settlementId);
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
    rr.contract_number AS contractNumber,
    COALESCE(
      (
        SELECT sma.paid_on
        FROM subscription_manual_activations sma
        WHERE sma.renewal_request_id = rr.id
          AND sma.is_after_incident = 1
        LIMIT 1
      ),
      rr.paid_at,
      rr.starts_on
    ) AS activationDate,
    EXISTS(
      SELECT 1 FROM subscription_manual_activations sma
      WHERE sma.renewal_request_id = rr.id AND sma.is_after_incident = 1
    ) AS afterIncident,
    cs.id AS settlementId,
    cs.contract_number AS settlementContractNumber,
    cs.settlement_date AS settlementDate
  FROM subscription_renewal_requests rr
  JOIN schools s ON s.id_school = rr.school_id
  LEFT JOIN area a ON a.id_area = s.area_id
  LEFT JOIN contract_settlement_items csi ON csi.renewal_request_id = rr.id
  LEFT JOIN contract_settlements cs ON cs.id = csi.settlement_id
`;

export async function listAccountantRenewals(input: {
  areaId: number;
  search: string;
  settlement?: SettlementFilter;
  settlementId?: number;
}): Promise<AccountantRenewalRow[]> {
  await ensureSubscriptionRenewalSchema();
  await ensureContractSettlementSchema();
  const { where, params } = filters(
    input.areaId,
    input.search,
    input.settlement ?? "all",
    input.settlementId ?? 0,
  );
  const rows = await query<
    Array<
      AccountantRenewalRow & {
        settlementId: number | null;
        settlementContractNumber: string | null;
        settlementDate: Date | string | null;
      }
    >
  >(
    `${LIST_SQL}
     WHERE ${where}
     ORDER BY activationDate DESC, rr.id DESC`,
    params,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    schoolName: row.schoolName,
    area: row.area,
    email: row.email,
    status: "paid",
    contractNumber: row.contractNumber,
    afterIncident: Boolean(row.afterIncident),
    activationDate: isoDateOnly(row.activationDate),
    settlement: toSettlementRef(row),
  }));
}

export async function findVisibleAccountantRenewal(
  requestId: number,
): Promise<(AccountantRenewalRow & { schoolId: number }) | null> {
  await ensureSubscriptionRenewalSchema();
  await ensureContractSettlementSchema();
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
    afterIncident: Boolean(row.afterIncident),
    activationDate: isoDateOnly(row.activationDate),
    settlement: null,
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
