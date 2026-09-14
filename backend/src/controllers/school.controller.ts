import type { Request, Response } from "express";
import { getSchoolName, countTeachers } from "../services/auth.service.js";
import { getSchoolProfile } from "../services/school.service.js";
import {
  addTeacherToProject,
  removeTeacherFromProject,
} from "../services/project.service.js";
import {
  buildTeachersBankExcel,
  createSchoolTeacher,
  getLessonAnalysisTeachers,
  getSchoolTeacher,
  getWorkerFormOptions,
  listSchoolTeachers,
  updateSchoolTeacher,
  type CreateTeacherInput,
  type UpdateTeacherInput,
} from "../services/teachers.service.js";
import { getProjectTeacherEvaluations, createProjectTeacherEvaluation, getSchoolEvaluationYearStats } from "../services/card.service.js";
import { getSchoolSubscriptionOverview } from "../services/school-subscription.service.js";
import {
  buildRenewalDocument,
  RenewalDocumentUnavailableError,
} from "../services/subscription-documents.service.js";
import {
  getLatestSchoolRenewal,
  submitSchoolRenewal,
} from "../services/subscription-renewal.service.js";

function getSchoolId(req: Request): number | null {
  const user = req.session.user;
  if (!user || user.accountType !== "school") {
    return null;
  }
  return user.schoolId;
}

export async function schoolProfile(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const profile = await getSchoolProfile(schoolId);
  if (!profile) {
    return res.status(404).json({ error: "Школа не найдена" });
  }

  return res.json({
    ...profile,
    email: req.session.user!.email,
  });
}

export async function schoolDashboard(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const [schoolName, teachersCount, evaluations] = await Promise.all([
      getSchoolName(schoolId),
      countTeachers(schoolId),
      getSchoolEvaluationYearStats(schoolId, 3),
    ]);

    return res.json({
      schoolName,
      teachersCount,
      schoolId,
      evaluations,
    });
  } catch (error) {
    console.error("School dashboard error:", error);
    return res.status(500).json({ error: "Не удалось загрузить статистику" });
  }
}

export async function listWorkers(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Number.parseInt(String(req.query.limit ?? "20"), 10);

  try {
    const result = await listSchoolTeachers(schoolId, { page, limit });
    return res.json(result);
  } catch (error) {
    console.error("List workers error:", error);
    return res.status(500).json({ error: "Не удалось загрузить список работников" });
  }
}

export async function workerFormOptions(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const options = await getWorkerFormOptions(schoolId);
    return res.json(options);
  } catch (error) {
    console.error("Worker form options error:", error);
    return res.status(500).json({ error: "Не удалось загрузить справочники" });
  }
}

function parseWorkerBody(body: Partial<CreateTeacherInput & UpdateTeacherInput>) {
  if (!body.surname?.trim() || !body.firstname?.trim() || !body.birthday) {
    return { error: "Укажите фамилию, имя и дату рождения" as const };
  }

  if (!body.genderId || !body.educationLevelId || !body.positionId) {
    return {
      error: "Укажите пол, уровень образования и должность" as const,
    };
  }

  return {
    data: {
      surname: body.surname,
      firstname: body.firstname,
      patronymic: body.patronymic,
      birthday: body.birthday,
      snils: body.snils,
      genderId: Number(body.genderId),
      specialty: body.specialty,
      educationLevelId: Number(body.educationLevelId),
      diploma: body.diploma,
      positionId: Number(body.positionId),
      totalExperience: body.totalExperience ? Number(body.totalExperience) : undefined,
      teachingExperience: body.teachingExperience
        ? Number(body.teachingExperience)
        : undefined,
      categoryId: body.categoryId ? Number(body.categoryId) : undefined,
      phone: body.phone,
      email: body.email,
      disciplineIds: body.disciplineIds?.map(Number),
      kpkPlace: body.kpkPlace,
      kpkYear: body.kpkYear,
    },
  };
}

export async function getWorker(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const teacherId = String(req.params.teacherId ?? "").trim();
  if (!teacherId) {
    return res.status(400).json({ error: "Не указан идентификатор работника" });
  }

  try {
    const teacher = await getSchoolTeacher(schoolId, teacherId);
    if (!teacher) {
      return res.status(404).json({ error: "Работник не найден" });
    }

    return res.json({ teacher });
  } catch (error) {
    console.error("Get worker error:", error);
    return res.status(500).json({ error: "Не удалось загрузить карточку работника" });
  }
}

