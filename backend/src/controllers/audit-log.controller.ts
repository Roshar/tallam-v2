import type { Request, Response } from "express";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  listAuditLogs,
  type AuditStatus,
} from "../services/audit-log.service.js";

export async function logs(req: Request, res: Response) {
  try {
    return res.json(
      await listAuditLogs({
        page: Number(req.query.page ?? 1) || 1,
        limit: Number(req.query.limit ?? 50) || 50,
        category: String(req.query.category ?? ""),
        action: String(req.query.action ?? ""),
        email: String(req.query.email ?? ""),
        status: String(req.query.status ?? "") as AuditStatus | "",
        dateFrom: String(req.query.dateFrom ?? ""),
        dateTo: String(req.query.dateTo ?? ""),
      }),
    );
  } catch (error) {
    console.error("Admin audit logs error:", error);
    return res.status(500).json({ error: "Не удалось загрузить журнал действий" });
  }
}

export function options(_req: Request, res: Response) {
  return res.json({
    categories: AUDIT_CATEGORIES,
    actions: AUDIT_ACTIONS,
  });
}

