import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";
import * as auditLogController from "../controllers/audit-log.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { auditHttpAction } from "../services/audit-log.service.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/logs/options", auditLogController.options);
router.get("/logs", auditLogController.logs);
router.get("/dashboard", adminController.dashboard);
router.get(
  "/backup",
  auditHttpAction({
    category: "system",
    action: "database.backup_downloaded",
    entityType: "database",
  }),
  adminController.downloadDatabaseBackup,
);
router.get("/online-schools", adminController.onlineSchools);
router.get("/schools/areas", adminController.schoolAreas);
router.get("/schools/email-availability", adminController.schoolEmailAvailability);
router.post(
  "/schools",
  auditHttpAction({
    category: "cabinet",
    action: "school.created",
    entityType: "school",
    details: (req) => ({
      schoolName: String(req.body?.schoolName ?? "").slice(0, 255),
      email: String(req.body?.email ?? "").slice(0, 150),
      areaId: Number(req.body?.areaId ?? 0) || null,
    }),
  }),
  adminController.createSchool,
);
router.get("/schools", adminController.schools);
router.post(
  "/schools/:schoolId/impersonate",
  adminController.impersonateSchool,
);
router.get("/schools/:schoolId", adminController.schoolDetail);
router.patch(
  "/schools/:schoolId",
  auditHttpAction({
    category: "cabinet",
    action: "school.renamed",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
    details: (req) => ({
      schoolName: String(req.body?.schoolName ?? "").slice(0, 255),
    }),
  }),
  adminController.renameSchool,
);
router.post(
  "/schools/:schoolId/purge-workers",
  auditHttpAction({
    category: "cabinet",
    action: "school.workers_cleared",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
  }),
  adminController.purgeSchoolWorkers,
);
router.get("/subscriptions/areas", adminController.subscriptionAreas);
router.get("/subscriptions/export", adminController.exportSubscriptions);
router.get("/subscriptions", adminController.subscriptions);
router.get("/renewals", adminController.renewalRequests);
router.get("/renewals/pending-count", adminController.renewalQueueCount);
router.get("/feedback/unread-count", adminController.adminFeedbackUnread);
router.get("/feedback", adminController.adminFeedbackList);
router.get("/feedback/:schoolId", adminController.adminFeedbackThread);
router.post(
  "/feedback/:schoolId",
  auditHttpAction({
    category: "cabinet",
    action: "cabinet.feedback_reply",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
  }),
  adminController.adminFeedbackReply,
);
router.get("/recovery/unread-count", adminController.recoveryUnread);
router.get("/recovery", adminController.recoveryList);
router.post(
  "/recovery/:requestId/done",
  auditHttpAction({
    category: "password",
    action: "password.recovery_processed",
    entityType: "recovery_request",
    entityId: (req) => req.params.requestId,
  }),
  adminController.recoveryMarkDone,
);
router.get("/renewals/:requestId", adminController.renewalRequestDetail);
router.post(
  "/renewals/:requestId/pay",
  auditHttpAction({
    category: "subscription",
    action: "subscription.payment_confirmed",
    entityType: "renewal_request",
    entityId: (req) => req.params.requestId,
  }),
  adminController.payRenewal,
);
router.get(
  "/renewals/:requestId/contract",
  adminController.adminRenewalContract,
);
router.get("/subscriptions/:schoolId", adminController.schoolDetail);
router.post(
  "/subscriptions/:schoolId/block",
  auditHttpAction({
    category: "subscription",
    action: "subscription.cabinet_blocked",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
  }),
  adminController.blockSchool,
);
router.post(
  "/subscriptions/:schoolId/activate",
  auditHttpAction({
    category: "subscription",
    action: "subscription.cabinet_activated",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
  }),
  adminController.activateSchool,
);
router.post(
  "/subscriptions/:schoolId/periods",
  auditHttpAction({
    category: "subscription",
    action: "subscription.period_created",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
  }),
  adminController.createSubscription,
);
router.patch(
  "/subscriptions/:schoolId/periods/:periodId",
  auditHttpAction({
    category: "subscription",
    action: "subscription.period_updated",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
    details: (req) => ({
      periodId: Number(req.params.periodId) || null,
      startsOn: String(req.body?.startsOn ?? ""),
      endsOn: String(req.body?.endsOn ?? ""),
    }),
  }),
  adminController.updateSubscription,
);
router.post(
  "/subscriptions/:schoolId/password-reset-link",
  auditHttpAction({
    category: "password",
    action: "password.admin_link_created",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
  }),
  adminController.createPasswordResetLink,
);

export default router;
