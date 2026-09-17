import { query } from "../db/pool.js";
import { getSchoolName } from "./auth.service.js";

const MESSAGE_MAX = 4_000;

export type SupportAuthorRole = "school" | "admin";

export interface SupportMessage {
  id: number;
  schoolId: number;
  authorRole: SupportAuthorRole;
  authorEmail: string;
  message: string;
  createdAt: string;
}

export interface SupportThread {
  schoolId: number;
  schoolName: string;
  messages: SupportMessage[];
}

export interface SupportConversation {
  schoolId: number;
  schoolName: string;
  lastMessage: string;
  lastAuthorRole: SupportAuthorRole;
  lastAt: string;
  unreadCount: number;
}

let schemaReady: Promise<void> | null = null;

export async function ensureSchoolFeedbackSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = initializeSchema()
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

async function initializeSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS school_support_messages (
      id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
      school_id bigint(20) UNSIGNED NOT NULL,
      author_role varchar(16) NOT NULL,
      author_email varchar(255) NOT NULL,
      message text NOT NULL,
      unread_for_admin tinyint(1) NOT NULL DEFAULT 0,
      unread_for_school tinyint(1) NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_support_school (school_id),
      KEY idx_support_created (created_at),
      KEY idx_support_unread_admin (unread_for_admin),
      KEY idx_support_unread_school (unread_for_school)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await migrateLegacyFeedback();
}

async function migrateLegacyFeedback(): Promise<void> {
  const tables = await query<Record<string, string>[]>(
    "SHOW TABLES LIKE 'school_feedback'",
  );
  if (!tables.length) {
    return;
  }

  await query(`
    INSERT INTO school_support_messages
      (school_id, author_role, author_email, message, unread_for_admin, unread_for_school, created_at)
    SELECT
      f.school_id,
      'school',
      f.actor_email,
      f.message,
      1,
      0,
      f.created_at
    FROM school_feedback f
    WHERE NOT EXISTS (
      SELECT 1
      FROM school_support_messages m
      WHERE m.school_id = f.school_id
        AND m.author_role = 'school'
        AND m.message = f.message
        AND m.created_at = f.created_at
    )
  `);
}

function normalizeMessage(raw: string): string {
  const message = raw.trim();
  if (!message) {
    throw new Error("Напишите сообщение");
  }
  if (message.length > MESSAGE_MAX) {
    throw new Error("Сообщение слишком длинное");
  }
  return message;
}

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function mapMessage(row: {
  id: number;
  school_id: number;
  author_role: SupportAuthorRole;
  author_email: string;
  message: string;
  created_at: Date | string;
}): SupportMessage {
  return {
    id: Number(row.id),
    schoolId: Number(row.school_id),
    authorRole: row.author_role === "admin" ? "admin" : "school",
    authorEmail: row.author_email,
    message: row.message,
    createdAt: toIso(row.created_at),
  };
}

async function listMessages(schoolId: number): Promise<SupportMessage[]> {
  const rows = await query<
    Array<{
      id: number;
      school_id: number;
      author_role: SupportAuthorRole;
      author_email: string;
      message: string;
      created_at: Date | string;
    }>
  >(
    `SELECT id, school_id, author_role, author_email, message, created_at
     FROM school_support_messages
     WHERE school_id = ?
     ORDER BY id ASC`,
    [schoolId],
  );
  return rows.map(mapMessage);
}

