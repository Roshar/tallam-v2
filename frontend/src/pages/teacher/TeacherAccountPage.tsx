import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { TeacherCabinetResponse } from "../../types/teacher-cabinet";

/**
 * Профиль учителя. Данные read-only: источник — карточка учителя в школе,
 * менять её из кабинета нельзя (ни школу, ни административные поля).
 */
export function TeacherAccountPage() {
  const [cabinet, setCabinet] = useState<TeacherCabinetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .teacherCabinet()
      .then((data) => {
        if (!cancelled) setCabinet(data);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить профиль");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="loading-state">Загрузка профиля...</div>;
  }
  if (error || !cabinet) {
    return <div className="alert alert-error">{error || "Профиль недоступен"}</div>;
  }

  const { context } = cabinet;
  const rows: Array<{ label: string; value: string }> = [
    { label: "ФИО", value: context.fullName },
    { label: "Школа", value: context.schoolName || "—" },
    { label: "Должность", value: context.position || "—" },
    {
      label: "Предметы",
      value: context.disciplines.length > 0 ? context.disciplines.join(", ") : "—",
    },
    { label: "Email", value: context.email || "—" },
    { label: "Телефон", value: context.phone || "—" },
  ];

  return (
    <div className="teacher-cabinet">
      <h1 className="teacher-section-title">Профиль</h1>
      <p className="teacher-section-hint">
        Данные заполняет школа. Если что-то нужно изменить — обратитесь к
        администрации школы.
      </p>

      <dl className="teacher-profile">
        {rows.map((row) => (
          <div key={row.label} className="teacher-profile__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="teacher-section-hint">
        Всего оценок в системе: {cabinet.totalEvaluations}. Учебный год:{" "}
        {cabinet.academicYearLabel}.
      </p>
    </div>
  );
}
