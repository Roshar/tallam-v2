import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type {
  AdminRenewalListItem,
  AdminRenewalRequest,
  AdminRenewalsResponse,
} from "../../types/admin";
import type { RenewalStatus } from "../../types/school";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<RenewalStatus, string> = {
  pending: "Ожидает подтверждения",
  documents_ready: "Ожидает подтверждения",
  paid: "Оплачено",
  cancelled: "Отменено",
};

function notifyRenewalQueueChanged() {
  window.dispatchEvent(new Event("admin-renewals-updated"));
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU").format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

function maskedPassport(series: string, number: string): string {
  return `${series.slice(0, 2)}•• •••${number.slice(-3)}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminRenewalsPage() {
  const [data, setData] = useState<AdminRenewalsResponse | null>(null);
  const [selected, setSelected] = useState<AdminRenewalRequest | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [manualOnly, setManualOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [revealPersonalData, setRevealPersonalData] = useState(false);
  const [error, setError] = useState("");
  const detailRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await api.adminRenewals({
          page,
          limit: PAGE_SIZE,
          status,
          search,
          manualOnly,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, manualOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected || detailLoading) return;
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected?.id, detailLoading]);

  async function openRequest(item: AdminRenewalListItem) {
    setDetailLoading(true);
    setError("");
    setRevealPersonalData(false);
    try {
      const { request } = await api.adminRenewal(item.id);
      setSelected(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить заявку");
    } finally {
      setDetailLoading(false);
    }
  }

  async function markPaid() {
    if (!selected) return;
    if (
      !window.confirm(
        "Подтвердить поступление оплаты? Подписка будет автоматически активирована на указанный годовой период.",
      )
    ) {
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const { request } = await api.payAdminRenewal(selected.id);
      setSelected(request);
      await load();
      notifyRenewalQueueChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подтвердить оплату");
    } finally {
      setActionLoading(false);
    }
  }

  async function downloadManual() {
    if (!selected?.manual) return;
    setDownloading(true);
    setError("");
    try {
      await api.downloadAdminManualActivationDocument(selected.manual.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скачать файл");
    } finally {
      setDownloading(false);
    }
  }

  async function download() {
    if (!selected) return;
    setDownloading(true);
    setError("");
    try {
      await api.downloadAdminRenewalDocument(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скачать документ");
    } finally {
      setDownloading(false);
    }
  }

  const totalPages = data?.pagination.totalPages ?? 1;
  const customer = selected?.customer;

  return (
    <div className="admin-renewals">
      <header className="admin-dashboard__heading">
        <div>
          <p className="admin-dashboard__eyebrow">Подписки</p>
          <h2 className="page-title">Заявки на продление</h2>
          <p className="page-subtitle">
            Проверка данных, документы и окончательное подтверждение оплаты
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="admin-renewals__filters">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <input
            className="form-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Школа или логин"
            aria-label="Поиск заявок"
          />
          <button type="submit" className="btn btn-primary">
            Найти
          </button>
        </form>
        <select
          className="form-input"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          aria-label="Статус заявки"
        >
          <option value="all">Все статусы</option>
          <option value="pending">Ожидают подтверждения</option>
          <option value="documents_ready">Документы готовы</option>
          <option value="paid">Оплачено</option>
          <option value="cancelled">Отменено</option>
        </select>
        <label className="admin-renewals__manual-filter">
          <input
            type="checkbox"
            checked={manualOnly}
            onChange={(event) => {
              setPage(1);
              setManualOnly(event.target.checked);
            }}
          />
          Только после аварии
        </label>
        {data?.manualStats.count ? (
          <span className="admin-renewals__manual-stats">
            Подключено после аварии: {data.manualStats.count}
            {data.manualStats.totalAmount
              ? ` на ${formatMoney(data.manualStats.totalAmount)}`
              : ""}
          </span>
        ) : null}
      </section>

      <div className="admin-renewals__workspace">
        <section className="admin-renewals__list">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Школа / заказчик</th>
                  <th>Создана</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item, index) => (
                  <tr
                    key={item.id}
                    className={
                      selected?.id === item.id
                        ? "admin-renewals__row--selected"
                        : undefined
                    }
                  >
                    <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-renewals__open"
                        onClick={() => void openRequest(item)}
                      >
                        {item.schoolName}
                      </button>
                      <small>{item.customerName}</small>
                      {item.manual ? (
                        <span className="admin-renewals__manual-badge">
                          После аварии
                        </span>
                      ) : null}
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <span
                        className={`admin-subscription-status admin-renewal-status--${item.status}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && !data?.items.length ? (
                  <tr>
                    <td colSpan={4} className="admin-subscriptions__empty">
                      Заявок не найдено
                    </td>
                  </tr>
                ) : null}
                {loading ? (
                  <tr>
                    <td colSpan={4} className="admin-subscriptions__empty">
                      Загрузка...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="admin-renewals__pagination">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Назад
            </button>
            <span>
              {page} из {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Вперёд
            </button>
          </div>
        </section>

        <aside ref={detailRef} className="admin-renewals__detail">
          {detailLoading ? (
            <p className="page-subtitle">Загрузка заявки...</p>
          ) : selected && customer ? (
            <>
              <div className="admin-renewals__detail-head">
                <div>
                  <p className="admin-dashboard__eyebrow">
                    Заявка № {selected.id}
                  </p>
                  <h3>{selected.schoolName}</h3>
                  <Link to={`/admin/subscriptions/${selected.schoolId}`}>
                    Открыть карточку школы
                  </Link>
                </div>
                <span
                  className={`admin-subscription-status admin-renewal-status--${selected.status}`}
                >
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>

              {selected.manual ? (
                <div className="admin-renewals__manual-info">
                  <p className="admin-renewals__manual-title">
                    Подключено вручную после аварии
                  </p>
                  <p>
                    Сумма:{" "}
                    <strong>
                      {selected.manual.amount === null
                        ? "не указана"
                        : formatMoney(selected.manual.amount)}
                    </strong>
                  </p>
                  {selected.manual.paidOn ? (
                    <p>
                      Дата оплаты:{" "}
                      <strong>{formatDate(selected.manual.paidOn)}</strong>
                    </p>
                  ) : null}
                  {selected.manual.note ? (
                    <p>Комментарий: {selected.manual.note}</p>
                  ) : null}
                  {selected.manual.hasDocument ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={downloading}
                      onClick={() => void downloadManual()}
                    >
                      {downloading ? "Подготовка..." : "Открыть платежку"}
                    </button>
                  ) : (
                    <p>Платежный документ не приложен</p>
                  )}
                </div>
              ) : (
                <>
              <div className="admin-renewals__privacy">
                <span>Персональные данные</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRevealPersonalData((value) => !value)}
                >
                  {revealPersonalData ? "Скрыть" : "Показать полностью"}
                </button>
              </div>

              <dl className="admin-renewals__customer">
                <div>
                  <dt>ФИО</dt>
                  <dd>{customer.fullName}</dd>
                </div>
                <div>
                  <dt>Телефон</dt>
                  <dd>{customer.phone || "не указан"}</dd>
                </div>
                <div>
                  <dt>Паспорт</dt>
                  <dd>
                    {revealPersonalData
                      ? `${customer.passportSeries} ${customer.passportNumber}`
                      : maskedPassport(
                          customer.passportSeries,
                          customer.passportNumber,
                        )}
                  </dd>
                </div>
                <div>
                  <dt>Выдан</dt>
                  <dd>
                    {revealPersonalData
                      ? `${customer.passportIssuedBy}, ${formatDate(customer.passportIssuedOn)}`
                      : "••••••••"}
                  </dd>
                </div>
                <div>
                  <dt>Код подразделения</dt>
                  <dd>
                    {revealPersonalData ? customer.divisionCode : "•••-•••"}
                  </dd>
                </div>
                <div>
                  <dt>Адрес проживания</dt>
                  <dd>
                    {revealPersonalData
                      ? customer.residentialAddress
                      : "Скрыт"}
                  </dd>
                </div>
                <div>
                  <dt>ИНН</dt>
                  <dd>
                    {revealPersonalData
                      ? customer.inn
                      : `${customer.inn.slice(0, 2)}••••••••${customer.inn.slice(-2)}`}
                  </dd>
                </div>
              </dl>
                </>
              )}

              {selected.status === "paid" && !selected.manual ? (
                <div className="admin-renewals__document-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={downloading}
                    onClick={() => void download()}
                  >
                    {downloading ? "Подготовка..." : "Договор и акт"}
                  </button>
                </div>
              ) : selected.status === "paid" && selected.manual ? null : (
                <p className="admin-renewals__period">
                  Договор и акт станут доступны после подтверждения оплаты.
                </p>
              )}

              <p className="admin-renewals__period">
                Договор:{" "}
                <strong>
                  {selected.manual
                    ? "не формировался"
                    : selected.contractNumber
                      ? `№ ${selected.contractNumber}`
                      : "ещё не присвоен"}
                </strong>
                {selected.manual ? " (подключение после аварии)" : ""}
              </p>

              {selected.startsOn && selected.endsOn ? (
                <p className="admin-renewals__period">
                  Период после оплаты: <strong>{formatDate(selected.startsOn)}</strong>
                  {" — "}
                  <strong>{formatDate(selected.endsOn)}</strong>
                </p>
              ) : null}

              {selected.status === "pending" ||
              selected.status === "documents_ready" ? (
                <button
                  type="button"
                  className="btn btn-primary admin-renewals__paid"
                  disabled={actionLoading}
                  onClick={() => void markPaid()}
                >
                  Подтвердить оплату и активировать на год
                </button>
              ) : null}
            </>
          ) : (
            <div className="admin-renewals__placeholder">
              Выберите заявку слева, чтобы проверить данные и подтвердить оплату.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

