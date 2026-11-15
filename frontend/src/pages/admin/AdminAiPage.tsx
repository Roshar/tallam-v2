import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { TablePagination } from "../../components/TablePagination";
import type { WorkersPageLimit } from "../../types/school";
import type {
  AiAdminUsage,
  AiJournalResponse,
  AiRepeatedQuery,
  AiSuggestionEntry,
} from "../../types/ai";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}

function statusLabel(status: string): string {
  if (status === "error") return "Ошибка";
  if (status === "blocked") return "Лимит";
  return "Успешно";
}

export function AdminAiPage() {
  const [usage, setUsage] = useState<AiAdminUsage | null>(null);
  const [journal, setJournal] = useState<AiJournalResponse | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestionEntry[]>([]);
  const [repeated, setRepeated] = useState<AiRepeatedQuery[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<WorkersPageLimit>(50);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeDays, setPurgeDays] = useState(365);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purging, setPurging] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.adminAiUsage(),
      api.adminAiSuggestions(),
      api.adminAiRepeated(30),
    ])
      .then(([usageResponse, suggestionsResponse, repeatedResponse]) => {
        if (!active) return;
        setUsage(usageResponse);
        setPurgeDays(usageResponse.retentionDays);
        setSuggestions(suggestionsResponse.items);
        setRepeated(repeatedResponse.items);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .adminAiQuestions({ page, limit, search })
      .then((response) => {
        if (active) setJournal(response);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, limit, search, reloadKey]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function purgeLogs() {
    if (purgeConfirm !== "PURGE" || purging) return;
    setPurging(true);
    setError("");
    try {
      const result = await api.adminAiPurge({
        confirm: purgeConfirm,
        days: purgeDays,
      });
      setNotice(
        `Журнал очищен: удалено вопросов ${result.deletedQuestions}, вызовов инструментов ${result.deletedToolCalls}. Действие записано в аудит.`,
      );
      setPurgeOpen(false);
      setPurgeConfirm("");
      setReloadKey((value) => value + 1);
    } catch (purgeError) {
      setError(
        purgeError instanceof Error
          ? purgeError.message
          : "Не удалось очистить журнал",
      );
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="admin-ai">
      <header className="admin-dashboard__heading">
        <div>
          <p className="admin-dashboard__eyebrow">Внутренний журнал</p>
          <h2 className="page-title">Чат поддержки</h2>
          <p className="page-subtitle">
            Полная история обращений, расходы, повторяющиеся запросы и
            предложения школ. Пользовательская история диалогов хранится
            отдельно и не влияет на журнал.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}

      <section className="admin-ai__stats" aria-label="Расходы за месяц">
        <article className="admin-ai__stat">
          <span>Обращений за месяц</span>
          <strong>{usage?.totals.questions ?? "-"}</strong>
        </article>
        <article className="admin-ai__stat">
          <span>Школ в журнале</span>
          <strong>{usage?.items.length ?? "-"}</strong>
        </article>
        <article className="admin-ai__stat">
          <span>Токены</span>
          <strong>
            {usage
              ? usage.totals.promptTokens + usage.totals.completionTokens
              : "-"}
          </strong>
        </article>
        <article className="admin-ai__stat">
          <span>Оценка расходов</span>
          <strong>
            {usage ? formatMoney(usage.totals.estimatedCostUsd) : "-"}
          </strong>
        </article>
      </section>

      <section className="admin-ai__panel">
        <div className="admin-ai__panel-head">
          <div>
            <h3>Журнал обращений</h3>
            <p>
              Включая диалоги, которые пользователи удалили из своей истории.
              Удаление диалога не затрагивает эти записи.
            </p>
          </div>
          <form className="admin-ai__search" onSubmit={applySearch}>
            <input
              className="form-input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Поиск по школе, email или вопросу"
              aria-label="Поиск по журналу"
            />
            <button type="submit" className="btn btn-primary">
              Найти
            </button>
            {search ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setPage(1);
                }}
              >
                Сбросить
              </button>
            ) : null}
          </form>
        </div>

        {loading ? <p className="admin-ai__empty">Загрузка...</p> : null}
        {!loading && !journal?.items.length ? (
          <p className="admin-ai__empty">По этому фильтру записей нет.</p>
        ) : null}

        {journal?.items.length ? (
          <div className="table-wrap">
            <table className="data-table admin-ai__table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Школа и пользователь</th>
                  <th>Диалог</th>
                  <th>Вопрос и ответ</th>
                  <th>Инструменты</th>
                  <th>Токены</th>
                  <th>Стоимость</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {journal.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="admin-ai__time">
                      {formatDateTime(entry.createdAt)}
                      <small>#{entry.id}</small>
                    </td>
                    <td>
                      <strong>{entry.schoolName || `Школа №${entry.schoolId}`}</strong>
                      <small>{entry.userEmail || "Пользователь удален"}</small>
                    </td>
                    <td>
                      {entry.conversationTitle || "Разовый запрос"}
                      <small>
                        {entry.conversationId
                          ? `Диалог #${entry.conversationId}`
                          : "Без диалога"}
                      </small>
                      {entry.conversationId && !entry.conversationExists ? (
                        <small className="admin-ai__removed">
                          Удален из истории пользователя
                        </small>
                      ) : null}
                    </td>
                    <td className="admin-ai__question">
                      <div>{entry.question}</div>
                      {entry.answer ? (
                        <details>
                          <summary>Показать ответ</summary>
                          <div className="admin-ai__answer">{entry.answer}</div>
                        </details>
                      ) : null}
                    </td>
                    <td className="admin-ai__tools">
                      {entry.tools || "-"}
                    </td>
                    <td className="admin-ai__numbers">
                      <span>
                        {entry.promptTokens ?? 0} /{" "}
                        {entry.completionTokens ?? 0}
                      </span>
                      <small>вход / выход</small>
                    </td>
                    <td className="admin-ai__numbers">
                      {entry.costUsd === null
                        ? "-"
                        : formatMoney(entry.costUsd)}
                    </td>
                    <td>
                      <span
                        className={`admin-ai__status admin-ai__status--${entry.status}`}
                      >
                        {statusLabel(entry.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {journal ? (
          <TablePagination
            page={page}
            limit={limit}
            total={journal.pagination.total}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
            disabled={loading}
          />
        ) : null}
      </section>

      <div className="admin-ai__grid">
        <section className="admin-ai__panel">
          <div className="admin-ai__panel-head">
            <div>
              <h3>Повторяющиеся запросы</h3>
              <p>Что чаще всего спрашивают школы за последние 30 дней.</p>
            </div>
          </div>
          {!repeated.length ? (
            <p className="admin-ai__empty">Повторов за период нет.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Запрос</th>
                    <th>Повторов</th>
                    <th>Школ</th>
                    <th>Последний</th>
                  </tr>
                </thead>
                <tbody>
                  {repeated.map((item, index) => (
                    <tr key={`${item.normalized}-${index}`}>
                      <td>{item.sample}</td>
                      <td>{item.total}</td>
                      <td>{item.schools}</td>
                      <td className="admin-ai__time">
                        {formatDateTime(item.lastAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-ai__panel">
          <div className="admin-ai__panel-head">
            <div>
              <h3>Предложения по развитию</h3>
              <p>Что школы предлагают улучшить в кабинете и чате.</p>
            </div>
          </div>
          {!suggestions.length ? (
            <p className="admin-ai__empty">Предложений пока нет.</p>
          ) : (
            <div className="admin-ai__suggestions">
              {suggestions.map((item) => (
                <article key={item.id} className="admin-ai__suggestion">
                  <div className="admin-ai__suggestion-head">
                    <strong>
                      {item.schoolName || `Школа №${item.schoolId}`}
                    </strong>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p>{item.suggestion}</p>
                  {item.userEmail ? <small>{item.userEmail}</small> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="admin-ai__panel admin-ai__retention">
        <div>
          <h3>Хранение и очистка журнала</h3>
          <p>
            Журнал хранится отдельно от диалогов пользователей. Срок хранения
            по умолчанию: {usage?.retentionDays ?? 365} дней. Очистка удаляет
            только внутренние записи старше указанного срока, не трогая
            пользовательские диалоги. Каждая очистка подтверждается и
            записывается в аудит.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            setPurgeOpen(true);
            setPurgeConfirm("");
            setPurgeDays(usage?.retentionDays ?? 365);
          }}
        >
          Очистить старые записи
        </button>
      </section>

      {purgeOpen ? (
        <div
          className="ai-modal-backdrop"
          onClick={() => (purging ? undefined : setPurgeOpen(false))}
        >
          <div
            className="ai-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-ai-purge-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="admin-ai-purge-title">Очистить внутренний журнал</h3>
            <p>
              Будут удалены записи журнала и вызовы инструментов старше
              указанного срока. Пользовательские диалоги останутся на месте.
            </p>
            <label className="admin-ai__purge-field">
              <span>Хранить последних дней</span>
              <input
                className="form-input"
                type="number"
                min={1}
                max={3650}
                value={purgeDays}
                onChange={(event) =>
                  setPurgeDays(Number(event.target.value) || 1)
                }
              />
            </label>
            <p className="ai-modal__note">
              Действие необратимо и будет записано в аудит. Для подтверждения
              введите PURGE.
            </p>
            <input
              className="form-input"
              value={purgeConfirm}
              onChange={(event) => setPurgeConfirm(event.target.value)}
              placeholder="PURGE"
              aria-label="Подтверждение очистки"
            />
            <div className="ai-modal__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPurgeOpen(false)}
                disabled={purging}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void purgeLogs()}
                disabled={purging || purgeConfirm !== "PURGE"}
              >
                {purging ? "Очищаем..." : "Очистить журнал"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
