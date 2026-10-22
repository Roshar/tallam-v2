import type { Request, Response, NextFunction } from "express";
import type { IroRole } from "../types/session.js";

export function requireIroAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.iroUser || req.session.iroUser.accountType !== "iro") {
    return res.status(401).json({ error: "Требуется авторизация ИРО" });
  }
  next();
}

export function requireIroRole(...roles: IroRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.iroUser) return res.status(401).json({ error: "Требуется авторизация ИРО" });
    if (!roles.includes(req.session.iroUser.role)) return res.status(403).json({ error: "Недостаточно прав" });
    next();
  };
}
