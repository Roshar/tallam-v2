import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { ProjectStatusBadges } from "../../components/ProjectStatusBadges";
import { TeacherFormModal } from "../../components/TeacherFormModal";
import type { TeacherDetail } from "../../types/school";

function formatDisplayDate(value: string): string {
  const parts = value.split("-");
  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="profile-field">
      <dt className="profile-field__label">{label}</dt>
      <dd className="profile-field__value">{value ?? "—"}</dd>
    </div>
  );
}

export function TeacherProfilePage() {
  const { teacherId = "" } = useParams();
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [projectUpdatingId, setProjectUpdatingId] = useState<number | null>(null);

  const loadTeacher = useCallback(async () => {
    if (!teacherId) {
      setError("Не указан идентификатор работника");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api.schoolWorker(teacherId);
      setTeacher(data.teacher);
    } catch (err) {
      setTeacher(null);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    void loadTeacher();
  }, [loadTeacher]);

  async function toggleProjectMembership(projectId: number, isMember: boolean) {
    if (!teacher) {
      return;
    }

    setProjectUpdatingId(projectId);
    setError("");

    try {
      const response = isMember
        ? await api.removeWorkerFromProject(teacher.id, projectId)
        : await api.addWorkerToProject(teacher.id, projectId);
      setTeacher(response.teacher);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка изменения проекта");
    } finally {
      setProjectUpdatingId(null);
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-body">
          <div className="teacher-profile__top">
            <Link to="/school/workers" className="teacher-profile__back">
              ← Вернуться к списку
            </Link>

            {teacher ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEditOpen(true)}
              >
                Редактировать
              </button>
            ) : null}
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}

          {loading ? (
            <p className="page-subtitle">Загрузка карточки...</p>
          ) : teacher ? (
            <div className="teacher-profile">
              <header className="teacher-profile__header">
                <div className="teacher-profile__avatar" aria-hidden="true">
                  {(teacher.firstname[0] ?? "?").toUpperCase()}
                </div>
                <div>
                  <h2 className="teacher-profile__name">{teacher.fullName}</h2>
                  <p className="teacher-profile__position">
                    {teacher.positionTitle ?? "Должность не указана"}
                  </p>
                  <ProjectStatusBadges
                    labels={teacher.activeProjects.map((project) => project.name)}
                  />
                </div>
              </header>

              {teacher.projectMemberships.length ? (
                <section className="teacher-profile__section">
                  <h3 className="teacher-profile__section-title">
                    Участие в проектах
                  </h3>
                  <ul className="project-membership-inline">
                    {teacher.projectMemberships.map((project) => (
                      <li key={project.id} className="project-membership-inline__item">
                        <span className="project-membership-inline__name">
                          {project.name}
                        </span>
                        <button
                          type="button"
                          className="project-membership-inline__action"
                          disabled={projectUpdatingId === project.id}
                          onClick={() =>
                            void toggleProjectMembership(project.id, project.isMember)
                          }
                        >
                          {projectUpdatingId === project.id
                            ? "(сохранение...)"
                            : project.isMember
                              ? "(исключить)"
                              : "(добавить в проект)"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="teacher-profile__section">
                <h3 className="teacher-profile__section-title">Личные данные</h3>
                <dl className="profile-grid">
                  <ProfileField label="ФИО" value={teacher.fullName} />
                  <ProfileField
                    label="Дата рождения"
                    value={formatDisplayDate(teacher.birthday)}
                  />
                  <ProfileField label="СНИЛС" value={teacher.snils} />
                  <ProfileField label="Пол" value={teacher.genderTitle} />
                </dl>
              </section>

              <section className="teacher-profile__section">
                <h3 className="teacher-profile__section-title">Образование</h3>
                <dl className="profile-grid">
                  <ProfileField
                    label="Уровень образования"
                    value={teacher.educationLevelTitle}
                  />
                  <ProfileField label="Специальность" value={teacher.specialty} />
                  <ProfileField label="Серия и номер диплома" value={teacher.diploma} />
                </dl>
              </section>

              <section className="teacher-profile__section">
                <h3 className="teacher-profile__section-title">
                  Профессиональные данные
                </h3>
                <dl className="profile-grid">
                  <ProfileField label="Должность" value={teacher.positionTitle} />
                  <ProfileField label="Общий стаж" value={teacher.totalExperience} />
                  <ProfileField
                    label="Педагогический стаж"
                    value={teacher.teachingExperience}
                  />
                  <ProfileField label="Категория" value={teacher.categoryTitle} />
                  <ProfileField
                    label="Преподаваемые дисциплины"
                    value={
                      teacher.disciplines.length
                        ? teacher.disciplines.map((item) => item.title).join(", ")
                        : null
                    }
                  />
                </dl>
              </section>

              <section className="teacher-profile__section">
                <h3 className="teacher-profile__section-title">Контактные данные</h3>
                <dl className="profile-grid">
                  <ProfileField label="Телефон" value={teacher.phone} />
                  <ProfileField label="Email" value={teacher.email} />
                </dl>
              </section>

              <section className="teacher-profile__section">
                <h3 className="teacher-profile__section-title">
                  Повышение квалификации
                </h3>
                <dl className="profile-grid">
                  <ProfileField
                    label="Место, программа (тема) КПК"
                    value={teacher.kpkPlace}
                  />
                  <ProfileField label="Год прохождения КПК" value={teacher.kpkYear} />
                </dl>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {teacher ? (
        <TeacherFormModal
          mode="edit"
          open={editOpen}
          teacherId={teacher.id}
          onClose={() => setEditOpen(false)}
          onSuccess={() => void loadTeacher()}
        />
      ) : null}
    </>
  );
}
