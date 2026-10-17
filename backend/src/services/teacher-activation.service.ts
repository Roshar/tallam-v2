import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { hashPassword } from "./auth.service.js";
import { sendMail } from "./email.service.js";
import { listTeacherCards } from "./teacher-cabinet.service.js";

/**
 * Активация личного кабинета учителя.
 *
 * Поток: школа создает приглашение на конкретную карточку учителя -> учитель
 * открывает ссылку -> видит свои результаты -> указывает свою почту -> получает
 * на нее код -> задает пароль. Код подтверждает, что почта действительно его:
 * адресам из карточек доверять нельзя, они часто общие школьные.
 */

const INVITE_TTL_DAYS = 14;
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;

export interface InviteRow {
  id: number;
  token: string;
  id_teacher: string;
  school_id: number;
  code_hash: string | null;
  code_email: string | null;
  code_expires_at: Date | null;
  code_attempts: number;
  used_at: Date | null;
  expires_at: Date;
  /** Считается в базе: сравнение времени в JS ломается на разнице часовых поясов. */
  is_active: number;
  code_valid: number;
}

export interface TeacherOption {
  idTeacher: string;
  fullName: string;
  email: string | null;
  status: "activated" | "invited" | "none";
}

let schemaReady: Promise<void> | null = null;

