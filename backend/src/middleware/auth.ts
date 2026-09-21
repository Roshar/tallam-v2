import type { Request, Response, NextFunction } from "express";
import type { SessionUser } from "../types/session.js";
import { clearSessionCookie } from "../lib/session-cookie.js";
import {
  SchoolAccessDeniedError,
  assertSchoolCabinetAccess,
  cabinetAccessFromState,
  getSchoolAccessState,
  syncSchoolCabinetAccess,
} from "../services/school-access.service.js";

function isImpersonating(req: Request) {
  return Boolean(req.session.impersonator);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  next();
}

export function requireRole(...roles: SessionUser["accountType"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Требуется авторизация" });
    }
    if (!roles.includes(req.session.user.accountType)) {
      return res.status(403).json({ error: "Недостаточно прав" });
    }
    next();
  };
}

export async function requireSchoolSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = req.session.user;
  if (!user || user.accountType !== "school") {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    await syncSchoolCabinetAccess(user.schoolId);
    const access = await getSchoolAccessState(user.schoolId);
    req.session.user = {
      ...user,
      cabinetAccess: cabinetAccessFromState(access),
    };

    if (!access.canLogin && !isImpersonating(req)) {
      req.session.destroy(() => {
        clearSessionCookie(res);
        res.status(401).json({ error: access.message });
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireActiveSchoolCabinet(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = req.session.user;
  if (!user || user.accountType !== "school") {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  try {
    await assertSchoolCabinetAccess(user.schoolId);
    next();
  } catch (error) {
    if (error instanceof SchoolAccessDeniedError) {
      if (error.code === "SUBSCRIPTION_REQUIRED" || isImpersonating(req)) {
        return res.status(403).json({
          error: error.message,
          code:
            error.code === "SUBSCRIPTION_REQUIRED"
              ? "SUBSCRIPTION_REQUIRED"
              : error.code,
        });
      }

      req.session.destroy(() => {
        clearSessionCookie(res);
        res.status(401).json({ error: error.message });
      });
      return;
    }
    next(error);
  }
}
