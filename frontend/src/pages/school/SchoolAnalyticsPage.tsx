import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AnalyticsLineChart } from "../../components/AnalyticsLineChart";
import {
  AnalyticsCard,
  AnalyticsCardTypeSwitch,
  AnalyticsDelta,
  AnalyticsDistribution,
  AnalyticsSectionBars,
} from "../../components/AnalyticsWidgets";
import type { AnalyticsCardType, SchoolAnalytics } from "../../types/analytics";

export function SchoolAnalyticsPage() {
  const [cardType, setCardType] = useState<AnalyticsCardType>("method");
  const [academicYear, setAcademicYear] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<SchoolAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .schoolAnalytics({
        cardType,
        academicYear: academicYear ?? undefined,
      })
      .then((response) => {
        if (cancelled) return;
        setAnalytics(response.analytics);
        setAcademicYear((current) => current ?? response.analytics.academicYearStart);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setAnalytics(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cardType, academicYear]);

  const selectedYear = academicYear ?? analytics?.academicYearStart ?? null;
  const cardTypeTitle =
    cardType === "method" ? "методической карте" : "комплексной карте";

  return (
    <div className="card">
      <div className="card-body">
        <header className="school-guide__header">
          <h2 className="page-title">Аналитика</h2>
          <p className="page-subtitle">
            Сводные результаты оценивания учителей школы. Методическая и
            комплексная карты считаются отдельно - общей оценки по двум картам
            система не выводит.
          </p>
        </header>

        <div className="analytics__toolbar">
          <AnalyticsCardTypeSwitch
            value={cardType}
            onChange={setCardType}
            disabled={loading}
          />
        </div>

        {analytics && analytics.academicYears.length > 0 ? (
          <div
            className="project-teacher__years"
            role="tablist"
            aria-label="Учебный год"
          >
            {analytics.academicYears.map((year) => {
              const selected = selectedYear === year.startYear;
              return (
                <button
                  key={year.startYear}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`project-teacher__year${selected ? " active" : ""}`}
                  onClick={() => setAcademicYear(year.startYear)}
                >
                  {year.label}
                  <span>учебный год</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {error ? <div className="alert alert-error">{error}</div> : null}

        {loading ? (
          <p className="page-subtitle">Считаем аналитику...</p>
        ) : analytics ? (
          !analytics.hasAnyOfType ? (
            <p className="analytics-empty">
              По {cardTypeTitle} в школе ещё нет ни одной оценки.
            </p>
          ) : !analytics.hasDataInYear ? (
            <p className="analytics-empty">
              За учебный год {analytics.academicYearLabel} оценивания по{" "}
              {cardTypeTitle} не проводились. Выберите другой год - оценки за
              прошлые периоды сохраняются.
            </p>
          ) : (
            <>
              <AnalyticsCard
                title="Средний показатель школы"
                hint="Считается по последней оценке каждого учителя за выбранный год, чтобы один учитель не учитывался несколько раз."
              >
                <div className="analytics-summary">
                  <span className="analytics-summary__value">
                    {analytics.average?.percent ?? 0}%
                  </span>
                  <AnalyticsDelta delta={analytics.delta} />
                  <span className="analytics-summary__hint">
                    оценено учителей: {analytics.average?.teachers ?? 0} ·
                    оценок за год: {analytics.average?.evaluations ?? 0}
                  </span>
                </div>
                {analytics.previousYear ? (
                  <p className="analytics-note">
                    Для сравнения: за {analytics.previousYear.academicYearLabel}{" "}
                    учебный год средний показатель был{" "}
                    {analytics.previousYear.percent}% (учителей:{" "}
                    {analytics.previousYear.teachers}).
                  </p>
                ) : (
                  <p className="analytics-note">
                    За предыдущий учебный год данных нет - сравнить пока не с
                    чем.
                  </p>
                )}
              </AnalyticsCard>

              <AnalyticsCard
                title="Динамика школы"
                hint="Средний процент оценок по фактическим датам проведения оценивания."
              >
                <AnalyticsLineChart
                  points={analytics.points.map((point) => ({
                    label: point.date,
                    caption: `${point.dateLabel} · оценок: ${point.evaluations}`,
                    value: point.percent,
                  }))}
                  ariaLabel={`Динамика средней оценки школы по ${cardTypeTitle}`}
                  emptyLabel="Нет оценок для построения динамики."
                />
              </AnalyticsCard>

              <AnalyticsCard
                title="Средние показатели по разделам"
                hint="Средний результат всех оценённых учителей школы по каждому разделу карты."
              >
                <AnalyticsSectionBars
                  sections={analytics.sections}
                  emptyLabel="Недостаточно данных для расчёта разделов."
                />
              </AnalyticsCard>

              <AnalyticsCard
                title="Распределение учителей"
                hint="По последней оценке каждого учителя за выбранный год."
              >
                <AnalyticsDistribution buckets={analytics.distribution} />
              </AnalyticsCard>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}