export async function updateWorker(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const teacherId = String(req.params.teacherId ?? "").trim();
  if (!teacherId) {
    return res.status(400).json({ error: "Не указан идентификатор работника" });
  }

  const parsed = parseWorkerBody(req.body);
  if ("error" in parsed) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const teacher = await updateSchoolTeacher(schoolId, teacherId, parsed.data);
    if (!teacher) {
      return res.status(404).json({ error: "Работник не найден" });
    }

    return res.json({ teacher });
  } catch (error) {
    console.error("Update worker error:", error);
    return res.status(500).json({ error: "Не удалось обновить данные работника" });
  }
}

export async function createWorker(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const body = req.body as Partial<CreateTeacherInput & { disciplineIds: number[] }>;
  const parsed = parseWorkerBody(body);
  if ("error" in parsed) {
    return res.status(400).json({ error: parsed.error });
  }

  if (!body.projectId) {
    return res.status(400).json({ error: "Выберите участие в проекте" });
  }

  try {
    const teacher = await createSchoolTeacher(schoolId, {
      ...parsed.data,
      projectId: Number(body.projectId),
    });

    return res.status(201).json({ teacher });
  } catch (error) {
    console.error("Create worker error:", error);
    return res.status(500).json({ error: "Не удалось добавить работника" });
  }
}

export async function exportWorkersBank(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const { buffer, filename } = await buildTeachersBankExcel(schoolId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.send(buffer);
  } catch (error) {
    console.error("Export workers bank error:", error);
    return res.status(500).json({ error: "Не удалось сформировать файл" });
  }
}

export async function listLessonAnalysis(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const data = await getLessonAnalysisTeachers(schoolId);
    return res.json(data);
  } catch (error) {
    console.error("List lesson analysis error:", error);
    return res.status(500).json({ error: "Не удалось загрузить участников проекта" });
  }
}

