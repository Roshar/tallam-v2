import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import * as passwordResetController from "../controllers/password-reset.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { auditHttpAction } from "../services/audit-log.service.js";

const router = Router();

router.post(
  "/login",
  auditHttpAction({
    category: "auth",
    action: "auth.login",
    actorEmail: (req) => String(req.body?.email ?? ""),
    details: (req) => ({ requestedAccountType: req.body?.accountType }),
  }),
  authController.login,
);
router.post(
  "/logout",
  auditHttpAction({ category: "auth", action: "auth.logout" }),
  authController.logout,
);
router.get("/me", authController.me);
router.post(
  "/stop-impersonation",
  requireAuth,
  authController.stopImpersonation,
);
router.post(
  "/forgot-password",
  auditHttpAction({
    category: "password",
    action: "password.reset_requested",
    actorEmail: (req) => String(req.body?.email ?? ""),
  }),
  passwordResetController.forgotPassword,
);
router.get("/reset-password/:token", passwordResetController.checkResetToken);
router.post("/reset-password/:token", passwordResetController.resetPassword);

export default router;
