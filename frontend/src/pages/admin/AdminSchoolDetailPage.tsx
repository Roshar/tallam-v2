import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import type {
  AdminPasswordResetLink,
  AdminSchoolAccessReason,
  AdminSchoolDetail,
  AdminSchoolSubscription,
} from "../../types/admin";

const STATUS_LABELS: Record<AdminSchoolSubscription["status"], string> = {
  active: "Активна",
  expiring: "Скоро истекает",
  expired: "Истекла",
  scheduled: "Ещё не началась",
  cancelled: "Отменена",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU").format(
    new Date(`${value}T00:00:00`),
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "ещё не входили";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function subscriptionTiming(subscription: AdminSchoolSubscription) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const starts = new Date(`${subscription.startsOn}T00:00:00`);
  const ends = new Date(`${subscription.endsOn}T00:00:00`);
  const day = 86_400_000;

  if (subscription.status === "cancelled") return "Период отменён";
  if (subscription.status === "scheduled") {
    return `Начнётся через ${Math.ceil((starts.getTime() - today.getTime()) / day)} дн.`;
  }
  if (subscription.status === "expired") {
    return `Истекла ${Math.ceil((today.getTime() - ends.getTime()) / day)} дн. назад`;
  }
  return `Осталось ${Math.max(0, Math.ceil((ends.getTime() - today.getTime()) / day))} дн.`;
}

