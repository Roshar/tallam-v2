import type { Request, Response } from "express";
import { isCardTypeKind } from "../services/evaluation-scale.js";
import * as iro from "../services/iro-analytics.service.js";

function academicYear(req: Request): number {
  const value = Number(req.query.academicYearStart);
  if (!Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new Error("Некорректный учебный год");
  }
  return value;
}

function cardType(req: Request) {
  const value = req.query.cardType;
  if (!isCardTypeKind(value)) {
    throw new Error("Параметр cardType обязателен: method или full");
  }
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || String(value).trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function run(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      return res.json(await handler(req));
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Некорректный запрос",
      });
    }
  };
}

export const academicYears = run(() => iro.getAcademicYears());
export const areas = run(() => iro.getAreas());
export const dashboard = run((req) => iro.getDashboard(academicYear(req)));

export const schools = run((req) =>
  iro.getSchools({
    year: academicYear(req),
    status: String(req.query.status ?? "all"),
    areaId: optionalNumber(req.query.areaId),
    coverageMin: optionalNumber(req.query.coverageMin),
    coverageMax: optionalNumber(req.query.coverageMax),
    search: String(req.query.search ?? "").trim(),
    page: Math.max(1, Number(req.query.page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(req.query.pageSize) || 20)),
    sort: String(req.query.sort ?? "name"),
  }),
);

export const schoolAnalytics = run((req) =>
  iro.getSchoolAnalytics(
    Number(req.params.schoolId),
    academicYear(req),
    cardType(req),
  ),
);

export const analytics = run((req) =>
  iro.getRepublicAnalytics(academicYear(req), cardType(req)),
);
