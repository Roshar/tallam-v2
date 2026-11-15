import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { config } from "../config.js";
import { pool, query } from "../db/pool.js";
import { TALLAM_ASSISTANT_SYSTEM_PROMPT } from "../ai/tallam-assistant.system.js";
import {
  AI_TOOL_DEFINITIONS,
  executeAiTool,
  resolveInternalLinks,
  type AiToolSource,
} from "./ai-tools.service.js";

export interface AiChatResult {
  conversationId: number;
  title: string;
  message: { role: "assistant"; content: string };
  sources: AiToolSource[];
  usage: AiUsage;
}

export interface AiUsage {
  used: number;
  limit: number;
  remaining: number;
  monthLabel: string;
}

export interface AiConversationSummary {
  id: number;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface AiConversationMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: AiToolSource[];
  createdAt: string;
}

export class AiAssistantError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AiAssistantError";
    this.status = status;
  }
}

let schemaReady: Promise<void> | null = null;

async function ensureColumn(
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const rows = await query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [table, column],
  );
  if (!rows.length) {
    await query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
    );
  }
}

export async function ensureAiAssistantSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS ai_assistant_conversations (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          school_id bigint(20) UNSIGNED NOT NULL,
          user_id bigint(20) UNSIGNED NOT NULL,
          title varchar(255) NOT NULL DEFAULT 'Новый диалог',
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_ai_conversations_school_user (school_id, user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS ai_assistant_messages (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          conversation_id bigint(20) UNSIGNED NOT NULL,
          role enum('user','assistant') NOT NULL,
          content mediumtext NOT NULL,
          sources mediumtext DEFAULT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_ai_messages_conversation (conversation_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS ai_assistant_tool_calls (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          question_id bigint(20) UNSIGNED NOT NULL,
          school_id bigint(20) UNSIGNED NOT NULL,
          tool_name varchar(100) NOT NULL,
          source_type varchar(50) DEFAULT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_ai_tool_calls_question (question_id),
          KEY idx_ai_tool_calls_school (school_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS ai_assistant_questions (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          school_id bigint(20) UNSIGNED NOT NULL,
          user_id bigint(20) UNSIGNED DEFAULT NULL,
          question text NOT NULL,
          answer mediumtext DEFAULT NULL,
          status enum('ok','error','blocked') NOT NULL DEFAULT 'ok',
          model varchar(100) DEFAULT NULL,
          conversation_id bigint(20) UNSIGNED DEFAULT NULL,
          conversation_title varchar(255) DEFAULT NULL,
          prompt_tokens int(10) UNSIGNED DEFAULT NULL,
          completion_tokens int(10) UNSIGNED DEFAULT NULL,
          cost_usd decimal(12,6) DEFAULT NULL,
          error_message varchar(500) DEFAULT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          answered_at timestamp NULL DEFAULT NULL,
          PRIMARY KEY (id),
          KEY idx_ai_questions_school_created (school_id, created_at),
          KEY idx_ai_questions_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS ai_assistant_suggestions (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          school_id bigint(20) UNSIGNED NOT NULL,
          user_id bigint(20) UNSIGNED DEFAULT NULL,
          suggestion text NOT NULL,
          status enum('new','reviewed','archived') NOT NULL DEFAULT 'new',
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          reviewed_at timestamp NULL DEFAULT NULL,
          PRIMARY KEY (id),
          KEY idx_ai_suggestions_school (school_id, created_at),
          KEY idx_ai_suggestions_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await ensureColumn(
        "ai_assistant_questions",
        "conversation_id",
        "bigint(20) UNSIGNED DEFAULT NULL",
      );
      await ensureColumn(
        "ai_assistant_questions",
        "conversation_title",
        "varchar(255) DEFAULT NULL",
      );
      await ensureColumn(
        "ai_assistant_questions",
        "cost_usd",
        "decimal(12,6) DEFAULT NULL",
      );
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export function isAiAssistantSchool(schoolId: number): boolean {
  if (config.aiAssistant.schoolIds.includes(schoolId)) return true;
  return config.isDev && schoolId === 483;
}

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 6000;
const MAX_QUESTION_CHARS = 8000;
const dailyCounters = new Map<string, { day: string; count: number }>();

const CARD_LINK = /\/school\/lesson-analysis\/teachers\/([^/\s?#]+)\/cards\/(\d+)/;
const TEACHER_LINK = /\/school\/(?:lesson-analysis\/teachers|workers)\/([^/\s?#]+)/;
const ANALYTICS_LINK = /\/school\/analytics(?:[?#\s]|$)/;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function suggestConversationTitle(text: string): string {
  const raw = text.trim();
  if (CARD_LINK.test(raw)) return "Анализ урока";
  if (TEACHER_LINK.test(raw)) return "Карточка педагога";
  if (ANALYTICS_LINK.test(raw)) return "Аналитика школы";

  const lower = raw.toLowerCase();
  if (lower.includes("план урока")) return "План урока";
  if (lower.includes("план обучения")) return "План обучения";
  if (lower.includes("методическ") && lower.includes("план")) {
    return "Методический план";
  }
  if (lower.includes("слаб") && lower.includes("направлен")) {
    return "Слабые направления";
  }
  if (lower.includes("отчет") || lower.includes("отчёт") || lower.includes("справк")) {
    return "Аналитическая справка";
  }
  if (lower.includes("педагог") || lower.includes("учител")) {
    return "Работа с педагогами";
  }
  if (lower.includes("оценк") || lower.includes("результат") || lower.includes("анализ")) {
    return "Анализ результатов";
  }

  const cleaned = raw
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return capitalize((cleaned || "Новый диалог").slice(0, 60));
}

function cleanMessage(value: unknown): string {
  const text = String(value ?? "").trim().slice(0, MAX_MESSAGE_CHARS);
  if (!text) throw new AiAssistantError("Задайте вопрос");
  return text;
}

function consumeDailyLimit(schoolId: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${schoolId}:${day}`;
  const current = dailyCounters.get(key);
  if (!current || current.day !== day) {
    dailyCounters.set(key, { day, count: 1 });
    return true;
  }
  if (current.count >= config.aiAssistant.dailyLimit) return false;
  current.count += 1;
  return true;
}

function monthLabel(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export async function getMonthlyUsage(schoolId: number): Promise<AiUsage> {
  await ensureAiAssistantSchema();
  const rows = await query<{ used: number }[]>(
    `SELECT COUNT(*) AS used
     FROM ai_assistant_questions
     WHERE school_id = ? AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
    [schoolId],
  );
  const used = Number(rows[0]?.used ?? 0);
  const limit = config.aiAssistant.monthlyLimit;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    monthLabel: monthLabel(),
  };
}

async function logQuestion(
  schoolId: number,
  userId: number | null,
  question: string,
  conversationId: number | null,
  conversationTitle: string | null,
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO ai_assistant_questions
       (school_id, user_id, conversation_id, conversation_title, question, status, model)
     VALUES (?, ?, ?, ?, ?, 'ok', ?)`,
    [
      schoolId,
      userId,
      conversationId,
      conversationTitle ? conversationTitle.slice(0, 255) : null,
      question.slice(0, MAX_QUESTION_CHARS),
      config.deepseek.model,
    ],
  );
  return Number(result.insertId);
}

function estimateCostUsd(
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  if (promptTokens === null && completionTokens === null) return null;
  const cost =
    ((promptTokens ?? 0) / 1_000_000) * config.deepseek.inputPricePerM +
    ((completionTokens ?? 0) / 1_000_000) * config.deepseek.outputPricePerM;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

async function finishLog(
  logId: number,
  input: {
    status: "ok" | "error" | "blocked";
    answer?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    costUsd?: number | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  await query(
    `UPDATE ai_assistant_questions
     SET status = ?, answer = ?, prompt_tokens = ?, completion_tokens = ?,
         cost_usd = ?, error_message = ?, answered_at = NOW()
     WHERE id = ?`,
    [
      input.status,
      input.answer ?? null,
      input.promptTokens ?? null,
      input.completionTokens ?? null,
      input.costUsd ?? null,
      input.errorMessage ? input.errorMessage.slice(0, 500) : null,
      logId,
    ],
  );
}

async function logToolCall(
  questionId: number,
  schoolId: number,
  toolName: string,
  sourceType: string | null,
): Promise<void> {
  await query(
    `INSERT INTO ai_assistant_tool_calls
       (question_id, school_id, tool_name, source_type)
     VALUES (?, ?, ?, ?)`,
    [questionId, schoolId, toolName.slice(0, 100), sourceType?.slice(0, 50) ?? null],
  ).catch(() => undefined);
}

async function createConversation(
  schoolId: number,
  userId: number,
  title: string,
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO ai_assistant_conversations (school_id, user_id, title)
     VALUES (?, ?, ?)`,
    [schoolId, userId, title.slice(0, 255)],
  );
  return Number(result.insertId);
}

async function getConversation(
  schoolId: number,
  userId: number,
  conversationId: number,
): Promise<{ id: number; title: string; messages: AiConversationMessage[] } | null> {
  const rows = await query<
    (RowDataPacket & { id: number; title: string })[]
  >(
    `SELECT id, title FROM ai_assistant_conversations
     WHERE id = ? AND school_id = ? AND user_id = ?
     LIMIT 1`,
    [conversationId, schoolId, userId],
  );
  const conversation = rows[0];
  if (!conversation) return null;

  const messages = await query<
    (RowDataPacket & {
      id: number;
      role: "user" | "assistant";
      content: string;
      sources: string | null;
      createdAt: string;
    })[]
  >(
    `SELECT id, role, content, sources,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
     FROM ai_assistant_messages
     WHERE conversation_id = ?
     ORDER BY id ASC`,
    [conversationId],
  );

  return {
    id: Number(conversation.id),
    title: conversation.title,
    messages: messages.map((message) => ({
      id: Number(message.id),
      role: message.role,
      content: message.content,
      sources: message.sources ? (JSON.parse(message.sources) as AiToolSource[]) : [],
      createdAt: message.createdAt,
    })),
  };
}

async function appendMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string,
  sources: AiToolSource[] = [],
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO ai_assistant_messages (conversation_id, role, content, sources)
     VALUES (?, ?, ?, ?)`,
    [
      conversationId,
      role,
      content,
      sources.length ? JSON.stringify(sources) : null,
    ],
  );
  await query(
    "UPDATE ai_assistant_conversations SET updated_at = NOW() WHERE id = ?",
    [conversationId],
  );
  return Number(result.insertId);
}

export async function listConversations(
  schoolId: number,
  userId: number,
): Promise<AiConversationSummary[]> {
  await ensureAiAssistantSchema();
  const rows = await query<
    (RowDataPacket & {
      id: number;
      title: string;
      updatedAt: string;
      messageCount: number;
    })[]
  >(
    `SELECT c.id, c.title,
            DATE_FORMAT(c.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt,
            COUNT(m.id) AS messageCount
     FROM ai_assistant_conversations c
     LEFT JOIN ai_assistant_messages m ON m.conversation_id = c.id
     WHERE c.school_id = ? AND c.user_id = ?
     GROUP BY c.id
     ORDER BY c.updated_at DESC
     LIMIT 50`,
    [schoolId, userId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    updatedAt: row.updatedAt,
    messageCount: Number(row.messageCount),
  }));
}

export async function getConversationForUser(
  schoolId: number,
  userId: number,
  conversationId: number,
) {
  await ensureAiAssistantSchema();
  const conversation = await getConversation(schoolId, userId, conversationId);
  if (!conversation) {
    throw new AiAssistantError("Диалог не найден", 404);
  }
  return conversation;
}

interface DeepSeekToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface DeepSeekMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
}

async function callDeepSeek(
  messages: DeepSeekMessage[],
  withTools: boolean,
): Promise<{
  message: DeepSeekMessage;
  promptTokens: number | null;
  completionTokens: number | null;
}> {
  if (!config.deepseek.apiKey) {
    throw new AiAssistantError(
      "Чат пока не настроен: не задан ключ модели",
      503,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.deepseek.timeoutMs);

  try {
    const response = await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.deepseek.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.deepseek.model,
        messages,
        temperature: 0.3,
        max_tokens: config.deepseek.maxTokens,
        stream: false,
        ...(withTools
          ? { tools: AI_TOOL_DEFINITIONS, tool_choice: "auto" }
          : {}),
      }),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: { message?: DeepSeekMessage; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    if (!response.ok) {
      throw new AiAssistantError(
        data.error?.message
          ? `DeepSeek: ${data.error.message}`
          : `DeepSeek вернул ошибку ${response.status}`,
        502,
      );
    }

    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new AiAssistantError("Модель вернула пустой ответ", 502);
    }

    return {
      message,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
    };
  } catch (error) {
    if (error instanceof AiAssistantError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiAssistantError("Модель не ответила вовремя", 504);
    }
    throw new AiAssistantError(
      error instanceof Error ? error.message : "Ошибка обращения к модели",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function addSource(list: AiToolSource[], source: AiToolSource | null) {
  if (!source) return;
  const key = `${source.type}:${source.cardId ?? ""}:${source.teacherId ?? ""}:${source.academicYearLabel ?? ""}`;
  const exists = list.some(
    (item) =>
      `${item.type}:${item.cardId ?? ""}:${item.teacherId ?? ""}:${item.academicYearLabel ?? ""}` ===
      key,
  );
  if (!exists) list.push(source);
}

export async function chatWithAssistant(input: {
  schoolId: number;
  userId: number;
  conversationId?: number | null;
  message: unknown;
}): Promise<AiChatResult> {
  await ensureAiAssistantSchema();
  const text = cleanMessage(input.message);
  const usageBefore = await getMonthlyUsage(input.schoolId);

  if (usageBefore.remaining <= 0) {
    await logQuestion(input.schoolId, input.userId, text, null, null).then((logId) =>
      finishLog(logId, {
        status: "blocked",
        errorMessage: "Превышен месячный лимит запросов",
      }),
    );
    throw new AiAssistantError(
      `На этот месяц лимит запросов исчерпан (${usageBefore.limit}).`,
      429,
    );
  }
  if (!consumeDailyLimit(input.schoolId)) {
    throw new AiAssistantError(
      "Слишком много запросов за сегодня. Попробуйте завтра.",
      429,
    );
  }

  let conversationId = Number(input.conversationId ?? 0);
  let title = suggestConversationTitle(text);

  if (conversationId) {
    const conversation = await getConversation(
      input.schoolId,
      input.userId,
      conversationId,
    );
    if (!conversation) throw new AiAssistantError("Диалог не найден", 404);
    title = conversation.title;
  } else {
    conversationId = await createConversation(
      input.schoolId,
      input.userId,
      title,
    );
  }

  await appendMessage(conversationId, "user", text);
  const logId = await logQuestion(
    input.schoolId,
    input.userId,
    text,
    conversationId,
    title,
  );

  try {
    const historyRows = await query<
      (RowDataPacket & { role: "user" | "assistant"; content: string })[]
    >(
      `SELECT role, content FROM ai_assistant_messages
       WHERE conversation_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [conversationId, MAX_HISTORY],
    );
    const history = historyRows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));

    const link = await resolveInternalLinks(text, input.schoolId).catch(() => ({
      context: null,
      sources: [] as AiToolSource[],
    }));
    const systemContent = link.context
      ? `${TALLAM_ASSISTANT_SYSTEM_PROMPT}\n\nКонтекст внутренней ссылки:\n${link.context}`
      : TALLAM_ASSISTANT_SYSTEM_PROMPT;

    const transcript: DeepSeekMessage[] = [
      { role: "system", content: systemContent },
      ...history,
    ];
    const sources: AiToolSource[] = [];
    link.sources.forEach((source) => addSource(sources, source));
    for (const source of link.sources) {
      await logToolCall(logId, input.schoolId, "internal_link", source.type);
    }

    let promptTokens = 0;
    let completionTokens = 0;
    let content = "";

    for (let round = 0; round < 4; round += 1) {
      const response = await callDeepSeek(transcript, true);
      promptTokens += response.promptTokens ?? 0;
      completionTokens += response.completionTokens ?? 0;

      const toolCalls = response.message.tool_calls ?? [];
      if (toolCalls.length) {
        transcript.push({
          role: "assistant",
          content: response.message.content ?? "",
          tool_calls: toolCalls,
        });
        for (const call of toolCalls.slice(0, 3)) {
          let toolData: unknown = { error: "Инструмент недоступен" };
          let toolSource: AiToolSource | null = null;
          try {
            const result = await executeAiTool(
              call.function.name,
              call.function.arguments,
              input.schoolId,
            );
            toolData = result.data;
            toolSource = result.source;
            addSource(sources, result.source);
            await logToolCall(
              logId,
              input.schoolId,
              call.function.name,
              result.source?.type ?? null,
            );
          } catch (toolError) {
            console.error("AI tool error:", call.function.name, toolError);
          }
          transcript.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(toolData),
          });
        }
        continue;
      }

      content = response.message.content?.trim() ?? "";
      break;
    }

    if (!content) {
      throw new AiAssistantError("Модель не сформировала ответ", 502);
    }

    await appendMessage(conversationId, "assistant", content, sources);
    await finishLog(logId, {
      status: "ok",
      answer: content,
      promptTokens: promptTokens || null,
      completionTokens: completionTokens || null,
      costUsd: estimateCostUsd(
        promptTokens || null,
        completionTokens || null,
      ),
    });

    return {
      conversationId,
      title,
      message: { role: "assistant", content },
      sources,
      usage: {
        used: usageBefore.used + 1,
        limit: usageBefore.limit,
        remaining: Math.max(0, usageBefore.remaining - 1),
        monthLabel: usageBefore.monthLabel,
      },
    };
  } catch (error) {
    await finishLog(logId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Ошибка",
    }).catch(() => undefined);
    throw error;
  }
}

export interface AiQuestionLogRow extends RowDataPacket {
  id: number;
  schoolId: number;
  schoolName: string | null;
  userId: number | null;
  userEmail: string | null;
  question: string;
  answer: string | null;
  status: "ok" | "error" | "blocked";
  model: string | null;
  conversationId: number | null;
  conversationTitle: string | null;
  conversationExists: number | boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  createdAt: string;
  tools: string | null;
}

export interface AiQuestionLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  schoolId?: number | null;
}

export async function listAiQuestions(
  filters: AiQuestionLogFilters = {},
) {
  await ensureAiAssistantSchema();
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(200, Math.max(10, filters.limit || 50));
  const offset = (page - 1) * limit;
  const conditions: string[] = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.schoolId) {
    conditions.push("q.school_id = ?");
    params.push(filters.schoolId);
  }
  if (filters.search?.trim()) {
    const search = `%${filters.search.trim().slice(0, 100)}%`;
    conditions.push("(q.question LIKE ? OR s.school_name LIKE ? OR u.email LIKE ?)");
    params.push(search, search, search);
  }
  const where = conditions.join(" AND ");

  const rows = await query<AiQuestionLogRow[]>(
    `SELECT q.id, q.school_id AS schoolId, s.school_name AS schoolName,
            q.user_id AS userId, u.email AS userEmail,
            q.question, q.answer, q.status, q.model,
            q.conversation_id AS conversationId,
            q.conversation_title AS conversationTitle,
            EXISTS(
              SELECT 1 FROM ai_assistant_conversations c
              WHERE c.id = q.conversation_id
            ) AS conversationExists,
            q.prompt_tokens AS promptTokens,
            q.completion_tokens AS completionTokens,
            q.cost_usd AS costUsd,
            DATE_FORMAT(q.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
            (SELECT GROUP_CONCAT(DISTINCT tc.tool_name ORDER BY tc.tool_name SEPARATOR ', ')
             FROM ai_assistant_tool_calls tc
             WHERE tc.question_id = q.id) AS tools
     FROM ai_assistant_questions q
     LEFT JOIN schools s ON s.id_school = q.school_id
     LEFT JOIN users u ON u.id = q.user_id
     WHERE ${where}
     ORDER BY q.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const countRows = await query<{ count: number }[]>(
    `SELECT COUNT(*) AS count
     FROM ai_assistant_questions q
     LEFT JOIN schools s ON s.id_school = q.school_id
     LEFT JOIN users u ON u.id = q.user_id
     WHERE ${where}`,
    params,
  );
  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      schoolId: Number(row.schoolId),
      schoolName: row.schoolName,
      userId: row.userId === null ? null : Number(row.userId),
      userEmail: row.userEmail,
      question: row.question,
      answer: row.answer,
      status: row.status,
      model: row.model,
      conversationId:
        row.conversationId === null ? null : Number(row.conversationId),
      conversationTitle: row.conversationTitle,
      conversationExists: Boolean(row.conversationExists),
      promptTokens:
        row.promptTokens === null ? null : Number(row.promptTokens),
      completionTokens:
        row.completionTokens === null ? null : Number(row.completionTokens),
      costUsd: row.costUsd === null ? null : Number(row.costUsd),
      createdAt: row.createdAt,
      tools: row.tools,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function createAiSuggestion(input: {
  schoolId: number;
  userId: number;
  suggestion: unknown;
}) {
  await ensureAiAssistantSchema();
  const text = String(input.suggestion ?? "").trim().slice(0, 4000);
  if (text.length < 5) {
    throw new AiAssistantError("Опишите предложение подробнее", 400);
  }
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO ai_assistant_suggestions (school_id, user_id, suggestion)
     VALUES (?, ?, ?)`,
    [input.schoolId, input.userId, text],
  );
  return { id: Number(result.insertId) };
}

export async function listAiSuggestions(limit = 100) {
  await ensureAiAssistantSchema();
  const safeLimit = Math.min(200, Math.max(10, limit));
  const rows = await query<
    (RowDataPacket & {
      id: number;
      schoolId: number;
      schoolName: string | null;
      userId: number | null;
      userEmail: string | null;
      suggestion: string;
      status: string;
      createdAt: string;
    })[]
  >(
    `SELECT sg.id, sg.school_id AS schoolId, s.school_name AS schoolName,
            sg.user_id AS userId, u.email AS userEmail, sg.suggestion, sg.status,
            DATE_FORMAT(sg.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
     FROM ai_assistant_suggestions sg
     LEFT JOIN schools s ON s.id_school = sg.school_id
     LEFT JOIN users u ON u.id = sg.user_id
     ORDER BY sg.id DESC
     LIMIT ?`,
    [safeLimit],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    schoolId: Number(row.schoolId),
    schoolName: row.schoolName,
    userId: row.userId === null ? null : Number(row.userId),
    userEmail: row.userEmail,
    suggestion: row.suggestion,
    status: row.status,
    createdAt: row.createdAt,
  }));
}

