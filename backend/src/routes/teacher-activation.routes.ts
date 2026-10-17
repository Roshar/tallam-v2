import { Router } from "express";
import * as activationController from "../controllers/teacher-activation.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Активация кабинета учителя.
 *
 * Публичные маршруты (`/activate/:token`) намеренно без авторизации: по ссылке
 * учитель попадает снаружи, до создания пароля. Доступ к ним дает только сам
 * токен - 32 случайных байта, одноразовый и с ограниченным сроком.
 */
const router = Router();

router.get("/activate/:token", activationController.preview);
router.post("/activate/:token/code", activationController.requestCode);
router.post("/activate/:token/complete", activationController.complete);

router.use("/school", requireAuth, requireRole("school"));
router.get("/school/overview", activationController.overview);
router.post("/school/invite", activationController.invite);
router.post("/school/invite/send", activationController.sendInvite);
router.post("/school/revoke", activationController.revoke);

export default router;
