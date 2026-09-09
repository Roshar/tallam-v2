import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { LessonAnalysisResponse, TeacherListItem } from "../../types/school";

export function LessonAnalysisMembersPage() {
  const [project, setProject] = useState<LessonAnalysisResponse["project"]>(null);
  const [members, setMembers] = useState<TeacherListItem[]>([]);
  const [candidates, setCandidates] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTeacherId, setBusyTeacherId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api.schoolLessonAnalysis();
      setProject(data.project);
      setMembers(data.teachers);
      setCandidates(data.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAdd(teacher: TeacherListItem) {
    if (!project || busyTeacherId) {
      return;
    }

    setBusyTeacherId(teacher.id);
    setError("");

    try {
      await api.addWorkerToProject(teacher.id, project.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить в проект");
    } finally {
      setBusyTeacherId(null);
    }
  }

  async function handleRemove(teacher: TeacherListItem) {
    if (!project || busyTeacherId) {
      return;
    }

    setBusyTeacherId(teacher.id);
    setError("");

    try {
      await api.removeWorkerFromProject(teacher.id, project.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось убрать из проекта");
    } finally {
      setBusyTeacherId(null);
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="page-header-row">
          <div>
            <Link to="/school/lesson-analysis" className="teacher-profile__back">
              ← Вернуться в проект
            </Link>
            <h2 className="page-title" style={{ marginTop: "0.75rem" }}>
              {project
                ? `Состав проекта «${project.name}»`
                : "Добавить учителя в проект"}
            </h2>
          </div>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        {!loading && !project ? (
          <div className="alert alert-error">
            Проект «Анализ урока» не подключён к вашей школе.
          </div>
        ) : null}

        {loading ? (
          <p className="page-subtitle">Загрузка списков...</p>
        ) : project ? (
          <div className="project-member-boards">
            <section className="project-member-board">
              <header className="project-member-board__header">
                <h3 className="project-member-board__title">
                  Список учителей, которые еще не добавлены в проект
                </h3>
                <p className="project-member-board__hint">
                  (Для добавления в проект необходимо нажать на кнопку «+»)
                </p>
              </header>
              <ul className="project-member-list">
                {candidates.length === 0 ? (
                  <li className="project-member-list__empty">Пусто</li>
                ) : (
                  candidates.map((teacher) => (
                    <li key={teacher.id} className="project-member-list__item">
                      <span className="project-member-list__name">
                        {teacher.fullName}
                      </span>
                      <button
                        type="button"
                        className="project-member-list__btn project-member-list__btn--add"
                        aria-label={`Добавить ${teacher.fullName}`}
                        disabled={busyTeacherId === teacher.id}
                        onClick={() => void handleAdd(teacher)}
                      >
                        +
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="project-member-board">
              <header className="project-member-board__header">
                <h3 className="project-member-board__title">
                  Список учителей, участвующих в проекте
                </h3>
                <p className="project-member-board__hint">
                  (Убрать из проекта можно нажав на кнопку «-»)
                </p>
              </header>
              <ul className="project-member-list">
                {members.length === 0 ? (
                  <li className="project-member-list__empty">Пусто</li>
                ) : (
                  members.map((teacher) => (
                    <li key={teacher.id} className="project-member-list__item">
                      <span className="project-member-list__name">
                        {teacher.fullName}
                      </span>
                      <button
                        type="button"
                        className="project-member-list__btn project-member-list__btn--remove"
                        aria-label={`Убрать ${teacher.fullName}`}
                        disabled={busyTeacherId === teacher.id}
                        onClick={() => void handleRemove(teacher)}
                      >
                        −
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
