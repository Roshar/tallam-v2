import type { Request, Response } from "express";
import {
  SELECTION_PRESETS,
  SelectionError,
  presetRows,
  presetCounts,
  previewSelection,
  buildSelectionExcel,
  createSavedSelection,
  deleteSavedSelection,
  ensureSelectionSchema,
  getSavedSelection,
  listSavedSelections,
  selectionOptions,
  type TeacherRow,
} from "../services/selection.service.js";
import type { FilterCondition } from "../services/selection-fields.js";
import { recordAuditLog } from "../services/audit-log.service.js";

/**
 * Живой предпросмотр пересчитывается на каждое изменение условия, поэтому
 * пишем в журнал не чаще одного раза в 30 секунд на сессию: иначе логи
 * списков превратятся в шум от набора цифры в поле.
 */
const previewLogAt = new Map<string, number>();
const PREVIEW_LOG_WINDOW_MS = 30_000;

async function logSelectionPreview(
  req: Request,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    if (details.conditions === 0) return;
    const key = req.sessionID || "anon";
    const now = Date.now();
    if (now - (previewLogAt.get(key) ?? 0) < PREVIEW_LOG_WINDOW_MS) return;
    previewLogAt.set(key, now);

    const user = req.session.user;
    await recordAuditLog({
      actorUserId: user?.id ?? null,
      actorEmail: user?.email ?? "",
      actorAccountType: user?.accountType ?? null,
      schoolId: getSchoolId(req),
      category: "selections",
      action: "СПИСОК:подбор",
      status: "success",
      details,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
  } catch (error) {
    console.error("Selection preview log error:", error);
  }
}

function getSchoolId(req: Request): number | null {
  const user = req.session.user;
  if (!user || user.accountType !== "school") return null;
  return user.schoolId;
}

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof SelectionError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Selection error:", error);
  return res.status(500).json({ error: fallback });
}

function parseFilters(raw: unknown): FilterCondition[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const condition = item as FilterCondition;
    return {
      field: String(condition.field ?? ""),
      op: String(condition.op ?? ""),
      value: condition.value ?? null,
      orNull: Boolean(condition.orNull),
    };
  });
}

function parseColumns(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((item) => String(item)) : [];
}

function sendExcel(res: Response, buffer: Buffer, filename: string) {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  return res.send(buffer);
}

export async function selectionOptionsHandler(req: Request, res: Response) {
  try {
    await ensureSelectionSchema();
    const data = await selectionOptions();
    return res.json(data);
  } catch (error) {
    return sendError(res, error, "Не удалось получить поля");
  }
}

export async function selectionPresetsHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const presets = await presetCounts(schoolId);
    return res.json({ presets });
  } catch (error) {
    return sendError(res, error, "Не удалось посчитать списки");
  }
}

export async function selectionPreviewHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const result = await previewSelection(
      schoolId,
      parseFilters(req.body?.filters),
      parseColumns(req.body?.columns),
      req.body?.sort,
    );
    const details = {
      conditions: parseFilters(req.body?.filters).length,
      columns: result.columns.length,
      rows: result.total,
    };
    res.locals.auditDetails = details;
    void logSelectionPreview(req, details);

    return res.json({
      total: result.total,
      rows: result.rows,
      warnings: result.warnings,
      columns: result.columns,
    });
  } catch (error) {
    return sendError(res, error, "Не удалось построить список");
  }
}

export async function selectionPresetRowsHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const rows = await presetRows(schoolId, String(req.params.presetKey));
    const presetKey = String(req.params.presetKey);
    res.locals.auditDetails = {
      preset: SELECTION_PRESETS.find((item) => item.key === presetKey)?.title ?? presetKey,
      rows: rows.length,
    };
    return res.json({ total: rows.length, rows: rows.slice(0, 50) });
  } catch (error) {
    return sendError(res, error, "Не удалось построить список");
  }
}

export async function selectionExportHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const columns = parseColumns(req.body?.columns);
    const title = String(req.body?.title ?? "Список учителей");

    let rows: TeacherRow[];
    if (req.body?.presetKey) {
      rows = await presetRows(schoolId, String(req.body.presetKey));
    } else {
      const preview = await previewSelection(
        schoolId,
        parseFilters(req.body?.filters),
        columns,
        req.body?.sort,
      );
      rows = preview.allRows;
    }

    const { buffer, filename } = await buildSelectionExcel(rows, columns, title);
    res.locals.auditDetails = {
      selectionTitle: title,
      rows: rows.length,
      columns: columns.length,
    };
    return sendExcel(res, buffer, filename);
  } catch (error) {
    return sendError(res, error, "Не удалось сформировать файл");
  }
}

export async function selectionListHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const items = await listSavedSelections(schoolId);
    return res.json({ items });
  } catch (error) {
    return sendError(res, error, "Не удалось получить списки");
  }
}

export async function selectionCreateHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const selection = await createSavedSelection(schoolId, {
      title: String(req.body?.title ?? ""),
      filters: parseFilters(req.body?.filters),
      columns: parseColumns(req.body?.columns),
      createdBy: req.session.user?.email ?? null,
    });
    res.locals.auditDetails = {
      selectionId: selection.id,
      selectionTitle: selection.title,
      conditions: selection.filters.length,
      columns: selection.columns.length,
    };
    return res.status(201).json({ selection });
  } catch (error) {
    return sendError(res, error, "Не удалось сохранить список");
  }
}

export async function selectionGetHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const selection = await getSavedSelection(schoolId, Number(req.params.id));
    return res.json({ selection });
  } catch (error) {
    return sendError(res, error, "Список не найден");
  }
}

export async function selectionDeleteHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const existing = await getSavedSelection(schoolId, Number(req.params.id));
    await deleteSavedSelection(schoolId, Number(req.params.id));
    res.locals.auditDetails = {
      selectionId: existing.id,
      selectionTitle: existing.title,
    };
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error, "Не удалось удалить список");
  }
}

export async function selectionSavedExportHandler(req: Request, res: Response) {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(401).json({ error: "Нет доступа" });
  try {
    await ensureSelectionSchema();
    const selection = await getSavedSelection(schoolId, Number(req.params.id));
    const preview = await previewSelection(
      schoolId,
      selection.filters,
      selection.columns,
    );
    const { buffer, filename } = await buildSelectionExcel(
      preview.allRows,
      selection.columns,
      selection.title,
    );
    res.locals.auditDetails = {
      selectionId: selection.id,
      selectionTitle: selection.title,
      rows: preview.total,
    };
    return sendExcel(res, buffer, filename);
  } catch (error) {
    return sendError(res, error, "Не удалось сформировать файл");
  }
}