async function insertMessage(input: {
  schoolId: number;
  authorRole: SupportAuthorRole;
  authorEmail: string;
  message: string;
}): Promise<void> {
  await query(
    `INSERT INTO school_support_messages
      (school_id, author_role, author_email, message, unread_for_admin, unread_for_school)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.schoolId,
      input.authorRole,
      input.authorEmail,
      input.message,
      input.authorRole === "school" ? 1 : 0,
      input.authorRole === "admin" ? 1 : 0,
    ],
  );
}

export async function getSchoolSupportThread(
  schoolId: number,
): Promise<SupportThread> {
  await ensureSchoolFeedbackSchema();
  await query(
    `UPDATE school_support_messages
     SET unread_for_school = 0
     WHERE school_id = ? AND unread_for_school = 1`,
    [schoolId],
  );
  const [schoolName, messages] = await Promise.all([
    getSchoolName(schoolId),
    listMessages(schoolId),
  ]);
  return {
    schoolId,
    schoolName: schoolName?.trim() || "Школа",
    messages,
  };
}

export async function postSchoolSupportMessage(input: {
  schoolId: number;
  actorEmail: string;
  message: string;
}): Promise<SupportThread> {
  const message = normalizeMessage(input.message);
  await ensureSchoolFeedbackSchema();
  await insertMessage({
    schoolId: input.schoolId,
    authorRole: "school",
    authorEmail: input.actorEmail,
    message,
  });
  return getSchoolSupportThread(input.schoolId);
}

export async function countSchoolUnread(schoolId: number): Promise<number> {
  await ensureSchoolFeedbackSchema();
  const rows = await query<{ count: number }[]>(
    `SELECT COUNT(*) AS count
     FROM school_support_messages
     WHERE school_id = ? AND unread_for_school = 1`,
    [schoolId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function listAdminSupportConversations(): Promise<
  SupportConversation[]
> {
  await ensureSchoolFeedbackSchema();
  const rows = await query<
    Array<{
      school_id: number;
      school_name: string | null;
      last_message: string;
      last_author_role: SupportAuthorRole;
      last_at: Date | string;
      unread_count: number;
    }>
  >(
    `SELECT
       last.school_id,
       s.school_name,
       last.message AS last_message,
       last.author_role AS last_author_role,
       last.created_at AS last_at,
       (
         SELECT COUNT(*)
         FROM school_support_messages unread
         WHERE unread.school_id = last.school_id
           AND unread.unread_for_admin = 1
       ) AS unread_count
     FROM school_support_messages last
     INNER JOIN (
       SELECT school_id, MAX(id) AS max_id
       FROM school_support_messages
       GROUP BY school_id
     ) latest ON latest.max_id = last.id
     LEFT JOIN schools s ON s.id_school = last.school_id
     ORDER BY last.created_at DESC, last.id DESC`,
  );

  return rows.map((row) => ({
    schoolId: Number(row.school_id),
    schoolName: row.school_name?.trim() || `Школа №${row.school_id}`,
    lastMessage: row.last_message,
    lastAuthorRole: row.last_author_role === "admin" ? "admin" : "school",
    lastAt: toIso(row.last_at),
    unreadCount: Number(row.unread_count ?? 0),
  }));
}

export async function countAdminUnreadConversations(): Promise<number> {
  await ensureSchoolFeedbackSchema();
  const rows = await query<{ count: number }[]>(
    `SELECT COUNT(DISTINCT school_id) AS count
     FROM school_support_messages
     WHERE unread_for_admin = 1`,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function getAdminSupportThread(
  schoolId: number,
): Promise<SupportThread> {
  await ensureSchoolFeedbackSchema();
  const schoolName = (await getSchoolName(schoolId))?.trim() || "";
  const messages = await listMessages(schoolId);
  if (!schoolName && messages.length === 0) {
    throw new Error("Переписка не найдена");
  }
  await query(
    `UPDATE school_support_messages
     SET unread_for_admin = 0
     WHERE school_id = ? AND unread_for_admin = 1`,
    [schoolId],
  );
  return {
    schoolId,
    schoolName: schoolName || `Школа №${schoolId}`,
    messages: await listMessages(schoolId),
  };
}

export async function postAdminSupportMessage(input: {
  schoolId: number;
  actorEmail: string;
  message: string;
}): Promise<SupportThread> {
  const message = normalizeMessage(input.message);
  await ensureSchoolFeedbackSchema();
  const schoolName = (await getSchoolName(input.schoolId))?.trim() || "";
  const existing = await listMessages(input.schoolId);
  if (!schoolName && existing.length === 0) {
    throw new Error("Переписка не найдена");
  }
  await insertMessage({
    schoolId: input.schoolId,
    authorRole: "admin",
    authorEmail: input.actorEmail,
    message,
  });
  return getAdminSupportThread(input.schoolId);
}
