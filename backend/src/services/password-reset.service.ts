import crypto from "node:crypto";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { sendPasswordResetEmail } from "./email.service.js";
import { appendSchoolPasswordNote } from "./password-notebook.service.js";
import {
  findSchoolUserByEmail,
  hashPassword,
  passwordsMatch,
} from "./auth.service.js";
import { getSchoolAccessState, syncSchoolCabinetAccess } from "./school-access.service.js";

interface SchoolUserRow {
  id: number;
  email: string;
  status: "on" | "off";
  role: string;
  school_id: number;
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
  school_id: number;
  school_name: string;
}

const MIN_PASSWORD_LENGTH = 6;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function createResetLink(user: SchoolUserRow): Promise<{
  resetUrl: string;
  expiresAt: Date;
}> {
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

  return {
    resetUrl: `${config.frontendUrl}/auth/reset/${token}`,
    expiresAt,
  };
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов`;
  }
  return null;
}

async function findSchoolAccount(email: string): Promise<SchoolUserRow | null> {
  const rows = await query<SchoolUserRow[]>(
    `SELECT id, email, status, role, school_id
     FROM users
     WHERE email = ? AND role = 'school_admin'
     LIMIT 1`,
    [email.trim()],
  );
  return rows[0] ?? null;
}

export async function requestSchoolPasswordReset(email: string): Promise<void> {
  const user = await findSchoolAccount(email);

  if (!user) {
    return;
  }

  await syncSchoolCabinetAccess(user.school_id);
  const access = await getSchoolAccessState(user.school_id);
  if (!access.canLogin) {
    return;
  }

  const { resetUrl } = await createResetLink(user);
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function createSchoolPasswordResetLink(
  schoolId: number,
): Promise<{ resetUrl: string; expiresAt: Date; email: string } | null> {
  const rows = await query<SchoolUserRow[]>(
    `SELECT id, email, status, role, school_id
     FROM users
     WHERE school_id = ? AND role = 'school_admin'
     LIMIT 1`,
    [schoolId],
  );
  const user = rows[0];

  if (!user) {
    return null;
  }

  await syncSchoolCabinetAccess(user.school_id);
  const access = await getSchoolAccessState(user.school_id);
  if (!access.canLogin) {
    return null;
  }

  const result = await createResetLink(user);
  return { ...result, email: user.email };
}

export async function validateResetToken(
  token: string,
): Promise<{
  valid: boolean;
  reason?: string;
  email?: string;
  userId?: number;
  schoolId?: number;
  schoolName?: string;
}> {
  if (!token?.trim()) {
    return { valid: false, reason: "Ссылка недействительна" };
  }

  const rows = await query<ResetTokenRow[]>(
    `SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.used_at,
            u.email, u.status, u.role, u.school_id, s.school_name
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     JOIN schools s ON s.id_school = u.school_id
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

  if (row.role !== "school_admin") {
    return { valid: false, reason: "Аккаунт недоступен" };
  }

  await syncSchoolCabinetAccess(row.school_id);
  const access = await getSchoolAccessState(row.school_id);
  if (!access.canLogin) {
    return { valid: false, reason: access.message };
  }

  return {
    valid: true,
    email: row.email,
    userId: row.user_id,
    schoolId: row.school_id,
    schoolName: row.school_name,
  };
}

export async function resetSchoolPassword(
  token: string,
  password: string,
): Promise<
  | { ok: true; email: string; userId: number; schoolId: number }
  | {
      ok: false;
      error: string;
      email?: string;
      userId?: number;
      schoolId?: number;
    }
> {
  const validation = await validateResetToken(token);
  if (!validation.valid) {
    return { ok: false, error: validation.reason ?? "Ссылка недействительна" };
  }

  const passwordError = validatePassword(password.trim());
  if (passwordError) {
    return {
      ok: false,
      error: passwordError,
      email: validation.email,
      userId: validation.userId,
      schoolId: validation.schoolId,
    };
  }

  password = password.trim();

  const tokenHash = hashToken(token.trim());
  const rows = await query<ResetTokenRow[]>(
    `SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.used_at,
            u.email, u.status, u.role, u.school_id, s.school_name
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     JOIN schools s ON s.id_school = u.school_id
     WHERE t.token_hash = ?
     LIMIT 1`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Ссылка недействительна" };
  }

  const hash = await hashPassword(password);

  await query("UPDATE users SET `password` = ? WHERE id = ?", [
    hash,
    row.user_id,
  ]);
  await query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?",
    [row.id],
  );
  await query(
    "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
    [row.user_id],
  );

  try {
    await appendSchoolPasswordNote({
      action: "reset",
      schoolId: row.school_id,
      schoolName: row.school_name,
      email: row.email,
      password,
      actor: `reset-link:${row.email}`,
    });
  } catch (error) {
    console.error("School password notebook write failed:", error);
  }

  return {
    ok: true,
    email: row.email,
    userId: row.user_id,
    schoolId: row.school_id,
  };
}

export async function changeSchoolCabinetPassword(
  schoolId: number,
  password: string,
  confirmPassword: string,
  actor: string,
): Promise<{ email: string; schoolName: string }> {
  if (!password.trim() || !confirmPassword.trim()) {
    throw new Error("Укажите пароль и подтверждение");
  }
  password = password.trim();
  confirmPassword = confirmPassword.trim();
  if (password !== confirmPassword) {
    throw new Error("Пароли не совпадают");
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const rows = await query<
    Array<SchoolUserRow & { school_name: string }>
  >(
    `SELECT u.id, u.email, u.status, u.role, u.school_id, s.school_name
     FROM users u
     JOIN schools s ON s.id_school = u.school_id
     WHERE u.school_id = ? AND u.role = 'school_admin'
     LIMIT 1`,
    [schoolId],
  );
  const user = rows[0];
  if (!user) {
    throw new Error("Кабинет школы не найден");
  }

  const hash = await hashPassword(password);
  await query("UPDATE users SET `password` = ? WHERE id = ?", [hash, user.id]);

  const stored = await findSchoolUserByEmail(user.email);
  if (!stored || !(await passwordsMatch(password, stored.password))) {
    throw new Error("Не удалось сохранить пароль. Попробуйте ещё раз.");
  }

  try {
    await appendSchoolPasswordNote({
      action: "changed",
      schoolId,
      schoolName: user.school_name,
      email: user.email,
      password,
      actor,
    });
  } catch (error) {
    console.error("School password notebook write failed:", error);
  }

  return { email: user.email, schoolName: user.school_name };
}
