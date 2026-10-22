import { Cards } from "./Cards";

interface Section {
  title: string;
  averagePercent: number;
}

export interface Aggregate {
  teachers: number;
  evaluatedTeachers: number;
  coveragePercent: number;
  evaluations: number;
  averagePercent: number | null;
  dynamics: number | null;
  sections: Section[];
  strongSections: Section[];
  weakSections: Section[];
  insufficient: boolean;
  distribution?: { label: string; count: number }[];
  schoolsWithData?: number;
  schoolsWithoutEnoughData?: number;
}

export function AggregateView({ data }: { data: Aggregate | null }) {
  if (!data) return <p>Загрузка...</p>;

  return (
    <>
      {data.insufficient && (
        <div className="notice">
          Недостаточно данных: оценено меньше 3 учителей. Средние и разрезы
          скрыты.
        </div>
      )}
      <Cards data={data as unknown as Record<string, unknown>} />
      {!data.insufficient && (
        <>
          <h2>Разделы карты</h2>
          <div className="sections">
            {data.sections.map((section) => (
              <div key={section.title}>
                <span>{section.title}</span>
                <b>{section.averagePercent}%</b>
                <i
                  style={{ width: `${Math.max(0, section.averagePercent)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="twocol">
            <article>
              <h2>Сильные разделы</h2>
              {data.strongSections.map((section) => (
                <p key={section.title}>{section.title}</p>
              ))}
            </article>
            <article>
              <h2>Проблемные разделы</h2>
              {data.weakSections.map((section) => (
                <p key={section.title}>{section.title}</p>
              ))}
            </article>
          </div>
          {data.distribution && (
            <>
              <h2>Распределение</h2>
              <div className="distribution">
                {data.distribution.map((bucket) => (
                  <div key={bucket.label}>
                    <b>{bucket.count}</b>
                    <span>{bucket.label}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
