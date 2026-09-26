import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface RenewalItem {
  id: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  status: "paid";
  contractNumber: string | null;
}

export function AccountantStatusPage() {
  const { user, loading, loginAccountant, logout } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [areas, setAreas] = useState<Array<{ id: number; title: string }>>([]);
  const [areaId, setAreaId] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<RenewalItem[]>([]);
  const [archiveLimit, setArchiveLimit] = useState(200);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const isAccountant = user?.accountType === "accountant";

  useEffect(() => {
    if (!isAccountant) return;
    api
      .accountantAreas()
      .then((data) => setAreas(data.items))
      .catch(() => setAreas([]));
  }, [isAccountant]);

  useEffect(() => {
    if (!isAccountant) return;
    let active = true;
    setListLoading(true);
    setError("");
    api
      .accountantRenewals({
        areaId: areaId || undefined,
        search: search || undefined,
      })
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setArchiveLimit(data.archiveLimit);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAccountant, areaId, search]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    setSubmitting(true);
    try {
      await loginAccountant(login.trim(), password);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Неверный логин или пароль");
    } finally {
      setSubmitting(false);
    }
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  async function downloadOne(id: number) {
    setError("");
    setDownloadingId(id);
    try {
      await api.downloadAccountantContract(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скачать документ");
    } finally {
      setDownloadingId(null);
    }
  }

  async function downloadAll() {
    setError("");
    setArchiveLoading(true);
    try {
      await api.downloadAccountantArchive({
        areaId: areaId || undefined,
        search: search || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скачать архив");
    } finally {
      setArchiveLoading(false);
    }
  }

  if (loading) {
    return <div className="loading-state">Загрузка...</div>;
  }

  if (!isAccountant) {
    return (
      <div className="status-login">
        <form className="status-login__card" onSubmit={(event) => void handleLogin(event)}>
          <p className="status-login__brand">Tallam</p>
          <h1>Вход для бухгалтерии</h1>
          {authError ? <div className="alert alert-error">{authError}</div> : null}
          <label>
            <span>Логин</span>
            <input
              className="form-input"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span>Пароль</span>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    );
  }

  const archiveDisabled =
    listLoading ||
    archiveLoading ||
    items.length === 0 ||
    items.length > archiveLimit;

  return (
    <div className="status-page">
      <header className="status-page__header">
        <div>
          <p className="status-page__brand">Tallam</p>
          <h1>Продлённые договоры</h1>
          <p>Школы с подтверждённой оплатой. В файле договор и акт.</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => void logout()}>
          Выйти
        </button>
      </header>

      <form className="status-page__filters" onSubmit={applySearch}>
        <label>
          <span>Район</span>
          <select
            className="form-input"
            value={areaId}
            onChange={(event) => setAreaId(Number(event.target.value))}
          >
            <option value={0}>Все районы</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Школа</span>
          <input
            className="form-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Название школы"
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Найти
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={archiveDisabled}
          onClick={() => void downloadAll()}
        >
          {archiveLoading ? "Сбор архива..." : "Скачать все договоры"}
        </button>
      </form>

      {items.length > archiveLimit ? (
        <p className="status-page__note">
          В списке больше {archiveLimit} договоров. Сузьте фильтр, чтобы скачать их одним архивом.
        </p>
      ) : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Школа</th>
              <th>Почта</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={5}>Загрузка списка...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5}>Нет школ с подтверждённой оплатой продления</td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.schoolName}</strong>
                    {item.area ? <small>{item.area}</small> : null}
                    {item.contractNumber ? <small>{item.contractNumber}</small> : null}
                  </td>
                  <td>{item.email ?? "Почта не указана"}</td>
                  <td>Оплачено</td>
                  <td>
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={downloadingId === item.id}
                      onClick={() => void downloadOne(item.id)}
                    >
                      {downloadingId === item.id
                        ? "Файл..."
                        : "Скачать договор и акт"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
