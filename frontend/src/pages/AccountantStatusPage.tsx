import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface RenewalItem {
  id: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  status: "paid";
  contractNumber: string | null;
  settlement: {
    id: number;
    label: string;
  } | null;
}

type SettlementFilter = "all" | "pending" | "settled";

function moscowToday(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function AccountantStatusPage() {
  const { user, loading, loginAccountant, logout } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [areas, setAreas] = useState<Array<{ id: number; title: string }>>([]);
  const [areaId, setAreaId] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [contractNumber, setContractNumber] = useState("");
  const [settlementDate, setSettlementDate] = useState(moscowToday);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<RenewalItem[]>([]);
  const [archiveLimit, setArchiveLimit] = useState(200);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const isAccountant = user?.accountType === "accountant";

  useEffect(() => {
    if (isAccountant) return;
    setAreaId(0);
    setSearchInput("");
    setSearch("");
    setSettlementFilter("all");
    setSelectedIds([]);
    setItems([]);
    setError("");
  }, [isAccountant]);

  useEffect(() => {
    if (!isAccountant) return;
    api
      .accountantAreas()
      .then((data) => setAreas(data.items))
      .catch(() => setAreas([]));
  }, [isAccountant]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!isAccountant) return;
    let active = true;
    setListLoading(true);
    setError("");
    api
      .accountantRenewals({
        areaId: areaId || undefined,
        search: search || undefined,
        settlement: settlementFilter,
      })
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setArchiveLimit(data.archiveLimit);
        setSelectedIds((current) =>
          current.filter((id) =>
            data.items.some((item) => item.id === id && !item.settlement),
          ),
        );
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
  }, [isAccountant, areaId, search, settlementFilter]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    setSubmitting(true);
    try {
      await loginAccountant(login.trim(), password, remember);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Неверный логин или пароль");
    } finally {
      setSubmitting(false);
    }
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

  const selectableIds = useMemo(
    () => items.filter((item) => !item.settlement).map((item) => item.id),
    [items],
  );
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));

  function toggleAll() {
    setSelectedIds(allSelected ? [] : selectableIds);
  }

  function toggleOne(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function openSettlementModal() {
    if (selectedIds.length === 0) return;
    setContractNumber("");
    setSettlementDate(moscowToday());
    setError("");
    setModalOpen(true);
  }

  async function submitSettlement(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.createAccountantSettlement({
        renewalIds: selectedIds,
        contractNumber,
        settlementDate,
      });
      setModalOpen(false);
      setSelectedIds([]);
      const data = await api.accountantRenewals({
        areaId: areaId || undefined,
        search: search || undefined,
        settlement: settlementFilter,
      });
      setItems(data.items);
      setArchiveLimit(data.archiveLimit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось оформить расчёт");
    } finally {
      setSaving(false);
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
          <label className="status-login__remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>Запомнить меня</span>
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

      <div className="status-page__filters">
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
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Название школы"
          />
        </label>
        <label>
          <span>Расчёт по договору</span>
          <select
            className="form-input"
            value={settlementFilter}
            onChange={(event) =>
              setSettlementFilter(event.target.value as SettlementFilter)
            }
          >
            <option value="all">Все</option>
            <option value="pending">Не оформлен</option>
            <option value="settled">Оформлен</option>
          </select>
        </label>
      </div>
      <div className="status-page__actions">
        <button
          className="btn btn-primary"
          type="button"
          disabled={selectedIds.length === 0 || saving}
          onClick={openSettlementModal}
        >
          Оформить расчёт
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={archiveDisabled}
          onClick={() => void downloadAll()}
        >
          {archiveLoading ? "Сбор архива..." : "Скачать все договоры"}
        </button>
      </div>

      {items.length > archiveLimit ? (
        <p className="status-page__note">
          В списке больше {archiveLimit} договоров. Сузьте фильтр, чтобы скачать их одним архивом.
        </p>
      ) : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="table-wrap">
        <table className="data-table status-table">
          <colgroup>
            <col className="status-table__check" />
            <col className="status-table__num" />
            <col className="status-table__school" />
            <col className="status-table__mail" />
            <col className="status-table__state" />
            <col className="status-table__settlement" />
            <col className="status-table__file" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Выбрать все"
                  checked={allSelected}
                  disabled={selectableIds.length === 0}
                  onChange={toggleAll}
                />
              </th>
              <th>№</th>
              <th>Школа</th>
              <th>Почта</th>
              <th>Статус</th>
              <th>Расчёт по договору</th>
              <th>Договор и акт</th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={7}>Загрузка списка...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>Нет школ с подтверждённой оплатой продления</td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Выбрать ${item.schoolName}`}
                      checked={selectedIds.includes(item.id)}
                      disabled={Boolean(item.settlement)}
                      onChange={() => toggleOne(item.id)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.schoolName}</strong>
                    {item.area ? <small>{item.area}</small> : null}
                    {item.contractNumber ? <small>{item.contractNumber}</small> : null}
                  </td>
                  <td>{item.email ?? "Почта не указана"}</td>
                  <td>Оплачено</td>
                  <td>{item.settlement?.label ?? "Не оформлен"}</td>
                  <td>
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={downloadingId === item.id}
                      onClick={() => void downloadOne(item.id)}
                    >
                      {downloadingId === item.id ? "Файл..." : "Скачать"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className="modal-card modal-card--narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settlement-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <h2 className="modal-card__title" id="settlement-title">
                Оформить расчёт
              </h2>
              <button
                className="modal-card__close"
                type="button"
                aria-label="Закрыть"
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="status-settlement-form" onSubmit={(event) => void submitSettlement(event)}>
              <p className="page-subtitle">Школ в расчёте: {selectedIds.length}</p>
              {error ? <div className="alert alert-error">{error}</div> : null}
              <label>
                <span>Номер договора</span>
                <input
                  className="form-input"
                  value={contractNumber}
                  onChange={(event) => setContractNumber(event.target.value)}
                  placeholder="Необязательно"
                  maxLength={50}
                />
              </label>
              <label>
                <span>Дата расчёта</span>
                <input
                  className="form-input"
                  type="date"
                  value={settlementDate}
                  onChange={(event) => setSettlementDate(event.target.value)}
                  required
                />
              </label>
              <div className="modal-actions">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Сохранение..." : "Оформить расчёт"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
