import type { Request, RequestHandler } from "express";
import type { ResultSetHeader } from "mysql2";
import { query } from "../db/pool.js";

export type AuditStatus = "success" | "failure";

export const AUDIT_ACTIONS = [
  { category: "auth", action: "auth.login", label: "Авторизация" },
  { category: "auth", action: "auth.logout", label: "Выход из системы" },
  {
    category: "auth",
    action: "auth.impersonate_school",
    label: "Вход под учётной записью школы",
  },
  {
    category: "auth",
    action: "auth.impersonation_stopped",
    label: "Возврат из кабинета школы",
  },
  {
    category: "password",
    action: "password.reset_requested",
    label: "Обращение о восстановлении доступа",
  },
  {
    category: "password",
    action: "password.recovery_processed",
    label: "Обращение обработано",
  },
  {
    category: "password",
    action: "password.changed",
    label: "Смена пароля",
  },
  {
    category: "password",
    action: "password.admin_link_created",
    label: "Создание ссылки смены пароля",
  },
  {
    category: "subscription",
    action: "subscription.view",
    label: "Просмотр подписки",
  },
  {
    category: "subscription",
    action: "subscription.renewal_view",
    label: "Просмотр заявки на продление",
  },
  {
    category: "subscription",
    action: "subscription.renewal_submit",
    label: "Отправка заявки на продление",
  },
  {
    category: "subscription",
    action: "subscription.contract_download",
    label: "Скачивание договора",
  },
  {
    category: "subscription",
    action: "subscription.invoice_download",
    label: "Скачивание счёта",
  },
  {
    category: "subscription",
    action: "subscription.payment_confirmed",
    label: "Подтверждение оплаты",
  },
  {
    category: "subscription",
    action: "subscription.period_created",
    label: "Добавление периода подписки",
  },
  {
    category: "subscription",
    action: "subscription.period_updated",
    label: "Изменение периода подписки",
  },
  {
    category: "subscription",
    action: "subscription.cabinet_activated",
    label: "Активация кабинета",
  },
  {
    category: "subscription",
    action: "subscription.cabinet_blocked",
    label: "Блокировка кабинета",
  },
  {
    category: "teachers",
    action: "teacher.list",
    label: "Просмотр списка работников",
  },
  {
    category: "teachers",
    action: "teacher.view",
    label: "Просмотр работника",
  },
  {
    category: "teachers",
    action: "teacher.create",
    label: "Добавление работника",
  },
  {
    category: "teachers",
    action: "teacher.update",
    label: "Изменение работника",
  },
  {
    category: "teachers",
    action: "teacher.export",
    label: "Экспорт работников",
  },
  {
    category: "teachers",
    action: "teacher.project_add",
    label: "Добавление работника в проект",
  },
  {
    category: "teachers",
    action: "teacher.project_remove",
    label: "Исключение работника из проекта",
  },
  {
    category: "lesson_analysis",
    action: "lesson_analysis.list",
    label: "Просмотр участников анализа урока",
  },
  {
    category: "lesson_analysis",
    action: "lesson_analysis.teacher_view",
    label: "Просмотр анализа работника",
  },
  {
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_create",
    label: "Добавление оценки урока",
  },
  {
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_view",
    label: "Просмотр оценки урока",
  },
  {
    category: "lesson_analysis",
    action: "lesson_analysis.recommendations_download",
    label: "Скачивание методических рекомендаций",
  },
  {
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_email",
    label: "Отправка оценки учителю",
  },
  {
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_comment_update",
    label: "Изменение комментария к оценке",
  },
  {
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_delete",
    label: "Удаление оценки урока",
  },
  {
    category: "cabinet",
    action: "school.created",
    label: "Регистрация школы",
  },
  {
    category: "cabinet",
    action: "cabinet.feedback_submit",
    label: "Сообщение из кабинета школы",
  },
  {
    category: "cabinet",
    action: "cabinet.feedback_reply",
    label: "Ответ администрации на отзыв школы",
  },
] as const;

export const AUDIT_CATEGORIES = [
  { value: "auth", label: "Авторизация" },
  { value: "password", label: "Пароли" },
  { value: "subscription", label: "Подписка" },
  { value: "teachers", label: "Работники" },
  { value: "lesson_analysis", label: "Анализ урока" },
  { value: "cabinet", label: "Кабинет школы" },
] as const;

export interface AuditLogItem {
  id: number;
  actorUserId: number | null;
  actorEmail: string;
  actorAccountType: string | null;
  schoolId: number | null;
  category: string;
  action: string;
  status: AuditStatus;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogRow {
  id: number;
  actorUserId: number | null;
  actorEmail: string;
  actorAccountType: string | null;
  schoolId: number | null;
  category: string;
  action: string;
  status: AuditStatus;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

let schemaReady: Promise<void> | null = null;

export async function ensureAuditLogSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        actor_user_id bigint(20) UNSIGNED DEFAULT NULL,
        actor_email varchar(255) NOT NULL,
        actor_account_type varchar(30) DEFAULT NULL,
        school_id bigint(20) UNSIGNED DEFAULT NULL,
        category varchar(40) NOT NULL,
        action varchar(100) NOT NULL,
        status enum('success','failure') NOT NULL,
        entity_type varchar(50) DEFAULT NULL,
        entity_id varchar(100) DEFAULT NULL,
        details json DEFAULT NULL,
        ip_address varchar(64) DEFAULT NULL,
        user_agent varchar(500) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_audit_created (created_at),
        KEY idx_audit_action_created (action, created_at),
        KEY idx_audit_email_created (actor_email, created_at),
        KEY idx_audit_category_created (category, created_at),
        KEY idx_audit_status_created (status, created_at),
        KEY idx_audit_school_created (school_id, created_at)
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

const BLOCKED_DETAIL_KEYS =
  /password|token|passport|inn|address|customer|cipher|secret/i;

function sanitizeDetails(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (BLOCKED_DETAIL_KEYS.test(key)) continue;
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      clean[key] = typeof item === "string" ? item.slice(0, 500) : item;
    }
  }
  return Object.keys(clean).length ? clean : null;
}

