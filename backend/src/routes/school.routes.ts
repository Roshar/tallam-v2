import { Router } from "express";
import * as schoolController from "../controllers/school.controller.js";
import {
  requireAuth,
  requireActiveSchoolCabinet,
  requireRole,
  requireSchoolSession,
} from "../middleware/auth.js";
import { auditHttpAction } from "../services/audit-log.service.js";

const router = Router();

router.use(requireAuth, requireRole("school"), requireSchoolSession);

router.get("/profile", schoolController.schoolProfile);
router.get(
  "/subscription",
  auditHttpAction({
    category: "subscription",
    action: "subscription.view",
  }),
  schoolController.schoolSubscription,
);
router.get(
  "/subscription/renewal",
  auditHttpAction({
    category: "subscription",
    action: "subscription.renewal_view",
  }),
  schoolController.schoolRenewal,
);
router.post(
  "/subscription/renewal",
  auditHttpAction({
    category: "subscription",
    action: "subscription.renewal_submit",
    entityType: "renewal_request",
  }),
  schoolController.submitRenewal,
);
router.get(
  "/subscription/renewal/:requestId/contract",
  auditHttpAction({
    category: "subscription",
    action: "subscription.contract_download",
    entityType: "renewal_request",
    entityId: (req) => req.params.requestId,
  }),
  schoolController.schoolRenewalContract,
);
router.get(
  "/subscription/renewal/:requestId/invoice",
  auditHttpAction({
    category: "subscription",
    action: "subscription.invoice_download",
    entityType: "renewal_request",
    entityId: (req) => req.params.requestId,
  }),
  schoolController.schoolRenewalInvoice,
);

router.use(requireActiveSchoolCabinet);

router.get("/dashboard", schoolController.schoolDashboard);
router.get("/workers/form-options", schoolController.workerFormOptions);
router.get(
  "/workers/export",
  auditHttpAction({ category: "teachers", action: "teacher.export" }),
  schoolController.exportWorkersBank,
);
router.get(
  "/workers",
  auditHttpAction({ category: "teachers", action: "teacher.list" }),
  schoolController.listWorkers,
);
router.post(
  "/workers",
  auditHttpAction({
    category: "teachers",
    action: "teacher.create",
    entityType: "teacher",
  }),
  schoolController.createWorker,
);
router.get(
  "/workers/:teacherId",
  auditHttpAction({
    category: "teachers",
    action: "teacher.view",
    entityType: "teacher",
    entityId: (req) => req.params.teacherId,
  }),
  schoolController.getWorker,
);
router.put(
  "/workers/:teacherId",
  auditHttpAction({
    category: "teachers",
    action: "teacher.update",
    entityType: "teacher",
    entityId: (req) => req.params.teacherId,
  }),
  schoolController.updateWorker,
);
router.post(
  "/workers/:teacherId/projects/:projectId",
  auditHttpAction({
    category: "teachers",
    action: "teacher.project_add",
    entityType: "teacher",
    entityId: (req) => req.params.teacherId,
    details: (req) => ({ projectId: req.params.projectId }),
  }),
  schoolController.addWorkerToProject,
);
router.delete(
  "/workers/:teacherId/projects/:projectId",
  auditHttpAction({
    category: "teachers",
    action: "teacher.project_remove",
    entityType: "teacher",
    entityId: (req) => req.params.teacherId,
    details: (req) => ({ projectId: req.params.projectId }),
  }),
  schoolController.removeWorkerFromProject,
);
router.get(
  "/projects/lesson-analysis",
  auditHttpAction({
    category: "lesson_analysis",
    action: "lesson_analysis.list",
  }),
  schoolController.listLessonAnalysis,
);
router.get(
  "/projects/lesson-analysis/teachers/:teacherId",
  auditHttpAction({
    category: "lesson_analysis",
    action: "lesson_analysis.teacher_view",
    entityType: "teacher",
    entityId: (req) => req.params.teacherId,
  }),
  schoolController.getLessonAnalysisTeacher,
);
router.post(
  "/projects/lesson-analysis/teachers/:teacherId/cards",
  auditHttpAction({
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_create",
    entityType: "teacher",
    entityId: (req) => req.params.teacherId,
    details: (req) => ({ cardType: req.body?.cardType }),
  }),
  schoolController.createLessonAnalysisEvaluation,
);

export default router;
