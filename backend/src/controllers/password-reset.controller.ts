import type { Request, Response } from "express";
import {
  requestSchoolPasswordReset,
  resetSchoolPassword,
  validateResetToken,
} from "../services/password-reset.service.js";

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as { email?: string };

  if (!email?.trim()) {
    return res.status(400).json({ error: "Укажите email" });
  }

  try {
    await requestSchoolPasswordReset(email.trim());

    return res.json({
      ok: true,
      message:
        "Если аккаунт школы с таким email существует, мы отправили инструкцию по восстановлению пароля.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Не удалось отправить письмо" });
  }
}

export async function checkResetToken(req: Request, res: Response) {
  const token = String(req.params.token ?? "");

  try {
    const result = await validateResetToken(token);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.reason });
    }
    return res.json({ valid: true });
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
    return res.status(400).json({ error: "Укажите пароль и подтверждение" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Пароли не совпадают" });
  }

  try {
    const result = await resetSchoolPassword(token, password);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      ok: true,
      message: "Пароль успешно изменён. Теперь вы можете войти.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Не удалось изменить пароль" });
  }
}
