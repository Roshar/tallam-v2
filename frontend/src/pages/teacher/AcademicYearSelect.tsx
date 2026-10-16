import type { AcademicYearOption } from "../../types/analytics";

/** Переключатель учебного года. Годы приходят с сервера: только те, где есть оценки. */
export function AcademicYearSelect({
  years,
  value,
  onChange,
}: {
  years: AcademicYearOption[];
  value: number;
  onChange: (year: number) => void;
}) {
  if (years.length <= 1) {
    return (
      <span className="teacher-year teacher-year--static">
        {years[0]?.label ?? "—"}
      </span>
    );
  }

  return (
    <label className="teacher-year">
      <span className="teacher-year__label">Учебный год</span>
      <select
        className="teacher-year__select"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {years.map((year) => (
          <option key={year.startYear} value={year.startYear}>
            {year.label}
            {year.isCurrent ? " (текущий)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
