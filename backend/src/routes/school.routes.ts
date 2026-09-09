import { Router } from "express";
import * as schoolController from "../controllers/school.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("school"));

router.get("/profile", schoolController.schoolProfile);
router.get("/dashboard", schoolController.schoolDashboard);
router.get("/workers/form-options", schoolController.workerFormOptions);
router.get("/workers/export", schoolController.exportWorkersBank);
router.get("/workers", schoolController.listWorkers);
router.post("/workers", schoolController.createWorker);
router.get("/workers/:teacherId", schoolController.getWorker);
router.put("/workers/:teacherId", schoolController.updateWorker);
router.post(
  "/workers/:teacherId/projects/:projectId",
  schoolController.addWorkerToProject,
);
router.delete(
  "/workers/:teacherId/projects/:projectId",
  schoolController.removeWorkerFromProject,
);
router.get("/projects/lesson-analysis", schoolController.listLessonAnalysis);
router.get(
  "/projects/lesson-analysis/teachers/:teacherId",
  schoolController.getLessonAnalysisTeacher,
);
router.post(
  "/projects/lesson-analysis/teachers/:teacherId/cards",
  schoolController.createLessonAnalysisEvaluation,
);

export default router;
