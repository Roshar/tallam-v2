import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { AdminDashboard, AdminVisitStats } from "../../types/admin";

function statusLabel(status: AdminDashboard["recentSchools"][number]["status"]) {
  if (status === "on") {
    return "Активен";
  }
  if (status === "off") {
    return "Отключён";
  }
  return "Нет кабинета";
}

function countLabel(value: number, one: string, few: string, many: string) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function periodNote(period: AdminVisitStats["day"]) {
  const visits = countLabel(period.visits, "заход", "захода", "заходов");
  if (period.from === period.to) return visits;
  const schools = `${period.schools} ${countLabel(period.schools, "школа", "школы", "школ")}`;
  return `${visits}, ${schools}`;
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [visits, setVisits] = useState<AdminVisitStats | null>(null);
  const [error, setError] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupNotice, setBackupNotice] = useState("");

  useEffect(() => {
    api.adminDashboard().then(setDashboard).catch((err: Error) => {
      setError(err.message);
    });
    api.adminVisitStats().then(setVisits).catch(() => {
      /* блок посещений необязателен для остальных цифр */
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      api
        .adminOnlineSchools()
        .then(({ onlineSchools }) => {
          setDashboard((current) =>
            current ? { ...current, onlineSchools } : current,
          );
        })
        .catch(() => {
          /* счётчик онлайна необязателен */
        });
    }, 20_000);
    return () => window.clearInterval(timer);
  }, []);

  function downloadBackup() {
    setError("");
    setBackupLoading(true);
    setBackupNotice("");
    api.downloadAdminDatabaseBackup();
    setBackupNotice(
      "Файл готовится и появится в загрузках браузера. Это может занять одну-две минуты.",
    );
    window.setTimeout(() => setBackupLoading(false), 1500);
  }

  const activeShare = useMemo(() => {
    if (!dashboard?.schools) {
      return 0;
    }
    return Math.round((dashboard.activeSchoolAccounts / dashboard.schools) * 100);
  }, [dashboard]);

  if (!dashboard && !error) {
    return (
      <div className="admin-dashboard__loading">
        <span className="admin-dashboard__loader" />
        <p>Загружаем данные платформы...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__heading">
        <div>
          <p className="admin-dashboard__eyebrow">Обзор платформы</p>
          <h2 className="page-title">Главная</h2>
          <p className="page-subtitle">
            Ключевые показатели Tallam на текущий момент
          </p>
        </div>
        <div className="admin-dashboard__heading-actions">
          <div className="admin-dashboard__date">
            {new Intl.DateTimeFormat("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={backupLoading}
            onClick={downloadBackup}
          >
            {backupLoading
              ? "Готовим файл..."
              : "Скачать резервную копию БД"}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {backupNotice ? (
        <div className="alert alert-success">{backupNotice}</div>
      ) : null}

      {dashboard ? (
        <>
          <section className="admin-stat-grid" aria-label="Основная статистика">
            <article className="admin-stat-card admin-stat-card--primary">
              <span className="admin-stat-card__icon" aria-hidden="true">
                ОУ
              </span>
              <div>
                <p className="admin-stat-card__label">Школ в системе</p>
                <p className="admin-stat-card__value">{dashboard.schools}</p>
                <p className="admin-stat-card__note">
                  {dashboard.activeSchoolAccounts} активных кабинетов
                </p>
              </div>
            </article>

            <article className="admin-stat-card admin-stat-card--online">
              <span className="admin-stat-card__icon" aria-hidden="true">
                <span className="admin-online-dot" />
              </span>
              <div>
                <p className="admin-stat-card__label">Сейчас в кабинетах</p>
                <p className="admin-stat-card__value">{dashboard.onlineSchools}</p>
                <p className="admin-stat-card__note">
                  Школы с активностью за 5 минут
                </p>
              </div>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-card__icon" aria-hidden="true">
                У
              </span>
              <div>
                <p className="admin-stat-card__label">Учителей</p>
                <p className="admin-stat-card__value">{dashboard.teachers}</p>
                <p className="admin-stat-card__note">Во всех школах</p>
              </div>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-card__icon" aria-hidden="true">
                ✓
              </span>
              <div>
                <p className="admin-stat-card__label">
                  Оценок за {dashboard.currentYear}
                </p>
                <p className="admin-stat-card__value">
                  {dashboard.evaluationsCurrentYear}
                </p>
                <p className="admin-stat-card__note">
                  Всего: {dashboard.evaluations}
                </p>
              </div>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-card__icon" aria-hidden="true">
                М
              </span>
              <div>
                <p className="admin-stat-card__label">Методистов</p>
                <p className="admin-stat-card__value">{dashboard.methodists}</p>
                <p className="admin-stat-card__note">Рабочих аккаунтов</p>
              </div>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-card__icon" aria-hidden="true">
                П
              </span>
              <div>
                <p className="admin-stat-card__label">Проектов</p>
                <p className="admin-stat-card__value">{dashboard.projects}</p>
                <p className="admin-stat-card__note">Без служебного проекта</p>
              </div>
            </article>

            <article className="admin-stat-card admin-stat-card--subscription">
              <span className="admin-stat-card__icon" aria-hidden="true">
                ₽
              </span>
              <div>
                <p className="admin-stat-card__label">Активных подписок</p>
                <p className="admin-stat-card__value">
                  {dashboard.subscriptions.active}
                </p>
                <p className="admin-stat-card__note">
                  Истекают за 30 дней: {dashboard.subscriptions.expiringSoon}
                </p>
              </div>
            </article>
          </section>

          {visits ? (
            <section className="admin-panel admin-visits" aria-label="Посещения кабинетов">
              <div className="admin-panel__header">
                <div>
                  <h3>Посещения кабинетов</h3>
                  <p>
                    Один заход: школа открыла кабинет в этот день. Повторные
                    обновления страницы в тот же день не считаются отдельно.
                  </p>
                </div>
              </div>
              <div className="admin-visits__periods">
                <article>
                  <span>Сегодня</span>
                  <strong>{visits.day.visits}</strong>
                  <p>{periodNote(visits.day)}</p>
                </article>
                <article>
                  <span>Неделя</span>
                  <strong>{visits.week.visits}</strong>
                  <p>{periodNote(visits.week)}</p>
                </article>
                <article>
                  <span>Месяц</span>
                  <strong>{visits.month.visits}</strong>
                  <p>{periodNote(visits.month)}</p>
                </article>
              </div>
              <div className="admin-visits__lists">
                <div>
                  <h4>Школы за этот месяц</h4>
                  {visits.schools.length ? (
                    <ol>
                      {visits.schools.map((school) => (
                        <li key={school.schoolId}>
                          <div>
                            <Link to={`/admin/schools/${school.schoolId}`}>
                              {school.schoolName}
                            </Link>
                            {school.areaName ? <span>{school.areaName}</span> : null}
                          </div>
                          <b>
                            {school.visits}{" "}
                            {countLabel(school.visits, "день", "дня", "дней")}
                          </b>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="admin-panel__empty">
                      Пока нет заходов. Цифры появятся, когда школы откроют кабинет.
                    </p>
                  )}
                </div>
                <div>
                  <h4>Районы за этот месяц</h4>
                  {visits.areas.length ? (
                    <ol>
                      {visits.areas.map((area) => (
                        <li key={area.areaName}>
                          <div>
                            <strong>{area.areaName}</strong>
                            <span>
                              {area.schools}{" "}
                              {countLabel(area.schools, "школа", "школы", "школ")}
                            </span>
                          </div>
                          <b>
                            {area.visits}{" "}
                            {countLabel(area.visits, "заход", "захода", "заходов")}
                          </b>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="admin-panel__empty">Районы появятся вместе с заходами.</p>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <div className="admin-dashboard__content-grid">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Последние школы в базе</h3>
                  <p>Пять последних записей по идентификатору</p>
                </div>
                <Link className="admin-panel__link" to="/admin/schools">
                  Все школы
                </Link>
              </div>

              <div className="admin-recent-schools">
                {dashboard.recentSchools.length ? (
                  dashboard.recentSchools.map((school) => (
                    <div className="admin-school-row" key={school.id}>
                      <span className="admin-school-row__number">{school.id}</span>
                      <div className="admin-school-row__main">
                        <p className="admin-school-row__name">
                          <Link to={`/admin/schools/${school.id}`}>{school.name}</Link>
                        </p>
                        <p className="admin-school-row__meta">
                          {[school.area, school.email].filter(Boolean).join(" · ") ||
                            "Дополнительные данные не указаны"}
                        </p>
                      </div>
                      <span
                        className={`admin-status admin-status--${
                          school.status === "on"
                            ? "active"
                            : school.status === "off"
                              ? "blocked"
                              : "empty"
                        }`}
                      >
                        {statusLabel(school.status)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="admin-panel__empty">Школы пока не добавлены</p>
                )}
              </div>
            </section>

            <aside className="admin-panel admin-health">
              <div className="admin-panel__header">
                <div>
                  <h3>Состояние кабинетов</h3>
                  <p>Доля школ с активным доступом</p>
                </div>
              </div>

              <div
                className="admin-health__chart"
                style={
                  {
                    "--active-share": `${activeShare * 3.6}deg`,
                  } as CSSProperties
                }
              >
                <div className="admin-health__chart-center">
                  <strong>{activeShare}%</strong>
                  <span>активны</span>
                </div>
              </div>

              <div className="admin-health__legend">
                <div>
                  <span className="admin-health__dot admin-health__dot--active" />
                  Активные
                  <strong>{dashboard.activeSchoolAccounts}</strong>
                </div>
                <div>
                  <span className="admin-health__dot admin-health__dot--blocked" />
                  Отключённые
                  <strong>{dashboard.blockedSchoolAccounts}</strong>
                </div>
                <div>
                  <span className="admin-health__dot admin-health__dot--empty" />
                  Без кабинета
                  <strong>
                    {Math.max(
                      dashboard.schools -
                        dashboard.activeSchoolAccounts -
                        dashboard.blockedSchoolAccounts,
                      0,
                    )}
                  </strong>
                </div>
              </div>

              <div className="admin-health__subscription-note">
                <strong>Подписки школ</strong>
                <div className="admin-health__subscription-row">
                  <span>Всего со сроками</span>
                  <b>{dashboard.subscriptions.total}</b>
                </div>
                <div className="admin-health__subscription-row">
                  <span>Истекают за 30 дней</span>
                  <b>{dashboard.subscriptions.expiringSoon}</b>
                </div>
                <div className="admin-health__subscription-row">
                  <span>Истекли</span>
                  <b>{dashboard.subscriptions.expired}</b>
                </div>
                {dashboard.subscriptions.startsLater ? (
                  <div className="admin-health__subscription-row">
                    <span>Ещё не начались</span>
                    <b>{dashboard.subscriptions.startsLater}</b>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
