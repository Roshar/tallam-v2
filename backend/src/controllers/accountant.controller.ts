import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config.js";
import { zipStoredFiles } from "../lib/zip-store.js";
import {
  ACCOUNTANT_ARCHIVE_LIMIT,
  findVisibleAccountantRenewal,
  listAccountantAreas,
  listAccountantRenewals,
} from "../services/accountant.service.js";
import {
  createContractSettlement,
  parseSettlementFilter,
  SettlementConflictError,
  SettlementInputError,
} from "../services/contract-settlement.service.js";
import {
  buildRenewalDocument,
  RenewalDocumentUnavailableError,
} from "../services/subscription-documents.service.js";
import type { SessionUser } from "../types/session.js";

function secretsMatch(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function filters(req: Request) {
  return {
    areaId: Number(req.query.areaId ?? 0) || 0,
    search: String(req.query.search ?? ""),
    settlement: parseSettlementFilter(String(req.query.settlement ?? "")),
  };
}

const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function accountantSession(login: string): SessionUser {
  return {
    id: 0,
    idUser: "accountant",
    email: login,
    role: "accountant",
    schoolId: 0,
    status: "on",
    accountType: "accountant",
  };
}

export async function login(req: Request, res: Response) {
  const loginName = String((req.body as { login?: string })?.login ?? "")
    .trim()
    .toLowerCase();
  const password = String((req.body as { password?: string })?.password ?? "");
  const expectedLogin = config.accountant.login;
  const expectedPassword = config.accountant.password;

  if (
    !expectedLogin ||
    !expectedPassword ||
    !loginName ||
    !password ||
    !secretsMatch(loginName, expectedLogin) ||
    !secretsMatch(password, expectedPassword)
  ) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  const remember = (req.body as { remember?: unknown }).remember === true;
  req.session.user = accountantSession(expectedLogin);
  req.session.impersonator = undefined;
  if (remember) {
    req.session.cookie.maxAge = REMEMBER_SESSION_MS;
  }

  try {
    await saveSession(req);
  } catch (error) {
    console.error("Accountant login session error:", error);
    return res.status(500).json({ error: "Не удалось сохранить вход" });
  }

  return res.json({ user: req.session.user });
}

export async function areas(_req: Request, res: Response) {
  try {
    return res.json({ items: await listAccountantAreas() });
  } catch (error) {
    console.error("Accountant areas error:", error);
    return res.status(500).json({ error: "Не удалось загрузить районы" });
  }
}

export async function renewals(req: Request, res: Response) {
  try {
    const items = await listAccountantRenewals(filters(req));
    return res.json({ items, archiveLimit: ACCOUNTANT_ARCHIVE_LIMIT });
  } catch (error) {
    console.error("Accountant renewals error:", error);
    return res.status(500).json({ error: "Не удалось загрузить список" });
  }
}

export async function createSettlement(req: Request, res: Response) {
  const body = req.body as {
    renewalIds?: unknown;
    contractNumber?: unknown;
    settlementDate?: unknown;
  };
  try {
    const settlement = await createContractSettlement({
      renewalIds: body.renewalIds,
      contractNumber: body.contractNumber,
      settlementDate: body.settlementDate,
      createdBy: req.session.user?.email ?? "accountant",
    });
    res.locals.auditDetails = {
      settlementId: settlement.id,
      schoolCount: settlement.schoolCount,
    };
    return res.status(201).json({ settlement });
  } catch (error) {
    if (error instanceof SettlementInputError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof SettlementConflictError) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Accountant settlement error:", error);
    return res.status(500).json({ error: "Не удалось оформить расчёт" });
  }
}

export async function contract(req: Request, res: Response) {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор" });
  }

  try {
    const renewal = await findVisibleAccountantRenewal(requestId);
    if (!renewal) {
      return res.status(404).json({ error: "Документ не найден" });
    }
    const document = await buildRenewalDocument({ requestId });
    if (!document) {
      return res.status(404).json({ error: "Документ не найден" });
    }
    res.locals.auditDetails = {
      schoolId: renewal.schoolId,
      schoolName: renewal.schoolName,
      email: renewal.email ?? "",
      contractNumber: renewal.contractNumber ?? "",
    };
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
    );
    return res.send(document.buffer);
  } catch (error) {
    if (error instanceof RenewalDocumentUnavailableError) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Accountant contract error:", error);
    return res.status(500).json({ error: "Не удалось сформировать документ" });
  }
}

export async function archive(req: Request, res: Response) {
  try {
    const items = await listAccountantRenewals(filters(req));
    if (items.length === 0) {
      return res.status(400).json({ error: "В списке нет договоров" });
    }
    if (items.length > ACCOUNTANT_ARCHIVE_LIMIT) {
      return res.status(400).json({
        error: `За один раз можно скачать не больше ${ACCOUNTANT_ARCHIVE_LIMIT} договоров. Сузьте список фильтром.`,
      });
    }

    const files: Array<{ name: string; data: Buffer }> = [];
    const usedNames = new Set<string>();
    for (const item of items) {
      const document = await buildRenewalDocument({ requestId: item.id });
      if (!document) {
        return res.status(404).json({
          error: `Не найден документ для школы ${item.schoolName}`,
        });
      }
      let name = document.filename.replace(/[\\/]/g, "-");
      if (usedNames.has(name)) {
        name = name.replace(/\.pdf$/i, `-${item.id}.pdf`);
      }
      usedNames.add(name);
      files.push({ name, data: document.buffer });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `Договоры-и-акты-Таллам-${stamp}.zip`;
    const selected = filters(req);
    res.locals.auditDetails = {
      count: files.length,
      schools: files.length
        ? items.map((item) => item.schoolName).join(", ")
        : "",
      areaId: selected.areaId,
      search: selected.search.trim(),
    };
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.send(zipStoredFiles(files));
  } catch (error) {
    if (error instanceof RenewalDocumentUnavailableError) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Accountant archive error:", error);
    return res.status(500).json({ error: "Не удалось собрать архив" });
  }
}