function subscriptionProgress(subscription: AdminSchoolSubscription) {
  const starts = new Date(`${subscription.startsOn}T00:00:00`).getTime();
  const ends = new Date(`${subscription.endsOn}T00:00:00`).getTime();
  const now = Date.now();
  if (ends <= starts) return 0;
  return Math.min(100, Math.max(0, ((now - starts) / (ends - starts)) * 100));
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function accountLabel(reason: AdminSchoolAccessReason) {
  switch (reason) {
    case "active":
      return "Кабинет активен";
    case "blocked":
      return "Принудительно заблокирован";
    case "expired":
      return "Подписка истекла";
    case "scheduled":
      return "Ожидает начала подписки";
    case "no_account":
      return "Кабинет не найден";
  }
}

export function AdminSchoolDetailPage() {
  const { schoolId } = useParams();
  const location = useLocation();
  const fromSchools = location.pathname.startsWith("/admin/schools");
  const { impersonateSchool } = useAuth();
  const numericSchoolId = Number(schoolId);
  const [detail, setDetail] = useState<AdminSchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [resetLink, setResetLink] = useState<AdminPasswordResetLink | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [startsOn, setStartsOn] = useState(isoDate(new Date()));
  const [endsOn, setEndsOn] = useState(addDays(isoDate(new Date()), 365));
  const [activateNote, setActivateNote] = useState("");
  const [periodStartsOn, setPeriodStartsOn] = useState(isoDate(new Date()));
  const [periodEndsOn, setPeriodEndsOn] = useState(addDays(isoDate(new Date()), 365));
  const [periodPhone, setPeriodPhone] = useState("");
  const [periodNote, setPeriodNote] = useState("");

  useEffect(() => {
    if (!Number.isInteger(numericSchoolId) || numericSchoolId <= 0) {
      setError("Некорректный идентификатор школы");
      setLoading(false);
      return;
    }

    let active = true;
    api
      .adminSchoolDetail(numericSchoolId)
      .then((data) => {
        if (active) setDetail(data);
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
  }, [numericSchoolId]);

  const maxYearEvaluations = useMemo(
    () =>
      Math.max(1, ...(detail?.evaluationsByYear.map((item) => item.count) ?? [])),
    [detail],
  );

  async function createResetLink() {
    if (!detail) return;
    setLinkLoading(true);
    setCopied(false);
    setError("");
    try {
      setResetLink(
        await api.createAdminPasswordResetLink(detail.school.id),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать ссылку");
    } finally {
      setLinkLoading(false);
    }
  }

  async function impersonate() {
    if (!detail) return;
    setImpersonateLoading(true);
    setError("");
    try {
      await impersonateSchool(detail.school.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти как школа");
      setImpersonateLoading(false);
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

  function applyPreset(days: number) {
    const start = isoDate(new Date());
    setStartsOn(start);
    setEndsOn(addDays(start, days));
  }

  async function activateCabinet() {
    if (!detail) return;
    setActionLoading(true);
    setError("");
    try {
      setDetail(
        await api.activateAdminSchool(detail.school.id, {
          startsOn,
          endsOn,
          note: activateNote.trim() || undefined,
        }),
      );
      setActivateOpen(false);
      setActivateNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось активировать кабинет");
    } finally {
      setActionLoading(false);
    }
  }

  function applyPeriodPreset(days: number) {
    const start = isoDate(new Date());
    setPeriodStartsOn(start);
    setPeriodEndsOn(addDays(start, days));
  }

  async function saveSubscription() {
    if (!detail) return;
    setActionLoading(true);
    setError("");
    try {
      setDetail(
        await api.createAdminSchoolSubscription(detail.school.id, {
          startsOn: periodStartsOn,
          endsOn: periodEndsOn,
          phone: periodPhone.trim() || undefined,
          note: periodNote.trim() || undefined,
        }),
      );
      setPeriodNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить подписку");
    } finally {
      setActionLoading(false);
    }
  }

  async function blockCabinet() {
    if (!detail) return;
    setActionLoading(true);
    setError("");
    try {
      setDetail(await api.blockAdminSchool(detail.school.id));
      setBlockOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось заблокировать кабинет");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-dashboard__loading">
        <span className="admin-dashboard__loader" />
        <p>Загружаем данные школы...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="admin-school-detail">
        <Link
          className="admin-school-detail__back"
          to={fromSchools ? "/admin/schools" : "/admin/subscriptions"}
        >
          {fromSchools ? "← Все школы" : "← Все подписки"}
        </Link>
        <div className="alert alert-error">
          {error || "Данные школы не найдены"}
        </div>
      </div>
    );
  }

  const { school, stats, currentSubscription, access } = detail;
  const canLogin = access.canLogin ?? access.allowed;
  const canBlock = access.canUseCabinet ?? access.allowed;
  const isCabinetActive = access.reason === "active";

  return (
    <div className="admin-school-detail">
      <Link
        className="admin-school-detail__back"
        to={fromSchools ? "/admin/schools" : "/admin/subscriptions"}
      >
        {fromSchools ? "← Все школы" : "← Все подписки"}
      </Link>

      <header className="admin-school-detail__header">
        <div>
          <p className="admin-dashboard__eyebrow">
            {school.area ?? "Район не указан"} · Школа № {school.id}
          </p>
          <h2 className="page-title">{school.name}</h2>
          <div className="admin-school-detail__account-line">
            <span
              className={`admin-status admin-status--${
                access.reason === "active" ? "active" : access.hasAccount ? "blocked" : "empty"
              }`}
            >
              {accountLabel(access.reason)}
            </span>
            {school.email ? (
              <a href={`mailto:${school.email}`}>{school.email}</a>
            ) : (
              <span>Логин не указан</span>
            )}
          </div>
        </div>

        <div className="admin-school-detail__actions">
          {access.hasAccount ? (
            <button
              type="button"
              className={fromSchools ? "btn btn-primary" : "btn btn-ghost"}
              disabled={impersonateLoading}
              onClick={() => void impersonate()}
            >
              {impersonateLoading ? "Вход..." : "Войти как школа"}
            </button>
          ) : null}
          {!fromSchools && access.hasAccount ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={actionLoading}
              onClick={() => {
                const start = isoDate(new Date());
                setStartsOn(start);
                setEndsOn(addDays(start, 365));
                setActivateOpen(true);
              }}
            >
              {isCabinetActive
                ? "Изменить срок подписки"
                : "Активировать на срок"}
            </button>
          ) : null}
          {!fromSchools && canBlock ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={actionLoading}
              onClick={() => setBlockOpen(true)}
            >
              Заблокировать кабинет
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!canLogin || linkLoading}
            title={
              !canLogin
                ? "Для создания ссылки нужен аккаунт без принудительной блокировки"
                : undefined
            }
            onClick={() => void createResetLink()}
          >
            {linkLoading ? "Создание..." : "Ссылка для смены пароля"}
          </button>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {fromSchools ? (
        <>
          <section className="admin-school-detail__stats" aria-label="Сводка по школе">
            <article>
              <span>Последний вход</span>
              <strong className="admin-school-detail__login">
                {formatDateTime(detail.lastLoginAt)}
              </strong>
              <small>авторизация в кабинете школы</small>
            </article>
            <article>
              <span>Сейчас в проекте</span>
              <strong>{stats.projectTeachers}</strong>
              <small>учителей в «Анализе урока»</small>
            </article>
            <article>
              <span>Педагоги в базе</span>
              <strong>{stats.teachers}</strong>
              <small>всего работников школы</small>
            </article>
            <article>
              <span>Оценок всего</span>
              <strong>{stats.evaluations}</strong>
              <small>за все годы</small>
            </article>
          </section>

          <section className="admin-school-years" aria-label="Статистика по годам">
            <div className="admin-panel__header">
              <div>
                <h3>Активность за 2 года</h3>
                <p>Учителя с оценками в проекте и количество проведённых оценок</p>
              </div>
            </div>
            <div className="admin-school-years__grid">
              {detail.yearlyActivity.map((item) => (
                <article key={item.year}>
                  <h4>{item.year}</h4>
                  <dl>
                    <div>
                      <dt>Учителей в проекте</dt>
                      <dd>{item.projectTeachers}</dd>
                    </div>
                    <div>
                      <dt>Оценок</dt>
                      <dd>{item.evaluations}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-panel admin-school-detail__subscription">
            <div className="admin-panel__header">
              <div>
                <h3>Подписка</h3>
                <p>
                  {currentSubscription
                    ? `${formatDate(currentSubscription.startsOn)} — ${formatDate(currentSubscription.endsOn)}`
                    : "Период доступа не указан"}
                </p>
              </div>
              {currentSubscription ? (
                <span
                  className={`admin-subscription-status admin-subscription-status--${currentSubscription.status}`}
                >
                  {STATUS_LABELS[currentSubscription.status]}
                </span>
              ) : null}
            </div>
            <div className="admin-school-detail__body admin-school-detail__profile-sub">
              {currentSubscription ? (
                <p className="admin-school-detail__timing">
                  {subscriptionTiming(currentSubscription)}
                </p>
              ) : null}
              <Link
                className="admin-panel__link"
                to={`/admin/subscriptions/${school.id}`}
              >
                Управление подпиской
              </Link>
            </div>
          </section>
        </>
      ) : (
        <>
      <section className="admin-school-detail__stats" aria-label="Статистика школы">
        <article>
          <span>Педагоги</span>
          <strong>{stats.teachers}</strong>
          <small>в базе школы</small>
        </article>
        <article>
          <span>Оценки за {stats.currentYear}</span>
          <strong>{stats.evaluationsCurrentYear}</strong>
          <small>всего {stats.evaluations}</small>
        </article>
        <article>
          <span>Проекты</span>
          <strong>{stats.projects}</strong>
          <small>подключено к школе</small>
        </article>
        <article>
          <span>Периоды подписки</span>
          <strong>{detail.subscriptions.length}</strong>
          <small>включая историю</small>
        </article>
      </section>

      <div className="admin-school-detail__grid">
        <section className="admin-panel admin-school-detail__subscription">
          <div className="admin-panel__header">
            <div>
              <h3>Текущая подписка</h3>
              <p>Последний действующий или запланированный период</p>
            </div>
            {currentSubscription ? (
              <span
                className={`admin-subscription-status admin-subscription-status--${currentSubscription.status}`}
              >
                {STATUS_LABELS[currentSubscription.status]}
              </span>
            ) : null}
          </div>

          {currentSubscription ? (
            <div className="admin-school-detail__body">
              <div className="admin-school-detail__period">
                <div>
                  <span>Начало</span>
                  <strong>{formatDate(currentSubscription.startsOn)}</strong>
                </div>
                <span className="admin-school-detail__period-arrow">→</span>
                <div>
                  <span>Окончание</span>
                  <strong>{formatDate(currentSubscription.endsOn)}</strong>
                </div>
              </div>
              <div className="admin-school-detail__progress">
                <span
                  style={{ width: `${subscriptionProgress(currentSubscription)}%` }}
                />
              </div>
              <p className="admin-school-detail__timing">
                {subscriptionTiming(currentSubscription)}
              </p>
              <dl className="admin-school-detail__contacts">
                <div>
                  <dt>Телефон</dt>
                  <dd>
                    {currentSubscription.phone ? (
                      <a href={`tel:${currentSubscription.phone}`}>
                        {currentSubscription.phone}
                      </a>
                    ) : (
                      "Не указан"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Источник</dt>
                  <dd>{currentSubscription.sourceLabel ?? "Не указан"}</dd>
                </div>
              </dl>
              {currentSubscription.note ? (
                <div className="admin-school-detail__note">
                  <strong>Примечание</strong>
                  <p>{currentSubscription.note}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <form
            className="admin-school-detail__body admin-activate-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSubscription();
            }}
          >
            <div>
              <h4 className="admin-school-detail__form-title">
                {currentSubscription
                  ? "Добавить период вручную"
                  : "Указать подписку вручную"}
              </h4>
              <p className="admin-school-detail__form-hint">
                Заполните даты доступа. Телефон и примечание необязательны.
              </p>
            </div>
            <div className="admin-activate-form__presets">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => applyPeriodPreset(6)}
              >
                7 дней
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => applyPeriodPreset(29)}
              >
                30 дней
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => applyPeriodPreset(364)}
              >
                1 год
              </button>
            </div>
            <div className="admin-activate-form__dates">
              <label>
                <span>Начало</span>
                <input
                  className="form-input"
                  type="date"
                  value={periodStartsOn}
                  onChange={(event) => setPeriodStartsOn(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Окончание</span>
                <input
                  className="form-input"
                  type="date"
                  value={periodEndsOn}
                  min={periodStartsOn}
                  onChange={(event) => setPeriodEndsOn(event.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              <span>Телефон</span>
              <input
                className="form-input"
                value={periodPhone}
                onChange={(event) => setPeriodPhone(event.target.value)}
                placeholder="Необязательно"
              />
            </label>
            <label>
              <span>Примечание</span>
              <input
                className="form-input"
                value={periodNote}
                onChange={(event) => setPeriodNote(event.target.value)}
                placeholder="Необязательно"
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={actionLoading || !periodStartsOn || !periodEndsOn}
            >
              {actionLoading ? "Сохранение..." : "Сохранить подписку"}
            </button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Динамика оценок</h3>
              <p>Количество оценок за последние три года</p>
            </div>
          </div>
          <div className="admin-school-detail__body">
            <div className="admin-school-detail__year-chart">
            {detail.evaluationsByYear.map((item) => (
              <div key={item.year}>
                <span>{item.year}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(
                        item.count ? 4 : 0,
                        (item.count / maxYearEvaluations) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>

          <div className="admin-school-detail__projects">
            <h4>Подключённые проекты</h4>
            {detail.projects.length ? (
              <div>
                {detail.projects.map((project) => (
                  <span key={project.id}>{project.name}</span>
                ))}
              </div>
            ) : (
              <p>Проекты не подключены</p>
            )}
          </div>
          </div>
        </section>
      </div>

      <section className="admin-panel admin-school-detail__history">
        <div className="admin-panel__header">
          <div>
            <h3>История подписок</h3>
            <p>Все периоды доступа, включая отменённые</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Период</th>
                <th>Статус</th>
                <th>Телефон</th>
                <th>Источник</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {detail.subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="admin-subscriptions__period">
                    {formatDate(subscription.startsOn)} —{" "}
                    {formatDate(subscription.endsOn)}
                  </td>
                  <td>
                    <span
                      className={`admin-subscription-status admin-subscription-status--${subscription.status}`}
                    >
                      {STATUS_LABELS[subscription.status]}
                    </span>
                  </td>
                  <td>{subscription.phone ?? "—"}</td>
                  <td>{subscription.sourceLabel ?? "—"}</td>
                  <td>{subscription.note ?? "—"}</td>
                </tr>
              ))}
              {!detail.subscriptions.length ? (
                <tr>
                  <td colSpan={5} className="admin-subscriptions__empty">
                    История подписок пуста
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}

      {resetLink ? (
        <div
          className="admin-reset-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-school-reset-modal-title"
          onClick={() => setResetLink(null)}
        >
          <div
            className="admin-reset-modal__dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-reset-modal__header">
              <div>
                <h3 id="admin-school-reset-modal-title">
                  Ссылка для смены пароля
                </h3>
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
                и может быть использована один раз.
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

      {activateOpen ? (
        <div
          className="admin-reset-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-activate-modal-title"
          onClick={() => !actionLoading && setActivateOpen(false)}
        >
          <div
            className="admin-reset-modal__dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-reset-modal__header">
              <div>
                <h3 id="admin-activate-modal-title">
                  {isCabinetActive
                    ? "Изменить срок подписки"
                    : "Активировать кабинет"}
                </h3>
                <p>
                  {isCabinetActive
                    ? "Укажите новый период действия подписки"
                    : "Школа сможет войти только в указанные даты"}
                </p>
              </div>
              <button
                type="button"
                className="admin-reset-modal__close"
                onClick={() => setActivateOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="admin-reset-modal__body admin-activate-form">
              <div className="admin-activate-form__presets">
                <button type="button" className="btn btn-ghost" onClick={() => applyPreset(6)}>
                  7 дней
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => applyPreset(29)}>
                  30 дней
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => applyPreset(364)}>
                  1 год
                </button>
              </div>
              <div className="admin-activate-form__dates">
                <label>
                  <span>Начало доступа</span>
                  <input
                    className="form-input"
                    type="date"
                    value={startsOn}
                    onChange={(event) => setStartsOn(event.target.value)}
                  />
                </label>
                <label>
                  <span>Окончание доступа</span>
                  <input
                    className="form-input"
                    type="date"
                    value={endsOn}
                    min={startsOn}
                    onChange={(event) => setEndsOn(event.target.value)}
                  />
                </label>
              </div>
              <label>
                <span>Примечание</span>
                <input
                  className="form-input"
                  value={activateNote}
                  onChange={(event) => setActivateNote(event.target.value)}
                  placeholder="Необязательно"
                />
              </label>
            </div>
            <div className="admin-reset-modal__actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={actionLoading}
                onClick={() => setActivateOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={actionLoading || !startsOn || !endsOn}
                onClick={() => void activateCabinet()}
              >
                {actionLoading
                  ? "Сохранение..."
                  : isCabinetActive
                    ? "Сохранить срок"
                    : "Активировать"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {blockOpen ? (
        <div
          className="admin-reset-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-block-modal-title"
          onClick={() => !actionLoading && setBlockOpen(false)}
        >
          <div
            className="admin-reset-modal__dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-reset-modal__header">
              <div>
                <h3 id="admin-block-modal-title">Заблокировать кабинет</h3>
                <p>{school.email ?? school.name}</p>
              </div>
              <button
                type="button"
                className="admin-reset-modal__close"
                onClick={() => setBlockOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="admin-reset-modal__body">
              <p>
                Кабинет сразу станет недоступен для входа, даже если срок
                подписки ещё не истёк. Период подписки сохранится — позже его
                можно снова активировать на выбранные даты.
              </p>
            </div>
            <div className="admin-reset-modal__actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={actionLoading}
                onClick={() => setBlockOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={actionLoading}
                onClick={() => void blockCabinet()}
              >
                {actionLoading ? "Блокировка..." : "Заблокировать"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
