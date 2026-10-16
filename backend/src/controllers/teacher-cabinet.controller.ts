import type { Request, Response } from "express";
import {
  buildRecommendationsPdf,
  getEvaluationDetail,
} from "../services/card-view.service.js";
import { getTeacherAnalytics } from "../services/analytics.service.js";
import {
  getTeacherCabinetContext,
  type TeacherCabinetContext,
} from "../services/teacher-account.service.js";
import {
  academicYearLabel,
  academicYearRange,
  currentAcademicYearStart,
  evaluationsForYear,
  getTeacherOverview,
  listTeacherCards,
} from "../services/teacher-cabinet.service.js";
import { isCardTypeKind, type CardTypeKind } from "../services/evaluation-scale.js";

/**
 * Личный кабинет учителя. Идентификатор учителя берётся ТОЛЬКО из сессии:
 * подставить чужой id через URL или параметры невозможно — эндпоинты его не
 * принимают. Школьные ручки при этом недоступны, потому что требуют
 * accountType = "school".
 */

interface TeacherSession {
  accountId: number;
  teacherId: string;
}

function getTeacherSession(req: Request): TeacherSession | null {
  const user = req.session.user;
  if (!user || user.accountType !== "teacher" || !user.teacherId) {
    return null;
  }
  return { accountId: user.id, teacherId: user.teacherId };
}

function parseCardType(req: Request): CardTypeKind {
  const value = String(req.query.cardType ?? "").trim();
  return isCardTypeKind(value) ? value : "method";
}

function parseAcademicYear(req: Request): number {
  const current = currentAcademicYearStart();
  const raw = String(req.query.academicYear ?? "").trim();
  if (!raw) return current;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 2000 || value > current + 1) {
    throw new Error("bad-year");
  }
  return value;
}

async function loadContext(
  req: Request,
  res: Response,
): Promise<TeacherCabinetContext | null> {
  const session = getTeacherSession(req);
  if (!session) {
    res.status(403).json({ error: "Доступ только для учителя" });
    return null;
  }

  const context = await getTeacherCabinetContext(session.teacherId);
  if (!context) {
    res.status(404).json({ error: "Карточка учителя не найдена" });
    return null;
  }
  return context;
}

/** Главная: кто я, мои результаты по обеим картам и доступные годы. */
export async function cabinet(req: Request, res: Response) {
  try {
    const context = await loadContext(req, res);
    if (!context) return;

    const academicYearStart = parseAcademicYear(req);
    const cards = await listTeacherCards(context.schoolId, context.teacherId);
    const overview = getTeacherOverview(cards, academicYearStart);
    const { from, to } = academicYearRange(academicYearStart);

    return res.json({
      context,
      academicYearStart,
      academicYearLabel: academicYearLabel(academicYearStart),
      academicYears: overview.academicYears,
      cardTypes: overview.cardTypeSummaries,
      totalEvaluations: cards.length,
      evaluationsInYear: cards.filter(
        (card) => card.academicYearStart === academicYearStart,
      ).length,
      period: { from, to },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "bad-year") {
      return res.status(400).json({ error: "Некорректный учебный год" });
    }
    console.error("Teacher cabinet error:", error);
    return res.status(500).json({ error: "Не удалось загрузить кабинет" });
  }
}

/** Динамика, разделы, сильные стороны и зоны развития по выбранной карте. */
export async function analytics(req: Request, res: Response) {
  const context = await loadContext(req, res);
  if (!context) return;

  try {
    const data = await getTeacherAnalytics(
      context.schoolId,
      context.teacherId,
      parseCardType(req),
      parseAcademicYear(req),
    );
    return res.json({ analytics: data });
  } catch (error) {
    if (error instanceof Error && error.message === "bad-year") {
      return res.status(400).json({ error: "Некорректный учебный год" });
    }
    console.error("Teacher analytics error:", error);
    return res.status(500).json({ error: "Не удалось построить аналитику" });
  }
}

/** История оцениваний за выбранный учебный год. */
export async function evaluations(req: Request, res: Response) {
  try {
    const context = await loadContext(req, res);
    if (!context) return;

    const academicYearStart = parseAcademicYear(req);
    const cards = await listTeacherCards(context.schoolId, context.teacherId);

    return res.json({
      academicYearStart,
      academicYearLabel: academicYearLabel(academicYearStart),
      academicYears: getTeacherOverview(cards, academicYearStart).academicYears,
      evaluations: evaluationsForYear(cards, academicYearStart),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "bad-year") {
      return res.status(400).json({ error: "Некорректный учебный год" });
    }
    console.error("Teacher evaluations error:", error);
    return res.status(500).json({ error: "Не удалось загрузить оценки" });
  }
}

/**
 * Подробная карта. Используется существующий просмотр оценки: он сам проверяет,
 * что карта принадлежит этому учителю и этой школе, поэтому чужой id вернёт 404.
 */
export async function evaluationDetail(req: Request, res: Response) {
  const context = await loadContext(req, res);
  if (!context) return;

  const cardId = Number.parseInt(String(req.params.cardId ?? ""), 10);
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: "Некорректная оценка" });
  }

  try {
    const detail = await getEvaluationDetail(
      context.schoolId,
      context.teacherId,
      cardId,
    );
    if (!detail) {
      return res.status(404).json({ error: "Оценка не найдена" });
    }
    return res.json({ detail });
  } catch (error) {
    console.error("Teacher evaluation detail error:", error);
    return res.status(500).json({ error: "Не удалось загрузить оценку" });
  }
}

/**
 * Методические рекомендации по своей оценке — тот же PDF, что школа скачивает
 * из карточки. Учитель получает его только для своих оценок: карта ищется по
 * идентификатору из сессии, поэтому чужой id вернёт 404.
 */
export async function evaluationRecommendations(req: Request, res: Response) {
  const context = await loadContext(req, res);
  if (!context) return;

  const cardId = Number.parseInt(String(req.params.cardId ?? ""), 10);
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: "Некорректная оценка" });
  }

  try {
    const detail = await getEvaluationDetail(
      context.schoolId,
      context.teacherId,
      cardId,
    );
    if (!detail) {
      return res.status(404).json({ error: "Оценка не найдена" });
    }

    const buffer = await buildRecommendationsPdf(detail);
    const safeName = detail.teacher.fullName.replace(/\s+/g, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(
        `rekomendacii-${safeName}.pdf`,
      )}`,
    );
    return res.send(buffer);
  } catch (error) {
    console.error("Teacher recommendations error:", error);
    return res
      .status(500)
      .json({ error: "Не удалось сформировать методические рекомендации" });
  }
}
