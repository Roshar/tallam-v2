import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { CABINET_NEWS, IRO_CARDS_NOTICE } from "../../data/cabinetNews";
import type { SchoolDashboard, SchoolSubscriptionOverview } from "../../types/school";

export function SchoolHomePage() {
  const [dashboard, setDashboard] = useState<SchoolDashboard | null>(null);
  const [subscription, setSubscription] =
    useState<SchoolSubscriptionOverview | null>(null);
  const [error, setError] = useState("");

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

  const yearsDesc = dashboard
    ? [...dashboard.evaluations.years].sort((a, b) => b.year - a.year)
    : [];
  const currentYearCount = yearsDesc[0]?.count ?? 0;
  const maxYearCount = Math.max(...yearsDesc.map((item) => item.count), 1);

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
          <p className="school-home__eyebrow">
            {dashboard?.schoolName ?? "Личный кабинет школы"}
          </p>
          <h2 className="school-home__title">
            Добро пожаловать в информационно-аналитическую платформу Tallam
          </h2>
          <p className="school-home__lead">
            В личном кабинете вы ведёте анализ уроков в цифровом виде: база
            работников, оценочные карты, заключения и методические рекомендации
            в одном месте.
          </p>
          <div className="school-home__hero-actions">
            <Link to="/school/guide" className="btn btn-primary">
              Инструкция для первого входа
            </Link>
            <Link to="/school/lesson-analysis" className="btn btn-ghost">
              Перейти к анализу урока
            </Link>
          </div>
        </section>

        {dashboard ? (
          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-card__label">Работников в базе</p>
              <p className="stat-card__value">{dashboard.teachersCount}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Оценок за текущий год</p>
              <p className="stat-card__value">{currentYearCount}</p>
            </div>
          </div>
        ) : (
          <p className="page-subtitle">Загрузка данных...</p>
        )}

        <section className="school-home__about">
          <div className="school-home__about-copy">
            <h3>Как устроена работа в кабинете</h3>
            <p>
              Платформа помогает школе управлять процессом анализа уроков:
              добавить учителей, провести оценку по карте и сохранить результат
              в профиле работника.
            </p>
            <p>
              Сейчас доступны две карты анализа урока. Выберите нужную перед
              началом оценки: от этого зависит набор критериев.
            </p>
            <p className="school-home__legal">{IRO_CARDS_NOTICE}</p>
            <p className="school-home__panel-lead">
              Вопрос или пожелание можно отправить в разделе{" "}
              <Link to="/school/feedback">«Отзывы и пожелания»</Link>.
            </p>
          </div>
          <div className="school-home__cards">
            <article className="school-home__card-type">
              <span>Карта №1</span>
              <strong>Методические компетенции</strong>
              <p>
                Краткая карта: целеполагание, организация деятельности,
                оценка и рефлексия, информационное обеспечение урока.
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
        </section>

        <section className="school-home__panel">
          <h3>Новости и обновления</h3>
          <p className="school-home__panel-lead">
            Здесь появляются новые возможности кабинета и планы развития.
          </p>
          <ul className="school-home__news">
            {CABINET_NEWS.map((item) => (
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
      </div>
    </div>
  );
}
