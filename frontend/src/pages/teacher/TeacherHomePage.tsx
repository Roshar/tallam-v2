import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { AnalyticsLineChart } from "../../components/AnalyticsLineChart";
import {
  AnalyticsCard,
  AnalyticsCardTypeSwitch,
  AnalyticsDelta,
  AnalyticsHighlights,
  AnalyticsSectionBars,
} from "../../components/AnalyticsWidgets";
import type { AnalyticsCardType, TeacherAnalytics } from "../../types/analytics";
import type { TeacherCabinetResponse } from "../../types/teacher-cabinet";
import { AcademicYearSelect } from "./AcademicYearSelect";

/**
 * Главная страница кабинета учителя. Отвечает на три вопроса:
 * какой результат сейчас, как он меняется и что получается лучше/хуже.
 */
export function TeacherHomePage() {
  const [cabinet, setCabinet] = useState<TeacherCabinetResponse | null>(null);
  const [cardType, setCardType] = useState<AnalyticsCardType>("method");
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCabinet = useCallback(async (academicYear?: number) => {
    const data = await api.teacherCabinet(academicYear);
    setCabinet(data);
    setYear(data.academicYearStart);
    return data;
  }, []);

  useEffect(() => {
    setLoading(true);
    loadCabinet()
      .catch(() => setError("Не удалось загрузить кабинет"))
      .finally(() => setLoading(false));
  }, [loadCabinet]);

  useEffect(() => {
    if (year === null) return;
    let cancelled = false;
    setAnalyticsLoading(true);
    api
      .teacherCabinetAnalytics(cardType, year)
      .then(({ analytics: data }) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch(() => {
        if (!cancelled) setAnalytics(null);
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cardType, year]);

  if (loading) {
    return <div className="loading-state">Загрузка кабинета...</div>;
  }
  if (error || !cabinet) {
    return <div className="alert alert-error">{error || "Кабинет недоступен"}</div>;
  }

  const { context } = cabinet;
  const activeSummary = cabinet.cardTypes.find((item) => item.cardType === cardType);

  return (
    <div className="teacher-cabinet">
      <header className="teacher-hero">
        <div>
          <p className="teacher-hero__eyebrow">Добро пожаловать</p>
          <h1 className="teacher-hero__name">{context.fullName}</h1>
          <p className="teacher-hero__meta">
            {[context.schoolName, context.position].filter(Boolean).join(" · ")}
          </p>
        </div>
        <AcademicYearSelect
          years={cabinet.academicYears}
          value={cabinet.academicYearStart}
          onChange={(nextYear) => {
            setLoading(true);
            loadCabinet(nextYear)
              .catch(() => setError("Не удалось загрузить учебный год"))
              .finally(() => setLoading(false));
          }}
        />
      </header>

      <section aria-labelledby="teacher-results">
        <h2 id="teacher-results" className="teacher-section-title">
          Мои результаты
        </h2>
        <p className="teacher-section-hint">
          Учебный год {cabinet.academicYearLabel}. Оценки по двум картам считаются
          отдельно и не смешиваются.
        </p>

        <div className="teacher-results">
          {cabinet.cardTypes.map((summary) => (
            <article
              key={summary.cardType}
              className={`teacher-result${
                summary.cardType === cardType ? " teacher-result--active" : ""
              }`}
            >
              <h3 className="teacher-result__title">{summary.cardTypeLabel}</h3>
              {summary.latest ? (
                <>
                  <p className="teacher-result__value">
                    {summary.latest.percent}%
                    <AnalyticsDelta delta={summary.delta} suffix=" п.п." />
                  </p>
                  <p className="teacher-result__date">
                    Последняя оценка: {summary.latest.dateLabel}
                  </p>
                  {summary.previous ? (
                    <p className="teacher-result__prev">
                      Предыдущая: {summary.previous.percent}% ({summary.previous.dateLabel})
                    </p>
                  ) : (
                    <p className="teacher-result__prev">
                      Это первая оценка за учебный год
                    </p>
                  )}
                  <p className="teacher-result__count">
                    Оценок за год: {summary.evaluationsInYear}
                  </p>
                </>
              ) : (
                <p className="teacher-result__empty">
                  {summary.hasAny
                    ? "В этом учебном году оценок пока нет"
                    : "Оценок по этой карте пока нет"}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="teacher-dynamics">
        <div className="teacher-section-head">
          <div>
            <h2 id="teacher-dynamics" className="teacher-section-title">
              Динамика результатов
            </h2>
            <p className="teacher-section-hint">
              Как менялся итоговый результат от оценки к оценке
            </p>
          </div>
          <AnalyticsCardTypeSwitch value={cardType} onChange={setCardType} />
        </div>

        <AnalyticsCard title={activeSummary?.cardTypeLabel ?? "Динамика"}>
          {analyticsLoading ? (
            <div className="loading-state">Загрузка...</div>
          ) : (
            <AnalyticsLineChart
              points={(analytics?.points ?? []).map((point) => ({
                label: point.dateLabel,
                value: point.percent,
                caption: `Оценок: ${point.evaluations}`,
              }))}
              ariaLabel="Динамика результатов по датам оценивания"
              emptyLabel={
                analytics?.hasAnyOfType
                  ? "В этом учебном году оценок по этой карте нет"
                  : "По этой карте оценок пока нет"
              }
            />
          )}
        </AnalyticsCard>
      </section>

      <section aria-labelledby="teacher-highlights">
        <h2 id="teacher-highlights" className="teacher-section-title">
          Что получается и что развивать
        </h2>
        <p className="teacher-section-hint">
          Разделы карты с самыми высокими и самыми низкими результатами за год
        </p>
        {analytics && analytics.sections.length > 0 ? (
          <div className="analytics-grid">
            <AnalyticsHighlights
              strengths={analytics.strengths}
              weaknesses={analytics.weaknesses}
            />
            <AnalyticsCard title="Результат по разделам">
              <AnalyticsSectionBars
                sections={analytics.sections}
                emptyLabel="Нет данных за выбранный год"
              />
            </AnalyticsCard>
          </div>
        ) : (
          <div className="empty-state">
            Пока нечего показать: за выбранный учебный год оценок по этой карте нет.
          </div>
        )}
      </section>

      <p className="teacher-cabinet__link">
        Все оценки с подробной расшифровкой — в разделе{" "}
        <Link to="/teacher/evaluations">Мои оценки</Link>.
      </p>
    </div>
  );
}
