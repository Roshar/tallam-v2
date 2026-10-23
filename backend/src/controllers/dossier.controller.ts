import type { Request, Response } from "express";
import {
  DossierError,
  getTeacherDossier,
} from "../services/teacher-dossier.service.js";

function getSchoolId(req: Request): number | null {
  const user = req.session.user;
  if (!user || user.accountType !== "school") return null;
  return user.schoolId;
}

export async function teacherDossierHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });

  try {
    const dossier = await getTeacherDossier(
      schoolId,
      String(req.params.teacherId),
    );
    res.locals.auditDetails = { teacherId: String(req.params.teacherId) };
    return res.json({ dossier });
  } catch (error) {
    if (error instanceof DossierError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Teacher dossier error:", error);
    return res.status(500).json({ error: "Не удалось загрузить дело учителя" });
  }
}
