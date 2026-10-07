import { useEffect, useState } from "react";
import { api } from "../../api/client";

type SettlementFilter = "all" | "pending" | "settled";

interface SettlementRef {
  id: number;
  label: string;
}

interface PaidSchool {
  renewalId: number;
  schoolId: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  settlement: SettlementRef | null;
}

interface SettlementDetail {
  id: number;
  label: string;
  createdBy: string;
  createdAt: string;
  schools: Array<{
    renewalId: number;
    schoolName: string;
    area: string | null;
    email: string | null;
  }>;
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AdminSettlementsPage() {
  const [filter, setFilter] = useState<SettlementFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState({ paid: 0, settled: 0, waiting: 0 });
  const [items, setItems] = useState<PaidSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .adminSettlements({ settlement: filter, search: search || undefined })
      .then((data) => {
        if (!active) return;
        setSummary(data.summary);
        setItems(data.items);
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
  }, [filter, search]);

  async function openSettlement(settlementId: number) {
    setDetailLoading(true);
    setError("");
    try {
      const data = await api.adminSettlement(settlementId);
      setDetail(data.settlement);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить расчёт");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="admin-subscriptions">
      <div className="page-header-row admin-subscriptions__header">
        <div>
          <p className="admin-dashboard__eyebrow">Оплаченные продления</p>
          <h2 className="page-title">Расчёт по договору</h2>
          <p className="page-subtitle">
            Статус расчёта по школам, которые бухгалтер отметил как оплаченные
          </p>
        </div>
      </div>

      <section className="admin-settlement-summary" aria-label="Сводка расчётов">
        <article>
          <span>Всего оплаченных школ</span>
          <strong>{summary.paid}</strong>
        </article>
        <article>
          <span>Расчёт оформлен</span>
          <strong>{summary.settled}</strong>
        </article>
        <article>
          <span>Ожидают расчёта</span>
          <strong>{summary.waiting}</strong>
        </article>
      </section>

      <div className="admin-settlement-filters">
        <label>
          <span>Расчёт</span>
          <select
            className="form-input"
            value={filter}
            onChange={(event) => setFilter(event.target.value as SettlementFilter)}
          >
            <option value="all">Все</option>
            <option value="pending">Не оформлен</option>
            <option value="settled">Оформлен</option>
          </select>
        </label>
        <label>
          <span>Школа</span>
          <input
            className="form-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Название школы"
          />
        </label>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="table-wrap admin-subscriptions__table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Школа</th>
              <th>Почта</th>
              <th>Расчёт по договору</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Загрузка списка...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4}>Нет школ по выбранному фильтру</td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.renewalId}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.schoolName}</strong>
                    {item.area ? <small className="admin-settlement-area">{item.area}</small> : null}
                  </td>
                  <td>{item.email ?? "Почта не указана"}</td>
                  <td>
                    {item.settlement ? (
                      <button
                        className="btn btn-ghost admin-settlement-link"
                        type="button"
                        onClick={() => void openSettlement(item.settlement!.id)}
                      >
                        {item.settlement.label}
                      </button>
                    ) : (
                      "Не оформлен"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailLoading ? <p className="page-subtitle">Загрузка расчёта...</p> : null}
      {detail ? (
        <section className="admin-settlement-detail">
          <div>
            <h3>{detail.label}</h3>
            <p>
              Оформил {detail.createdBy}, {formatCreatedAt(detail.createdAt)}. Школ:{" "}
              {detail.schools.length}
            </p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Школа</th>
                  <th>Почта</th>
                </tr>
              </thead>
              <tbody>
                {detail.schools.map((school, index) => (
                  <tr key={school.renewalId}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{school.schoolName}</strong>
                      {school.area ? (
                        <small className="admin-settlement-area">{school.area}</small>
                      ) : null}
                    </td>
                    <td>{school.email ?? "Почта не указана"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
