import { Router } from "express";
import * as auth from "../controllers/iro-auth.controller.js";
import * as analytics from "../controllers/iro-analytics.controller.js";
import {
  requireIroAuth,
  requireIroRole,
} from "../middleware/iro-auth.js";

const router = Router();

router.post("/auth/login", auth.login);
router.post("/auth/logout", requireIroAuth, auth.logout);
router.get("/auth/me", auth.me);

router.use(
  requireIroAuth,
  requireIroRole("iro_viewer", "iro_methodologist", "iro_admin"),
);
router.get("/meta/academic-years", analytics.academicYears);
router.get("/areas", analytics.areas);
router.get("/dashboard", analytics.dashboard);
router.get("/schools", analytics.schools);
router.get("/schools/:schoolId/analytics", analytics.schoolAnalytics);
router.get("/analytics", analytics.analytics);

export default router;
