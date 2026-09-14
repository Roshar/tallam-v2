import type { ResultSetHeader } from "mysql2";
import { query } from "../db/pool.js";

export class SchoolAccessDeniedError extends Error {
  code: "ACCESS_DENIED" | "SUBSCRIPTION_REQUIRED";

  constructor(
    message: string,
    code: "ACCESS_DENIED" | "SUBSCRIPTION_REQUIRED" = "ACCESS_DENIED",
  ) {
    super(message);
    this.name = "SchoolAccessDeniedError";
    this.code = code;
  }
}

export type SchoolAccessReason =
  | "active"
  | "no_account"
  | "blocked"
  | "expired"
  | "scheduled";

export interface SchoolAccessState {
  hasAccount: boolean;
  accountStatus: "on" | "off" | "" | null;
  blockedByAdmin: boolean;
  hasSubscriptionHistory: boolean;
  hasCoveringSubscription: boolean;
  allowed: boolean;
  canLogin: boolean;
  canUseCabinet: boolean;
  reason: SchoolAccessReason;
  message: string;
}

interface AccountRow {
  status: "on" | "off" | "";
  blocked_by_admin: number;
}

interface FlagRow {
  present: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ACTIVATION_DAYS = 366 * 5;
let blockedByAdminReady: Promise<void> | null = null;

export function parseIsoDate(value: string): string | null {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === value ? value : null;
}

function parseSubscriptionPeriod(startsOnRaw: string, endsOnRaw: string) {
  const startsOn = parseIsoDate(startsOnRaw);
  const endsOn = parseIsoDate(endsOnRaw);
  if (!startsOn || !endsOn) {
    throw new Error("Укажите корректные даты начала и окончания");
  }
  if (endsOn < startsOn) {
    throw new Error("Дата окончания не может быть раньше даты начала");
  }

  const startMs = new Date(`${startsOn}T00:00:00`).getTime();
  const endMs = new Date(`${endsOn}T00:00:00`).getTime();
  const days = Math.round((endMs - startMs) / 86_400_000) + 1;
  if (days > MAX_ACTIVATION_DAYS) {
    throw new Error("Срок подписки не может превышать 5 лет");
  }

  return { startsOn, endsOn };
}

function accessMessage(reason: SchoolAccessReason): string {
  switch (reason) {
    case "active":
      return "Кабинет доступен";
    case "no_account":
      return "Кабинет школы не найден";
    case "blocked":
      return "Кабинет школы принудительно заблокирован";
    case "scheduled":
      return "Подписка ещё не началась. Кабинет откроется в дату начала срока";
    case "expired":
      return "Срок подписки истёк. Оплатите продление или, если платёж уже отправлен, дождитесь подтверждения администрацией портала";
  }
}

function schoolFilterSql(schoolId?: number) {
  return schoolId ? "AND u.school_id = ?" : "";
}

export async function ensureSchoolAccessSchema() {
  if (!blockedByAdminReady) {
    blockedByAdminReady = (async () => {
      const columns = await query<{ Field: string }[]>(
        "SHOW COLUMNS FROM users LIKE 'blocked_by_admin'",
      );
      if (!columns.length) {
        await query(
          "ALTER TABLE users ADD COLUMN blocked_by_admin tinyint(1) NOT NULL DEFAULT 0",
        );
      }
    })().catch((error) => {
      blockedByAdminReady = null;
      throw error;
    });
  }

  await blockedByAdminReady;
}

export async function syncSchoolCabinetAccess(schoolId?: number) {
  await ensureSchoolAccessSchema();
  const params = schoolId ? [schoolId] : [];
  const schoolFilter = schoolFilterSql(schoolId);

  const expired = await query<ResultSetHeader>(
    `UPDATE users u
     SET u.status = 'off'
     WHERE u.role = 'school_admin'
       AND u.status = 'on'
       ${schoolFilter}
       AND EXISTS (
         SELECT 1
         FROM school_subscriptions ss
         WHERE ss.school_id = u.school_id
           AND ss.is_cancelled = 0
       )
       AND NOT EXISTS (
         SELECT 1
         FROM school_subscriptions ss
         WHERE ss.school_id = u.school_id
           AND ss.is_cancelled = 0
           AND CURDATE() BETWEEN ss.starts_on AND ss.ends_on
       )`,
    params,
  );

  await query<ResultSetHeader>(
    `UPDATE users u
     SET u.status = 'on'
     WHERE u.role = 'school_admin'
       AND u.status = 'off'
       AND u.blocked_by_admin = 0
       ${schoolFilter}
       AND EXISTS (
         SELECT 1
         FROM school_subscriptions ss
         WHERE ss.school_id = u.school_id
           AND ss.is_cancelled = 0
           AND CURDATE() BETWEEN ss.starts_on AND ss.ends_on
       )`,
    params,
  );

  return Number(expired.affectedRows ?? 0);
}

export const syncExpiredSchoolAccounts = syncSchoolCabinetAccess;

export async function getSchoolAccessState(
  schoolId: number,
): Promise<SchoolAccessState> {
  await ensureSchoolAccessSchema();

  const [accountRows, historyRows, coveringRows, scheduledRows] =
    await Promise.all([
      query<AccountRow[]>(
        `SELECT status, blocked_by_admin
         FROM users
         WHERE school_id = ? AND role = 'school_admin'
         ORDER BY id ASC
         LIMIT 1`,
        [schoolId],
      ),
      query<FlagRow[]>(
        `SELECT EXISTS (
           SELECT 1 FROM school_subscriptions
           WHERE school_id = ? AND is_cancelled = 0
         ) AS present`,
        [schoolId],
      ),
      query<FlagRow[]>(
        `SELECT EXISTS (
           SELECT 1 FROM school_subscriptions
           WHERE school_id = ?
             AND is_cancelled = 0
             AND CURDATE() BETWEEN starts_on AND ends_on
         ) AS present`,
        [schoolId],
      ),
      query<FlagRow[]>(
        `SELECT EXISTS (
           SELECT 1 FROM school_subscriptions
           WHERE school_id = ?
             AND is_cancelled = 0
             AND starts_on > CURDATE()
         ) AS present`,
        [schoolId],
      ),
    ]);

  const account = accountRows[0];
  const hasAccount = Boolean(account);
  const accountStatus = account?.status ?? null;
  const blockedByAdmin = Boolean(Number(account?.blocked_by_admin));
  const hasSubscriptionHistory = Boolean(Number(historyRows[0]?.present));
  const hasCoveringSubscription = Boolean(Number(coveringRows[0]?.present));
  const hasScheduledSubscription = Boolean(Number(scheduledRows[0]?.present));

  let reason: SchoolAccessReason = "active";
  if (!hasAccount) {
    reason = "no_account";
  } else if (blockedByAdmin) {
    reason = "blocked";
  } else if (hasSubscriptionHistory && !hasCoveringSubscription) {
    reason = hasScheduledSubscription ? "scheduled" : "expired";
  } else if (accountStatus !== "on") {
    reason = "blocked";
  }

  const canUseCabinet = reason === "active";
  const canLogin =
    hasAccount &&
    !blockedByAdmin &&
    (reason === "active" || reason === "expired" || reason === "scheduled");

  return {
    hasAccount,
    accountStatus,
    blockedByAdmin,
    hasSubscriptionHistory,
    hasCoveringSubscription,
    allowed: canUseCabinet,
    canLogin,
    canUseCabinet,
    reason,
    message: accessMessage(reason),
  };
}

export function cabinetAccessFromState(
  access: SchoolAccessState,
): "full" | "billing" {
  return access.canUseCabinet ? "full" : "billing";
}

export async function assertSchoolLoginAccess(schoolId: number) {
  await syncSchoolCabinetAccess(schoolId);
  const access = await getSchoolAccessState(schoolId);
  if (!access.canLogin) {
    throw new SchoolAccessDeniedError(access.message);
  }
  return access;
}

export async function assertSchoolCabinetAccess(schoolId: number) {
  await syncSchoolCabinetAccess(schoolId);
  const access = await getSchoolAccessState(schoolId);
  if (!access.canUseCabinet) {
    throw new SchoolAccessDeniedError(
      access.message,
      access.canLogin ? "SUBSCRIPTION_REQUIRED" : "ACCESS_DENIED",
    );
  }
  return access;
}

export async function blockSchoolCabinet(schoolId: number) {
  await ensureSchoolAccessSchema();
  const access = await getSchoolAccessState(schoolId);
  if (!access.hasAccount) {
    return null;
  }

  await query(
    `UPDATE users
     SET status = 'off', blocked_by_admin = 1
     WHERE school_id = ? AND role = 'school_admin'`,
    [schoolId],
  );

  return getSchoolAccessState(schoolId);
}

export async function createSchoolSubscription(input: {
  schoolId: number;
  startsOn: string;
  endsOn: string;
  phone?: string;
  note?: string;
}) {
  const { startsOn, endsOn } = parseSubscriptionPeriod(
    input.startsOn,
    input.endsOn,
  );

  const schoolRows = await query<{ id: number }[]>(
    "SELECT id_school AS id FROM schools WHERE id_school = ? LIMIT 1",
    [input.schoolId],
  );
  if (!schoolRows[0]) {
    throw new Error("Школа не найдена");
  }

  const phoneRows = await query<{ phone: string | null }[]>(
    `SELECT contact_phone AS phone
     FROM school_subscriptions
     WHERE school_id = ?
     ORDER BY ends_on DESC, id DESC
     LIMIT 1`,
    [input.schoolId],
  );

  const phone = input.phone?.trim().slice(0, 100) || phoneRows[0]?.phone || null;
  const note = input.note?.trim().slice(0, 500) || null;

  await query(
    `INSERT INTO school_subscriptions (
       school_id, starts_on, ends_on, contact_phone, is_cancelled, source_label, note
     ) VALUES (?, ?, ?, ?, 0, 'admin-manual', ?)
     ON DUPLICATE KEY UPDATE
       is_cancelled = 0,
       contact_phone = VALUES(contact_phone),
       source_label = 'admin-manual',
       note = VALUES(note)`,
    [input.schoolId, startsOn, endsOn, phone, note],
  );

  await syncSchoolCabinetAccess(input.schoolId);
}

export async function activateSchoolCabinet(input: {
  schoolId: number;
  startsOn: string;
  endsOn: string;
  note?: string;
}) {
  const { startsOn, endsOn } = parseSubscriptionPeriod(
    input.startsOn,
    input.endsOn,
  );

  await ensureSchoolAccessSchema();
  const access = await getSchoolAccessState(input.schoolId);
  if (!access.hasAccount) {
    throw new Error("Кабинет школы не найден");
  }

  const phoneRows = await query<{ phone: string | null }[]>(
    `SELECT contact_phone AS phone
     FROM school_subscriptions
     WHERE school_id = ?
     ORDER BY ends_on DESC, id DESC
     LIMIT 1`,
    [input.schoolId],
  );

  const note =
    input.note?.trim().slice(0, 500) || "Активация кабинета администратором";

  await query(
    `INSERT INTO school_subscriptions (
       school_id, starts_on, ends_on, contact_phone, is_cancelled, source_label, note
     ) VALUES (?, ?, ?, ?, 0, 'admin-activate', ?)
     ON DUPLICATE KEY UPDATE
       is_cancelled = 0,
       source_label = 'admin-activate',
       note = VALUES(note)`,
    [input.schoolId, startsOn, endsOn, phoneRows[0]?.phone ?? null, note],
  );

  await query(
    `UPDATE users
     SET blocked_by_admin = 0
     WHERE school_id = ? AND role = 'school_admin'`,
    [input.schoolId],
  );

  await syncSchoolCabinetAccess(input.schoolId);
  return getSchoolAccessState(input.schoolId);
}
