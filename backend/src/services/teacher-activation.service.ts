import crypto from "node:crypto";
import type { ResultSetHeader } from "mysql2";
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
  sent_at: Date | null;
  send_count: number;
  /** Считается в базе: сравнение времени в JS ломается на разнице часовых поясов. */
  is_active: number;
  code_valid: number;
}

export interface TeacherOption {
  idTeacher: string;
  fullName: string;
  email: string | null;
  status: "activated" | "invited" | "none";
  /** Адрес, на который уйдет письмо: почта из карточки, а не из аккаунта. */
  cardEmail: string | null;
  /** На этот адрес в школе приходится больше одного учителя. */
  emailShared: boolean;
  /** Адрес совпадает с логином самой школы. */
  emailIsSchool: boolean;
  /** Письмо уже уходило: повторно не отправляем. */
  inviteSentAt: string | null;
  inviteSendCount: number;
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
        sent_at timestamp NULL,
        send_count int(11) NOT NULL DEFAULT 0,
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
            code_expires_at, code_attempts, used_at, expires_at, sent_at, send_count,
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

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || null;
}

/** Логин школы. Письмо на него не отправляем: это ящик самой школы, не учителя. */
async function getSchoolEmail(schoolId: number): Promise<string | null> {
  const rows = await query<{ email: string | null }[]>(
    "SELECT email FROM users WHERE school_id = ? AND role = 'school_admin' LIMIT 1",
    [schoolId],
  );
  return normalizeEmail(rows[0]?.email);
}

/**
 * Общий адрес: на него в этой школе заведено больше одного учителя.
 * Отправлять туда письмо бессмысленно - непонятно, кто именно получит доступ,
 * поэтому такие адреса раздают вручную.
 */
