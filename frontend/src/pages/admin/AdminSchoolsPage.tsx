import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { TablePagination } from "../../components/TablePagination";
import { useAuth } from "../../context/AuthContext";
import type {
  AdminSchoolCabinetStatus,
  AdminSchoolListItem,
  AdminSubscriptionArea,
} from "../../types/admin";
import type { WorkersPageLimit } from "../../types/school";

type CabinetFilter = "all" | AdminSchoolCabinetStatus;

const CABINET_LABELS: Record<AdminSchoolCabinetStatus, string> = {
  active: "Активен",
  blocked: "Отключён",
  none: "Без кабинета",
};

function schoolCountLabel(value: number) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "школ";
  if (last === 1) return "школа";
  if (last >= 2 && last <= 4) return "школы";
  return "школ";
}

export function AdminSchoolsPage() {
  const [items, setItems] = useState<AdminSchoolListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<WorkersPageLimit>(20);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [areas, setAreas] = useState<AdminSubscriptionArea[]>([]);
  const [areaId, setAreaId] = useState(0);
  const [cabinetStatus, setCabinetStatus] = useState<CabinetFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { impersonateSchool } = useAuth();
  const [impersonateId, setImpersonateId] = useState<number | null>(null);

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
      .adminSchools({ page, limit, search, areaId, cabinetStatus })
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
  }, [page, limit, search, areaId, cabinetStatus]);

  async function impersonate(targetSchoolId: number) {
    setImpersonateId(targetSchoolId);
    setError("");
    try {
      await impersonateSchool(targetSchoolId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти как школа");
      setImpersonateId(null);
    }
  }

  return (
    <div className="admin-subscriptions admin-schools">
      <div className="page-header-row admin-subscriptions__header">
        <div>
          <p className="admin-dashboard__eyebrow">База образовательных организаций</p>
          <h2 className="page-title">Школы</h2>
          <p className="page-subtitle">
            Все школы платформы: район, логин кабинета и состояние доступа
          </p>
        </div>
        <span className="admin-subscriptions__total">
          {total} {schoolCountLabel(total)}
        </span>
      </div>

      <section className="admin-subscriptions__filters">
        <label className="admin-subscriptions__search">
          <span>Поиск</span>
          <input
            className="form-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Школа, район или логин"
          />
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

        <label className="admin-subscriptions__status">
          <span>Кабинет</span>
          <select
            className="form-input"
            value={cabinetStatus}
            onChange={(event) => {
              setCabinetStatus(event.target.value as CabinetFilter);
              setPage(1);
            }}
          >
            <option value="all">Все кабинеты</option>
            <option value="active">Активные</option>
            <option value="blocked">Отключённые</option>
            <option value="none">Без кабинета</option>
          </select>
        </label>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="table-wrap admin-subscriptions__table-wrap">
        <table className="data-table admin-subscriptions__table admin-schools__table">
          <thead>
            <tr>
              <th>№</th>
              <th>Школа</th>
              <th>Район</th>
              <th>Логин</th>
              <th>Работники</th>
              <th>Кабинет</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-subscriptions__empty">
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
                  <p className="admin-subscriptions__school">
                    <Link to={`/admin/schools/${item.schoolId}`}>
                      {item.schoolName}
                    </Link>
                  </p>
                </td>
                <td>{item.area ?? "Район не указан"}</td>
                <td>{item.email ?? "—"}</td>
                <td>{item.teachersCount}</td>
                <td>
                  <div className="admin-schools__cabinet">
                    <span
                      className={`admin-status admin-status--${
                        item.cabinetStatus === "active"
                          ? "active"
                          : item.cabinetStatus === "blocked"
                            ? "blocked"
                            : "empty"
                      }`}
                    >
                      {CABINET_LABELS[item.cabinetStatus]}
                    </span>
                    {item.email ? (
                      <button
                        type="button"
                        className="table-action-link table-action-link--button"
                        disabled={impersonateId === item.schoolId}
                        onClick={() => void impersonate(item.schoolId)}
                      >
                        {impersonateId === item.schoolId
                          ? "Вход..."
                          : "Войти как школа"}
                      </button>
                    ) : null}
                  </div>
                </td>
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
