import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { MaintenanceNotice } from "../../components/MaintenanceNotice";
import { SupportContacts } from "../../components/SupportContacts";
import {
  CABINET_NEWS_REST,
  FEATURED_NEWS,
  IRO_CARDS_NOTICE,
} from "../../data/cabinetNews";
import type { SchoolDashboard, SchoolSubscriptionOverview } from "../../types/school";

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function SchoolHomePage() {
  const [dashboard, setDashboard] = useState<SchoolDashboard | null>(null);
  const [subscription, setSubscription] =
    useState<SchoolSubscriptionOverview | null>(null);
  const [error, setError] = useState("");
  const [hintHidden, setHintHidden] = useState(true);

  useEffect(() => {
    api
      .schoolDashboard()
      .then(setDashboard)
      .catch((err: Error) => setError(err.message));
    api
      .schoolSubscription()
      .then(setSubscription)
      .catch(() => {
        /* баннер необязателен */
      });
  }, []);

  // Подсказка для новичков показывается, пока её не закрыли в этой школе.
  useEffect(() => {
    if (!dashboard) return;
    const key = `tallam.guideHint.${dashboard.schoolId}`;
    setHintHidden(window.localStorage.getItem(key) === "1");
  }, [dashboard]);

  function hideGuideHint() {
    if (dashboard) {
      window.localStorage.setItem(`tallam.guideHint.${dashboard.schoolId}`, "1");
    }
    setHintHidden(true);
  }

  const yearsDesc = dashboard
    ? [...dashboard.evaluations.years].sort((a, b) => b.year - a.year)
    : [];
  const currentYearCount = yearsDesc[0]?.count ?? 0;
  const maxYearCount = Math.max(...yearsDesc.map((item) => item.count), 1);
  const signals = dashboard?.signals ?? null;

  return (
    <div className="card school-home">
      <div className="card-body">
        {error ? <div className="alert alert-error">{error}</div> : null}

        {subscription?.status === "expiring" ? (
          <div className="alert alert-warning school-home-sub-alert">
            Подписка действует до{" "}
            {subscription.endsOn
              ? subscription.endsOn.split("-").reverse().join(".")
              : "конца текущего срока"}
            .{" "}
            <Link to="/school/subscription">Перейти к продлению</Link>
          </div>
        ) : null}

        <section className="school-home__hero">
          <div className="school-home__hero-copy">
            <p className="school-home__eyebrow">
              {dashboard?.schoolName ?? "Личный кабинет школы"}
            </p>
            <h2 className="school-home__title">Добро пожаловать</h2>
            <p className="school-home__lead">
              {dashboard ? (
                <>
                  {dashboard.teachersCount}{" "}
                  {plural(
                    dashboard.teachersCount,
                    "работник",
                    "работника",
                    "работников",
                  )}
                  {" · "}
                  {currentYearCount}{" "}
                  {plural(currentYearCount, "оценка", "оценки", "оценок")} за
                  текущий год
                </>
              ) : (
                "Загрузка данных..."
              )}
            </p>
          </div>
        </section>

        <section className="school-home__dashboard">
          <div className="school-home__metrics">
            <Link className="school-home__metric" to="/school/workers">
              <span className="school-home__metric-value">
                {dashboard ? dashboard.teachersCount : "н/д"}
              </span>
              <span className="school-home__metric-label">Учителей в базе</span>
            </Link>

            <Link className="school-home__metric" to="/school/analytics">
              <span className="school-home__metric-value">{currentYearCount}</span>
              <span className="school-home__metric-label">
                Оценок за учебный год
              </span>
            </Link>

            <Link className="school-home__metric" to="/school/selections">
              <span className="school-home__metric-value">
                {signals ? signals.neverEvaluated : "н/д"}
              </span>
              <span className="school-home__metric-label">Ещё не оценивались</span>
            </Link>

            <Link className="school-home__metric" to="/school/analytics">
              <span className="school-home__metric-value">
                {signals ? signals.attention : "н/д"}
              </span>
              <span className="school-home__metric-label">Требуют внимания</span>
              <span className="school-home__metric-note">
                последняя оценка ниже 50%
              </span>
            </Link>
          </div>

          <div className="school-home__quick">
            <p className="school-home__quick-title">Быстрые действия</p>
            <Link className="school-home__action" to="/school/lesson-analysis">
              Провести оценивание
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="school-home__action" to="/school/workers">
              Добавить учителя
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="school-home__action" to="/school/selections">
              Открыть списки
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="school-home__action" to="/school/analytics">
              Посмотреть аналитику
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="school-home__panel">
          <h3>Новости и обновления</h3>
          <p className="school-home__panel-lead">
            Здесь появляются новые возможности кабинета и планы развития.
          </p>
          {FEATURED_NEWS ? (
            <article className="school-home__featured">
              <div className="school-home__featured-top">
                <span className="school-home__featured-badge">Новое</span>
                <time>{FEATURED_NEWS.date}</time>
              </div>
              <h4 className="school-home__featured-title">{FEATURED_NEWS.title}</h4>
              <p className="school-home__featured-text">{FEATURED_NEWS.text}</p>
              {FEATURED_NEWS.cta ? (
                <Link
                  className="school-home__featured-cta"
                  to={FEATURED_NEWS.cta.to}
                >
                  {FEATURED_NEWS.cta.label}
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </article>
          ) : null}
          <ul className="school-home__news">
            {CABINET_NEWS_REST.map((item) => (
              <li key={item.title}>
                <div className="school-home__news-top">
                  <b className={`school-home__tag school-home__tag--${item.tagKind}`}>
                    {item.tag}
                  </b>
                  <time>{item.date}</time>
                </div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {dashboard ? (
          <section className="home-stats">
            <h3 className="home-stats__title">Проведённые оценки по годам</h3>
            <p className="home-stats__subtitle">
              Статистика оценок уроков за последние три года
            </p>
            <div className="home-stats__years">
              {yearsDesc.map((item) => (
                <div key={item.year} className="home-stats__year">
                  <div className="home-stats__year-top">
                    <span className="home-stats__year-label">{item.year}</span>
                    <span className="home-stats__year-count">{item.count}</span>
                  </div>
                  <div className="home-stats__bar" aria-hidden="true">
                    <div
                      className="home-stats__bar-fill"
                      style={{
                        width: `${Math.max(
                          (item.count / maxYearCount) * 100,
                          item.count > 0 ? 8 : 0,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!hintHidden ? (
          <div className="school-home__hint">
            <span>
              Впервые в кабинете? Короткая инструкция поможет пройти первые шаги.
            </span>
            <Link to="/school/guide">Открыть инструкцию</Link>
            <button type="button" onClick={hideGuideHint}>
              Скрыть
            </button>
          </div>
        ) : null}

        <details className="school-home__details">
          <summary>Как работает Таллам</summary>
          <div className="school-home__details-body">
            <p>
              Кабинет помогает школе управлять анализом уроков: добавить учителей,
              провести оценку по карте и сохранить результат в профиле работника.
              Дальше оценки и заключения видны в разделе «Аналитика», а списки
              учителей собираются по нужным условиям.
            </p>
            <p>
              Карты разные по устройству, поэтому результаты не сводятся в одну
              оценку: методическая и комплексная считаются отдельно. Перед началом
              оценки проверьте, что у учителя заполнены предметы, от них зависит
              набор критериев.
            </p>
            <div className="school-home__cards">
              <article className="school-home__card-type">
                <span>Карта №1</span>
                <strong>Методические компетенции</strong>
                <p>
                  Целеполагание, организация деятельности, оценка и рефлексия,
                  информационное обеспечение урока.
                </p>
              </article>
              <article className="school-home__card-type">
                <span>Карта №2</span>
                <strong>Комплексная оценка</strong>
                <p>
                  Предметные, методические, психолого-педагогические и
                  коммуникативные компетенции.
                </p>
              </article>
            </div>
            <p className="school-home__legal">{IRO_CARDS_NOTICE}</p>
            <p className="school-home__panel-lead">
              Пошаговый разбор первых шагов есть в{" "}
              <Link to="/school/guide">инструкции для первого входа</Link>.
              Вопрос или пожелание можно отправить в разделе{" "}
              <Link to="/school/feedback">«Отзывы и пожелания»</Link>.
            </p>
          </div>
        </details>

        <SupportContacts />

        <div className="school-home__footnote">
          <MaintenanceNotice />
        </div>
      </div>
    </div>
  );
}
