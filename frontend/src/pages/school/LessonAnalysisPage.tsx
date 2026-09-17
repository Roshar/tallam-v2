import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { TeachersTable } from "../../components/TeachersTable";
import type { LessonAnalysisResponse, TeacherListItem } from "../../types/school";

export function LessonAnalysisPage() {
  const [project, setProject] = useState<LessonAnalysisResponse["project"]>(null);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .schoolLessonAnalysis()
      .then((data) => {
        setProject(data.project);
        setTeachers(data.teachers);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card">
      <div className="card-body">
        <div className="page-header-row">
          <div>
            <h2 className="page-title">
              {project?.name ?? "Проект «Анализ урока»"}
            </h2>
            <p className="page-subtitle">
              Учителя, участвующие в проекте — по ним проводится анализ уроков
            </p>
          </div>
          {!loading && project ? (
            <div className="page-header-row__actions">
              <Link
                to="/school/lesson-analysis/members"
                className="btn btn-primary"
              >
                Добавить учителя в проект
              </Link>
            </div>
          ) : null}
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        {!loading && !project ? (
          <div className="alert alert-error">
            Проект «Анализ урока» не подключён к вашей школе. Обратитесь в
            техподдержку.
          </div>
        ) : null}

        {loading ? (
          <p className="page-subtitle">Загрузка списка...</p>
        ) : project ? (
          <TeachersTable
            teachers={teachers}
            emptyMessage="В проекте пока нет участников. Добавьте учителей через «Добавить учителя в проект»."
            viewBasePath="/school/lesson-analysis/teachers"
            viewLabel="Профиль в проекте"
            userInfoBasePath="/school/workers"
            userInfoLabel="Просмотр"
            compact
            headers={{
              number: "№",
              name: "ФИО (учителя)",
              userInfo: "Информация о пользователе",
              action: "Данные пользователя (в проекте)",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
