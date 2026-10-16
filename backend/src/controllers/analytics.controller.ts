import type { Request, Response } from "express";
import {
  AnalyticsError,
  currentAcademicYearStart,
  getSchoolAnalytics,
  getTeacherAnalytics,
} from "../services/analytics.service.js";
import { isCardTypeKind, type CardTypeKind } from "../services/evaluation-scale.js";

function getSchoolId(req: Request): number | null {
  const user = req.session.user;
  if (!user || user.accountType !== "school") {
    return null;
  }
  return user.schoolId;
}

function parseCardType(req: Request): CardTypeKind {
  const value = String(req.query.cardType ?? "").trim();
  return isCardTypeKind(value) ? value : "method";
}

/** Год по умолчанию - текущий учебный; заведомо чужие значения отсекаем. */
function parseAcademicYear(req: Request): number {
  const current = currentAcademicYearStart();
  const raw = String(req.query.academicYear ?? "").trim();
  if (!raw) return current;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 2000 || value > current + 1) {
    throw new AnalyticsError("Некорректный учебный год");
  }
  return value;
}

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof AnalyticsError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Analytics error:", error);
  return res.status(500).json({ error: fallback });
}

export async function teacherAnalytics(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const teacherId = String(req.params.teacherId ?? "").trim();
  if (!teacherId) {
    return res.status(400).json({ error: "Не указан идентификатор работника" });
  }

  try {
    const analytics = await getTeacherAnalytics(
      schoolId,
      teacherId,
      parseCardType(req),
      parseAcademicYear(req),
    );
    res.locals.auditDetails = { scope: "teacher", cardType: analytics.cardType };
    return res.json({ analytics });
  } catch (error) {
    return sendError(res, error, "Не удалось построить аналитику работника");
  }
}

export async function schoolAnalytics(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const analytics = await getSchoolAnalytics(
      schoolId,
      parseCardType(req),
      parseAcademicYear(req),
    );
    res.locals.auditDetails = { scope: "school", cardType: analytics.cardType };
    return res.json({ analytics });
  } catch (error) {
    return sendError(res, error, "Не удалось построить аналитику школы");
  }
}
