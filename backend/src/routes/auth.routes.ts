import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", authController.me);
router.get(
  "/school/dashboard",
  requireAuth,
  requireRole("school"),
  authController.schoolDashboard,
);

export default router;
