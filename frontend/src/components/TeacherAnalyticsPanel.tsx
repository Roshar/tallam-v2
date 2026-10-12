import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AnalyticsLineChart } from "./AnalyticsLineChart";
import {
  AnalyticsCard,
  AnalyticsCardTypeSwitch,
  AnalyticsDelta,
  AnalyticsHighlights,
  AnalyticsSectionBars,
} from "./AnalyticsWidgets";
import type { AnalyticsCardType, TeacherAnalytics } from "../types/analytics";

interface TeacherAnalyticsPanelProps {
  teacherId: string;
  academicYearStart: number;
  academicYearLabel: string;
}

export function TeacherAnalyticsPanel({
  teacherId,
  academicYearStart,
  academicYearLabel,
}: TeacherAnalyticsPanelProps) {
  const [cardType, setCardType] = useState<AnalyticsCardType>("method");
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!teacherId) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .teacherAnalytics(teacherId, { cardType, academicYear: academicYearStart })
      .then((response) => {
        if (!cancelled) setAnalytics(response.analytics);
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
  }, [teacherId, cardType, academicYearStart]);

  const cardTypeTitle =
    cardType === "method" ? "методической карте" : "комплексной карте";

  return (
    <div className="analytics">
      <div className="analytics__toolbar">
        <AnalyticsCardTypeSwitch
          value={cardType}
          onChange={setCardType}
          disabled={loading}
        />
        <span className="analytics__period">Учебный год {academicYearLabel}</span>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <p className="page-subtitle">Считаем аналитику...</p>
      ) : analytics ? (
        !analytics.hasAnyOfType ? (
          <p className="analytics-empty">
            По {cardTypeTitle} у этого работника ещё нет ни одной оценки.
          </p>
        ) : !analytics.hasDataInYear ? (
          <p className="analytics-empty">
            За учебный год {academicYearLabel} оценивания по {cardTypeTitle} не
            проводились. Выберите другой год — оценки за прошлые периоды
            сохраняются.
          </p>
        ) : (
          <>
            <AnalyticsCard title="Динамика общей оценки">
              <div className="analytics-summary">
                <span className="analytics-summary__value">
                  {analytics.latest?.percent ?? 0}%
                </span>
                <AnalyticsDelta delta={analytics.delta} />
                {analytics.previous ? (
                  <span className="analytics-summary__hint">
                    предыдущая оценка {analytics.previous.dateLabel} —{" "}
                    {analytics.previous.percent}%
                  </span>
                ) : (
                  <span className="analytics-summary__hint">
                    это первая оценка по этой карте за год — сравнить пока не с
                    чем
                  </span>
                )}
              </div>
              <AnalyticsLineChart
                points={analytics.points.map((point) => ({
                  label: point.date,
                  caption: point.dateLabel,
                  value: point.percent,
                }))}
                ariaLabel={`Динамика итоговой оценки по ${cardTypeTitle}`}
                emptyLabel="Нет оценок для построения динамики."
              />
            </AnalyticsCard>

            <AnalyticsCard
              title="Показатели по разделам карты"
              hint="Средний результат по каждому разделу за выбранный учебный год."
            >
              <AnalyticsSectionBars
                sections={analytics.sections}
                emptyLabel="Недостаточно данных для расчёта разделов."
              />
            </AnalyticsCard>

            <AnalyticsCard
              title="Сильные стороны и зоны развития"
              hint="Автоматически по средним показателям разделов, без экспертных выводов."
            >
              <AnalyticsHighlights
                strengths={analytics.strengths}
                weaknesses={analytics.weaknesses}
              />
            </AnalyticsCard>

            <AnalyticsCard
              title="Изменение по разделам"
              hint="Последняя оценка года в сравнении с предыдущей."
            >
              {analytics.comparison.length === 0 ? (
                <p className="analytics-empty">
                  Для сравнения нужны минимум две оценки по этой карте за
                  выбранный учебный год.
                </p>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Раздел</th>
                        <th className="analytics-table__num">Было</th>
                        <th className="analytics-table__num">Сейчас</th>
                        <th className="analytics-table__num">Изменение</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.comparison.map((row) => (
                        <tr key={row.id}>
                          <td>{row.title}</td>
                          <td className="analytics-table__num">{row.before}%</td>
                          <td className="analytics-table__num">{row.after}%</td>
                          <td className="analytics-table__num">
                            {row.delta === 0 ? (
                              <span className="analytics-delta analytics-delta--flat">
                                0 п.п.
                              </span>
                            ) : (
                              <AnalyticsDelta delta={row.delta} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AnalyticsCard>
          </>
        )
      ) : null}
    </div>
  );
}
