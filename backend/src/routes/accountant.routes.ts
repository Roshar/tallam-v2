import { Router } from "express";
import * as accountantController from "../controllers/accountant.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { auditHttpAction } from "../services/audit-log.service.js";

const router = Router();

router.post(
  "/login",
  auditHttpAction({
    category: "accountant",
    action: "auth.accountant_login",
    actorEmail: (req) => String(req.body?.login ?? "").slice(0, 150),
  }),
  accountantController.login,
);

router.use(requireAuth, requireRole("accountant"));
router.get("/areas", accountantController.areas);
router.get("/renewals", accountantController.renewals);
router.get(
  "/renewals/archive",
  auditHttpAction({
    category: "accountant",
    action: "accountant.archive_download",
    entityType: "renewal_archive",
  }),
  accountantController.archive,
);
router.get(
  "/renewals/:requestId/contract",
  auditHttpAction({
    category: "accountant",
    action: "accountant.contract_download",
    entityType: "renewal_request",
    entityId: (req) => req.params.requestId,
  }),
  accountantController.contract,
);

export default router;
