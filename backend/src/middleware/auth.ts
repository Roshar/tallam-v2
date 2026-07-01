import type { Request, Response, NextFunction } from "express";
import type { SessionUser } from "../types/session.js";

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
