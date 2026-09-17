import crypto from "node:crypto";
import type { ResultSetHeader } from "mysql2";
import { query } from "../db/pool.js";

export type RecoveryRequestStatus = "new" | "done";

export interface RecoveryCaptcha {
  captchaId: string;
  imageSvg: string;
}

export interface RecoveryRequest {
  id: number;
  email: string;
  phone: string;
  schoolId: number | null;
  schoolName: string | null;
  status: RecoveryRequestStatus;
  ipAddress: string | null;
  createdAt: string;
  processedAt: string | null;
  processedByEmail: string | null;
}

class RecoveryRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RecoveryRequestError";
    this.status = status;
  }
}

export { RecoveryRequestError };

interface CaptchaEntry {
  answer: string;
  expiresAt: number;
  attempts: number;
}

interface SchoolLookupRow {
  school_id: number;
  school_name: string;
}

interface RecoveryRow {
  id: number;
  email: string;
  phone: string;
  school_id: number | null;
  school_name: string | null;
  status: RecoveryRequestStatus;
  ip_address: string | null;
  created_at: Date | string;
  processed_at: Date | string | null;
  processed_by_email: string | null;
}

const CAPTCHA_TTL_MS = 10 * 60 * 1000;
const CAPTCHA_MAX_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const captchas = new Map<string, CaptchaEntry>();
const captchaHits = new Map<string, number[]>();

let schemaReady: Promise<void> | null = null;

export async function ensureRecoverySchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS password_recovery_requests (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        email varchar(150) NOT NULL,
        phone varchar(32) NOT NULL,
        school_id bigint(20) UNSIGNED DEFAULT NULL,
        school_name varchar(255) DEFAULT NULL,
        status varchar(16) NOT NULL DEFAULT 'new',
        ip_address varchar(64) DEFAULT NULL,
        user_agent varchar(500) DEFAULT NULL,
        processed_at timestamp NULL DEFAULT NULL,
        processed_by_email varchar(255) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_recovery_status (status),
        KEY idx_recovery_created (created_at),
        KEY idx_recovery_email (email)
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

function pruneCaptchas(now = Date.now()) {
  for (const [id, item] of captchas) {
    if (item.expiresAt <= now) captchas.delete(id);
  }
  for (const [ip, stamps] of captchaHits) {
    const fresh = stamps.filter((stamp) => now - stamp < 60_000);
    if (fresh.length) captchaHits.set(ip, fresh);
    else captchaHits.delete(ip);
  }
}

function randomDigits(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += String(bytes[i] % 10);
  }
  return result;
}

