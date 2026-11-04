import type { NextFunction, Request, Response } from "express";

/**
 * Простая защита формы входа от перебора.
 *
 * Считаем только неудачные попытки (401). Успешный вход сбрасывает счетчик
 * пары «IP + логин». Общий счетчик по IP ловит перебор по разным логинам.
 * Состояние в памяти: у нас один процесс PM2, при рестарте счетчики
 * обнуляются - это допустимо для базовой защиты.
 */
const WINDOW_MS = 15 * 60 * 1000;
const PER_ACCOUNT_LIMIT = 10;
const PER_IP_LIMIT = 50;
const PRUNE_THRESHOLD = 2000;

interface AttemptCounter {
  count: number;
  resetAt: number;
}

const accountCounters = new Map<string, AttemptCounter>();
const ipCounters = new Map<string, AttemptCounter>();

function counterFor(
  map: Map<string, AttemptCounter>,
  key: string,
  now: number,
): AttemptCounter {
  const existing = map.get(key);
  if (existing && existing.resetAt > now) {
    return existing;
  }
  const fresh = { count: 0, resetAt: now + WINDOW_MS };
  map.set(key, fresh);
  return fresh;
}

function prune(map: Map<string, AttemptCounter>, now: number) {
  if (map.size < PRUNE_THRESHOLD) return;
  for (const [key, value] of map) {
    if (value.resetAt <= now) map.delete(key);
  }
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function loginName(req: Request): string {
  const raw = req.body?.email ?? req.body?.login ?? "";
  return String(raw).trim().toLowerCase().slice(0, 200);
}

function blockedResponse(res: Response, retryAfterMs: number) {
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  res.setHeader("Cache-Control", "no-store");
  return res.status(429).json({
    error: "Слишком много попыток входа. Попробуйте позже.",
  });
}

export function loginRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const now = Date.now();
  prune(accountCounters, now);
  prune(ipCounters, now);

  const ip = clientIp(req);
  const login = loginName(req);
  const accountKey = `${ip}|${login}`;

  const ipCounter = counterFor(ipCounters, ip, now);
  if (ipCounter.count >= PER_IP_LIMIT) {
    return blockedResponse(res, ipCounter.resetAt - now);
  }

  if (login) {
    const accountCounter = counterFor(accountCounters, accountKey, now);
    if (accountCounter.count >= PER_ACCOUNT_LIMIT) {
      return blockedResponse(res, accountCounter.resetAt - now);
    }
  }

  res.on("finish", () => {
    const finishedAt = Date.now();
    if (res.statusCode === 401) {
      counterFor(accountCounters, accountKey, finishedAt).count += 1;
      counterFor(ipCounters, ip, finishedAt).count += 1;
    } else if (res.statusCode >= 200 && res.statusCode < 400 && login) {
      // Удачный вход: снимаем блокировку с этой пары IP + логин.
      accountCounters.delete(accountKey);
    }
  });

  next();
}
