import type { Request, Response } from "express";
import { authenticate, getIroUserById } from "../services/iro-auth.service.js";
import { recordAuditLog } from "../services/audit-log.service.js";

const cookie = {
  path: "/api/iro",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function save(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

export async function login(req: Request, res: Response) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    return res.status(400).json({ error: "Укажите email и пароль" });
  }
  const user = await authenticate(email, password);
  if (!user) {
    await recordAuditLog({
      actorEmail: email,
      actorAccountType: "iro",
      category: "iro",
      action: "iro.auth.login",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });
    return res.status(401).json({ error: "Неверный email или пароль" });
  }
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
  req.session.iroUser = user;
  await save(req);
  await recordAuditLog({
    actorUserId: user.id,
    actorEmail: user.email,
    actorAccountType: "iro",
    category: "iro",
    action: "iro.auth.login",
    status: "success",
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });
  return res.json({ user });
}

export function logout(req: Request, res: Response) {
  const user = req.session.iroUser;
  req.session.destroy(async (error) => {
    if (error) return res.status(500).json({ error: "Не удалось выйти" });
    res.clearCookie("iro_smad", cookie);
    if (user) {
      await recordAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        actorAccountType: "iro",
        category: "iro",
        action: "iro.auth.logout",
        status: "success",
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? null,
      });
    }
    return res.json({ ok: true });
  });
}

export async function me(req: Request, res: Response) {
  const id = req.session.iroUser?.iroUserId;
  if (!id) return res.status(401).json({ error: "Не авторизован" });
  const user = await getIroUserById(id);
  if (!user) {
    return req.session.destroy(() => {
      res.clearCookie("iro_smad", cookie);
      res.status(401).json({ error: "Не авторизован" });
    });
  }
  req.session.iroUser = user;
  return res.json({ user });
}
