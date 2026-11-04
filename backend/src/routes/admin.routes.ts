import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import * as adminController from "../controllers/admin.controller.js";
import * as settlementController from "../controllers/settlement.controller.js";
import * as vacancyController from "../controllers/vacancy.controller.js";
import * as auditLogController from "../controllers/audit-log.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { auditHttpAction } from "../services/audit-log.service.js";

const router = Router();

fs.mkdirSync(config.paymentDocsDir, { recursive: true });

const PAYMENT_DOCUMENT_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const PAYMENT_DOCUMENT_EXT = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

const paymentDocumentUpload = multer({
  storage: multer.diskStorage({
    destination: config.paymentDocsDir,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (
      !PAYMENT_DOCUMENT_EXT.has(extension) ||
      !PAYMENT_DOCUMENT_MIME.has(file.mimetype)
    ) {
      return callback(new Error("Приложите файл PDF, PNG или JPG"));
    }
    callback(null, true);
  },
});

function uploadPaymentDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  paymentDocumentUpload.single("document")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Файл больше 10 МБ"
          : "Не удалось загрузить файл";
      return res.status(400).json({ error: message });
    }
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Не удалось загрузить файл",
    });
  });
}

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
router.get("/visits", adminController.schoolVisits);
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
router.get("/settlements", settlementController.settlements);
router.get("/settlements/:settlementId", settlementController.settlement);
router.get("/renewals/pending-count", adminController.renewalQueueCount);
router.get(
  "/vacancies",
  auditHttpAction({
    category: "cabinet",
    action: "cabinet.vacancy_admin_list",
    entityType: "vacancy",
    details: (req) => ({
      page: Number(req.query.page) || 1,
    }),
  }),
  vacancyController.adminVacancies,
);
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
  "/subscriptions/:schoolId/manual-activation",
  auditHttpAction({
    category: "subscription",
    action: "subscription.manual_activation_created",
    entityType: "school",
    entityId: (req) => req.params.schoolId,
  }),
  uploadPaymentDocument,
  adminController.createManualActivationHandler,
);
router.get(
  "/manual-activations/:activationId/document",
  adminController.downloadManualActivationDocument,
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
