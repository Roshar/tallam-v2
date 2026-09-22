import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { TablePagination } from "../../components/TablePagination";
import type {
  AdminPasswordResetLink,
  AdminSubscriptionArea,
  AdminSubscription,
  AdminSubscriptionListStatus,
} from "../../types/admin";
import type { WorkersPageLimit } from "../../types/school";

type StatusFilter = "all" | AdminSubscriptionListStatus;

const STATUS_LABELS: Record<AdminSubscriptionListStatus, string> = {
  active: "Активна",
  expiring: "Скоро истекает",
  expired: "Истекла",
  scheduled: "Ещё не началась",
  missing: "Нет данных",
};

function cabinetAccessLabel(accountStatus: AdminSubscription["accountStatus"]) {
  if (accountStatus === "on") return "Кабинет открыт";
  if (accountStatus != null) return "Нужна оплата";
  return "Нет кабинета";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU").format(
    new Date(`${value}T00:00:00`),
  );
}

function schoolCountLabel(value: number) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "школ";
  if (last === 1) return "школа";
  if (last >= 2 && last <= 4) return "школы";
  return "школ";
}

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function AdminSubscriptionsPage() {
  const [items, setItems] = useState<AdminSubscription[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<WorkersPageLimit>(20);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [areas, setAreas] = useState<AdminSubscriptionArea[]>([]);
  const [areaId, setAreaId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [linkLoadingId, setLinkLoadingId] = useState<number | null>(null);
  const [resetLink, setResetLink] = useState<AdminPasswordResetLink | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [copiedCell, setCopiedCell] = useState("");

  useEffect(() => {
    api
      .adminSubscriptionAreas()
      .then((data) => setAreas(data.items))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api
      .adminSubscriptions({ page, limit, search, status, areaId })
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setTotal(data.pagination.total);
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
  }, [page, limit, search, status, areaId]);

  async function createResetLink(schoolId: number) {
    setLinkLoadingId(schoolId);
    setError("");
    setCopied(false);
    try {
      setResetLink(await api.createAdminPasswordResetLink(schoolId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать ссылку");
    } finally {
      setLinkLoadingId(null);
    }
  }

  async function copyResetLink() {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink.resetUrl);
      setCopied(true);
    } catch {
      setError("Не удалось скопировать ссылку. Выделите её вручную.");
    }
  }

  async function copyCellValue(key: string, value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCell(key);
      window.setTimeout(() => {
        setCopiedCell((current) => (current === key ? "" : current));
      }, 1800);
    } catch {
      setError(`Не удалось скопировать ${label}`);
    }
  }

  async function exportSubscriptions() {
    setExporting(true);
    setError("");
    try {
      await api.downloadAdminSubscriptions({ search, status, areaId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="admin-subscriptions">
      <div className="page-header-row admin-subscriptions__header">
        <div>
          <p className="admin-dashboard__eyebrow">Доступ школ</p>
          <h2 className="page-title">Подписки</h2>
          <p className="page-subtitle">
            Все школы платформы: сроки доступа, кабинеты без данных и школы, которым нужна оплата
          </p>
        </div>
        <div className="admin-subscriptions__header-actions">
          <span className="admin-subscriptions__total">
            {total} {schoolCountLabel(total)}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || exporting || total === 0}
            onClick={() => void exportSubscriptions()}
          >
            {exporting ? "Формирование..." : "Экспорт в Excel"}
          </button>
        </div>
      </div>

      <section className="admin-subscriptions__filters">
        <label className="admin-subscriptions__search">
          <span>Поиск</span>
          <input
            className="form-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Школа, район, логин или телефон"
          />
        </label>

        <label className="admin-subscriptions__status">
          <span>Статус</span>
          <select
            className="form-input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">Все школы</option>
            <option value="active">Активные</option>
            <option value="expiring">Истекают за 30 дней</option>
            <option value="expired">Истёкшие</option>
            <option value="scheduled">Ещё не начались</option>
            <option value="missing">Без данных о подписке</option>
            <option value="unpaid">Заблокированы, нужна оплата</option>
          </select>
        </label>

        <label className="admin-subscriptions__area">
          <span>Район</span>
          <select
            className="form-input"
            value={areaId}
            onChange={(event) => {
              setAreaId(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={0}>Все районы</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="table-wrap admin-subscriptions__table-wrap">
        <table className="data-table admin-subscriptions__table">
          <thead>
            <tr>
              <th>№</th>
              <th>Школа</th>
              <th>Логин</th>
              <th>Телефон</th>
              <th>Срок подписки</th>
              <th>Статус</th>
              <th>Кабинет</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-subscriptions__empty">
                  Школы по выбранным условиям не найдены
                </td>
              </tr>
            ) : null}

            {items.map((item, index) => (
              <tr key={item.schoolId}>
                <td className="admin-subscriptions__index">
                  {(page - 1) * limit + index + 1}
                </td>
                <td>
                  <div className="admin-copyable-value">
                    <p className="admin-subscriptions__school">
                      <Link to={`/admin/subscriptions/${item.schoolId}`}>
                        {item.schoolName}
                      </Link>
                    </p>
                    <button
                      type="button"
                      className={`admin-copy-button${
                        copiedCell === `${item.schoolId}:school`
                          ? " is-copied"
                          : ""
                      }`}
                      title={
                        copiedCell === `${item.schoolId}:school`
                          ? "Скопировано"
                          : "Скопировать название школы"
                      }
                      aria-label="Скопировать название школы"
                      onClick={() =>
                        void copyCellValue(
                          `${item.schoolId}:school`,
                          item.schoolName,
                          "название школы",
                        )
                      }
                    >
                      <CopyIcon
                        copied={copiedCell === `${item.schoolId}:school`}
                      />
                    </button>
                  </div>
                  <p className="admin-subscriptions__area">
                    {item.area ?? "Район не указан"}
                  </p>
                </td>
                <td>
                  {item.email ? (
                    <div className="admin-copyable-value">
                      <span>{item.email}</span>
                      <button
                        type="button"
                        className={`admin-copy-button${
                          copiedCell === `${item.schoolId}:email`
                            ? " is-copied"
                            : ""
                        }`}
                        title={
                          copiedCell === `${item.schoolId}:email`
                            ? "Скопировано"
                            : "Скопировать email"
                        }
                        aria-label="Скопировать email"
                        onClick={() =>
                          void copyCellValue(
                            `${item.schoolId}:email`,
                            item.email!,
                            "email",
                          )
                        }
                      >
                        <CopyIcon
                          copied={copiedCell === `${item.schoolId}:email`}
                        />
                      </button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {item.phone ? (
                    <div className="admin-copyable-value">
                      <span>{item.phone}</span>
                      <button
                        type="button"
                        className={`admin-copy-button${
                          copiedCell === `${item.schoolId}:phone`
                            ? " is-copied"
                            : ""
                        }`}
                        title={
                          copiedCell === `${item.schoolId}:phone`
                            ? "Скопировано"
                            : "Скопировать телефон"
                        }
                        aria-label="Скопировать телефон"
                        onClick={() =>
                          void copyCellValue(
                            `${item.schoolId}:phone`,
                            item.phone!,
                            "номер телефона",
                          )
                        }
                      >
                        <CopyIcon
                          copied={copiedCell === `${item.schoolId}:phone`}
                        />
                      </button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="admin-subscriptions__period">
                  {item.startsOn && item.endsOn ? (
                    <>
                      <span>{formatDate(item.startsOn)}</span>
                      <span>—</span>
                      <span>{formatDate(item.endsOn)}</span>
                    </>
                  ) : (
                    <span className="admin-subscriptions__no-data">Нет данных</span>
                  )}
                </td>
                <td>
                  <span
                    className={`admin-subscription-status admin-subscription-status--${item.subscriptionStatus}`}
                  >
                    {STATUS_LABELS[item.subscriptionStatus]}
                  </span>
                </td>
                <td>
                  <span
                    className={`admin-cabinet-access admin-cabinet-access--${
                      item.accountStatus === "on"
                        ? "open"
                        : item.accountStatus != null
                          ? "unpaid"
                          : "none"
                    }`}
                  >
                    {cabinetAccessLabel(item.accountStatus)}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="table-action-link table-action-link--button"
                    disabled={!item.email || linkLoadingId === item.schoolId}
                    title={
                      !item.email ? "Логин школы не указан" : undefined
                    }
                    onClick={() => void createResetLink(item.schoolId)}
                  >
                    {linkLoadingId === item.schoolId
                      ? "Создание..."
                      : "Ссылка для смены пароля"}
                  </button>
                </td>
              </tr>
            ))}

            {loading ? (
              <tr>
                <td colSpan={8} className="admin-subscriptions__empty">
                  Загрузка...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        limit={limit}
        total={total}
        disabled={loading}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
      />

      {resetLink ? (
        <div
          className="admin-reset-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-reset-modal-title"
          onClick={() => setResetLink(null)}
        >
          <div
            className="admin-reset-modal__dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-reset-modal__header">
              <div>
                <h3 id="admin-reset-modal-title">Ссылка для смены пароля</h3>
                <p>{resetLink.email}</p>
              </div>
              <button
                type="button"
                className="admin-reset-modal__close"
                onClick={() => setResetLink(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="admin-reset-modal__body">
              <p>
                Передайте эту ссылку школе. Она действует до{" "}
                <strong>
                  {new Intl.DateTimeFormat("ru-RU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(resetLink.expiresAt))}
                </strong>{" "}
                либо до успешной смены пароля. Открывать её можно повторно:
                после сохранения нового пароля ссылка станет недействительной.
              </p>
              <input
                className="form-input admin-reset-modal__link"
                value={resetLink.resetUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>

            <div className="admin-reset-modal__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setResetLink(null)}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void copyResetLink()}
              >
                {copied ? "Скопировано" : "Скопировать ссылку"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
