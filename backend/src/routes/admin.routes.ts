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
router.get("/schools", adminController.schools);
router.post(
  "/schools/:schoolId/impersonate",
  adminController.impersonateSchool,
);
router.get("/schools/:schoolId", adminController.schoolDetail);
router.get("/subscriptions/areas", adminController.subscriptionAreas);
router.get("/subscriptions/export", adminController.exportSubscriptions);
router.get("/subscriptions", adminController.subscriptions);
router.get("/renewals", adminController.renewalRequests);
router.get("/renewals/pending-count", adminController.renewalQueueCount);
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
router.get("/renewals/:requestId/invoice", adminController.adminRenewalInvoice);
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
