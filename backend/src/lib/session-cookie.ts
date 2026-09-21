import type { CookieOptions, Response } from "express";
import { config } from "../config.js";

export function sessionCookieOptions(): CookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.session.name, sessionCookieOptions());
}
