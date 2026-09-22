import ExcelJS from "exceljs";
import type { Request, Response } from "express";
import {
  countOnlineSchools,
  getAdminDashboard,
  getAdminSchoolDetail,
  getAdminSchools,
  getAdminSubscriptionAreas,
  getAdminSubscriptions,
  updateSchoolName,
  type SchoolCabinetStatusFilter,
  type SubscriptionListRow,
  type SubscriptionStatusFilter,
} from "../services/admin.service.js";
import { getSchoolSessionUser, getSchoolName } from "../services/auth.service.js";
import { recordAuditLog } from "../services/audit-log.service.js";
import { createSchoolPasswordResetLink } from "../services/password-reset.service.js";
import {
  createSchoolWithCabinet,
  getAllAreas,
  isUserEmailAvailable,
  isValidEmail,
  normalizeEmail,
  SchoolRegisterError,
} from "../services/school-register.service.js";
import {
  cleanupDatabaseBackup,
  createDatabaseBackup,
} from "../services/database-backup.service.js";
import { purgeSchoolTeachersAndEvaluations } from "../services/school-purge.service.js";
import {
  activateSchoolCabinet,
  blockSchoolCabinet,
  cabinetAccessFromState,
  createSchoolSubscription,
  getSchoolAccessState,
  syncSchoolCabinetAccess,
  updateSchoolSubscription,
} from "../services/school-access.service.js";
import {
  buildRenewalDocument,
  RenewalDocumentUnavailableError,
} from "../services/subscription-documents.service.js";
import {
  countAwaitingRenewalConfirmations,
  getRenewalRequest,
  listRenewalRequests,
  markRenewalPaid,
  type RenewalStatus,
} from "../services/subscription-renewal.service.js";
import {
  countAdminUnreadConversations,
  getAdminSupportThread,
  listAdminSupportConversations,
  postAdminSupportMessage,
} from "../services/school-feedback.service.js";
import {
  countNewRecoveryRequests,
  listRecoveryRequests,
  markRecoveryRequestDone,
  RecoveryRequestError,
} from "../services/password-recovery.service.js";

const SUBSCRIPTION_STATUSES = new Set<SubscriptionStatusFilter>([
  "all",
  "active",
  "expiring",
  "expired",
  "scheduled",
  "missing",
  "unpaid",
]);

function parseSubscriptionFilters(req: Request) {
  const requestedStatus = String(req.query.status ?? "all");
  const status: SubscriptionStatusFilter = SUBSCRIPTION_STATUSES.has(
    requestedStatus as SubscriptionStatusFilter,
  )
    ? (requestedStatus as SubscriptionStatusFilter)
    : "all";
  const requestedAreaId = Number(req.query.areaId ?? 0);

  return {
    search: String(req.query.search ?? "").trim().slice(0, 100),
    status,
    areaId:
      Number.isInteger(requestedAreaId) && requestedAreaId > 0
        ? requestedAreaId
        : null,
  };
}

const BACKUP_TIMEOUT_MS = 15 * 60 * 1000;

