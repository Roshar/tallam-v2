import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type {
  EvaluationListItem,
  ProjectTeacherProfileResponse,
} from "../../types/school";

export function ProjectTeacherPage() {
  const { teacherId = "" } = useParams();
  const [data, setData] = useState<ProjectTeacherProfileResponse | null>(null);
  const [source, setSource] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(
    async (filters?: { source?: string; discipline?: string }) => {
      if (!teacherId) {
        setError("Не указан идентификатор учителя");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await api.schoolLessonAnalysisTeacher(teacherId, filters);
        setData(response);
      } catch (err) {
        setData(null);
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    },
    [teacherId],
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function handleFilterSubmit(event: FormEvent) {
    event.preventDefault();
    void loadProfile({
      source: source || undefined,
      discipline: discipline || undefined,
    });
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="project-teacher__top">
          <Link to="/school/lesson-analysis" className="teacher-profile__back">
            ← Вернуться к списку
          </Link>
          {data ? (
            <div className="project-teacher__top-actions">
              <Link
                to={`/school/workers/${data.teacher.id}`}
                className="table-action-link"
              >
                Личная карточка
              </Link>
              <Link
                to={`/school/lesson-analysis/teachers/${data.teacher.id}/evaluate`}
                className="btn btn-primary"
              >
                Оценить
              </Link>
            </div>
          ) : null}
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        {loading && !data ? (
          <p className="page-subtitle">Загрузка профиля...</p>
        ) : data ? (
          <>
            <header className="project-teacher__header">
              <p className="project-teacher__eyebrow">{data.project.name}</p>
              <h2 className="page-title">Личный профиль</h2>
              <p className="project-teacher__fio">{data.teacher.fullName}</p>
              {data.teacher.position ? (
                <p className="page-subtitle">{data.teacher.position}</p>
              ) : null}
            </header>

            <form className="project-teacher__filters" onSubmit={handleFilterSubmit}>
              <div className="project-teacher__filters-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="card-source">
                    Тип оценки
                  </label>
                  <select
                    id="card-source"
                    className="form-input"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                  >
                    <option value="">Все типы</option>
                    {data.filters.sources.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="card-discipline">
                    Предмет
                  </label>
                  <select
                    id="card-discipline"
                    className="form-input"
                    value={discipline}
                    onChange={(event) => setDiscipline(event.target.value)}
                  >
                    <option value="">Все предметы</option>
                    {data.filters.disciplines.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary project-teacher__filter-btn">
                Отобразить результаты по фильтру
              </button>
            </form>

            <section className="project-teacher__section">
              <h3 className="project-teacher__section-title">
                Список оценок (оценки уроков)
              </h3>

              <EvaluationsTable evaluations={data.evaluations} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function EvaluationsTable({ evaluations }: { evaluations: EvaluationListItem[] }) {
  if (evaluations.length === 0) {
    return (
      <p className="table-empty">
        Нет оценок по выбранным условиям.
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Дата</th>
            <th>Предмет</th>
            <th>Класс</th>
            <th>Тип оценки</th>
            <th>Тип карты</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>{item.dateLabel}</td>
              <td>{item.disciplineTitle}</td>
              <td>{item.classLabel}</td>
              <td>{item.sourceLabel}</td>
              <td>{item.cardTypeLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
