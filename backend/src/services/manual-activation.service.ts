import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool, query } from "../db/pool.js";
import {
  encryptCustomer,
  ensureSubscriptionRenewalSchema,
} from "./subscription-renewal.service.js";
import {
  parseSubscriptionPeriod,
  syncSchoolCabinetAccess,
} from "./school-access.service.js";

export interface ManualActivationDocument {
  originalName: string;
  mime: string;
  size: number;
  storedName: string;
}

export interface ManualActivationInput {
  schoolId: number;
  startsOn: string;
  endsOn: string;
  amount?: number | null;
  paidOn?: string | null;
  phone?: string | null;
  note?: string | null;
  document?: ManualActivationDocument | null;
  adminUserId: number;
}

export interface ManualActivationResult {
  activationId: number;
  requestId: number;
  subscriptionId: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function optionalAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Укажите корректную сумму");
  }
  return Math.round(amount * 100) / 100;
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!ISO_DATE.test(text)) {
    throw new Error("Укажите корректную дату оплаты");
  }
  return text;
}

export async function createManualActivation(
  input: ManualActivationInput,
): Promise<ManualActivationResult> {
  await ensureSubscriptionRenewalSchema();
  const { startsOn, endsOn } = parseSubscriptionPeriod(
    input.startsOn,
    input.endsOn,
  );
  const amount = optionalAmount(input.amount);
  const paidOn = optionalDate(input.paidOn);
  const phone = input.phone?.trim().slice(0, 100) || "";
  const note = input.note?.trim().slice(0, 500) || null;

  const schoolRows = await query<
    (RowDataPacket & { id: number; name: string })[]
  >(
    `SELECT id_school AS id, school_name AS name
     FROM schools
     WHERE id_school = ?
     LIMIT 1`,
    [input.schoolId],
  );
  const school = schoolRows[0];
  if (!school) throw new Error("Школа не найдена");

  const encrypted = encryptCustomer({
    fullName: "",
    phone,
    passportSeries: "",
    passportNumber: "",
    passportIssuedBy: "",
    passportIssuedOn: "",
    divisionCode: "",
    residentialAddress: "",
    inn: "",
  });

  const connection = await pool.getConnection();
  let activationId = 0;
  let requestId = 0;
  let subscriptionId = 0;

  try {
    await connection.beginTransaction();
    await connection.query(
      "SELECT id_school FROM schools WHERE id_school = ? FOR UPDATE",
      [input.schoolId],
    );

    await connection.query(
      `INSERT INTO school_subscriptions (
         school_id, starts_on, ends_on, contact_phone, is_cancelled,
         source_label, note
       ) VALUES (?, ?, ?, ?, 0, 'after-incident', ?)
       ON DUPLICATE KEY UPDATE
         is_cancelled = 0,
         contact_phone = VALUES(contact_phone),
         source_label = 'after-incident',
         note = VALUES(note)`,
      [
        input.schoolId,
        startsOn,
        endsOn,
        phone || null,
        note ?? "Подключение после аварии",
      ],
    );

    const [periodRows] = await connection.query<
      (RowDataPacket & { id: number })[]
    >(
      `SELECT id FROM school_subscriptions
       WHERE school_id = ? AND starts_on = ? AND ends_on = ?
       LIMIT 1`,
      [input.schoolId, startsOn, endsOn],
    );
    subscriptionId = Number(periodRows[0]?.id ?? 0);
    if (!subscriptionId) {
      throw new Error("Не удалось сохранить период подписки");
    }

    const [requestResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO subscription_renewal_requests (
         school_id, customer_ciphertext, customer_iv, customer_auth_tag,
         status, starts_on, ends_on, consent_at, paid_at, processed_by_user_id
       ) VALUES (?, ?, ?, ?, 'paid', ?, ?, NOW(), ?, ?)`,
      [
        input.schoolId,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        startsOn,
        endsOn,
        paidOn ? `${paidOn} 12:00:00` : new Date(),
        input.adminUserId,
      ],
    );
    requestId = Number(requestResult.insertId);

    const [activationResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO subscription_manual_activations (
         school_id, renewal_request_id, subscription_id, amount, paid_on,
         note, is_after_incident, document_original_name, document_mime,
         document_size, document_stored_name, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      [
        input.schoolId,
        requestId,
        subscriptionId,
        amount,
        paidOn,
        note,
        input.document?.originalName ?? null,
        input.document?.mime ?? null,
        input.document?.size ?? null,
        input.document?.storedName ?? null,
        input.adminUserId,
      ],
    );
    activationId = Number(activationResult.insertId);

    await connection.query(
      `UPDATE users
       SET blocked_by_admin = 0
       WHERE school_id = ? AND role = 'school_admin'`,
      [input.schoolId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await syncSchoolCabinetAccess(input.schoolId);
  return { activationId, requestId, subscriptionId };
}

export interface ManualActivationDocumentRow {
  id: number;
  storedName: string;
  originalName: string | null;
  mime: string | null;
}

export async function getManualActivationDocument(
  activationId: number,
): Promise<ManualActivationDocumentRow | null> {
  await ensureSubscriptionRenewalSchema();
  const rows = await query<
    (RowDataPacket & ManualActivationDocumentRow)[]
  >(
    `SELECT
       id,
       document_stored_name AS storedName,
       document_original_name AS originalName,
       document_mime AS mime
     FROM subscription_manual_activations
     WHERE id = ?
     LIMIT 1`,
    [activationId],
  );
  const row = rows[0];
  if (!row || !row.storedName) return null;
  return row;
}