export async function recordAuditLog(input: {
  actorUserId?: number | null;
  actorEmail: string;
  actorAccountType?: string | null;
  schoolId?: number | null;
  category: string;
  action: string;
  status: AuditStatus;
  entityType?: string | null;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await ensureAuditLogSchema();
  const email = input.actorEmail.trim().toLowerCase().slice(0, 255) || "unknown";
  await query<ResultSetHeader>(
    `INSERT INTO audit_logs (
       actor_user_id, actor_email, actor_account_type, school_id,
       category, action, status, entity_type, entity_id, details,
       ip_address, user_agent
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.actorUserId ?? null,
      email,
      input.actorAccountType?.slice(0, 30) ?? null,
      input.schoolId ?? null,
      input.category.slice(0, 40),
      input.action.slice(0, 100),
      input.status,
      input.entityType?.slice(0, 50) ?? null,
      input.entityId === null || input.entityId === undefined
        ? null
        : String(input.entityId).slice(0, 100),
      JSON.stringify(sanitizeDetails(input.details)),
      input.ipAddress?.slice(0, 64) ?? null,
      input.userAgent?.slice(0, 500) ?? null,
    ],
  );
}

function clientIp(req: Request): string | null {
  return req.ip || req.socket.remoteAddress || null;
}

export function auditHttpAction(options: {
  category: string;
  action: string;
  entityType?: string;
  entityId?: (
    req: Request,
  ) => string | string[] | number | null | undefined;
  actorEmail?: (req: Request) => string | null | undefined;
  details?: (req: Request) => Record<string, unknown> | null;
}): RequestHandler {
  return (req, res, next) => {
    const initialUser = req.session?.user;
    const fallbackEmail = options.actorEmail?.(req)?.trim() || "";
    const ipAddress = clientIp(req);
    const userAgent = req.get("user-agent") ?? null;
    const rawEntityId = options.entityId?.(req) ?? null;
    const entityId = Array.isArray(rawEntityId)
      ? rawEntityId.join(",")
      : rawEntityId;
    const details = options.details?.(req) ?? null;

    res.once("finish", () => {
      const user = req.session?.user ?? initialUser;
      void recordAuditLog({
        actorUserId: user?.id ?? null,
        actorEmail: user?.email ?? fallbackEmail ?? "unknown",
        actorAccountType: user?.accountType ?? null,
        schoolId: user?.schoolId || null,
        category: options.category,
        action: options.action,
        status: res.statusCode < 400 ? "success" : "failure",
        entityType: options.entityType ?? null,
        entityId,
        details: {
          httpStatus: res.statusCode,
          ...details,
        },
        ipAddress,
        userAgent,
      }).catch((error) => {
        console.error("Audit log write failed:", error);
      });
    });

    next();
  };
}

function parseDetails(
  value: AuditLogRow["details"],
): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function listAuditLogs(input: {
  page: number;
  limit: number;
  category?: string;
  action?: string;
  email?: string;
  status?: AuditStatus | "";
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  items: AuditLogItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  await ensureAuditLogSchema();
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(20, input.limit || 50));
  const offset = (page - 1) * limit;
  const conditions: string[] = ["1 = 1"];
  const params: unknown[] = [];
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  if (input.category?.trim()) {
    conditions.push("category = ?");
    params.push(input.category.trim().slice(0, 40));
  }
  if (input.action?.trim()) {
    conditions.push("action = ?");
    params.push(input.action.trim().slice(0, 100));
  }
  if (input.email?.trim()) {
    conditions.push("actor_email LIKE ?");
    params.push(`%${input.email.trim().slice(0, 100)}%`);
  }
  if (input.status === "success" || input.status === "failure") {
    conditions.push("status = ?");
    params.push(input.status);
  }
  if (input.dateFrom && isoDate.test(input.dateFrom)) {
    conditions.push("created_at >= ?");
    params.push(`${input.dateFrom} 00:00:00`);
  }
  if (input.dateTo && isoDate.test(input.dateTo)) {
    conditions.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(`${input.dateTo} 00:00:00`);
  }

  const where = conditions.join(" AND ");
  const rows = await query<AuditLogRow[]>(
    `SELECT
       id,
       actor_user_id AS actorUserId,
       actor_email AS actorEmail,
       actor_account_type AS actorAccountType,
       school_id AS schoolId,
       category,
       action,
       status,
       entity_type AS entityType,
       entity_id AS entityId,
       details,
       ip_address AS ipAddress,
       user_agent AS userAgent,
       DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt
     FROM audit_logs
     WHERE ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const countRows = await query<{ count: number }[]>(
    `SELECT COUNT(*) AS count FROM audit_logs WHERE ${where}`,
    params,
  );
  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows.map((row) => ({
      ...row,
      id: Number(row.id),
      actorUserId: row.actorUserId ? Number(row.actorUserId) : null,
      schoolId: row.schoolId ? Number(row.schoolId) : null,
      details: parseDetails(row.details),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