export async function getLessonAnalysisTeacher(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const teacherId = String(req.params.teacherId ?? "").trim();
  if (!teacherId) {
    return res.status(400).json({ error: "Не указан идентификатор учителя" });
  }

  const sourceRaw = String(req.query.source ?? "").trim();
  const disciplineRaw = String(req.query.discipline ?? "").trim();
  const sourceId = sourceRaw ? Number.parseInt(sourceRaw, 10) : undefined;
  const disciplineId = disciplineRaw
    ? Number.parseInt(disciplineRaw, 10)
    : undefined;

  try {
    const data = await getProjectTeacherEvaluations(schoolId, teacherId, {
      sourceId:
        sourceId && Number.isFinite(sourceId) && sourceId > 0
          ? sourceId
          : undefined,
      disciplineId:
        disciplineId && Number.isFinite(disciplineId) && disciplineId > 0
          ? disciplineId
          : undefined,
    });

    if (!data) {
      return res.status(404).json({
        error: "Учитель не найден в проекте «Анализ урока»",
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("Get lesson analysis teacher error:", error);
    return res.status(500).json({
      error: "Не удалось загрузить профиль учителя в проекте",
    });
  }
}

export async function createLessonAnalysisEvaluation(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const teacherId = String(req.params.teacherId ?? "").trim();
  if (!teacherId) {
    return res.status(400).json({ error: "Не указан идентификатор учителя" });
  }

  const body = req.body as {
    cardType?: string;
    disciplineId?: number;
    classId?: number;
    literClass?: string;
    sourceId?: number;
    dateCreate?: string;
    thema?: string;
    sourceFio?: string;
    positionName?: string;
    sourceWorkplace?: string;
    scores?: Record<string, number>;
  };

  if (body.cardType !== "method" && body.cardType !== "full") {
    return res.status(400).json({ error: "Выберите тип карты оценки" });
  }

  if (!body.scores || typeof body.scores !== "object") {
    return res.status(400).json({ error: "Укажите оценки по критериям" });
  }

  try {
    const result = await createProjectTeacherEvaluation(schoolId, teacherId, {
      cardType: body.cardType,
      disciplineId: Number(body.disciplineId),
      classId: Number(body.classId),
      literClass: body.literClass,
      sourceId: Number(body.sourceId),
      dateCreate: String(body.dateCreate ?? ""),
      thema: String(body.thema ?? ""),
      sourceFio: body.sourceFio,
      positionName: body.positionName,
      sourceWorkplace: body.sourceWorkplace,
      scores: Object.fromEntries(
        Object.entries(body.scores).map(([key, value]) => [key, Number(value)]),
      ),
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error("Create evaluation error:", error);
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить оценку";

    if (
      message.includes("Missing") ||
      message.includes("Invalid") ||
      message.includes("Outside") ||
      message.includes("критерий") ||
      message.includes("not in project")
    ) {
      return res.status(400).json({
        error:
          message === "Teacher not in project"
            ? "Учитель не найден в проекте"
            : message === "Outside evaluator fields required"
              ? "Для внешней оценки укажите ФИО, должность и место работы эксперта"
              : message === "Missing required fields"
                ? "Заполните предмет, класс, дату, тему и тип оценки"
                : "Проверьте заполнение формы оценки",
      });
    }

    return res.status(500).json({ error: "Не удалось сохранить оценку" });
  }
}

export async function addWorkerToProject(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const teacherId = String(req.params.teacherId ?? "").trim();
  const projectId = Number.parseInt(String(req.params.projectId ?? ""), 10);

  if (!teacherId || !projectId) {
    return res.status(400).json({ error: "Укажите работника и проект" });
  }

  try {
    await addTeacherToProject(schoolId, teacherId, projectId);
    const teacher = await getSchoolTeacher(schoolId, teacherId);
    if (!teacher) {
      return res.status(404).json({ error: "Работник не найден" });
    }
    return res.json({ teacher });
  } catch (error) {
    console.error("Add worker to project error:", error);
    return res.status(500).json({ error: "Не удалось добавить работника в проект" });
  }
}

export async function removeWorkerFromProject(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const teacherId = String(req.params.teacherId ?? "").trim();
  const projectId = Number.parseInt(String(req.params.projectId ?? ""), 10);

  if (!teacherId || !projectId) {
    return res.status(400).json({ error: "Укажите работника и проект" });
  }

  try {
    await removeTeacherFromProject(schoolId, teacherId, projectId);
    const teacher = await getSchoolTeacher(schoolId, teacherId);
    if (!teacher) {
      return res.status(404).json({ error: "Работник не найден" });
    }
    return res.json({ teacher });
  } catch (error) {
    console.error("Remove worker from project error:", error);
    return res.status(500).json({ error: "Не удалось исключить работника из проекта" });
  }
}

export async function schoolSubscription(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const overview = await getSchoolSubscriptionOverview(schoolId);
    if (!overview) {
      return res.status(404).json({ error: "Школа не найдена" });
    }
    return res.json(overview);
  } catch (error) {
    console.error("School subscription error:", error);
    return res.status(500).json({ error: "Не удалось загрузить данные подписки" });
  }
}

export async function schoolRenewal(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    return res.json({ request: await getLatestSchoolRenewal(schoolId) });
  } catch (error) {
    console.error("School renewal error:", error);
    return res.status(500).json({ error: "Не удалось загрузить заявку" });
  }
}

export async function submitRenewal(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const request = await submitSchoolRenewal(schoolId, req.body);
    return res.status(201).json({ request });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось отправить заявку";
    if (
      message.includes("поле") ||
      message.includes("паспорт") ||
      message.includes("подразделения") ||
      message.includes("ИНН") ||
      message.includes("согласие") ||
      message.includes("Статус заявки")
    ) {
      return res.status(400).json({ error: message });
    }
    console.error("Submit school renewal error:", error);
    return res.status(500).json({ error: "Не удалось отправить заявку" });
  }
}

async function downloadRenewalDocument(
  req: Request,
  res: Response,
  kind: "contract" | "invoice",
) {
  const schoolId = getSchoolId(req);
  const requestId = Number(req.params.requestId);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор заявки" });
  }

  try {
    const document = await buildRenewalDocument({
      requestId,
      kind,
      schoolId,
    });
    if (!document) {
      return res.status(404).json({ error: "Документ не найден" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
    );
    return res.send(document.buffer);
  } catch (error) {
    if (error instanceof RenewalDocumentUnavailableError) {
      return res.status(409).json({ error: error.message });
    }
    console.error(`School renewal ${kind} error:`, error);
    return res.status(500).json({ error: "Не удалось сформировать документ" });
  }
}

export async function schoolRenewalContract(req: Request, res: Response) {
  return downloadRenewalDocument(req, res, "contract");
}

export async function schoolRenewalInvoice(req: Request, res: Response) {
  return downloadRenewalDocument(req, res, "invoice");
}