export async function downloadDatabaseBackup(req: Request, res: Response) {
  req.setTimeout(BACKUP_TIMEOUT_MS);
  res.setTimeout(BACKUP_TIMEOUT_MS);

  try {
    const backup = await createDatabaseBackup();
    res.locals.auditDetails = {
      filename: backup.filename,
      database: backup.database,
    };
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(backup.filename)}`,
    );
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(backup.filePath, { cacheControl: false }, async () => {
      await cleanupDatabaseBackup(backup);
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось сформировать резервную копию базы";
    if (message.includes("уже формируется")) {
      return res.status(409).json({ error: message });
    }
    if (message.includes("mariadb-dump") || message.includes("mysqldump")) {
      return res.status(500).json({ error: message });
    }
    console.error("Admin database backup error:", error);
    return res.status(500).json({
      error: "Не удалось сформировать резервную копию базы",
    });
  }
}

export async function dashboard(_req: Request, res: Response) {
  try {
    return res.json(await getAdminDashboard());
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res
      .status(500)
      .json({ error: "Не удалось загрузить данные администратора" });
  }
}

export async function onlineSchools(_req: Request, res: Response) {
  try {
    return res.json({ onlineSchools: await countOnlineSchools() });
  } catch (error) {
    console.error("Admin online schools error:", error);
    return res.status(500).json({ error: "Не удалось посчитать школы онлайн" });
  }
}

export async function subscriptions(req: Request, res: Response) {
  const filters = parseSubscriptionFilters(req);

  try {
    return res.json(
      await getAdminSubscriptions({
        page: Number(req.query.page ?? 1) || 1,
        limit: Number(req.query.limit ?? 20) || 20,
        ...filters,
      }),
    );
  } catch (error) {
    console.error("Admin subscriptions error:", error);
    return res.status(500).json({ error: "Не удалось загрузить подписки" });
  }
}

export async function subscriptionAreas(_req: Request, res: Response) {
  try {
    return res.json({ items: await getAdminSubscriptionAreas() });
  } catch (error) {
    console.error("Admin subscription areas error:", error);
    return res.status(500).json({ error: "Не удалось загрузить районы" });
  }
}

const CABINET_STATUSES = new Set<SchoolCabinetStatusFilter>([
  "all",
  "active",
  "blocked",
  "none",
]);

function parseSchoolListFilters(req: Request) {
  const requestedCabinet = String(req.query.cabinetStatus ?? "all");
  const cabinetStatus: SchoolCabinetStatusFilter = CABINET_STATUSES.has(
    requestedCabinet as SchoolCabinetStatusFilter,
  )
    ? (requestedCabinet as SchoolCabinetStatusFilter)
    : "all";
  const requestedAreaId = Number(req.query.areaId ?? 0);

  return {
    search: String(req.query.search ?? "").trim().slice(0, 100),
    cabinetStatus,
    areaId:
      Number.isInteger(requestedAreaId) && requestedAreaId > 0
        ? requestedAreaId
        : null,
  };
}

export async function schools(req: Request, res: Response) {
  const filters = parseSchoolListFilters(req);

  try {
    return res.json(
      await getAdminSchools({
        page: Number(req.query.page ?? 1) || 1,
        limit: Number(req.query.limit ?? 20) || 20,
        ...filters,
      }),
    );
  } catch (error) {
    console.error("Admin schools error:", error);
    return res.status(500).json({ error: "Не удалось загрузить школы" });
  }
}

export async function schoolAreas(_req: Request, res: Response) {
  try {
    return res.json({ items: await getAllAreas() });
  } catch (error) {
    console.error("Admin school areas error:", error);
    return res.status(500).json({ error: "Не удалось загрузить районы" });
  }
}

export async function schoolEmailAvailability(req: Request, res: Response) {
  const email = normalizeEmail(String(req.query.email ?? ""));
  if (!email) {
    return res.status(400).json({ error: "Укажите email" });
  }
  if (!isValidEmail(email)) {
    return res.json({ email, available: false, reason: "invalid" });
  }

  try {
    const available = await isUserEmailAvailable(email);
    return res.json({
      email,
      available,
      reason: available ? null : "taken",
    });
  } catch (error) {
    console.error("Admin email availability error:", error);
    return res.status(500).json({ error: "Не удалось проверить email" });
  }
}

export async function createSchool(req: Request, res: Response) {
  const body = req.body as {
    schoolName?: string;
    areaId?: number;
    email?: string;
    password?: string;
    confirmPassword?: string;
    startsOn?: string;
    endsOn?: string;
  };

  try {
    const school = await createSchoolWithCabinet({
      schoolName: String(body.schoolName ?? ""),
      areaId: Number(body.areaId ?? 0),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      confirmPassword: String(body.confirmPassword ?? ""),
      startsOn: String(body.startsOn ?? ""),
      endsOn: String(body.endsOn ?? ""),
      actor: `admin:${req.session.user?.email ?? "unknown"}`,
    });
    return res.status(201).json(school);
  } catch (error) {
    if (error instanceof SchoolRegisterError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Admin create school error:", error);
    return res.status(500).json({ error: "Не удалось зарегистрировать школу" });
  }
}

export async function renameSchool(req: Request, res: Response) {
  const schoolId = parseSchoolId(req);
  if (!schoolId) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  try {
    const renamed = await updateSchoolName(
      schoolId,
      String((req.body as { schoolName?: string })?.schoolName ?? ""),
    );
    res.locals.auditDetails = {
      previousName: renamed.previousName,
      schoolName: renamed.schoolName,
    };
    return res.json(await getAdminSchoolDetail(schoolId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось переименовать школу";
    if (
      message.includes("не менее") ||
      message.includes("длинное") ||
      message.includes("не найдена")
    ) {
      return res.status(400).json({ error: message });
    }
    console.error("Admin rename school error:", error);
    return res.status(500).json({ error: "Не удалось переименовать школу" });
  }
}

export async function purgeSchoolWorkers(req: Request, res: Response) {
  const schoolId = parseSchoolId(req);
  if (!schoolId) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  try {
    const result = await purgeSchoolTeachersAndEvaluations(
      schoolId,
      String((req.body as { confirmName?: string })?.confirmName ?? ""),
    );
    res.locals.auditDetails = {
      schoolName: result.schoolName,
      teachers: result.teachers,
      evaluations: result.evaluations,
    };
    return res.json({
      ...result,
      detail: await getAdminSchoolDetail(schoolId),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось очистить работников и оценки";
    if (
      message.includes("подтверждения") ||
      message.includes("не найдена") ||
      message.includes("Некорректный")
    ) {
      return res.status(400).json({ error: message });
    }
    console.error("Admin purge school workers error:", error);
    return res.status(500).json({
      error: "Не удалось очистить работников и оценки",
    });
  }
}

export async function schoolDetail(req: Request, res: Response) {
  const schoolId = Number(req.params.schoolId);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  try {
    const detail = await getAdminSchoolDetail(schoolId);
    if (!detail) {
      return res.status(404).json({ error: "Школа не найдена" });
    }
    return res.json(detail);
  } catch (error) {
    console.error("Admin school detail error:", error);
    return res.status(500).json({ error: "Не удалось загрузить данные школы" });
  }
}

export async function impersonateSchool(req: Request, res: Response) {
  const schoolId = Number(req.params.schoolId);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  const admin = req.session.user;
  if (!admin || admin.accountType !== "admin") {
    return res.status(403).json({ error: "Недостаточно прав" });
  }
  if (req.session.impersonator) {
    return res.status(400).json({ error: "Сначала вернитесь из кабинета школы" });
  }

  try {
    const schoolUser = await getSchoolSessionUser(schoolId);
    if (!schoolUser) {
      return res.status(400).json({ error: "У этой школы нет кабинета" });
    }

    await syncSchoolCabinetAccess(schoolId);
    const access = await getSchoolAccessState(schoolId);
    const schoolName = (await getSchoolName(schoolId)) ?? schoolUser.email;
    schoolUser.cabinetAccess = cabinetAccessFromState(access);
    schoolUser.impersonatedBy = { id: admin.id, email: admin.email };

    await recordAuditLog({
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorAccountType: "admin",
      schoolId,
      category: "auth",
      action: "auth.impersonate_school",
      status: "success",
      entityType: "school",
      entityId: schoolId,
      details: {
        schoolEmail: schoolUser.email,
        schoolName,
      },
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userAgent: req.get("user-agent") ?? null,
    });

    req.session.impersonator = admin;
    req.session.user = schoolUser;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return res.json({ user: schoolUser });
  } catch (error) {
    console.error("Admin impersonate school error:", error);
    return res.status(500).json({ error: "Не удалось войти как школа" });
  }
}

const SUBSCRIPTION_STATUS_LABELS: Record<
  SubscriptionListRow["subscriptionStatus"],
  string
> = {
  active: "Активна",
  expiring: "Скоро истекает",
  expired: "Истекла",
  scheduled: "Ещё не началась",
  missing: "Нет данных",
};

function cabinetAccessLabel(accountStatus: SubscriptionListRow["accountStatus"]) {
  if (accountStatus === "on") return "Кабинет открыт";
  if (accountStatus != null) return "Нужна оплата";
  return "Нет кабинета";
}

function displayDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export async function exportSubscriptions(req: Request, res: Response) {
  const filters = parseSubscriptionFilters(req);

  try {
    const items: SubscriptionListRow[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await getAdminSubscriptions({
        page,
        limit: 100,
        ...filters,
      });
      items.push(...result.items);
      totalPages = result.pagination.totalPages;
      page += 1;
    } while (page <= totalPages);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Подписки школ");

    worksheet.columns = [
      { header: "№", key: "number", width: 8 },
      { header: "Район", key: "area", width: 32 },
      { header: "Школа", key: "school", width: 52 },
      { header: "Логин", key: "email", width: 30 },
      { header: "Телефон", key: "phone", width: 20 },
      { header: "Начало подписки", key: "startsOn", width: 18 },
      { header: "Окончание подписки", key: "endsOn", width: 20 },
      { header: "Статус", key: "status", width: 20 },
      { header: "Кабинет", key: "cabinet", width: 22 },
    ];

    items.forEach((item, index) => {
      worksheet.addRow({
        number: index + 1,
        area: item.area ?? "",
        school: item.schoolName,
        email: item.email ?? "",
        phone: item.phone ?? "",
        startsOn: displayDate(item.startsOn),
        endsOn: displayDate(item.endsOn),
        status: SUBSCRIPTION_STATUS_LABELS[item.subscriptionStatus],
        cabinet: cabinetAccessLabel(item.accountStatus),
      });
    });

    const header = worksheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2E609A" },
    };
    header.alignment = { vertical: "middle", horizontal: "center" };
    header.height = 24;
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: "A1",
      to: "I1",
    };
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: "top", wrapText: true };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Подписки-школ-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Admin subscriptions export error:", error);
    return res.status(500).json({ error: "Не удалось сформировать файл" });
  }
}

export async function createPasswordResetLink(req: Request, res: Response) {
  const schoolId = Number(req.params.schoolId);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  try {
    const result = await createSchoolPasswordResetLink(schoolId);
    if (!result) {
      return res
        .status(404)
        .json({ error: "Кабинет школы недоступен" });
    }

    return res.json({
      resetUrl: result.resetUrl,
      expiresAt: result.expiresAt.toISOString(),
      email: result.email,
    });
  } catch (error) {
    console.error("Admin create password reset link error:", error);
    return res
      .status(500)
      .json({ error: "Не удалось создать ссылку для смены пароля" });
  }
}

function parseSchoolId(req: Request) {
  const schoolId = Number(req.params.schoolId);
  return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

export async function blockSchool(req: Request, res: Response) {
  const schoolId = parseSchoolId(req);
  if (!schoolId) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  try {
    const access = await blockSchoolCabinet(schoolId);
    if (!access) {
      return res.status(404).json({ error: "Кабинет школы не найден" });
    }
    return res.json(await getAdminSchoolDetail(schoolId));
  } catch (error) {
    console.error("Admin block school error:", error);
    return res.status(500).json({ error: "Не удалось заблокировать кабинет" });
  }
}

export async function activateSchool(req: Request, res: Response) {
  const schoolId = parseSchoolId(req);
  if (!schoolId) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  const { startsOn, endsOn, note } = req.body as {
    startsOn?: string;
    endsOn?: string;
    note?: string;
  };

  try {
    await activateSchoolCabinet({
      schoolId,
      startsOn: String(startsOn ?? ""),
      endsOn: String(endsOn ?? ""),
      note: typeof note === "string" ? note : "",
    });
    return res.json(await getAdminSchoolDetail(schoolId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось активировать кабинет";
    if (
      message.includes("даты") ||
      message.includes("окончания") ||
      message.includes("Срок подписки") ||
      message.includes("Срок активации") ||
      message.includes("не найден")
    ) {
      return res.status(400).json({ error: message });
    }
    console.error("Admin activate school error:", error);
    return res.status(500).json({ error: "Не удалось активировать кабинет" });
  }
}

export async function createSubscription(req: Request, res: Response) {
  const schoolId = parseSchoolId(req);
  if (!schoolId) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  const { startsOn, endsOn, phone, note } = req.body as {
    startsOn?: string;
    endsOn?: string;
    phone?: string;
    note?: string;
  };

  try {
    await createSchoolSubscription({
      schoolId,
      startsOn: String(startsOn ?? ""),
      endsOn: String(endsOn ?? ""),
      phone: typeof phone === "string" ? phone : "",
      note: typeof note === "string" ? note : "",
    });
    return res.json(await getAdminSchoolDetail(schoolId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить подписку";
    if (
      message.includes("даты") ||
      message.includes("окончания") ||
      message.includes("Срок подписки") ||
      message.includes("не найден") ||
      message.includes("уже есть")
    ) {
      return res.status(400).json({ error: message });
    }
    console.error("Admin create subscription error:", error);
    return res.status(500).json({ error: "Не удалось сохранить подписку" });
  }
}

export async function updateSubscription(req: Request, res: Response) {
  const schoolId = parseSchoolId(req);
  const periodId = Number(req.params.periodId);
  if (!schoolId || !Number.isInteger(periodId) || periodId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор периода" });
  }

  const { startsOn, endsOn, phone, note } = req.body as {
    startsOn?: string;
    endsOn?: string;
    phone?: string;
    note?: string;
  };

  try {
    await updateSchoolSubscription({
      schoolId,
      periodId,
      startsOn: String(startsOn ?? ""),
      endsOn: String(endsOn ?? ""),
      phone: typeof phone === "string" ? phone : "",
      note: typeof note === "string" ? note : "",
    });
    return res.json(await getAdminSchoolDetail(schoolId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось изменить подписку";
    if (
      message.includes("даты") ||
      message.includes("окончания") ||
      message.includes("Срок подписки") ||
      message.includes("не найден") ||
      message.includes("уже есть")
    ) {
      return res.status(400).json({ error: message });
    }
    console.error("Admin update subscription error:", error);
    return res.status(500).json({ error: "Не удалось изменить подписку" });
  }
}

const RENEWAL_STATUSES = new Set<RenewalStatus | "all">([
  "all",
  "pending",
  "documents_ready",
  "paid",
  "cancelled",
]);

export async function renewalQueueCount(_req: Request, res: Response) {
  try {
    return res.json({
      awaitingConfirmation: await countAwaitingRenewalConfirmations(),
    });
  } catch (error) {
    console.error("Admin renewal queue count error:", error);
    return res.status(500).json({ error: "Не удалось загрузить счётчик заявок" });
  }
}

export async function renewalRequests(req: Request, res: Response) {
  const requestedStatus = String(req.query.status ?? "all");
  const status = RENEWAL_STATUSES.has(requestedStatus as RenewalStatus | "all")
    ? (requestedStatus as RenewalStatus | "all")
    : "all";
  try {
    return res.json(
      await listRenewalRequests({
        page: Number(req.query.page ?? 1) || 1,
        limit: Number(req.query.limit ?? 20) || 20,
        status,
        search: String(req.query.search ?? ""),
      }),
    );
  } catch (error) {
    console.error("Admin renewal requests error:", error);
    return res.status(500).json({ error: "Не удалось загрузить заявки" });
  }
}

export async function renewalRequestDetail(req: Request, res: Response) {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор заявки" });
  }
  try {
    const request = await getRenewalRequest(requestId);
    if (!request) {
      return res.status(404).json({ error: "Заявка не найдена" });
    }
    return res.json({ request });
  } catch (error) {
    console.error("Admin renewal request detail error:", error);
    return res.status(500).json({ error: "Не удалось загрузить заявку" });
  }
}

export async function payRenewal(req: Request, res: Response) {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор заявки" });
  }
  try {
    const request = await markRenewalPaid(requestId, req.session.user!.id);
    return res.json({ request });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось подтвердить оплату";
    if (message.includes("Отменён") || message.includes("не найдена")) {
      return res.status(400).json({ error: message });
    }
    console.error("Admin pay renewal error:", error);
    return res.status(500).json({ error: "Не удалось подтвердить оплату" });
  }
}

async function downloadAdminRenewalDocument(req: Request, res: Response) {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор заявки" });
  }
  try {
    const document = await buildRenewalDocument({ requestId });
    if (!document) {
      return res.status(404).json({ error: "Документ не найден" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
    );
    return res.send(document.buffer);
  } catch (error) {
    if (error instanceof RenewalDocumentUnavailableError) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Admin renewal document error:", error);
    return res.status(500).json({ error: "Не удалось сформировать документ" });
  }
}

export async function adminRenewalContract(req: Request, res: Response) {
  return downloadAdminRenewalDocument(req, res);
}

export async function adminFeedbackUnread(_req: Request, res: Response) {
  try {
    const unread = await countAdminUnreadConversations();
    return res.json({ unread });
  } catch (error) {
    console.error("Admin feedback unread error:", error);
    return res.status(500).json({ error: "Не удалось загрузить отзывы" });
  }
}

export async function adminFeedbackList(_req: Request, res: Response) {
  try {
    const items = await listAdminSupportConversations();
    return res.json({ items });
  } catch (error) {
    console.error("Admin feedback list error:", error);
    return res.status(500).json({ error: "Не удалось загрузить отзывы" });
  }
}

export async function adminFeedbackThread(req: Request, res: Response) {
  const schoolId = Number(req.params.schoolId);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  try {
    const thread = await getAdminSupportThread(schoolId);
    return res.json(thread);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить переписку";
    if (message.includes("не найдена")) {
      return res.status(404).json({ error: message });
    }
    console.error("Admin feedback thread error:", error);
    return res.status(500).json({ error: "Не удалось загрузить переписку" });
  }
}

export async function adminFeedbackReply(req: Request, res: Response) {
  const schoolId = Number(req.params.schoolId);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор школы" });
  }

  const body = req.body as { message?: string };
  try {
    const thread = await postAdminSupportMessage({
      schoolId,
      actorEmail: req.session.user!.email,
      message: String(body.message ?? ""),
    });
    return res.json(thread);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось отправить ответ";
    if (message.includes("сообщение") || message.includes("длинное")) {
      return res.status(400).json({ error: message });
    }
    if (message.includes("не найдена")) {
      return res.status(404).json({ error: message });
    }
    console.error("Admin feedback reply error:", error);
    return res.status(500).json({ error: "Не удалось отправить ответ" });
  }
}

export async function recoveryUnread(_req: Request, res: Response) {
  try {
    return res.json({ unread: await countNewRecoveryRequests() });
  } catch (error) {
    console.error("Admin recovery unread error:", error);
    return res.status(500).json({ error: "Не удалось загрузить обращения" });
  }
}

export async function recoveryList(req: Request, res: Response) {
  const requested = String(req.query.status ?? "all");
  const status =
    requested === "new" || requested === "done" ? requested : "all";

  try {
    return res.json({ items: await listRecoveryRequests(status) });
  } catch (error) {
    console.error("Admin recovery list error:", error);
    return res.status(500).json({ error: "Не удалось загрузить обращения" });
  }
}

export async function recoveryMarkDone(req: Request, res: Response) {
  const id = Number(req.params.requestId);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор обращения" });
  }

  try {
    const item = await markRecoveryRequestDone(
      id,
      req.session.user?.email ?? "unknown",
    );
    return res.json(item);
  } catch (error) {
    if (error instanceof RecoveryRequestError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Admin recovery mark done error:", error);
    return res.status(500).json({ error: "Не удалось обновить обращение" });
  }
}
