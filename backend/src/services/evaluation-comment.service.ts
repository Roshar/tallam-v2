import type { PoolConnection } from "mysql2/promise";
import { query } from "../db/pool.js";

const ALLOWED_TAGS = new Set([
  "p",
  "div",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
]);

const VOID_TAGS = new Set(["br"]);
const COMMENT_MAX_LENGTH = 20_000;

let schemaReady: Promise<void> | null = null;

function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_NO_SUCH_TABLE"
  );
}

export async function ensureEvaluationCommentSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS evaluation_comments (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        card_id bigint(20) UNSIGNED NOT NULL,
        school_id bigint(20) UNSIGNED NOT NULL,
        body_html mediumtext NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_evaluation_comments_card (card_id),
        KEY idx_evaluation_comments_school (school_id)
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

export function sanitizeCommentHtml(raw: unknown): string {
  if (typeof raw !== "string") return "";

  let html = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|iframe|object|embed|textarea|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    )
    .replace(
      /<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|noscript)[^>]*>/gi,
      "",
    );

  html = html.replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g, (match, tagName) => {
    const tag = String(tagName).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const closing = match.startsWith("</");
    if (VOID_TAGS.has(tag)) return closing ? "" : "<br>";
    return closing ? `</${tag}>` : `<${tag}>`;
  });

  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  if (html.length > COMMENT_MAX_LENGTH) {
    html = html.slice(0, COMMENT_MAX_LENGTH);
  }

  return html.trim();
}

export async function getEvaluationCommentHtml(
  cardId: number,
  schoolId: number,
): Promise<string | null> {
  try {
    const rows = await query<{ body_html: string }[]>(
      `SELECT body_html
       FROM evaluation_comments
       WHERE card_id = ? AND school_id = ?
       LIMIT 1`,
      [cardId, schoolId],
    );
    const html = rows[0]?.body_html?.trim() || "";
    return html || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

export function commentHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function insertEvaluationComment(
  connection: PoolConnection,
  cardId: number,
  schoolId: number,
  rawHtml: unknown,
): Promise<void> {
  const bodyHtml = sanitizeCommentHtml(rawHtml);
  if (!bodyHtml) return;

  await connection.execute(
    `INSERT INTO evaluation_comments (card_id, school_id, body_html)
     VALUES (?, ?, ?)`,
    [cardId, schoolId, bodyHtml],
  );
}

export async function upsertEvaluationComment(
  cardId: number,
  schoolId: number,
  rawHtml: unknown,
): Promise<string | null> {
  await ensureEvaluationCommentSchema();
  const bodyHtml = sanitizeCommentHtml(rawHtml);
  if (!bodyHtml) {
    await query(
      "DELETE FROM evaluation_comments WHERE card_id = ? AND school_id = ?",
      [cardId, schoolId],
    );
    return null;
  }

  await query(
    `INSERT INTO evaluation_comments (card_id, school_id, body_html)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE body_html = VALUES(body_html)`,
    [cardId, schoolId, bodyHtml],
  );
  return bodyHtml;
}

export async function deleteEvaluationComment(
  connection: PoolConnection,
  cardId: number,
  schoolId: number,
): Promise<void> {
  try {
    await connection.execute(
      "DELETE FROM evaluation_comments WHERE card_id = ? AND school_id = ?",
      [cardId, schoolId],
    );
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}
