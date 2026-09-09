import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { SchoolDashboard } from "../../types/school";

export function SchoolHomePage() {
  const [dashboard, setDashboard] = useState<SchoolDashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .schoolDashboard()
      .then(setDashboard)
      .catch((err: Error) => setError(err.message));
  }, []);

  const yearsDesc = dashboard
    ? [...dashboard.evaluations.years].sort((a, b) => b.year - a.year)
    : [];
  const currentYearCount = yearsDesc[0]?.count ?? 0;
  const maxYearCount = Math.max(...yearsDesc.map((item) => item.count), 1);

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="page-title">Личный кабинет</h2>
        <p className="page-subtitle">
          Управление учителями и проведение оценок уроков
        </p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="cabinet-welcome">
          <p className="cabinet-welcome__title">
            {dashboard?.schoolName ?? "Загрузка..."}
          </p>
          <p className="cabinet-welcome__text">
            Добро пожаловать в Tallam. Ведите базу работников и проводите
            анализ уроков в рамках проекта «Анализ урока».
          </p>
        </div>

        {dashboard ? (
          <>
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

            <section className="home-stats">
              <h3 className="home-stats__title">
                Проведённые оценки по годам
              </h3>
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
          </>
        ) : (
          <p className="page-subtitle">Загрузка данных...</p>
        )}
      </div>
    </div>
  );
}
