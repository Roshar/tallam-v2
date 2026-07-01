import type { Request, Response } from "express";
import { authenticate, getSchoolName, countTeachers } from "../services/auth.service.js";

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
    const user = await authenticate(email.trim(), password, accountType);
    if (!user) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }

    req.session.user = user;
    return res.json({ user });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
}

export function logout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Не удалось выйти" });
    }
    res.clearCookie(process.env.SESSION_NAME ?? "smad");
    return res.json({ ok: true });
  });
}

export function me(req: Request, res: Response) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Не авторизован" });
  }
  return res.json({ user: req.session.user });
}

export async function schoolDashboard(req: Request, res: Response) {
  const user = req.session.user;
  if (!user || user.accountType !== "school") {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const [schoolName, teachersCount] = await Promise.all([
    getSchoolName(user.schoolId),
    countTeachers(user.schoolId),
  ]);

  return res.json({
    schoolName,
    teachersCount,
    schoolId: user.schoolId,
  });
}
