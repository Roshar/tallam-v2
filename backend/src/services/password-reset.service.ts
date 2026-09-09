import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { sendPasswordResetEmail } from "./email.service.js";

interface SchoolUserRow {
  id: number;
  email: string;
  status: "on" | "off";
  role: string;
}

interface ResetTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  email: string;
  status: "on" | "off";
  role: string;
}

const MIN_PASSWORD_LENGTH = 6;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов`;
  }
  return null;
}

async function findSchoolAccount(email: string): Promise<SchoolUserRow | null> {
  const rows = await query<SchoolUserRow[]>(
    `SELECT id, email, status, role
     FROM users
     WHERE email = ? AND role = 'school_admin'
     LIMIT 1`,
    [email.trim()],
  );
  return rows[0] ?? null;
}

export async function requestSchoolPasswordReset(email: string): Promise<void> {
  const user = await findSchoolAccount(email);

  if (!user || user.status !== "on") {
    return;
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + config.passwordReset.expiresMinutes * 60 * 1000,
  );

  await query(
    "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
    [user.id],
  );

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [user.id, tokenHash, expiresAt],
  );

  const resetUrl = `${config.frontendUrl}/auth/reset/${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function validateResetToken(
  token: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!token?.trim()) {
    return { valid: false, reason: "Ссылка недействительна" };
  }

  const rows = await query<ResetTokenRow[]>(
    `SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.used_at,
            u.email, u.status, u.role
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ?
     LIMIT 1`,
    [hashToken(token.trim())],
  );

  const row = rows[0];
  if (!row) {
    return { valid: false, reason: "Ссылка недействительна или уже использована" };
  }

  if (row.used_at) {
    return { valid: false, reason: "Ссылка уже была использована" };
  }

  if (new Date(row.expires_at) < new Date()) {
    return { valid: false, reason: "Срок действия ссылки истёк" };
  }

  if (row.role !== "school_admin" || row.status !== "on") {
    return { valid: false, reason: "Аккаунт недоступен" };
  }

  return { valid: true };
}

export async function resetSchoolPassword(
  token: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const validation = await validateResetToken(token);
  if (!validation.valid) {
    return { ok: false, error: validation.reason ?? "Ссылка недействительна" };
  }

  const tokenHash = hashToken(token.trim());
  const rows = await query<ResetTokenRow[]>(
    `SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.used_at,
            u.email, u.status, u.role
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ?
     LIMIT 1`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Ссылка недействительна" };
  }

  const hash = await bcrypt.hash(password, 10);

  await query("UPDATE users SET password = ? WHERE id = ?", [hash, row.user_id]);
  await query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?",
    [row.id],
  );
  await query(
    "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
    [row.user_id],
  );

  return { ok: true };
}
