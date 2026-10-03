import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { TablePagination } from "../../components/TablePagination";
import type { WorkersPageLimit } from "../../types/school";
import type { VacancyListItem } from "../../types/vacancy";
import { formatVacancyDate, VACANCY_STATUS_LABELS } from "../../types/vacancy";

function vacancyCountLabel(value: number) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "вакансий";
  if (last === 1) return "вакансия";
  if (last >= 2 && last <= 4) return "вакансии";
  return "вакансий";
}

function statusLabel(item: VacancyListItem) {
  if (item.expired && item.status === "ACTIVE") return "Срок публикации истек";
  return VACANCY_STATUS_LABELS[item.status];
}

export function AdminVacanciesPage() {
  const [items, setItems] = useState<VacancyListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<WorkersPageLimit>(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .adminVacancies({ page, limit })
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
  }, [page, limit]);

  return (
    <div className="admin-subscriptions">
      <div className="page-header-row admin-subscriptions__header">
        <div>
          <p className="admin-dashboard__eyebrow">Кабинеты школ</p>
          <h2 className="page-title">Вакансии</h2>
          <p className="page-subtitle">
            Все вакансии, которые школы добавили в своих кабинетах
          </p>
        </div>
        <span className="admin-subscriptions__total">
          {total} {vacancyCountLabel(total)}
        </span>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="table-wrap admin-subscriptions__table-wrap">
        <table className="data-table admin-subscriptions__table">
          <thead>
            <tr>
              <th>№</th>
              <th>Должность</th>
              <th>Предмет</th>
              <th>Школа</th>
              <th>Статус</th>
              <th>Добавлена</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-subscriptions__empty">
                  Школы пока не добавляли вакансии
                </td>
              </tr>
            ) : null}
            {items.map((item, index) => (
              <tr key={item.id}>
                <td className="admin-subscriptions__index">
                  {(page - 1) * limit + index + 1}
                </td>
                <td>{item.position}</td>
                <td>{item.subject}</td>
                <td>
                  <p className="admin-subscriptions__school">{item.schoolName}</p>
                  {item.areaName ? (
                    <p className="page-subtitle">{item.areaName}</p>
                  ) : null}
                </td>
                <td>
                  <span
                    className={`vacancy-status vacancy-status--${
                      item.expired ? "expired" : item.status.toLowerCase()
                    }`}
                  >
                    {statusLabel(item)}
                  </span>
                </td>
                <td>{formatVacancyDate(item.createdOn)}</td>
              </tr>
            ))}
            {loading ? (
              <tr>
                <td colSpan={6} className="admin-subscriptions__empty">
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
    </div>
  );
}
