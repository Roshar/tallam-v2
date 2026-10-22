const labels: Record<string, string> = {
  schools: "Всего школ",
  activeSchools: "Активных школ",
  inactiveSchools: "Неактивных школ",
  teachers: "Всего учителей",
  evaluatedTeachers: "Оценено учителей",
  evaluations: "Оцениваний",
  coveragePercent: "Покрытие, %",
  methodEvaluations: "Методических",
  fullEvaluations: "Комплексных",
  averagePercent: "Средний результат, %",
  schoolsWithData: "Школ с данными",
  schoolsWithoutEnoughData: "Недостаточно данных",
};

export function Cards({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="cards">
      {Object.entries(data)
        .filter(([key, value]) => labels[key] && typeof value !== "object")
        .map(([key, value]) => (
          <article key={key}>
            <span>{labels[key]}</span>
            <strong>{value === null ? "-" : String(value)}</strong>
          </article>
        ))}
    </div>
  );
}