function captchaSvg(code: string): string {
  const glyphs = [...code]
    .map((digit, index) => {
      const x = 22 + index * 28;
      const y = 34 + (index % 2 === 0 ? -4 : 4);
      const rot = (index % 2 === 0 ? -14 : 12) + index * 2;
      return `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" font-size="28" font-family="Georgia, Times, serif" font-weight="700" fill="#1a4474">${digit}</text>`;
    })
    .join("");
  const noise = Array.from({ length: 7 }, (_, index) => {
    const x1 = index * 20;
    const y1 = 6 + ((index * 11) % 36);
    const x2 = 40 + index * 16;
    const y2 = 42 - ((index * 7) % 28);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#52a1ff" stroke-opacity="0.38" stroke-width="1.2" />`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="52" viewBox="0 0 168 52" role="img" aria-label="Код с картинки"><rect width="168" height="52" rx="8" fill="#eef5fd"/>${noise}${glyphs}</svg>`;
}

export function createRecoveryCaptcha(ipAddress: string): RecoveryCaptcha {
  pruneCaptchas();
  const ip = ipAddress || "unknown";
  const recent = captchaHits.get(ip) ?? [];
  if (recent.length >= 20) {
    throw new RecoveryRequestError(
      "Слишком много запросов. Подождите минуту и обновите код",
      429,
    );
  }
  captchaHits.set(ip, [...recent, Date.now()]);

  const answer = randomDigits(5);
  const captchaId = crypto.randomBytes(16).toString("hex");
  captchas.set(captchaId, {
    answer,
    expiresAt: Date.now() + CAPTCHA_TTL_MS,
    attempts: 0,
  });
  return { captchaId, imageSvg: captchaSvg(answer) };
}

function consumeCaptcha(captchaId: string, answer: string): void {
  pruneCaptchas();
  const entry = captchas.get(captchaId);
  if (!entry || entry.expiresAt <= Date.now()) {
    captchas.delete(captchaId);
    throw new RecoveryRequestError("Обновите код с картинки и введите его заново");
  }
  entry.attempts += 1;
  const expected = entry.answer;
  const given = answer.replace(/\s+/g, "");
  if (given !== expected) {
    if (entry.attempts >= CAPTCHA_MAX_ATTEMPTS) {
      captchas.delete(captchaId);
    }
    throw new RecoveryRequestError("Неверный код с картинки");
  }
  captchas.delete(captchaId);
}

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function mapRequest(row: RecoveryRow): RecoveryRequest {
  return {
    id: Number(row.id),
    email: row.email,
    phone: row.phone,
    schoolId: row.school_id ? Number(row.school_id) : null,
    schoolName: row.school_name,
    status: row.status === "done" ? "done" : "new",
    ipAddress: row.ip_address,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    processedAt: toIso(row.processed_at),
    processedByEmail: row.processed_by_email,
  };
}

async function findSchoolByEmail(email: string): Promise<SchoolLookupRow | null> {
  const rows = await query<SchoolLookupRow[]>(
    `SELECT u.school_id, s.school_name
     FROM users u
     JOIN schools s ON s.id_school = u.school_id
     WHERE u.email = ? AND u.role = 'school_admin'
     LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function submitRecoveryRequest(input: {
  email: string;
  phone: string;
  captchaId: string;
  captchaAnswer: string;
  honeypot: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<{ ok: true; message: string }> {
  await ensureRecoverySchema();
  consumeCaptcha(input.captchaId, input.captchaAnswer);

  if (input.honeypot.trim()) {
    return {
      ok: true,
      message:
        "Обращение принято. Сотрудник портала свяжется с вами по указанному телефону.",
    };
  }

  const email = normalizeEmail(input.email);
  if (!EMAIL_PATTERN.test(email)) {
    throw new RecoveryRequestError("Укажите корректный email школы");
  }

  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new RecoveryRequestError("Укажите номер телефона для связи");
  }

  const recent = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total
     FROM password_recovery_requests
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
       AND (email = ? OR ip_address = ?)`,
    [email, input.ipAddress ?? ""],
  );
  if (Number(recent[0]?.total ?? 0) >= 5) {
    throw new RecoveryRequestError(
      "Слишком много обращений. Позвоните в поддержку, если доступ нужен срочно",
      429,
    );
  }

  const school = await findSchoolByEmail(email);
  const open = await query<{ id: number }[]>(
    `SELECT id FROM password_recovery_requests
     WHERE email = ? AND status = 'new'
     ORDER BY id DESC
     LIMIT 1`,
    [email],
  );

  if (open[0]) {
    await query(
      `UPDATE password_recovery_requests
       SET phone = ?, school_id = ?, school_name = ?, ip_address = ?, user_agent = ?
       WHERE id = ?`,
      [
        phone,
        school?.school_id ?? null,
        school?.school_name ?? null,
        input.ipAddress,
        input.userAgent?.slice(0, 500) ?? null,
        open[0].id,
      ],
    );
  } else {
    await query<ResultSetHeader>(
      `INSERT INTO password_recovery_requests (
         email, phone, school_id, school_name, status, ip_address, user_agent
       ) VALUES (?, ?, ?, ?, 'new', ?, ?)`,
      [
        email,
        phone,
        school?.school_id ?? null,
        school?.school_name ?? null,
        input.ipAddress,
        input.userAgent?.slice(0, 500) ?? null,
      ],
    );
  }

  return {
    ok: true,
    message:
      "Обращение принято. Сотрудник портала свяжется с вами по указанному телефону.",
  };
}

export async function countNewRecoveryRequests(): Promise<number> {
  await ensureRecoverySchema();
  const rows = await query<{ total: number }[]>(
    "SELECT COUNT(*) AS total FROM password_recovery_requests WHERE status = 'new'",
  );
  return Number(rows[0]?.total ?? 0);
}

export async function listRecoveryRequests(
  status: "all" | RecoveryRequestStatus,
): Promise<RecoveryRequest[]> {
  await ensureRecoverySchema();
  const condition = status === "all" ? "1 = 1" : "status = ?";
  const params = status === "all" ? [] : [status];
  const rows = await query<RecoveryRow[]>(
    `SELECT id, email, phone, school_id, school_name, status, ip_address,
            created_at, processed_at, processed_by_email
     FROM password_recovery_requests
     WHERE ${condition}
     ORDER BY (status = 'new') DESC, id DESC
     LIMIT 200`,
    params,
  );
  return rows.map(mapRequest);
}

export async function markRecoveryRequestDone(
  id: number,
  actorEmail: string,
): Promise<RecoveryRequest> {
  await ensureRecoverySchema();
  const updated = await query<ResultSetHeader>(
    `UPDATE password_recovery_requests
     SET status = 'done', processed_at = NOW(), processed_by_email = ?
     WHERE id = ?`,
    [actorEmail.slice(0, 255), id],
  );
  if (!Number(updated.affectedRows)) {
    throw new RecoveryRequestError("Обращение не найдено", 404);
  }
  const rows = await query<RecoveryRow[]>(
    `SELECT id, email, phone, school_id, school_name, status, ip_address,
            created_at, processed_at, processed_by_email
     FROM password_recovery_requests
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  if (!rows[0]) {
    throw new RecoveryRequestError("Обращение не найдено", 404);
  }
  return mapRequest(rows[0]);
}
