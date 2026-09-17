import type { Request, Response } from "express";
import {
  resetSchoolPassword,
  validateResetToken,
} from "../services/password-reset.service.js";
import { recordAuditLog } from "../services/audit-log.service.js";
import {
  createRecoveryCaptcha,
  RecoveryRequestError,
  submitRecoveryRequest,
} from "../services/password-recovery.service.js";

function logPasswordChange(
  req: Request,
  status: "success" | "failure",
  identity?: { email?: string; userId?: number; schoolId?: number },
  httpStatus = 200,
) {
  void recordAuditLog({
    actorUserId: identity?.userId ?? null,
    actorEmail: identity?.email ?? "unknown",
    actorAccountType: identity?.email ? "school" : null,
    schoolId: identity?.schoolId ?? null,
    category: "password",
    action: "password.changed",
    status,
    details: { httpStatus },
    ipAddress: req.ip || req.socket.remoteAddress || null,
    userAgent: req.get("user-agent") ?? null,
  }).catch((error) => {
    console.error("Password audit log write failed:", error);
  });
}

function logPasswordFailureForToken(
  req: Request,
  token: string,
  httpStatus: number,
) {
  void validateResetToken(token)
    .then((identity) => {
      logPasswordChange(req, "failure", identity, httpStatus);
    })
    .catch(() => {
      logPasswordChange(req, "failure", undefined, httpStatus);
    });
}

export async function recoveryCaptcha(req: Request, res: Response) {
  try {
    const captcha = createRecoveryCaptcha(
      req.ip || req.socket.remoteAddress || "unknown",
    );
    res.setHeader("Cache-Control", "no-store");
    return res.json(captcha);
  } catch (error) {
    if (error instanceof RecoveryRequestError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Recovery captcha error:", error);
    return res.status(500).json({ error: "Не удалось получить код" });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  const body = req.body as {
    email?: string;
    phone?: string;
    captchaId?: string;
    captchaAnswer?: string;
    website?: string;
  };

  try {
    const result = await submitRecoveryRequest({
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      captchaId: String(body.captchaId ?? ""),
      captchaAnswer: String(body.captchaAnswer ?? ""),
      honeypot: String(body.website ?? ""),
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userAgent: req.get("user-agent") ?? null,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof RecoveryRequestError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Не удалось отправить обращение" });
  }
}

export async function checkResetToken(req: Request, res: Response) {
  const token = String(req.params.token ?? "");

  try {
    const result = await validateResetToken(token);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.reason });
    }
    return res.json({ valid: true, schoolName: result.schoolName });
  } catch (error) {
    console.error("Validate reset token error:", error);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const token = String(req.params.token ?? "");
  const { password, confirmPassword } = req.body as {
    password?: string;
    confirmPassword?: string;
  };

  if (!password || !confirmPassword) {
    logPasswordFailureForToken(req, token, 400);
    return res.status(400).json({ error: "Укажите пароль и подтверждение" });
  }

  if (password !== confirmPassword) {
    logPasswordFailureForToken(req, token, 400);
    return res.status(400).json({ error: "Пароли не совпадают" });
  }

  try {
    const result = await resetSchoolPassword(token, password);
    if (!result.ok) {
      logPasswordChange(req, "failure", result, 400);
      return res.status(400).json({ error: result.error });
    }

    logPasswordChange(req, "success", result);
    return res.json({
      ok: true,
      message: "Пароль успешно изменён. Теперь вы можете войти.",
    });
  } catch (error) {
    logPasswordChange(req, "failure", undefined, 500);
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Не удалось изменить пароль" });
  }
}
