import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { AdminRecoveryRequest, AdminRecoveryStatus } from "../../types/admin";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }
  return value;
}

export function AdminRecoveryPage() {
  const [items, setItems] = useState<AdminRecoveryRequest[]>([]);
  const [status, setStatus] = useState<"all" | AdminRecoveryStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.adminRecoveryRequests(status);
      setItems(data.items);
      window.dispatchEvent(new Event("admin-recovery-updated"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить обращения",
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function markDone(id: number) {
    setSavingId(id);
    setError("");
    try {
      const updated = await api.markAdminRecoveryDone(id);
      setItems((current) => {
        if (status === "new") {
          return current.filter((item) => item.id !== id);
        }
        return current.map((item) => (item.id === id ? updated : item));
      });
      window.dispatchEvent(new Event("admin-recovery-updated"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось отметить обращение",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="admin-recovery">
      <div className="page-header-row">
        <div>
          <p className="admin-dashboard__eyebrow">Восстановление доступа</p>
          <h2 className="page-title">Обращения</h2>
          <p className="page-subtitle">
            Запросы со страницы «Забыли пароль». Почта не отправляется: свяжитесь
            со школой по телефону.
          </p>
        </div>
        <div className="admin-recovery__filters">
          <button
            type="button"
            className={`admin-recovery__filter${status === "all" ? " is-active" : ""}`}
            onClick={() => setStatus("all")}
          >
            Все
          </button>
          <button
            type="button"
            className={`admin-recovery__filter${status === "new" ? " is-active" : ""}`}
            onClick={() => setStatus("new")}
          >
            Новые
          </button>
          <button
            type="button"
            className={`admin-recovery__filter${status === "done" ? " is-active" : ""}`}
            onClick={() => setStatus("done")}
          >
            Обработанные
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Школа</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="admin-subscriptions__empty">
                  Загрузка...
                </td>
              </tr>
            ) : null}

            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-subscriptions__empty">
                  Обращений пока нет
                </td>
              </tr>
            ) : null}

            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <time dateTime={item.createdAt}>
                    {formatDateTime(item.createdAt)}
                  </time>
                </td>
                <td>{item.email}</td>
                <td>
                  <a className="admin-recovery__phone" href={`tel:${item.phone}`}>
                    {formatPhone(item.phone)}
                  </a>
                </td>
                <td>
                  {item.schoolId && item.schoolName ? (
                    <Link to={`/admin/schools/${item.schoolId}`}>
                      {item.schoolName}
                    </Link>
                  ) : (
                    <span className="admin-recovery__unknown">
                      Школа не найдена
                    </span>
                  )}
                </td>
                <td>
                  <span
                    className={`admin-status admin-status--${
                      item.status === "new" ? "new" : "active"
                    }`}
                  >
                    {item.status === "new" ? "Новое" : "Обработано"}
                  </span>
                </td>
                <td>
                  {item.status === "new" ? (
                    <button
                      type="button"
                      className="table-action-link table-action-link--button"
                      disabled={savingId === item.id}
                      onClick={() => void markDone(item.id)}
                    >
                      {savingId === item.id ? "Сохранение..." : "Обработано"}
                    </button>
                  ) : (
                    <span className="admin-recovery__done-by">
                      {item.processedByEmail ?? ""}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