async function isSharedAddress(
  schoolId: number,
  email: string,
): Promise<boolean> {
  const rows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total
     FROM teachers
     WHERE school_id = ? AND LOWER(TRIM(email)) = ?`,
    [schoolId, email],
  );
  return Number(rows[0]?.total ?? 0) > 1;
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
}): Promise<Array<{ idTeacher: string; fullName: string; link: string }>> {
  await ensureTeacherInviteSchema();
  const result: Array<{
    idTeacher: string;
    fullName: string;
    link: string;
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
    result.push({ idTeacher, fullName: fullName(teacher), link });
  }

  return result;
}

/**
 * Одно письмо с персональной ссылкой.
 *
 * Школа отправляет приглашение по одному учителю и только после подтверждения
 * адреса: почтам из карточек доверять нельзя, на общий ящик письмо не уходит.
 * Повторная отправка запрещена - отметка `sent_at` закрывает приглашение от
 * второй попытки, чтобы школа не завалила один ящик одинаковыми письмами.
 */
export async function sendTeacherInvite(input: {
  schoolId: number;
  createdBy: number;
  idTeacher: string;
}): Promise<
  | { ok: true; sentTo: string; fullName: string }
  | { error: string; status: number; reason?: "shared" | "school" }
> {
  await ensureTeacherInviteSchema();

  const teacher = await findTeacherCard(input.schoolId, input.idTeacher);
  if (!teacher) {
    return { error: "Учитель не найден в этой школе", status: 404 };
  }

  const account = await query<{ status: string | null }[]>(
    "SELECT status FROM teacher_accounts WHERE id_teacher = ? LIMIT 1",
    [input.idTeacher],
  );
  if (account[0]?.status === "on") {
    return { error: "Кабинет уже активирован", status: 409 };
  }

  const to = normalizeEmail(teacher.email);
  if (!to) {
    return { error: "В карточке учителя не указана почта", status: 400 };
  }

  const schoolEmail = await getSchoolEmail(input.schoolId);
  if (schoolEmail && to === schoolEmail) {
    return {
      error: "Это почта самой школы, приглашение передают вручную",
      status: 409,
      reason: "school",
    };
  }

  if (await isSharedAddress(input.schoolId, to)) {
    return {
      error: "Адрес общий для нескольких учителей, приглашение передают вручную",
      status: 409,
      reason: "shared",
    };
  }

  const prepared = await createInvites({
    schoolId: input.schoolId,
    createdBy: input.createdBy,
    teacherIds: [input.idTeacher],
  });
  if (prepared.length === 0) {
    return { error: "Не удалось подготовить ссылку", status: 500 };
  }
  const link = prepared[0].link;

  // Отметку о сроке и отправке читаем из базы: сравнение времени в JS ломается
  // на разнице часовых поясов между MySQL и Node.
  const invites = await query<
    { id: number; already_sent: number; expires_label: string | null }[]
  >(
    `SELECT id, (sent_at IS NOT NULL) AS already_sent,
            DATE_FORMAT(expires_at, '%d.%m.%Y') AS expires_label
     FROM teacher_invites
     WHERE id_teacher = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [input.idTeacher],
  );
  const invite = invites[0];
  if (!invite) {
    return { error: "Ссылка не подготовлена", status: 500 };
  }
  if (invite.already_sent) {
    return { error: "Приглашение уже отправлено", status: 409 };
  }

  const name = fullName(teacher);
  const school = teacher.school_name?.trim() || "ваша школа";
  const expires = invite.expires_label;
  const subject = "Кабинет учителя Tallam - персональная ссылка";

  const textLines = [
    `Здравствуйте, ${name}!`,
    "",
    `Школа "${school}" открыла вам доступ к личному кабинету на платформе Tallam.`,
    "В кабинете ваши результаты по методической и комплексной картам, динамика и разбор оценок.",
    "",
    "Перейдите по ссылке:",
    link,
    "",
  ];
  if (expires) {
    textLines.push(`Ссылка действует до ${expires}.`);
  }
  textLines.push(
    "На странице подтвердите свою почту кодом из письма и задайте пароль.",
    "",
    "Если вы не ожидали это письмо, просто проигнорируйте его.",
  );

  await sendMail({
    to,
    subject,
    text: textLines.join("\n"),
    html: `
      <p>Здравствуйте, ${name}!</p>
      <p>Школа "${school}" открыла вам доступ к личному кабинету на платформе <strong>Tallam</strong>.</p>
      <p>В кабинете ваши результаты по методической и комплексной картам, динамика и разбор оценок.</p>
      <p><a href="${link}">Открыть кабинет</a></p>
      <p>Или скопируйте ссылку в браузер:<br><span>${link}</span></p>
      ${expires ? `<p>Ссылка действует до ${expires}.</p>` : ""}
      <p>На странице подтвердите свою почту кодом из письма и задайте пароль.</p>
      <p>Если вы не ожидали это письмо, просто проигнорируйте его.</p>
    `,
  });

  const updated = await query<ResultSetHeader>(
    `UPDATE teacher_invites
     SET sent_at = NOW(), send_count = send_count + 1
     WHERE id = ? AND sent_at IS NULL`,
    [invite.id],
  );
  if (!Number(updated.affectedRows)) {
    return { error: "Приглашение уже отправлено", status: 409 };
  }

  return { ok: true, sentTo: to, fullName: name };
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
      invite_sent_at: string | null;
      invite_send_count: number | null;
    }[]
  >(
    `SELECT t.id_teacher, t.surname, t.firstname, t.patronymic, t.email,
            a.id AS account_id, a.status AS account_status, a.email AS account_email,
            i.token AS invite_token, i.expires_at AS invite_expires_at,
            i.sent_at_label AS invite_sent_at, i.send_count AS invite_send_count
     FROM teachers t
     LEFT JOIN teacher_accounts a ON a.id_teacher = t.id_teacher
     LEFT JOIN (
       SELECT inv.id_teacher, inv.token, inv.expires_at, inv.send_count,
              DATE_FORMAT(inv.sent_at, '%d.%m.%Y') AS sent_at_label,
              ROW_NUMBER() OVER (PARTITION BY inv.id_teacher ORDER BY inv.id DESC) AS rn
       FROM teacher_invites inv
       WHERE inv.school_id = ? AND inv.used_at IS NULL AND inv.expires_at > NOW()
     ) i ON i.id_teacher = t.id_teacher AND i.rn = 1
     WHERE t.school_id = ?
     ORDER BY t.surname, t.firstname`,
    [schoolId, schoolId],
  );

  const schoolEmail = await getSchoolEmail(schoolId);

  // Считаем общие адреса по карточкам, а не по аккаунтам: письмо уходит именно
  // на адрес из карточки.
  const addressCounts = new Map<string, number>();
  for (const row of teachers) {
    const cardEmail = normalizeEmail(row.email);
    if (!cardEmail) continue;
    addressCounts.set(cardEmail, (addressCounts.get(cardEmail) ?? 0) + 1);
  }

  const items: TeacherOption[] = teachers.map((row) => {
    const cardEmail = normalizeEmail(row.email);
    return {
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
      cardEmail,
      emailShared: cardEmail
        ? (addressCounts.get(cardEmail) ?? 0) > 1
        : false,
      emailIsSchool: Boolean(cardEmail && schoolEmail && cardEmail === schoolEmail),
      inviteSentAt: row.invite_sent_at ?? null,
      inviteSendCount: Number(row.invite_send_count ?? 0),
    };
  });

  const sent = await query<{ total: number }[]>(
    `SELECT COUNT(DISTINCT id_teacher) AS total
     FROM teacher_invites
     WHERE school_id = ? AND sent_at IS NOT NULL`,
    [schoolId],
  );

  return {
    total: items.length,
    withEmail: items.filter((item) => Boolean(item.email)).length,
    activated: items.filter((item) => item.status === "activated").length,
    invited: items.filter((item) => item.status === "invited").length,
    sent: Number(sent[0]?.total ?? 0),
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
