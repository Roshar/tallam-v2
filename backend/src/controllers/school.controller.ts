import type { Request, Response } from "express";
import { config } from "../config.js";
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
import {
  buildRecommendationsPdf,
  deleteEvaluation,
  getEvaluationDetail,
  sendEvaluationToTeacher,
} from "../services/card-view.service.js";
import { upsertEvaluationComment } from "../services/evaluation-comment.service.js";
import {
  countSchoolUnread,
  getSchoolSupportThread,
  postSchoolSupportMessage,
} from "../services/school-feedback.service.js";
import { getSchoolSubscriptionOverview } from "../services/school-subscription.service.js";
import {
  buildRenewalDocument,
  RenewalDocumentUnavailableError,
} from "../services/subscription-documents.service.js";
import {
  getLatestSchoolRenewal,
  submitSchoolRenewal,
} from "../services/subscription-renewal.service.js";
import { changeSchoolCabinetPassword } from "../services/password-reset.service.js";

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

export async function schoolPresence(_req: Request, res: Response) {
  return res.json({ ok: true });
}

export async function schoolFeedbackUnread(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const unread = await countSchoolUnread(schoolId);
    return res.json({ unread });
  } catch (error) {
    console.error("School feedback unread error:", error);
    return res.status(500).json({ error: "Не удалось загрузить отзывы" });
  }
}

export async function schoolFeedbackThread(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const thread = await getSchoolSupportThread(schoolId);
    return res.json(thread);
  } catch (error) {
    console.error("School feedback thread error:", error);
    return res.status(500).json({ error: "Не удалось загрузить переписку" });
  }
}

export async function sendSchoolFeedback(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const body = req.body as { message?: string };
  try {
    const thread = await postSchoolSupportMessage({
      schoolId,
      actorEmail: req.session.user!.email,
      message: String(body.message ?? ""),
    });
    return res.json(thread);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось отправить сообщение";
    if (message.includes("сообщение") || message.includes("длинное")) {
      return res.status(400).json({ error: message });
    }
    console.error("School feedback error:", error);
    return res.status(500).json({ error: "Не удалось отправить сообщение" });
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

  if (!body.disciplineIds?.length) {
    return {
      error:
        "Выберите хотя бы один предмет. Без предмета нельзя добавить оценку урока. Если это не учитель, отметьте «Администрация»." as const,
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
    const message = error instanceof Error ? error.message : "";
    if (message.includes("СНИЛС")) {
      return res.status(400).json({ error: message });
    }
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
    const message = error instanceof Error ? error.message : "";
    if (message.includes("СНИЛС")) {
      return res.status(400).json({ error: message });
    }
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
    commentHtml?: string;
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
      commentHtml: body.commentHtml,
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

function parseCardParams(req: Request) {
  const schoolId = getSchoolId(req);
  const teacherId = String(req.params.teacherId ?? "").trim();
  const cardId = Number(req.params.cardId);
  return { schoolId, teacherId, cardId };
}

export async function getLessonAnalysisEvaluation(req: Request, res: Response) {
  const { schoolId, teacherId, cardId } = parseCardParams(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  if (!teacherId || !Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: "Некорректные параметры оценки" });
  }

  try {
    const detail = await getEvaluationDetail(schoolId, teacherId, cardId);
    if (!detail) {
      return res.status(404).json({ error: "Оценка не найдена" });
    }
    return res.json(detail);
  } catch (error) {
    console.error("Get evaluation error:", error);
    return res.status(500).json({ error: "Не удалось загрузить оценку" });
  }
}

export async function downloadEvaluationRecommendations(
  req: Request,
  res: Response,
) {
  const { schoolId, teacherId, cardId } = parseCardParams(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  if (!teacherId || !Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: "Некорректные параметры оценки" });
  }

  try {
    const detail = await getEvaluationDetail(schoolId, teacherId, cardId);
    if (!detail) {
      return res.status(404).json({ error: "Оценка не найдена" });
    }
    const buffer = await buildRecommendationsPdf(detail);
    const filename = `rekomendacii-${detail.teacher.fullName.replace(/\s+/g, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.send(buffer);
  } catch (error) {
    console.error("Evaluation recommendations error:", error);
    return res.status(500).json({
      error: "Не удалось сформировать методические рекомендации",
    });
  }
}

export async function updateLessonAnalysisEvaluationComment(
  req: Request,
  res: Response,
) {
  const { schoolId, teacherId, cardId } = parseCardParams(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  if (!teacherId || !Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: "Некорректные параметры оценки" });
  }

  try {
    const detail = await getEvaluationDetail(schoolId, teacherId, cardId);
    if (!detail) {
      return res.status(404).json({ error: "Оценка не найдена" });
    }

    const commentHtml = await upsertEvaluationComment(
      cardId,
      schoolId,
      (req.body as { commentHtml?: unknown })?.commentHtml,
    );

    return res.json({ commentHtml });
  } catch (error) {
    console.error("Update evaluation comment error:", error);
    return res.status(500).json({
      error: "Не удалось сохранить комментарий",
    });
  }
}

export async function emailLessonAnalysisEvaluation(req: Request, res: Response) {
  const { schoolId, teacherId, cardId } = parseCardParams(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  if (!teacherId || !Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: "Некорректные параметры оценки" });
  }

  const email = String((req.body as { email?: string })?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Укажите корректный адрес электронной почты" });
  }

  try {
    const detail = await getEvaluationDetail(schoolId, teacherId, cardId);
    if (!detail) {
      return res.status(404).json({ error: "Оценка не найдена" });
    }
    await sendEvaluationToTeacher(detail, email);
    return res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Почтовый сервер не настроен")) {
      return res.status(503).json({ error: message });
    }
    console.error("Email evaluation error:", error);
    return res.status(500).json({ error: "Не удалось отправить письмо" });
  }
}

export async function deleteLessonAnalysisEvaluation(
  req: Request,
  res: Response,
) {
  const { schoolId, teacherId, cardId } = parseCardParams(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  if (!teacherId || !Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: "Некорректные параметры оценки" });
  }

  try {
    const deleted = await deleteEvaluation(schoolId, teacherId, cardId);
    if (!deleted) {
      return res.status(404).json({ error: "Оценка не найдена" });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("Delete evaluation error:", error);
    return res.status(500).json({ error: "Не удалось удалить оценку" });
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

export async function changeSchoolPassword(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  if (req.session.impersonator) {
    return res.status(403).json({
      error: "Смену пароля нельзя выполнять из режима входа как школа",
    });
  }

  const body = req.body as { password?: string; confirmPassword?: string };

  try {
    const result = await changeSchoolCabinetPassword(
      schoolId,
      String(body.password ?? ""),
      String(body.confirmPassword ?? ""),
      `school:${req.session.user?.email ?? "unknown"}`,
    );

    req.session.destroy((err) => {
      if (err) {
        console.error("School session destroy after password change:", err);
      }
      res.clearCookie(config.session.name);
      return res.json({
        ok: true,
        message: "Пароль обновлён. Войдите с новым паролем.",
        email: result.email,
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось изменить пароль";
    if (
      message.includes("парол") ||
      message.includes("Парол") ||
      message.includes("не найден")
    ) {
      return res.status(400).json({ error: message });
    }
    console.error("School password change error:", error);
    return res.status(500).json({ error: "Не удалось изменить пароль" });
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

async function downloadRenewalDocument(req: Request, res: Response) {
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
    console.error("School renewal document error:", error);
    return res.status(500).json({ error: "Не удалось сформировать документ" });
  }
}

export async function schoolRenewalContract(req: Request, res: Response) {
  return downloadRenewalDocument(req, res);
}
