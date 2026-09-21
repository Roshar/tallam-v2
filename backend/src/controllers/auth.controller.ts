import type { Request, Response } from "express";
import { authenticate } from "../services/auth.service.js";
import { recordAuditLog } from "../services/audit-log.service.js";
import { clearSessionCookie } from "../lib/session-cookie.js";
import {
  SchoolAccessDeniedError,
  assertSchoolLoginAccess,
  cabinetAccessFromState,
  getSchoolAccessState,
  syncSchoolCabinetAccess,
} from "../services/school-access.service.js";

function clearSession(req: Request, res: Response, status: number, error: string) {
  req.session.destroy(() => {
    clearSessionCookie(res);
    res.status(status).json({ error });
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

export async function login(req: Request, res: Response) {
  const { email, password, accountType } = req.body as {
    email?: string;
    password?: string;
    accountType?: "school" | "methodist";
  };

  if (!email?.trim() || !password || !accountType) {
    return res.status(400).json({ error: "Укажите логин, пароль и тип аккаунта" });
  }

  try {
    const user = await authenticate(email.trim(), String(password), accountType);
    if (!user) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }

    if (user.accountType === "school") {
      const access = await assertSchoolLoginAccess(user.schoolId);
      user.cabinetAccess = cabinetAccessFromState(access);
    }

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.user = user;
    await saveSession(req);
    return res.json({ user });
  } catch (error) {
    if (error instanceof SchoolAccessDeniedError) {
      return res.status(403).json({ error: error.message });
    }
    console.error("Login error:", error);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
}

export function logout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Не удалось выйти" });
    }
    clearSessionCookie(res);
    return res.json({ ok: true });
  });
}

export async function me(req: Request, res: Response) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  if (req.session.user.accountType === "school") {
    try {
      await syncSchoolCabinetAccess(req.session.user.schoolId);
      const access = await getSchoolAccessState(req.session.user.schoolId);
      req.session.user = {
        ...req.session.user,
        cabinetAccess: cabinetAccessFromState(access),
      };
      if (!access.canLogin && !req.session.impersonator) {
        return clearSession(req, res, 401, access.message);
      }
    } catch (error) {
      if (error instanceof SchoolAccessDeniedError) {
        return clearSession(req, res, 401, error.message);
      }
      throw error;
    }
  }

  return res.json({ user: req.session.user });
}

export async function stopImpersonation(req: Request, res: Response) {
  const admin = req.session.impersonator;
  const schoolUser = req.session.user;
  if (!admin || !schoolUser?.impersonatedBy) {
    return res.status(400).json({ error: "Сейчас нет входа под школой" });
  }

  const schoolId = schoolUser.schoolId;
  await recordAuditLog({
    actorUserId: admin.id,
    actorEmail: admin.email,
    actorAccountType: "admin",
    schoolId,
    category: "auth",
    action: "auth.impersonation_stopped",
    status: "success",
    entityType: "school",
    entityId: schoolId,
    details: { schoolEmail: schoolUser.email },
    ipAddress: req.ip || req.socket.remoteAddress || null,
    userAgent: req.get("user-agent") ?? null,
  });

  delete req.session.impersonator;
  delete admin.impersonatedBy;
  req.session.user = admin;
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
  return res.json({ user: admin, schoolId });
}