export async function getRepeatedAiQuestions(days = 30) {
  await ensureAiAssistantSchema();
  const safeDays = Math.min(365, Math.max(1, Number(days) || 30));
  return query<
    (RowDataPacket & {
      normalized: string;
      sample: string;
      total: number;
      schools: number;
      lastAt: string;
    })[]
  >(
    `SELECT LOWER(TRIM(q.question)) AS normalized,
            MIN(q.question) AS sample,
            COUNT(*) AS total,
            COUNT(DISTINCT q.school_id) AS schools,
            DATE_FORMAT(MAX(q.created_at), '%Y-%m-%dT%H:%i:%sZ') AS lastAt
     FROM ai_assistant_questions q
     WHERE q.created_at >= DATE_SUB(NOW(), INTERVAL ${safeDays} DAY)
     GROUP BY normalized
     HAVING COUNT(*) > 1
     ORDER BY total DESC
     LIMIT 20`,
  );
}

export async function deleteAiConversation(input: {
  schoolId: number;
  userId: number;
  conversationId: number;
}) {
  await ensureAiAssistantSchema();
  const conversation = await getConversation(
    input.schoolId,
    input.userId,
    input.conversationId,
  );
  if (!conversation) {
    throw new AiAssistantError("Диалог не найден", 404);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "DELETE FROM ai_assistant_messages WHERE conversation_id = ?",
      [input.conversationId],
    );
    await connection.query(
      `DELETE FROM ai_assistant_conversations
       WHERE id = ? AND school_id = ? AND user_id = ?`,
      [input.conversationId, input.schoolId, input.userId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function purgeAiLogs(days?: number | null) {
  await ensureAiAssistantSchema();
  const safeDays = Math.min(
    3650,
    Math.max(1, Number(days) || config.aiAssistant.logRetentionDays),
  );
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [toolResult] = await connection.query<ResultSetHeader>(
      `DELETE FROM ai_assistant_tool_calls
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ${safeDays} DAY)`,
    );
    const [questionResult] = await connection.query<ResultSetHeader>(
      `DELETE FROM ai_assistant_questions
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ${safeDays} DAY)`,
    );
    await connection.commit();
    return {
      days: safeDays,
      deletedQuestions: Number(questionResult.affectedRows ?? 0),
      deletedToolCalls: Number(toolResult.affectedRows ?? 0),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getAdminAiUsage() {
  await ensureAiAssistantSchema();
  const rows = await query<
    (RowDataPacket & {
      schoolId: number;
      schoolName: string | null;
      questions: number;
      promptTokens: number;
      completionTokens: number;
      costUsd: number;
    })[]
  >(
    `SELECT q.school_id AS schoolId, s.school_name AS schoolName,
            COUNT(*) AS questions,
            COALESCE(SUM(q.prompt_tokens), 0) AS promptTokens,
            COALESCE(SUM(q.completion_tokens), 0) AS completionTokens,
            COALESCE(SUM(COALESCE(
              q.cost_usd,
              (COALESCE(q.prompt_tokens, 0) / 1000000) * ? +
              (COALESCE(q.completion_tokens, 0) / 1000000) * ?
            )), 0) AS costUsd
     FROM ai_assistant_questions q
     LEFT JOIN schools s ON s.id_school = q.school_id
     WHERE q.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
     GROUP BY q.school_id
     ORDER BY questions DESC`,
    [config.deepseek.inputPricePerM, config.deepseek.outputPricePerM],
  );

  const items = rows.map((row) => ({
    schoolId: Number(row.schoolId),
    schoolName: row.schoolName,
    questions: Number(row.questions),
    promptTokens: Number(row.promptTokens),
    completionTokens: Number(row.completionTokens),
    estimatedCostUsd: Math.round(Number(row.costUsd) * 1000000) / 1000000,
  }));

  return {
    items,
    totals: {
      questions: items.reduce((sum, item) => sum + item.questions, 0),
      promptTokens: items.reduce((sum, item) => sum + item.promptTokens, 0),
      completionTokens: items.reduce(
        (sum, item) => sum + item.completionTokens,
        0,
      ),
      estimatedCostUsd:
        Math.round(
          items.reduce((sum, item) => sum + item.estimatedCostUsd, 0) *
            1000000,
        ) / 1000000,
    },
    monthLabel: monthLabel(),
    retentionDays: config.aiAssistant.logRetentionDays,
  };
}
