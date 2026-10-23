import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  SELECTION_COLUMN_LABELS,
  SELECTION_OPERATOR_LABELS,
  formatSelectionCell,
  isSelectionOpWithoutValue,
  type SavedSelection,
  type SelectionField,
  type SelectionFilter,
  type SelectionMeta,
  type SelectionPreset,
  type SelectionPreview,
  type SelectionRow,
} from "../../types/selection";

const PRESET_COLUMNS = [
  "fio",
  "position",
  "category",
  "age",
  "last_evaluation_date",
];

const DEFAULT_COLUMNS = ["fio", "position", "category", "age"];

function emptyCondition(field: SelectionField): SelectionFilter {
  const op = field.operators[0] ?? "eq";
  return { field: field.key, op, value: "" };
}

export function SelectionsPage() {
  const [meta, setMeta] = useState<SelectionMeta | null>(null);
  const [presets, setPresets] = useState<SelectionPreset[]>([]);
  const [saved, setSaved] = useState<SavedSelection[]>([]);
  const [activePreset, setActivePreset] = useState<SelectionPreset | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [filters, setFilters] = useState<SelectionFilter[]>([]);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [preview, setPreview] = useState<SelectionPreview | null>(null);
  const [presetRows, setPresetRows] = useState<SelectionRow[] | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadReference = useCallback(() => {
    Promise.all([api.selectionMeta(), api.selectionPresets(), api.savedSelections()])
      .then(([metaData, presetData, savedData]) => {
        setMeta(metaData);
        setPresets(presetData.presets);
        setSaved(savedData.items);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadReference();
  }, [loadReference]);

  // Незаполненное условие не считаем условием: такой запрос не отправляем
  // на сервер, иначе пользователь сразу видит ошибку валидации.
  const hasIncompleteCondition = useMemo(() => {
    return filters.some((condition) => {
      const field = meta?.fields.find((item) => item.key === condition.field);
      if (!field) return true;
      if (isSelectionOpWithoutValue(condition.op)) return false;
      return (
        condition.value === undefined ||
        condition.value === null ||
        String(condition.value).trim() === ""
      );
    });
  }, [filters, meta]);

  useEffect(() => {
    if (!builderOpen) return;
    if (hasIncompleteCondition) {
      setPreview(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      api
        .selectionPreview({ filters, columns })
        .then(setPreview)
        .catch((err: Error) => {
          setPreview(null);
          setError(err.message);
        });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [builderOpen, filters, columns, hasIncompleteCondition]);

  function pickPreset(preset: SelectionPreset) {
    setActivePreset(preset);
    setBuilderOpen(false);
    setPresetRows(null);
    setError("");
    setBusy(true);
    api
      .selectionPresetRows(preset.key)
      .then((data) => setPresetRows(data.rows))
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  }

  function openBuilder() {
    setBuilderOpen(true);
    setActivePreset(null);
    setPresetRows(null);
    setNotice("");
    setError("");
  }

  function openSaved(selection: SavedSelection) {
    setBuilderOpen(true);
    setActivePreset(null);
    setPresetRows(null);
    setFilters(selection.filters);
    setColumns(selection.columns);
    setTitle(selection.title);
    setNotice("");
    setError("");
  }

  async function exportPreset(preset: SelectionPreset) {
    setBusy(true);
    setError("");
    try {
      await api.selectionExport({
        presetKey: preset.key,
        title: preset.title,
        columns: PRESET_COLUMNS,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function exportBuilder() {
    setBusy(true);
    setError("");
    try {
      await api.selectionExport({
        filters,
        columns,
        title: title.trim() || "Список учителей",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSelection() {
    setBusy(true);
    setError("");
    try {
      const created = await api.createSelection({ title, filters, columns });
      setSaved((current) => [created.selection, ...current]);
      setNotice("Список сохранён. Он будет обновляться автоматически.");
      setTitle("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSelection(selection: SavedSelection) {
    if (!window.confirm(`Удалить список «${selection.title}»?`)) return;
    setBusy(true);
    try {
      await api.deleteSelection(selection.id);
      setSaved((current) => current.filter((item) => item.id !== selection.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fieldByKey = useMemo(() => {
    const map = new Map<string, SelectionField>();
    meta?.fields.forEach((field) => map.set(field.key, field));
    return map;
  }, [meta]);

  function updateFilter(index: number, patch: Partial<SelectionFilter>) {
    setFilters((current) =>
      current.map((condition, position) =>
        position === index ? { ...condition, ...patch } : condition,
      ),
    );
  }

  function addCondition() {
    if (!meta) return;
    const field = meta.fields.find((item) => item.key === "age") ?? meta.fields[0];
    if (!field) return;
    setFilters((current) => [...current, emptyCondition(field)]);
  }

  function removeCondition(index: number) {
    setFilters((current) => current.filter((_, position) => position !== index));
  }

  const presetTableRows = presetRows ?? [];
  const builderTableRows = preview?.rows ?? [];
  const tableColumns = preview?.columns?.length ? preview.columns : columns;

  return (
    <div className="card">
      <div className="card-body">
        <header className="school-guide__header">
          <h2 className="page-title">Списки учителей</h2>
          <p className="page-subtitle">
            Готовые списки учителей и собственные подборки по заданным условиям.
            Данные обновляются автоматически, любой список можно выгрузить в
            Excel.
          </p>
        </header>

        <section className="selections__intro">
          <h3 className="selections__intro-title">Как это работает</h3>
          <ol className="selections__intro-list">
            <li>
              <b>Выберите готовый список</b> или создайте свою подборку учителей
              по нужным условиям.
            </li>
            <li>
              <b>Проверьте результат</b> — список обновляется автоматически при
              изменении данных учителей.
            </li>
            <li>
              <b>Сохраните подборку</b> для дальнейшей работы или выгрузите её в
              Excel.
            </li>
          </ol>
          <p className="selections__intro-note">
            Сохранённые списки всегда остаются актуальными: если данные учителя
            изменятся, состав списка пересчитается автоматически.
          </p>
        </section>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        {loading && <p className="page-subtitle">Загрузка…</p>}

        {!loading && (
          <>
            <section className="selections__section">
              <h3 className="selections__section-title">Готовые списки</h3>
              <div className="selections__presets">
                {presets.map((preset) => (
                  <div className="selections__preset" key={preset.key}>
                    <button
                      type="button"
                      className="selections__preset-main"
                      onClick={() => pickPreset(preset)}
                    >
                      <span className="selections__preset-title">
                        {preset.title}
                      </span>
                      <span className="selections__preset-count">
                        {preset.count}
                      </span>
                      <span className="selections__preset-desc">
                        {preset.description}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy || preset.count === 0}
                      onClick={() => exportPreset(preset)}
                    >
                      Excel
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="selections__section">
              <div className="selections__section-head">
                <h3 className="selections__section-title">Мои списки</h3>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openBuilder}
                >
                  Новый список
                </button>
              </div>

              {saved.length === 0 ? (
                <p className="selections__empty">
                  Пока нет сохранённых списков. Соберите свой, например «Молодые
                  математики» или «К аттестации в этом году».
                </p>
              ) : (
                <table className="table selections__table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Изменён</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {saved.map((selection) => (
                      <tr key={selection.id}>
                        <td>{selection.title}</td>
                        <td>{selection.updatedAt.split("-").reverse().join(".")}</td>
                        <td className="selections__row-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => openSaved(selection)}
                          >
                            Открыть
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              void api
                                .savedSelectionExport(selection.id)
                                .catch((err: Error) => setError(err.message));
                            }}
                          >
                            Excel
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => removeSelection(selection)}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {activePreset && (
              <section className="selections__section">
                <div className="selections__section-head">
                  <h3 className="selections__section-title">
                    {activePreset.title}
                  </h3>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => exportPreset(activePreset)}
                    disabled={busy}
                  >
                    Скачать Excel
                  </button>
                </div>
                <p className="selections__hint">{activePreset.description}</p>

                {busy && <p className="page-subtitle">Считаем…</p>}

                {!busy && presetTableRows.length === 0 && (
                  <p className="selections__empty">
                    Никого не нашли. Возможно, это хорошая новость. Попробуйте
                    другой список.
                  </p>
                )}

                {presetTableRows.length > 0 && (
                  <RowsTable rows={presetTableRows} columns={PRESET_COLUMNS} />
                )}
              </section>
            )}

            {builderOpen && (
              <section className="selections__section">
                <div className="selections__section-head">
                  <h3 className="selections__section-title">Новый список</h3>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setBuilderOpen(false)}
                  >
                    Закрыть
                  </button>
                </div>

                <div className="selections__conditions">
                  {filters.map((condition, index) => {
                    const field = fieldByKey.get(condition.field);
                    if (!field) return null;
                    const options = meta?.options[field.key] ?? [];
                    return (
                      <div className="selections__condition" key={`${field.key}-${index}`}>
                        <span className="selections__and">
                          {index === 0 ? "Где" : "И"}
                        </span>
                        <select
                          className="form-input"
                          value={condition.field}
                          onChange={(event) => {
                            const next = fieldByKey.get(event.target.value);
                            if (next) {
                              setFilters((current) =>
                                current.map((item, position) =>
                                  position === index ? emptyCondition(next) : item,
                                ),
                              );
                            }
                          }}
                        >
                          {meta?.fields.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </select>

                        <select
                          className="form-input selections__op"
                          value={condition.op}
                          onChange={(event) =>
                            updateFilter(index, {
                              op: event.target.value,
                              value: "",
                            })
                          }
                        >
                          {field.operators.map((op) => (
                            <option key={op} value={op}>
                              {SELECTION_OPERATOR_LABELS[op] ?? op}
                            </option>
                          ))}
                        </select>

                        {!isSelectionOpWithoutValue(condition.op) &&
                          (field.kind === "enum" ? (
                            <select
                              className="form-input selections__value"
                              value={String(condition.value ?? "")}
                              onChange={(event) =>
                                updateFilter(index, { value: event.target.value })
                              }
                            >
                              <option value="">Выберите…</option>
                              {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.title}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="form-input selections__value"
                              type={
                                condition.op === "before" || condition.op === "after"
                                  ? "date"
                                  : "number"
                              }
                              value={String(condition.value ?? "")}
                              onChange={(event) =>
                                updateFilter(index, { value: event.target.value })
                              }
                            />
                          ))}

                        {condition.op === "lt" && field.kind === "number" && (
                          <label className="selections__nullable">
                            <input
                              type="checkbox"
                              checked={Boolean(condition.orNull)}
                              onChange={(event) =>
                                updateFilter(index, { orNull: event.target.checked })
                              }
                            />
                            включая незаполненные
                          </label>
                        )}

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => removeCondition(index)}
                        >
                          Убрать
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={addCondition}
                  >
                    + Добавить условие
                  </button>
                </div>

                <div className="selections__columns">
                  <span className="selections__columns-label">Показывать:</span>
                  {meta?.fields
                    .filter((field) => field.columnable)
                    .map((field) => (
                      <label className="selections__column-toggle" key={field.key}>
                        <input
                          type="checkbox"
                          checked={columns.includes(field.key)}
                          onChange={(event) =>
                            setColumns((current) =>
                              event.target.checked
                                ? [...current, field.key]
                                : current.filter((item) => item !== field.key),
                            )
                          }
                        />
                        {SELECTION_COLUMN_LABELS[field.key] ?? field.label}
                      </label>
                    ))}
                </div>

                <p className="selections__count">
                  {hasIncompleteCondition
                    ? "Заполните значение условия, и вы увидите, кто попадёт в список."
                    : preview
                      ? `Подходит ${preview.total} учителей`
                      : "Считаем…"}
                </p>

                {preview?.warnings.map((warning) => (
                  <div className="alert alert-warning" key={warning.code}>
                    {warning.message}: {warning.affected}
                  </div>
                ))}

                {builderTableRows.length > 0 && (
                  <RowsTable rows={builderTableRows} columns={tableColumns} />
                )}

                {preview && preview.total === 0 && (
                  <p className="selections__empty">
                    Никого не нашли. Попробуйте ослабить условия, например
                    увеличить стаж или убрать предмет.
                  </p>
                )}

                <div className="selections__save">
                  <input
                    className="form-input"
                    placeholder="Название списка"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={150}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy || !title.trim() || hasIncompleteCondition}
                    onClick={saveSelection}
                  >
                    Сохранить список
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy || hasIncompleteCondition}
                    onClick={exportBuilder}
                  >
                    Скачать Excel
                  </button>
                </div>
              </section>
            )}

            <p className="selections__footer">
              Нужен другой срез по учителю? Откройте{" "}
              <Link to="/school/workers">базу работников</Link> и выберите
              «Дело учителя».
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function RowsTable({
  rows,
  columns,
}: {
  rows: SelectionRow[];
  columns: string[];
}) {
  return (
    <div className="selections__table-wrap">
      <table className="table selections__table">
        <thead>
          <tr>
            {columns.map((key) => (
              <th key={key}>{SELECTION_COLUMN_LABELS[key] ?? key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((key) => (
                <td key={key}>
                  {key === "fio" ? (
                    <Link to={`/school/workers/${row.id}/dossier`}>
                      {row.fio}
                    </Link>
                  ) : (
                    formatSelectionCell(row, key)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length >= 50 && (
        <p className="selections__hint">
          Показаны первые 50 строк. В Excel выгрузится весь список.
        </p>
      )}
    </div>
  );
}