export async function ensureTeacherInviteSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS teacher_invites (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        token char(64) NOT NULL,
        id_teacher varchar(150) NOT NULL,
        school_id int NOT NULL,
        created_by bigint(20) UNSIGNED NULL,
        code_hash varchar(200) NULL,
        code_email varchar(150) NULL,
        code_expires_at timestamp NULL,
        code_attempts int(11) NOT NULL DEFAULT 0,
        used_at timestamp NULL,
        expires_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_teacher_invites_token (token),
        KEY idx_teacher_invites_teacher (id_teacher),
        KEY idx_teacher_invites_school (school_id),
        KEY idx_teacher_invites_expires (expires_at)
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

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function activationLink(token: string): string {
  return `${config.frontendUrl}/teacher/activate/${token}`;
}

function newCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function findInvite(token: string): Promise<InviteRow | null> {
  await ensureTeacherInviteSchema();
  const rows = await query<InviteRow[]>(
    `SELECT id, token, id_teacher, school_id, code_hash, code_email,
            code_expires_at, code_attempts, used_at, expires_at,
            (used_at IS NULL AND expires_at > NOW()) AS is_active,
            (code_expires_at IS NOT NULL AND code_expires_at > NOW()) AS code_valid
     FROM teacher_invites
     WHERE token = ?
     LIMIT 1`,
    [token],
  );
  return rows[0] ?? null;
}

interface TeacherRow {
  id_teacher: string;
  surname: string;
  firstname: string;
  patronymic: string | null;
  email: string | null;
  school_id: number;
  school_name: string | null;
  title_position: string | null;
}

async function findTeacherCard(
  schoolId: number,
  idTeacher: string,
): Promise<TeacherRow | null> {
  const rows = await query<TeacherRow[]>(
    `SELECT t.id_teacher, t.surname, t.firstname, t.patronymic, t.email,
            t.school_id, s.school_name, p.title_position
     FROM teachers t
     LEFT JOIN schools s ON s.id_school = t.school_id
     LEFT JOIN position p ON t.position = p.id_position
     WHERE t.id_teacher = ? AND t.school_id = ?
     LIMIT 1`,
    [idTeacher, schoolId],
  );
  return rows[0] ?? null;
}

function fullName(row: TeacherRow): string {
  return [row.surname, row.firstname, row.patronymic]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Что учитель увидит до ввода пароля: себя и свои результаты. Данные берутся из
 * тех же функций, что и в кабинете, поэтому цифры совпадают с кабинетом.
 */
export async function getActivationPreview(token: string) {
  const invite = await findInvite(token);
  if (!invite || !invite.is_active) {
    return null;
  }

  const teacher = await findTeacherCard(invite.school_id, invite.id_teacher);
  if (!teacher) return null;

  const cards = await listTeacherCards(invite.school_id, invite.id_teacher);
  const latest = cards.length > 0 ? cards[cards.length - 1] : null;

  return {
    teacher: {
      fullName: fullName(teacher),
      schoolName: teacher.school_name?.trim() ?? "",
      position: teacher.title_position?.trim() ?? null,
      cardEmail: teacher.email?.trim() || null,
    },
    summary: {
      evaluations: cards.length,
      latestPercent: latest?.percent ?? null,
      latestDate: latest?.dateLabel ?? null,
      lastCardType: latest?.cardTypeLabel ?? null,
    },
  };
}

/** Школа создает приглашения: по одному на каждого выбранного учителя. */
export async function createInvites(input: {
  schoolId: number;
  createdBy: number;
  teacherIds: string[];
}): Promise<Array<{ idTeacher: string; fullName: string; link: string; emailed: boolean }>> {
  await ensureTeacherInviteSchema();
  const result: Array<{
    idTeacher: string;
    fullName: string;
    link: string;
    emailed: boolean;
  }> = [];

  for (const idTeacher of input.teacherIds) {
    const teacher = await findTeacherCard(input.schoolId, idTeacher);
    if (!teacher) continue;

    const existingAccount = await query<{ id: number }[]>(
      "SELECT id FROM teacher_accounts WHERE id_teacher = ? LIMIT 1",
      [idTeacher],
    );
    if (existingAccount.length > 0) continue;

    // Живое приглашение переиспользуем, чтобы повторное нажатие не плодило ссылки.
    const existing = await query<{ token: string }[]>(
      `SELECT token FROM teacher_invites
       WHERE id_teacher = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [idTeacher],
    );

    let token = existing[0]?.token ?? null;
    if (!token) {
      token = newToken();
      await query(
        `INSERT INTO teacher_invites (token, id_teacher, school_id, created_by, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [token, idTeacher, input.schoolId, input.createdBy, INVITE_TTL_DAYS],
      );
    }

    const link = activationLink(token);
    const cardEmail = teacher.email?.trim() || null;
    let emailed = false;

    if (cardEmail) {
      try {
        await sendMail({
          to: cardEmail,
          subject: "Личный кабинет учителя Tallam",
          text: [
            `Здравствуйте, ${fullName(teacher)}.`,
            "",
            "Школа открыла вам доступ в личный кабинет Tallam.",
            "Там ваши оценки, динамика результатов и методические рекомендации.",
            "",
            `Активировать кабинет: ${link}`,
            "",
            "Ссылка персональная. Если вы не ожидали это письмо, просто не открывайте ссылку.",
          ].join("\n"),
          html: `<p>Здравствуйте, ${fullName(teacher)}.</p>
<p>Школа открыла вам доступ в личный кабинет Tallam. Там ваши оценки, динамика результатов и методические рекомендации.</p>
<p><a href="${link}">Активировать кабинет</a></p>
<p>Ссылка персональная и действует ${INVITE_TTL_DAYS} дней.</p>`,
        });
        emailed = true;
      } catch (error) {
        console.error("Teacher invite email error:", error);
      }
    }

    result.push({ idTeacher, fullName: fullName(teacher), link, emailed });
  }

  return result;
}

/** Код на почту, которую указал сам учитель. */
export async function sendActivationCode(
  token: string,
  email: string,
): Promise<{ ok: true } | { error: string }> {
  const invite = await findInvite(token);
  if (!invite || !invite.is_active) {
    return { error: "Ссылка недействительна или устарела" };
  }

  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return { error: "Некорректный адрес почты" };
  }

  const taken = await query<{ id: number }[]>(
    "SELECT id FROM teacher_accounts WHERE email = ? LIMIT 1",
    [normalized],
  );
  if (taken.length > 0) {
    return { error: "Этот адрес уже используется другим аккаунтом" };
  }

  const code = newCode();
  const hash = await bcrypt.hash(code, 10);
  await query(
    `UPDATE teacher_invites
     SET code_hash = ?, code_email = ?, code_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
         code_attempts = 0
     WHERE id = ?`,
    [hash, normalized, invite.id],
  );

  await sendMail({
    to: normalized,
    subject: "Код подтверждения Tallam",
    text: `Код подтверждения: ${code}\n\nКод действует 10 минут.`,
    html: `<p>Код подтверждения: <strong>${code}</strong></p><p>Код действует 10 минут.</p>`,
  });

  return { ok: true };
}

/** Завершение: проверяем код и создаем аккаунт. */
export async function completeActivation(input: {
  token: string;
  email: string;
  code: string;
  password: string;
}): Promise<{ ok: true } | { error: string; status?: number }> {
  const invite = await findInvite(input.token);
  if (!invite || !invite.is_active) {
    return { error: "Ссылка недействительна или устарела", status: 410 };
  }
  if (!invite.code_hash || !invite.code_expires_at || !invite.code_email) {
    return { error: "Сначала запросите код на почту", status: 400 };
  }
  if (!invite.code_valid) {
    return { error: "Код истек, запросите новый", status: 410 };
  }
  if (invite.code_attempts >= CODE_MAX_ATTEMPTS) {
    return { error: "Слишком много попыток, запросите новый код", status: 429 };
  }

  const email = input.email.trim().toLowerCase();
  if (email !== invite.code_email) {
    return { error: "Почта не совпадает с той, на которую отправлен код", status: 400 };
  }

  const valid = await bcrypt.compare(input.code.trim(), invite.code_hash);
  if (!valid) {
    await query(
      "UPDATE teacher_invites SET code_attempts = code_attempts + 1 WHERE id = ?",
      [invite.id],
    );
    return { error: "Неверный код", status: 400 };
  }

  const taken = await query<{ id: number }[]>(
    "SELECT id FROM teacher_accounts WHERE email = ? AND id_teacher <> ? LIMIT 1",
    [email, invite.id_teacher],
  );
  if (taken.length > 0) {
    return { error: "Этот адрес уже используется другим аккаунтом", status: 409 };
  }

  const passwordHash = await hashPassword(input.password);
  await query(
    `INSERT INTO teacher_accounts (id_teacher, email, password, status)
     VALUES (?, ?, ?, 'on')
     ON DUPLICATE KEY UPDATE email = VALUES(email), password = VALUES(password), status = 'on'`,
    [invite.id_teacher, email, passwordHash],
  );
  await query("UPDATE teacher_invites SET used_at = NOW() WHERE id = ?", [invite.id]);

  return { ok: true };
}

/**
 * Сводка для кабинета школы: кто уже активирован, кто приглашен, кого еще нет.
 * Это та метрика, которую показывает владелец.
 */
export async function getActivationOverview(schoolId: number) {
  await ensureTeacherInviteSchema();

  const teachers = await query<
    {
      id_teacher: string;
      surname: string;
      firstname: string;
      patronymic: string | null;
      email: string | null;
      account_id: number | null;
      account_status: string | null;
      account_email: string | null;
      invite_token: string | null;
      invite_expires_at: Date | null;
    }[]
  >(
    `SELECT t.id_teacher, t.surname, t.firstname, t.patronymic, t.email,
            a.id AS account_id, a.status AS account_status, a.email AS account_email,
            i.token AS invite_token, i.expires_at AS invite_expires_at
     FROM teachers t
     LEFT JOIN teacher_accounts a ON a.id_teacher = t.id_teacher
     LEFT JOIN (
       SELECT inv.id_teacher, inv.token, inv.expires_at,
              ROW_NUMBER() OVER (PARTITION BY inv.id_teacher ORDER BY inv.id DESC) AS rn
       FROM teacher_invites inv
       WHERE inv.school_id = ? AND inv.used_at IS NULL AND inv.expires_at > NOW()
     ) i ON i.id_teacher = t.id_teacher AND i.rn = 1
     WHERE t.school_id = ?
     ORDER BY t.surname, t.firstname`,
    [schoolId, schoolId],
  );

  const items: TeacherOption[] = teachers.map((row) => ({
    idTeacher: row.id_teacher,
    fullName: [row.surname, row.firstname, row.patronymic]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" "),
    email: row.account_email?.trim() || row.email?.trim() || null,
    status:
      row.account_id && row.account_status === "on"
        ? "activated"
        : row.invite_token
          ? "invited"
          : "none",
  }));

  return {
    total: items.length,
    withEmail: items.filter((item) => Boolean(item.email)).length,
    activated: items.filter((item) => item.status === "activated").length,
    invited: items.filter((item) => item.status === "invited").length,
    teachers: items,
    currentInviteLinks: teachers
      .filter((row) => row.invite_token)
      .map((row) => ({
        idTeacher: row.id_teacher,
        link: activationLink(row.invite_token as string),
      })),
  };
}

/** Отзыв доступа: школа может закрыть кабинет учителя. */
export async function revokeTeacherAccount(
  schoolId: number,
  idTeacher: string,
): Promise<boolean> {
  const owned = await query<{ id: number }[]>(
    "SELECT id FROM teacher_accounts WHERE id_teacher = ? LIMIT 1",
    [idTeacher],
  );
  if (owned.length === 0) return false;

  const teacher = await findTeacherCard(schoolId, idTeacher);
  if (!teacher) return false;

  await query(
    "UPDATE teacher_accounts SET status = 'off' WHERE id_teacher = ?",
    [idTeacher],
  );
  return true;
}
