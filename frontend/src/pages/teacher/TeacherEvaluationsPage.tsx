import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { AnalyticsCardType } from "../../types/analytics";
import type { TeacherEvaluationsResponse } from "../../types/teacher-cabinet";
import { AcademicYearSelect } from "./AcademicYearSelect";

/** История оцениваний учителя за выбранный учебный год. */
export function TeacherEvaluationsPage() {
  const [data, setData] = useState<TeacherEvaluationsResponse | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [cardType, setCardType] = useState<AnalyticsCardType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .teacherEvaluations(year ?? undefined)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setYear(response.academicYearStart);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить оценки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading && !data) {
    return <div className="loading-state">Загрузка оценок...</div>;
  }
  if (error || !data) {
    return <div className="alert alert-error">{error || "Оценки недоступны"}</div>;
  }

  const rows = data.evaluations.filter(
    (item) => cardType === "all" || item.cardType === cardType,
  );

  return (
    <div className="teacher-cabinet">
      <div className="teacher-section-head">
        <div>
          <h1 className="teacher-section-title">Мои оценки</h1>
          <p className="teacher-section-hint">
            Оценки за {data.academicYearLabel}. Откройте любую, чтобы увидеть
            расшифровку по критериям.
          </p>
        </div>
        <AcademicYearSelect
          years={data.academicYears}
          value={data.academicYearStart}
          onChange={setYear}
        />
      </div>

      <div className="teacher-filters">
        <button
          type="button"
          className={`teacher-filters__btn${cardType === "all" ? " active" : ""}`}
          onClick={() => setCardType("all")}
        >
          Все карты
        </button>
        <button
          type="button"
          className={`teacher-filters__btn${cardType === "method" ? " active" : ""}`}
          onClick={() => setCardType("method")}
        >
          Методическая
        </button>
        <button
          type="button"
          className={`teacher-filters__btn${cardType === "full" ? " active" : ""}`}
          onClick={() => setCardType("full")}
        >
          Комплексная
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          За {data.academicYearLabel} оценок нет. Попробуйте выбрать другой учебный
          год.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table teacher-evaluations">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип карты</th>
                <th>Кто проводил</th>
                <th className="teacher-evaluations__value">Результат</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>{item.dateLabel}</td>
                  <td>{item.cardTypeLabel}</td>
                  <td>{item.sourceLabel}</td>
                  <td className="teacher-evaluations__value">
                    <strong>{item.percent}%</strong>
                  </td>
                  <td className="teacher-evaluations__action">
                    <Link
                      className="btn btn-ghost"
                      to={`/teacher/evaluations/${item.id}`}
                    >
                      Подробнее
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
