import crypto from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { config } from "../config.js";
import { pool, query } from "../db/pool.js";
import { getSchoolName } from "./auth.service.js";
import { syncSchoolCabinetAccess } from "./school-access.service.js";

export type RenewalStatus =
  | "pending"
  | "documents_ready"
  | "paid"
  | "cancelled";

export interface RenewalCustomerData {
  fullName: string;
  phone: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssuedOn: string;
  divisionCode: string;
  residentialAddress: string;
  inn: string;
}

export interface RenewalRequest {
  id: number;
  schoolId: number;
  schoolName: string;
  status: RenewalStatus;
  contractNumber: string | null;
  invoiceNumber: string | null;
  issuedOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  consentAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: RenewalCustomerData;
}

export interface RenewalListItem {
  id: number;
  schoolId: number;
  schoolName: string;
  area: string | null;
  status: RenewalStatus;
  customerName: string;
  contractNumber: string | null;
  invoiceNumber: string | null;
  issuedOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface RenewalRow extends RowDataPacket {
  id: number;
  schoolId: number;
  schoolName: string;
  status: RenewalStatus;
  customerCiphertext: string;
  customerIv: string;
  customerAuthTag: string;
  contractNumber: string | null;
  invoiceNumber: string | null;
  issuedOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  consentAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  area?: string | null;
}

interface PeriodEndRow {
  latestEnd: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const encryptionKey = crypto
  .createHash("sha256")
  .update(config.subscriptionDataEncryptionKey)
  .digest();
let schemaReady: Promise<void> | null = null;

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addYearsMinusOneDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() - 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addOneDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

interface DocumentNumbers {
  contractNumber: string;
  invoiceNumber: string;
  issuedOn: string;
}

async function allocateDocumentNumbers(
  connection: PoolConnection,
  issuedOn = todayIso(),
): Promise<DocumentNumbers> {
  const periodLabel = issuedOn.slice(0, 7);
  await connection.query(
    `INSERT IGNORE INTO subscription_document_sequences (
       period_key, last_number
     ) VALUES ('global', 0)`,
  );
  const [sequenceRows] = await connection.query<
    (RowDataPacket & { last_number: number })[]
  >(
    `SELECT last_number
     FROM subscription_document_sequences
     WHERE period_key = 'global'
     FOR UPDATE`,
  );
  const nextNumber = Number(sequenceRows[0]?.last_number ?? 0) + 1;
  await connection.query(
    `UPDATE subscription_document_sequences
     SET last_number = ?
     WHERE period_key = 'global'`,
    [nextNumber],
  );
  const serial = String(nextNumber).padStart(4, "0");
  return {
    contractNumber: `Д-${periodLabel}-${serial}`,
    invoiceNumber: `С-${periodLabel}-${serial}`,
    issuedOn,
  };
}

export async function ensureRequestHasDocumentNumbers(
  requestId: number,
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<
      (RowDataPacket & {
        status: RenewalStatus;
        contractNumber: string | null;
        invoiceNumber: string | null;
        issuedOn: string | null;
      })[]
    >(
      `SELECT
         status,
         contract_number AS contractNumber,
         invoice_number AS invoiceNumber,
         DATE_FORMAT(issued_on, '%Y-%m-%d') AS issuedOn
       FROM subscription_renewal_requests
       WHERE id = ?
       FOR UPDATE`,
      [requestId],
    );
    const row = rows[0];
    if (
      !row ||
      row.status === "cancelled" ||
      (row.contractNumber && row.invoiceNumber)
    ) {
      await connection.commit();
      return;
    }

    const numbers = await allocateDocumentNumbers(
      connection,
      row.issuedOn || todayIso(),
    );
    await connection.query(
      `UPDATE subscription_renewal_requests
       SET contract_number = COALESCE(contract_number, ?),
           invoice_number = COALESCE(invoice_number, ?),
           issued_on = COALESCE(issued_on, ?)
       WHERE id = ?`,
      [numbers.contractNumber, numbers.invoiceNumber, numbers.issuedOn, requestId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ensureUniqueDocumentIndexes() {
  const indexes = await query<{ Key_name: string }[]>(
    `SHOW INDEX FROM subscription_renewal_requests`,
  );
  const names = new Set(indexes.map((item) => item.Key_name));
  if (!names.has("uq_renewal_contract_number")) {
    await query(
      `ALTER TABLE subscription_renewal_requests
       ADD UNIQUE KEY uq_renewal_contract_number (contract_number)`,
    );
  }
  if (!names.has("uq_renewal_invoice_number")) {
    await query(
      `ALTER TABLE subscription_renewal_requests
       ADD UNIQUE KEY uq_renewal_invoice_number (invoice_number)`,
    );
  }
}

function validIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const normalized = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return normalized === value;
}

function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  let normalized = digits;
  if (normalized.length === 10 && normalized.startsWith("9")) {
    normalized = `7${normalized}`;
  }
  if (normalized.length === 11 && normalized.startsWith("8")) {
    normalized = `7${normalized.slice(1)}`;
  }
  if (!/^7\d{10}$/.test(normalized)) {
    throw new Error("Укажите корректный номер телефона");
  }
  return `+7 ${normalized.slice(1, 4)} ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9)}`;
}

function validateInn(value: string): boolean {
  if (!/^\d{12}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const firstWeights = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const secondWeights = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const first =
    (firstWeights.reduce((sum, weight, index) => sum + weight * digits[index]!, 0) %
      11) %
    10;
  const second =
    (secondWeights.reduce(
      (sum, weight, index) => sum + weight * digits[index]!,
      0,
    ) %
      11) %
    10;
  return first === digits[10] && second === digits[11];
}

function normalizeText(
  value: unknown,
  label: string,
  minLength: number,
  maxLength: number,
): string {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (normalized.length < minLength) {
    throw new Error(`Заполните поле «${label}»`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`Поле «${label}» слишком длинное`);
  }
  return normalized;
}

export function validateRenewalCustomerData(
  input: Partial<RenewalCustomerData>,
): RenewalCustomerData {
  const passportSeries = String(input.passportSeries ?? "").replace(/\D/g, "");
  const passportNumber = String(input.passportNumber ?? "").replace(/\D/g, "");
  const divisionDigits = String(input.divisionCode ?? "").replace(/\D/g, "");
  const inn = String(input.inn ?? "").replace(/\D/g, "");
  const passportIssuedOn = String(input.passportIssuedOn ?? "").trim();

  if (passportSeries.length !== 4) {
    throw new Error("Серия паспорта должна содержать 4 цифры");
  }
  if (passportNumber.length !== 6) {
    throw new Error("Номер паспорта должен содержать 6 цифр");
  }
  if (!validIsoDate(passportIssuedOn) || passportIssuedOn > todayIso()) {
    throw new Error("Укажите корректную дату выдачи паспорта");
  }
  if (divisionDigits.length !== 6) {
    throw new Error("Код подразделения должен содержать 6 цифр");
  }
  if (!validateInn(inn)) {
    throw new Error("Укажите корректный ИНН физического лица из 12 цифр");
  }

  return {
    fullName: normalizeText(input.fullName, "ФИО", 5, 200),
    phone: normalizePhone(input.phone),
    passportSeries,
    passportNumber,
    passportIssuedBy: normalizeText(
      input.passportIssuedBy,
      "Кем выдан паспорт",
      5,
      500,
    ),
    passportIssuedOn,
    divisionCode: `${divisionDigits.slice(0, 3)}-${divisionDigits.slice(3)}`,
    residentialAddress: normalizeText(
      input.residentialAddress,
      "Адрес проживания",
      8,
      500,
    ),
    inn,
  };
}

function encryptCustomer(customer: RenewalCustomerData): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(customer), "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptCustomer(row: RenewalRow): RenewalCustomerData {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(row.customerIv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.customerAuthTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.customerCiphertext, "base64")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(plaintext.toString("utf8")) as Partial<RenewalCustomerData>;
  return {
    fullName: parsed.fullName ?? "",
    phone: parsed.phone ?? "",
    passportSeries: parsed.passportSeries ?? "",
    passportNumber: parsed.passportNumber ?? "",
    passportIssuedBy: parsed.passportIssuedBy ?? "",
    passportIssuedOn: parsed.passportIssuedOn ?? "",
    divisionCode: parsed.divisionCode ?? "",
    residentialAddress: parsed.residentialAddress ?? "",
    inn: parsed.inn ?? "",
  };
}

export async function ensureSubscriptionRenewalSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS subscription_renewal_requests (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          school_id bigint(20) UNSIGNED NOT NULL,
          customer_ciphertext longtext NOT NULL,
          customer_iv varchar(64) NOT NULL,
          customer_auth_tag varchar(64) NOT NULL,
          status enum('pending','documents_ready','paid','cancelled')
            NOT NULL DEFAULT 'pending',
          contract_number varchar(50) DEFAULT NULL,
          invoice_number varchar(50) DEFAULT NULL,
          issued_on date DEFAULT NULL,
          starts_on date DEFAULT NULL,
          ends_on date DEFAULT NULL,
          consent_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          paid_at timestamp NULL DEFAULT NULL,
          processed_by_user_id bigint(20) UNSIGNED DEFAULT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_renewal_school_created (school_id, created_at),
          KEY idx_renewal_status_created (status, created_at),
          UNIQUE KEY uq_renewal_contract_number (contract_number),
          UNIQUE KEY uq_renewal_invoice_number (invoice_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS subscription_document_sequences (
          period_key char(7) NOT NULL,
          last_number int(10) UNSIGNED NOT NULL DEFAULT 0,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (period_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await ensureUniqueDocumentIndexes();
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

const RENEWAL_SELECT = `
  SELECT
    rr.id,
    rr.school_id AS schoolId,
    s.school_name AS schoolName,
    (SELECT a.title_area FROM area a WHERE a.id_area = s.area_id LIMIT 1) AS area,
    rr.status,
    rr.customer_ciphertext AS customerCiphertext,
    rr.customer_iv AS customerIv,
    rr.customer_auth_tag AS customerAuthTag,
    rr.contract_number AS contractNumber,
    rr.invoice_number AS invoiceNumber,
    DATE_FORMAT(rr.issued_on, '%Y-%m-%d') AS issuedOn,
    DATE_FORMAT(rr.starts_on, '%Y-%m-%d') AS startsOn,
    DATE_FORMAT(rr.ends_on, '%Y-%m-%d') AS endsOn,
    DATE_FORMAT(rr.consent_at, '%Y-%m-%dT%H:%i:%sZ') AS consentAt,
    DATE_FORMAT(rr.paid_at, '%Y-%m-%dT%H:%i:%sZ') AS paidAt,
    DATE_FORMAT(rr.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
    DATE_FORMAT(rr.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt
  FROM subscription_renewal_requests rr
  JOIN schools s ON s.id_school = rr.school_id
`;

function mapRequest(row: RenewalRow): RenewalRequest {
  return {
    id: Number(row.id),
    schoolId: Number(row.schoolId),
    schoolName: row.schoolName,
    status: row.status,
    contractNumber: row.contractNumber,
    invoiceNumber: row.invoiceNumber,
    issuedOn: row.issuedOn,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    consentAt: row.consentAt,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customer: decryptCustomer(row),
  };
}

export async function getRenewalRequest(
  id: number,
  schoolId?: number,
): Promise<RenewalRequest | null> {
  await ensureSubscriptionRenewalSchema();
  const rows = await query<RenewalRow[]>(
    `${RENEWAL_SELECT}
     WHERE rr.id = ? ${schoolId ? "AND rr.school_id = ?" : ""}
     LIMIT 1`,
    schoolId ? [id, schoolId] : [id],
  );
  return rows[0] ? mapRequest(rows[0]) : null;
}

export async function getLatestSchoolRenewal(
  schoolId: number,
): Promise<RenewalRequest | null> {
  await ensureSubscriptionRenewalSchema();
  const rows = await query<RenewalRow[]>(
    `${RENEWAL_SELECT}
     WHERE rr.school_id = ?
     ORDER BY rr.id DESC
     LIMIT 1`,
    [schoolId],
  );
  return rows[0] ? mapRequest(rows[0]) : null;
}

export async function submitSchoolRenewal(
  schoolId: number,
  input: Partial<RenewalCustomerData> & { consent?: boolean },
): Promise<RenewalRequest> {
  await ensureSubscriptionRenewalSchema();
  if (input.consent !== true) {
    throw new Error("Необходимо согласие на обработку персональных данных");
  }

  const schoolName = await getSchoolName(schoolId);
  if (!schoolName) {
    throw new Error("Школа не найдена");
  }

  const customer = validateRenewalCustomerData(input);
  const encrypted = encryptCustomer(customer);
  const connection = await pool.getConnection();
  let requestId = 0;

  try {
    await connection.beginTransaction();
    await connection.query(
      `SELECT id_school FROM schools WHERE id_school = ? FOR UPDATE`,
      [schoolId],
    );
    const [editableRows] = await connection.query<
      (RowDataPacket & {
        id: number;
        status: RenewalStatus;
        contractNumber: string | null;
        invoiceNumber: string | null;
        issuedOn: string | null;
      })[]
    >(
      `SELECT
         id,
         status,
         contract_number AS contractNumber,
         invoice_number AS invoiceNumber,
         DATE_FORMAT(issued_on, '%Y-%m-%d') AS issuedOn
       FROM subscription_renewal_requests
       WHERE school_id = ? AND status IN ('pending', 'documents_ready')
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [schoolId],
    );
    const existing = editableRows[0];
    const numbers =
      existing?.contractNumber && existing?.invoiceNumber
        ? {
            contractNumber: existing.contractNumber,
            invoiceNumber: existing.invoiceNumber,
            issuedOn: existing.issuedOn || todayIso(),
          }
        : await allocateDocumentNumbers(connection);

    if (existing) {
      const [update] = await connection.query<ResultSetHeader>(
        `UPDATE subscription_renewal_requests
         SET customer_ciphertext = ?,
             customer_iv = ?,
             customer_auth_tag = ?,
             status = 'pending',
             contract_number = ?,
             invoice_number = ?,
             issued_on = ?,
             consent_at = NOW()
         WHERE id = ? AND status IN ('pending', 'documents_ready')`,
        [
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.authTag,
          numbers.contractNumber,
          numbers.invoiceNumber,
          numbers.issuedOn,
          existing.id,
        ],
      );
      if (!update.affectedRows) {
        throw new Error("Статус заявки изменился. Обновите страницу");
      }
      requestId = Number(existing.id);
    } else {
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO subscription_renewal_requests (
           school_id, customer_ciphertext, customer_iv, customer_auth_tag,
           status, contract_number, invoice_number, issued_on, consent_at
         ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NOW())`,
        [
          schoolId,
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.authTag,
          numbers.contractNumber,
          numbers.invoiceNumber,
          numbers.issuedOn,
        ],
      );
      requestId = Number(result.insertId);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const request = await getRenewalRequest(requestId, schoolId);
  if (!request) {
    throw new Error("Не удалось сохранить заявку");
  }
  return request;
}

export async function markRenewalPaid(
  id: number,
  adminUserId: number,
): Promise<RenewalRequest> {
  await ensureSubscriptionRenewalSchema();
  const connection = await pool.getConnection();
  let schoolId = 0;

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RenewalRow[]>(
      `${RENEWAL_SELECT}
       WHERE rr.id = ?
       LIMIT 1
       FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new Error("Заявка не найдена");
    schoolId = Number(row.schoolId);

    if (row.status === "paid") {
      await connection.commit();
      return mapRequest(row);
    }
    if (row.status === "cancelled") {
      throw new Error("Отменённую заявку нельзя подтвердить");
    }

    const customer = decryptCustomer(row);
    const numbers =
      row.contractNumber && row.invoiceNumber
        ? {
            contractNumber: row.contractNumber,
            invoiceNumber: row.invoiceNumber,
            issuedOn: row.issuedOn || todayIso(),
          }
        : await allocateDocumentNumbers(connection);
    const contractNumber = numbers.contractNumber;
    const invoiceNumber = numbers.invoiceNumber;
    const issuedOn = numbers.issuedOn;

    const [periodRows] = await connection.query<
      (RowDataPacket & PeriodEndRow)[]
    >(
      `SELECT DATE_FORMAT(MAX(ends_on), '%Y-%m-%d') AS latestEnd
       FROM school_subscriptions
       WHERE school_id = ?
         AND is_cancelled = 0
         AND ends_on >= CURDATE()`,
      [row.schoolId],
    );
    const startsOn = periodRows[0]?.latestEnd
      ? addOneDay(periodRows[0].latestEnd)
      : todayIso();
    const endsOn = addYearsMinusOneDay(startsOn);

    await connection.query(
      `INSERT INTO school_subscriptions (
         school_id, starts_on, ends_on, contact_phone, is_cancelled,
         source_label, note
       ) VALUES (?, ?, ?, ?, 0, 'billing-payment', ?)
       ON DUPLICATE KEY UPDATE
         is_cancelled = 0,
         contact_phone = VALUES(contact_phone),
         source_label = 'billing-payment',
         note = VALUES(note)`,
      [
        row.schoolId,
        startsOn,
        endsOn,
        customer.phone || null,
        `Оплачено по счёту № ${invoiceNumber}, договор № ${contractNumber}`,
      ],
    );
    await connection.query(
      `UPDATE subscription_renewal_requests
       SET status = 'paid',
           contract_number = ?,
           invoice_number = ?,
           issued_on = ?,
           starts_on = ?,
           ends_on = ?,
           paid_at = NOW(),
           processed_by_user_id = ?
       WHERE id = ?`,
      [
        contractNumber,
        invoiceNumber,
        issuedOn,
        startsOn,
        endsOn,
        adminUserId,
        id,
      ],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await syncSchoolCabinetAccess(schoolId);
  return (await getRenewalRequest(id))!;
}

export async function listRenewalRequests(input: {
  page: number;
  limit: number;
  status?: RenewalStatus | "all";
  search?: string;
}): Promise<{
  items: RenewalListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  await ensureSubscriptionRenewalSchema();
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(10, input.limit || 20));
  const offset = (page - 1) * limit;
  const conditions: string[] = ["1 = 1"];
  const params: unknown[] = [];

  if (input.status && input.status !== "all") {
    conditions.push("rr.status = ?");
    params.push(input.status);
  }
  if (input.search?.trim()) {
    conditions.push(`(
      s.school_name LIKE ?
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.school_id = s.id_school
          AND u.role = 'school_admin'
          AND u.email LIKE ?
      )
    )`);
    const search = `%${input.search.trim().slice(0, 100)}%`;
    params.push(search, search);
  }

  const where = conditions.join(" AND ");
  const rows = await query<RenewalRow[]>(
    `${RENEWAL_SELECT}
     WHERE ${where}
     ORDER BY
       FIELD(rr.status, 'pending', 'documents_ready', 'paid', 'cancelled'),
       rr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const countRows = await query<{ count: number }[]>(
    `SELECT COUNT(*) AS count
     FROM subscription_renewal_requests rr
     JOIN schools s ON s.id_school = rr.school_id
     WHERE ${where}`,
    params,
  );
  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      schoolId: Number(row.schoolId),
      schoolName: row.schoolName,
      area: row.area ?? null,
      status: row.status,
      customerName: decryptCustomer(row).fullName,
      contractNumber: row.contractNumber,
      invoiceNumber: row.invoiceNumber,
      issuedOn: row.issuedOn,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function countAwaitingRenewalConfirmations(): Promise<number> {
  await ensureSubscriptionRenewalSchema();
  const rows = await query<{ count: number }[]>(
    `SELECT COUNT(*) AS count
     FROM subscription_renewal_requests
     WHERE status IN ('pending', 'documents_ready')`,
  );
  return Number(rows[0]?.count ?? 0);
}

