import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool, query } from "../db/pool.js";

const HIDDEN_SCHOOL_EMAILS = [
  "test@test.ru",
  "test2@test.ru",
  "test3@test.ru",
  "v2.newschool@tallam.test",
];

const MAX_SCHOOLS = 500;

export type SettlementFilter = "all" | "pending" | "settled";

export interface SettlementRef {
  id: number;
  contractNumber: string | null;
  settlementDate: string;
  label: string;
}

export class SettlementInputError extends Error {}
export class SettlementConflictError extends Error {}

let schemaReady: Promise<void> | null = null;

export async function ensureContractSettlementSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS contract_settlements (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          contract_number varchar(50) DEFAULT NULL,
          settlement_date date NOT NULL,
          created_by varchar(255) NOT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_contract_settlements_date (settlement_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS contract_settlement_items (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          settlement_id bigint(20) UNSIGNED NOT NULL,
          renewal_request_id bigint(20) UNSIGNED NOT NULL,
          school_id bigint(20) UNSIGNED NOT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_settlement_item_renewal (renewal_request_id),
          KEY idx_settlement_items_settlement (settlement_id),
          KEY idx_settlement_items_school (school_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export function parseSettlementFilter(value: string): SettlementFilter {
  if (value === "pending" || value === "settled") return value;
  return "all";
}

export function moscowToday(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function settlementLabel(
  contractNumber: string | null,
  settlementDate: string,
): string {
  const [year, month, day] = settlementDate.split("-");
  const formatted = `${day}.${month}.${year}`;
  const number = contractNumber?.trim();
  if (!number) return `б/н от ${formatted}`;
  return `№ ${number} от ${formatted}`;
}

function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function hiddenSchoolSql(schoolIdSql = "s.id_school") {
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

function parseContractNumber(value: unknown): string | null {
  const text = String(value ?? "").trim().slice(0, 50);
  if (!text) return null;
  if (/[\u0000-\u001f]/.test(text)) {
    throw new SettlementInputError("Номер договора содержит недопустимые символы");
  }
  return text;
}

function parseSettlementDate(value: unknown): string {
  const text = String(value ?? "").trim() || moscowToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new SettlementInputError("Укажите дату расчёта");
  }
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new SettlementInputError("Укажите дату расчёта");
  }
  return text;
}

function parseRenewalIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new SettlementInputError("Выберите школы для расчёта");
  }
  const ids = [...new Set(value.map((item) => Number(item)))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (ids.length === 0) {
    throw new SettlementInputError("Выберите школы для расчёта");
  }
  if (ids.length > MAX_SCHOOLS) {
    throw new SettlementInputError(`За один раз можно оформить не больше ${MAX_SCHOOLS} школ`);
  }
  return ids;
}

interface PaidRenewalRow extends RowDataPacket {
  id: number;
  schoolId: number;
}

export async function createContractSettlement(input: {
  renewalIds: unknown;
  contractNumber: unknown;
  settlementDate: unknown;
  createdBy: string;
}): Promise<SettlementRef & { schoolCount: number }> {
  await ensureContractSettlementSchema();
  const renewalIds = parseRenewalIds(input.renewalIds);
  const contractNumber = parseContractNumber(input.contractNumber);
  const settlementDate = parseSettlementDate(input.settlementDate);
  const createdBy = input.createdBy.trim().slice(0, 255) || "accountant";
  const hidden = hiddenSchoolSql();
  const placeholders = renewalIds.map(() => "?").join(", ");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [found] = await connection.query<PaidRenewalRow[]>(
      `SELECT rr.id, rr.school_id AS schoolId
       FROM subscription_renewal_requests rr
       JOIN schools s ON s.id_school = rr.school_id
       WHERE rr.status = 'paid'
         AND rr.id IN (${placeholders})
         AND ${hidden.sql}`,
      [...renewalIds, ...hidden.params],
    );
    if (found.length !== renewalIds.length) {
      throw new SettlementInputError(
        "Можно оформить расчёт только по оплаченным школам из списка",
      );
    }

    const [header] = await connection.query<ResultSetHeader>(
      `INSERT INTO contract_settlements (contract_number, settlement_date, created_by)
       VALUES (?, ?, ?)`,
      [contractNumber, settlementDate, createdBy],
    );
    const settlementId = Number(header.insertId);
    const values = found.map(() => "(?, ?, ?)").join(", ");
    const params = found.flatMap((row) => [
      settlementId,
      Number(row.id),
      Number(row.schoolId),
    ]);
    await connection.query<ResultSetHeader>(
      `INSERT INTO contract_settlement_items
         (settlement_id, renewal_request_id, school_id)
       VALUES ${values}`,
      params,
    );
    await connection.commit();
    return {
      id: settlementId,
      contractNumber,
      settlementDate,
      label: settlementLabel(contractNumber, settlementDate),
      schoolCount: found.length,
    };
  } catch (error) {
    await connection.rollback();
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new SettlementConflictError(
        "Одна из выбранных школ уже входит в расчёт",
      );
    }
    throw error;
  } finally {
    connection.release();
  }
}

export interface SettlementSchoolRow {
  renewalId: number;
  schoolId: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  settlement: SettlementRef | null;
}

export interface SettlementSummary {
  paid: number;
  settled: number;
  waiting: number;
}

function settlementFromRow(row: {
  settlementId: number | null;
  settlementContractNumber: string | null;
  settlementDate: Date | string | null;
}): SettlementRef | null {
  const date = dateOnly(row.settlementDate);
  if (!row.settlementId || !date) return null;
  const contractNumber = row.settlementContractNumber?.trim() || null;
  return {
    id: Number(row.settlementId),
    contractNumber,
    settlementDate: date,
    label: settlementLabel(contractNumber, date),
  };
}

const PAID_LIST_SQL = `
  SELECT
    rr.id AS renewalId,
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
    cs.id AS settlementId,
    cs.contract_number AS settlementContractNumber,
    cs.settlement_date AS settlementDate
  FROM subscription_renewal_requests rr
  JOIN schools s ON s.id_school = rr.school_id
  LEFT JOIN area a ON a.id_area = s.area_id
  LEFT JOIN contract_settlement_items csi ON csi.renewal_request_id = rr.id
  LEFT JOIN contract_settlements cs ON cs.id = csi.settlement_id
`;

export async function listPaidSettlements(input: {
  filter: SettlementFilter;
  search?: string;
}): Promise<{ summary: SettlementSummary; items: SettlementSchoolRow[] }> {
  await ensureContractSettlementSchema();
  const hidden = hiddenSchoolSql();
  const summaryRows = await query<Array<{ paid: number; settled: number }>>(
    `SELECT
       COUNT(*) AS paid,
       SUM(csi.id IS NOT NULL) AS settled
     FROM subscription_renewal_requests rr
     JOIN schools s ON s.id_school = rr.school_id
     LEFT JOIN contract_settlement_items csi ON csi.renewal_request_id = rr.id
     WHERE rr.status = 'paid' AND ${hidden.sql}`,
    hidden.params,
  );
  const paid = Number(summaryRows[0]?.paid ?? 0);
  const settled = Number(summaryRows[0]?.settled ?? 0);

  const conditions = ["rr.status = 'paid'", hidden.sql];
  const params: unknown[] = [...hidden.params];
  if (input.filter === "pending") conditions.push("csi.id IS NULL");
  if (input.filter === "settled") conditions.push("csi.id IS NOT NULL");
  const like = input.search?.trim().slice(0, 100);
  if (like) {
    conditions.push("s.school_name LIKE ?");
    params.push(`%${like}%`);
  }

  const rows = await query<
    Array<{
      renewalId: number;
      schoolId: number;
      schoolName: string;
      area: string | null;
      email: string | null;
      settlementId: number | null;
      settlementContractNumber: string | null;
      settlementDate: Date | string | null;
    }>
  >(
    `${PAID_LIST_SQL}
     WHERE ${conditions.join(" AND ")}
     ORDER BY rr.paid_at DESC, rr.id DESC`,
    params,
  );

  return {
    summary: { paid, settled, waiting: Math.max(0, paid - settled) },
    items: rows.map((row) => ({
      renewalId: Number(row.renewalId),
      schoolId: Number(row.schoolId),
      schoolName: row.schoolName,
      area: row.area,
      email: row.email,
      settlement: settlementFromRow(row),
    })),
  };
}

export interface SettlementDetail {
  id: number;
  contractNumber: string | null;
  settlementDate: string;
  label: string;
  createdBy: string;
  createdAt: string;
  schools: Array<{
    renewalId: number;
    schoolId: number;
    schoolName: string;
    area: string | null;
    email: string | null;
  }>;
}

export async function getContractSettlement(
  settlementId: number,
): Promise<SettlementDetail | null> {
  await ensureContractSettlementSchema();
  const headers = await query<
    Array<{
      id: number;
      contractNumber: string | null;
      settlementDate: Date | string;
      createdBy: string;
      createdAt: Date | string;
    }>
  >(
    `SELECT id, contract_number AS contractNumber, settlement_date AS settlementDate,
            created_by AS createdBy, created_at AS createdAt
     FROM contract_settlements
     WHERE id = ?
     LIMIT 1`,
    [settlementId],
  );
  const header = headers[0];
  const settlementDate = header ? dateOnly(header.settlementDate) : null;
  if (!header || !settlementDate) return null;

  const schools = await query<
    Array<{
      renewalId: number;
      schoolId: number;
      schoolName: string;
      area: string | null;
      email: string | null;
    }>
  >(
    `SELECT
       csi.renewal_request_id AS renewalId,
       s.id_school AS schoolId,
       s.school_name AS schoolName,
       a.title_area AS area,
       (
         SELECT u.email
         FROM users u
         WHERE u.school_id = s.id_school AND u.role = 'school_admin'
         ORDER BY u.status = 'on' DESC, u.id ASC
         LIMIT 1
       ) AS email
     FROM contract_settlement_items csi
     JOIN schools s ON s.id_school = csi.school_id
     LEFT JOIN area a ON a.id_area = s.area_id
     WHERE csi.settlement_id = ?
     ORDER BY s.school_name`,
    [settlementId],
  );

  const createdAt =
    header.createdAt instanceof Date
      ? header.createdAt.toISOString()
      : new Date(header.createdAt).toISOString();
  const contractNumber = header.contractNumber?.trim() || null;

  return {
    id: Number(header.id),
    contractNumber,
    settlementDate,
    label: settlementLabel(contractNumber, settlementDate),
    createdBy: header.createdBy,
    createdAt,
    schools: schools.map((school) => ({
      renewalId: Number(school.renewalId),
      schoolId: Number(school.schoolId),
      schoolName: school.schoolName,
      area: school.area,
      email: school.email,
    })),
  };
}

export function toSettlementRef(row: {
  settlementId: number | null;
  settlementContractNumber: string | null;
  settlementDate: Date | string | null;
}): SettlementRef | null {
  return settlementFromRow(row);
}
