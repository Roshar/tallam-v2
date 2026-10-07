import type { Request, Response } from "express";
import {
  getContractSettlement,
  listPaidSettlements,
  parseSettlementFilter,
} from "../services/contract-settlement.service.js";

export async function settlements(req: Request, res: Response) {
  try {
    return res.json(
      await listPaidSettlements({
        filter: parseSettlementFilter(String(req.query.settlement ?? "")),
        search: String(req.query.search ?? ""),
      }),
    );
  } catch (error) {
    console.error("Admin settlements error:", error);
    return res.status(500).json({ error: "Не удалось загрузить расчёты" });
  }
}

export async function settlement(req: Request, res: Response) {
  const settlementId = Number(req.params.settlementId);
  if (!Number.isInteger(settlementId) || settlementId <= 0) {
    return res.status(400).json({ error: "Некорректный идентификатор расчёта" });
  }
  try {
    const item = await getContractSettlement(settlementId);
    if (!item) {
      return res.status(404).json({ error: "Расчёт не найден" });
    }
    return res.json({ settlement: item });
  } catch (error) {
    console.error("Admin settlement detail error:", error);
    return res.status(500).json({ error: "Не удалось загрузить расчёт" });
  }
}
