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
router.get("/presence", schoolController.schoolPresence);
router.post(
  "/password",
  auditHttpAction({
    category: "password",
    action: "password.changed",
  }),
  schoolController.changeSchoolPassword,
);
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

router.use(requireActiveSchoolCabinet);

router.get("/dashboard", schoolController.schoolDashboard);
router.get("/feedback/unread", schoolController.schoolFeedbackUnread);
router.get("/feedback", schoolController.schoolFeedbackThread);
router.post(
  "/feedback",
  auditHttpAction({
    category: "cabinet",
    action: "cabinet.feedback_submit",
  }),
  schoolController.sendSchoolFeedback,
);
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
router.get(
  "/projects/lesson-analysis/teachers/:teacherId/cards/:cardId",
  auditHttpAction({
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_view",
    entityType: "card",
    entityId: (req) => req.params.cardId,
  }),
  schoolController.getLessonAnalysisEvaluation,
);
router.get(
  "/projects/lesson-analysis/teachers/:teacherId/cards/:cardId/recommendations",
  auditHttpAction({
    category: "lesson_analysis",
    action: "lesson_analysis.recommendations_download",
    entityType: "card",
    entityId: (req) => req.params.cardId,
  }),
  schoolController.downloadEvaluationRecommendations,
);
router.patch(
  "/projects/lesson-analysis/teachers/:teacherId/cards/:cardId/comment",
  auditHttpAction({
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_comment_update",
    entityType: "card",
    entityId: (req) => req.params.cardId,
  }),
  schoolController.updateLessonAnalysisEvaluationComment,
);
router.post(
  "/projects/lesson-analysis/teachers/:teacherId/cards/:cardId/email",
  auditHttpAction({
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_email",
    entityType: "card",
    entityId: (req) => req.params.cardId,
  }),
  schoolController.emailLessonAnalysisEvaluation,
);
router.delete(
  "/projects/lesson-analysis/teachers/:teacherId/cards/:cardId",
  auditHttpAction({
    category: "lesson_analysis",
    action: "lesson_analysis.evaluation_delete",
    entityType: "card",
    entityId: (req) => req.params.cardId,
  }),
  schoolController.deleteLessonAnalysisEvaluation,
);

export default router;
