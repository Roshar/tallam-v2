import type { Request, Response } from "express";
import {
  closeVacancy,
  createVacancy,
  getVacancy,
  listVacancies,
  listVacancyFilters,
  parseVacancyInput,
  updateVacancy,
  VacancyError,
} from "../services/vacancy.service.js";

function getSchoolId(req: Request): number | null {
  const user = req.session.user;
  if (!user || user.accountType !== "school") return null;
  return user.schoolId;
}

function sendVacancyError(res: Response, error: unknown, fallback: string) {
  if (error instanceof VacancyError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

function optionalNumber(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

export async function vacancyFilters(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  try {
    return res.json(await listVacancyFilters(schoolId));
  } catch (error) {
    return sendVacancyError(res, error, "Не удалось загрузить фильтры вакансий");
  }
}

export async function vacancies(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const scope = req.query.scope === "others" ? "others" : "mine";
  const areaId = Number(req.query.areaId);
  try {
    return res.json(
      await listVacancies({
        viewerSchoolId: schoolId,
        scope,
        subject: String(req.query.subject ?? "").trim().slice(0, 200),
        areaId: Number.isInteger(areaId) && areaId > 0 ? areaId : null,
        school: String(req.query.school ?? "").trim().slice(0, 200),
        salaryFrom: optionalNumber(req.query.salaryFrom),
        hoursFrom: optionalNumber(req.query.hoursFrom),
        status: String(req.query.status ?? ""),
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      }),
    );
  } catch (error) {
    return sendVacancyError(res, error, "Не удалось загрузить вакансии");
  }
}

export async function vacancy(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  try {
    const item = await getVacancy(Number(req.params.vacancyId), schoolId);
    res.locals.auditDetails = {
      vacancyId: item.id,
      position: item.position,
      subject: item.subject,
      status: item.status,
    };
    return res.json(item);
  } catch (error) {
    return sendVacancyError(res, error, "Не удалось загрузить вакансию");
  }
}

export async function createSchoolVacancy(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  try {
    const input = parseVacancyInput(req.body);
    const created = await createVacancy(schoolId, input);
    res.locals.auditDetails = {
      vacancyId: created.id,
      position: created.position,
      subject: created.subject,
      status: created.status,
    };
    return res.status(201).json(created);
  } catch (error) {
    return sendVacancyError(res, error, "Не удалось создать вакансию");
  }
}

export async function updateSchoolVacancy(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  try {
    const input = parseVacancyInput(req.body);
    const updated = await updateVacancy(Number(req.params.vacancyId), schoolId, input);
    res.locals.auditDetails = {
      vacancyId: updated.id,
      position: updated.position,
      subject: updated.subject,
      status: updated.status,
    };
    return res.json(updated);
  } catch (error) {
    return sendVacancyError(res, error, "Не удалось сохранить вакансию");
  }
}

export async function closeSchoolVacancy(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  try {
    const closed = await closeVacancy(Number(req.params.vacancyId), schoolId);
    res.locals.auditDetails = {
      vacancyId: closed.id,
      position: closed.position,
      subject: closed.subject,
      status: closed.status,
    };
    return res.json(closed);
  } catch (error) {
    return sendVacancyError(res, error, "Не удалось закрыть вакансию");
  }
}
