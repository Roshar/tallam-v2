import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { api } from "../../api/client";
import { TablePagination } from "../../components/TablePagination";
import type {
  AdminAuditLog,
  AdminAuditLogOptions,
  AdminAuditLogsResponse,
} from "../../types/admin";
import type { WorkersPageLimit } from "../../types/school";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function detailLabel(key: string): string {
  const labels: Record<string, string> = {
    httpStatus: "HTTP-статус",
    projectId: "Проект",
    cardType: "Тип карты",
    requestedAccountType: "Тип аккаунта",
  };
  return labels[key] ?? key;
}

export function AdminLogsPage() {
  const [options, setOptions] = useState<AdminAuditLogOptions | null>(null);
  const [data, setData] = useState<AdminAuditLogsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<WorkersPageLimit>(50);
  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .adminAuditLogOptions()
      .then(setOptions)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .adminAuditLogs({
        page,
        limit,
        category,
        action,
        email,
        status,
        dateFrom,
        dateTo,
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [action, category, dateFrom, dateTo, email, limit, page, status]);

  const actionLabels = useMemo(
    () =>
      new Map(options?.actions.map((item) => [item.action, item.label]) ?? []),
    [options],
  );
  const visibleActions =
    options?.actions.filter((item) => !category || item.category === category) ??
    [];

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setEmail(emailInput.trim());
  }

  function resetFilters() {
    setPage(1);
    setCategory("");
    setAction("");
    setStatus("");
    setEmailInput("");
    setEmail("");
    setDateFrom("");
    setDateTo("");
  }

  function renderDetails(item: AdminAuditLog) {
    const details = Object.entries(item.details ?? {});
    return (
      <div className="admin-logs__details">
        <dl>
          {item.schoolId ? (
            <div>
              <dt>Школа</dt>
              <dd>№ {item.schoolId}</dd>
            </div>
          ) : null}
          {item.entityType || item.entityId ? (
            <div>
              <dt>Объект</dt>
              <dd>
                {[item.entityType, item.entityId].filter(Boolean).join(" · ")}
              </dd>
            </div>
          ) : null}
          {item.ipAddress ? (
            <div>
              <dt>IP-адрес</dt>
              <dd>{item.ipAddress}</dd>
            </div>
          ) : null}
          {details.map(([key, value]) => (
            <div key={key}>
              <dt>{detailLabel(key)}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
        {item.userAgent ? (
          <p>
            <strong>Устройство:</strong> {item.userAgent}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="admin-logs">
      <header className="admin-dashboard__heading">
        <div>
          <p className="admin-dashboard__eyebrow">Контроль действий</p>
          <h2 className="page-title">Логи</h2>
          <p className="page-subtitle">
            Авторизация, подписки, работники, оценки уроков и смена паролей
          </p>
        </div>
      </header>

      <nav className="admin-logs__categories" aria-label="Категории логов">
        <button
          type="button"
          className={!category ? "active" : ""}
          onClick={() => {
            setPage(1);
            setCategory("");
            setAction("");
          }}
        >
          Все
        </button>
        {options?.categories.map((item) => (
          <button
            key={item.value}
            type="button"
            className={category === item.value ? "active" : ""}
            onClick={() => {
              setPage(1);
              setCategory(item.value);
              setAction("");
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <form className="admin-logs__filters" onSubmit={applyFilters}>
        <label>
          <span className="form-label">Тип действия</span>
          <select
            className="form-input"
            value={action}
            onChange={(event) => {
              setPage(1);
              setAction(event.target.value);
            }}
          >
            <option value="">Все действия</option>
            {visibleActions.map((item) => (
              <option key={item.action} value={item.action}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="form-label">Email инициатора</span>
          <input
            className="form-input"
            type="search"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            placeholder="school@example.ru"
          />
        </label>
        <label>
          <span className="form-label">Статус</span>
          <select
            className="form-input"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            <option value="">Все статусы</option>
            <option value="success">Успешно</option>
            <option value="failure">Ошибка</option>
          </select>
        </label>
        <label>
          <span className="form-label">Дата с</span>
          <input
            className="form-input"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => {
              setPage(1);
              setDateFrom(event.target.value);
            }}
          />
        </label>
        <label>
          <span className="form-label">Дата по</span>
          <input
            className="form-input"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => {
              setPage(1);
              setDateTo(event.target.value);
            }}
          />
        </label>
        <div className="admin-logs__filter-actions">
          <button type="submit" className="btn btn-primary">
            Применить
          </button>
          <button type="button" className="btn btn-ghost" onClick={resetFilters}>
            Сбросить
          </button>
        </div>
      </form>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="admin-logs__table">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Email инициатора</th>
                <th>Действие</th>
                <th>Статус</th>
                <th aria-label="Подробнее" />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <Fragment key={item.id}>
                  <tr key={item.id}>
                    <td className="admin-logs__time">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td>
                      <strong>{item.actorEmail}</strong>
                      {item.actorAccountType ? (
                        <small>{item.actorAccountType}</small>
                      ) : null}
                    </td>
                    <td>
                      {actionLabels.get(item.action) ?? item.action}
                      <small>{item.action}</small>
                    </td>
                    <td>
                      <span
                        className={`admin-log-status admin-log-status--${item.status}`}
                      >
                        {item.status === "success" ? "Успешно" : "Ошибка"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action-link table-action-link--button"
                        onClick={() =>
                          setExpandedId((current) =>
                            current === item.id ? null : item.id,
                          )
                        }
                      >
                        {expandedId === item.id ? "Скрыть" : "Детали"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === item.id ? (
                    <tr key={`${item.id}-details`}>
                      <td colSpan={5}>{renderDetails(item)}</td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {loading ? (
                <tr>
                  <td colSpan={5} className="admin-subscriptions__empty">
                    Загрузка...
                  </td>
                </tr>
              ) : null}
              {!loading && !data?.items.length ? (
                <tr>
                  <td colSpan={5} className="admin-subscriptions__empty">
                    По выбранным фильтрам событий нет
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          limit={limit}
          total={data?.pagination.total ?? 0}
          disabled={loading}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setPage(1);
            setLimit(value);
          }}
        />
      </section>
    </div>
  );
}

