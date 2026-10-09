import type { Request, Response } from "express";
import {
  deleteSchoolTeacher,
  previewTeacherDeletion,
  TeacherDeletionError,
} from "../services/teacher-delete.service.js";

function getSchoolId(req: Request): number | null {
  const user = req.session.user;
  if (!user || user.accountType !== "school") {
    return null;
  }
  return user.schoolId;
}

function teacherIdFrom(req: Request): string {
  return String(req.params.teacherId ?? "").trim();
}

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof TeacherDeletionError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Teacher deletion error:", error);
  return res.status(500).json({ error: fallback });
}

export async function previewWorkerDeletion(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    const preview = await previewTeacherDeletion(schoolId, teacherIdFrom(req));
    return res.json({ preview });
  } catch (error) {
    return sendError(res, error, "Не удалось подготовить удаление работника");
  }
}

export async function deleteWorker(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const teacherId = teacherIdFrom(req);
  if (!teacherId) {
    return res.status(400).json({ error: "Не указан идентификатор работника" });
  }

  try {
    const deleted = await deleteSchoolTeacher(schoolId, teacherId);

    // Попадает в журнал действий вместе с тем, что именно было удалено.
    res.locals.auditDetails = {
      fullName: deleted.fullName,
      evaluations: deleted.evaluations,
      comments: deleted.comments,
      projects: deleted.projects,
    };

    return res.json({ deleted });
  } catch (error) {
    return sendError(res, error, "Не удалось удалить работника");
  }
}
