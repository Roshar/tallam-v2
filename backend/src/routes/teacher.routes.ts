import { Router } from "express";
import * as teacherCabinetController from "../controllers/teacher-cabinet.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Личный кабинет учителя. Отдельный роутер: школьные ручки остаются нетронутыми,
 * а здесь с самого начала стоит проверка роли — учитель не попадёт ни в один
 * школьный эндпоинт, потому что тот требует accountType = "school".
 */
const router = Router();

router.use(requireAuth, requireRole("teacher"));

router.get("/cabinet", teacherCabinetController.cabinet);
router.get("/analytics", teacherCabinetController.analytics);
router.get("/evaluations", teacherCabinetController.evaluations);
router.get("/evaluations/:cardId", teacherCabinetController.evaluationDetail);
router.get(
  "/evaluations/:cardId/recommendations",
  teacherCabinetController.evaluationRecommendations,
);

export default router;
