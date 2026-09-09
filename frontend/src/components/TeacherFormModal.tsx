import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  CreateTeacherPayload,
  TeacherDetail,
  UpdateTeacherPayload,
  WorkerFormOptions,
} from "../types/school";

type TeacherFormMode = "create" | "edit";

interface TeacherFormModalProps {
  mode: TeacherFormMode;
  open: boolean;
  teacherId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface TeacherFormState {
  surname: string;
  firstname: string;
  patronymic: string;
  birthday: string;
  snils: string;
  genderId: string;
  specialty: string;
  educationLevelId: string;
  diploma: string;
  positionId: string;
  totalExperience: string;
  teachingExperience: string;
  categoryId: string;
  phone: string;
  email: string;
  disciplineIds: number[];
  kpkPlace: string;
  kpkYear: string;
  projectId: string;
}

const emptyForm: TeacherFormState = {
  surname: "",
  firstname: "",
  patronymic: "",
  birthday: "1980-01-01",
  snils: "",
  genderId: "",
  specialty: "",
  educationLevelId: "",
  diploma: "",
  positionId: "",
  totalExperience: "",
  teachingExperience: "",
  categoryId: "",
  phone: "",
  email: "",
  disciplineIds: [],
  kpkPlace: "",
  kpkYear: "",
  projectId: "1",
};

function mapTeacherToForm(teacher: TeacherDetail): TeacherFormState {
  return {
    surname: teacher.surname,
    firstname: teacher.firstname,
    patronymic: teacher.patronymic ?? "",
    birthday: teacher.birthday,
    snils: teacher.snils ?? "",
    genderId: String(teacher.genderId),
    specialty: teacher.specialty ?? "",
    educationLevelId: String(teacher.educationLevelId),
    diploma: teacher.diploma ?? "",
    positionId: String(teacher.positionId),
    totalExperience:
      teacher.totalExperience != null ? String(teacher.totalExperience) : "",
    teachingExperience:
      teacher.teachingExperience != null ? String(teacher.teachingExperience) : "",
    categoryId: teacher.categoryId != null ? String(teacher.categoryId) : "",
    phone: teacher.phone ?? "",
    email: teacher.email ?? "",
    disciplineIds: teacher.disciplineIds,
    kpkPlace: teacher.kpkPlace ?? "",
    kpkYear: teacher.kpkYear ?? "",
    projectId: "1",
  };
}

function buildPayload(form: TeacherFormState): UpdateTeacherPayload {
  return {
    surname: form.surname.trim(),
    firstname: form.firstname.trim(),
    patronymic: form.patronymic.trim() || undefined,
    birthday: form.birthday,
    snils: form.snils.trim() || undefined,
    genderId: Number(form.genderId),
    specialty: form.specialty.trim() || undefined,
    educationLevelId: Number(form.educationLevelId),
    diploma: form.diploma.trim() || undefined,
    positionId: Number(form.positionId),
    totalExperience: form.totalExperience ? Number(form.totalExperience) : undefined,
    teachingExperience: form.teachingExperience
      ? Number(form.teachingExperience)
      : undefined,
    categoryId: form.categoryId ? Number(form.categoryId) : undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    disciplineIds: form.disciplineIds,
    kpkPlace: form.kpkPlace.trim() || undefined,
    kpkYear: form.kpkYear.trim() || undefined,
  };
}

export function TeacherFormModal({
  mode,
  open,
  teacherId,
  onClose,
  onSuccess,
}: TeacherFormModalProps) {
  const [options, setOptions] = useState<WorkerFormOptions | null>(null);
  const [form, setForm] = useState<TeacherFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");
    setLoading(true);

    const requests: [
      Promise<WorkerFormOptions>,
      Promise<TeacherDetail | null>,
    ] = [
      api.schoolWorkerFormOptions(),
      mode === "edit" && teacherId
        ? api.schoolWorker(teacherId).then((response) => response.teacher)
        : Promise.resolve(null),
    ];

    Promise.all(requests)
      .then(([formOptions, teacher]) => {
        setOptions(formOptions);
        if (teacher) {
          setForm(mapTeacherToForm(teacher));
        } else {
          setForm(emptyForm);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, mode, teacherId]);

  if (!open) {
    return null;
  }

  const isCreate = mode === "create";
  const title = isCreate
    ? "Добавить работника в базу ОО"
    : "Редактировать данные работника";
  const submitLabel = isCreate ? "Добавить" : "Сохранить";

  function updateField<K extends keyof TeacherFormState>(
    key: K,
    value: TeacherFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDiscipline(id: number) {
    setForm((prev) => ({
      ...prev,
      disciplineIds: prev.disciplineIds.includes(id)
        ? prev.disciplineIds.filter((item) => item !== id)
        : [...prev.disciplineIds, id],
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const payload = buildPayload(form);

    try {
      if (isCreate) {
        const createPayload: CreateTeacherPayload = {
          ...payload,
          projectId: Number(form.projectId),
        };
        await api.createSchoolWorker(createPayload);
        setForm(emptyForm);
      } else if (teacherId) {
        await api.updateSchoolWorker(teacherId, payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-form-title"
      >
        <div className="modal-card__header">
          <h2 id="teacher-form-title" className="modal-card__title">
            {title}
          </h2>
          <button type="button" className="modal-card__close" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="modal-form">
            <p className="page-subtitle">Загрузка формы...</p>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            {error ? <div className="alert alert-error">{error}</div> : null}

            <section className="modal-section">
              <h3 className="modal-section__title">Личные данные</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Фамилия *</label>
                  <input
                    className="form-input"
                    value={form.surname}
                    onChange={(e) => updateField("surname", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Имя *</label>
                  <input
                    className="form-input"
                    value={form.firstname}
                    onChange={(e) => updateField("firstname", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Отчество</label>
                  <input
                    className="form-input"
                    value={form.patronymic}
                    onChange={(e) => updateField("patronymic", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Дата рождения *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.birthday}
                    onChange={(e) => updateField("birthday", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">СНИЛС</label>
                  <input
                    className="form-input"
                    value={form.snils}
                    onChange={(e) => updateField("snils", e.target.value)}
                    placeholder="Только цифры"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Пол *</label>
                  <select
                    className="form-input"
                    value={form.genderId}
                    onChange={(e) => updateField("genderId", e.target.value)}
                    required
                  >
                    <option value="">Выбрать</option>
                    {options?.genders.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="modal-section">
              <h3 className="modal-section__title">Образование</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Уровень образования *</label>
                  <select
                    className="form-input"
                    value={form.educationLevelId}
                    onChange={(e) => updateField("educationLevelId", e.target.value)}
                    required
                  >
                    <option value="">Выбрать</option>
                    {options?.educationLevels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Специальность</label>
                  <input
                    className="form-input"
                    value={form.specialty}
                    onChange={(e) => updateField("specialty", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Серия и номер диплома</label>
                  <input
                    className="form-input"
                    value={form.diploma}
                    onChange={(e) => updateField("diploma", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="modal-section">
              <h3 className="modal-section__title">Профессиональные данные</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Должность *</label>
                  <select
                    className="form-input"
                    value={form.positionId}
                    onChange={(e) => updateField("positionId", e.target.value)}
                    required
                  >
                    <option value="">Выбрать</option>
                    {options?.positions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Общий стаж</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={form.totalExperience}
                    onChange={(e) => updateField("totalExperience", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Педагогический стаж</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={form.teachingExperience}
                    onChange={(e) =>
                      updateField("teachingExperience", e.target.value)
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Категория</label>
                  <select
                    className="form-input"
                    value={form.categoryId}
                    onChange={(e) => updateField("categoryId", e.target.value)}
                  >
                    <option value="">Не указана</option>
                    {options?.categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {options?.disciplines.length ? (
                <div className="form-group">
                  <label className="form-label">Преподаваемые дисциплины</label>
                  <div className="discipline-list">
                    {options.disciplines.map((item) => (
                      <label key={item.id} className="discipline-item">
                        <input
                          type="checkbox"
                          checked={form.disciplineIds.includes(item.id)}
                          onChange={() => toggleDiscipline(item.id)}
                        />
                        <span>{item.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="modal-section">
              <h3 className="modal-section__title">Контактные данные</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Телефон</label>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="modal-section">
              <h3 className="modal-section__title">Повышение квалификации</h3>
              <div className="form-grid">
                <div className="form-group form-group--wide">
                  <label className="form-label">Место, программа (тема) КПК</label>
                  <input
                    className="form-input"
                    value={form.kpkPlace}
                    onChange={(e) => updateField("kpkPlace", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Год прохождения КПК</label>
                  <input
                    className="form-input"
                    value={form.kpkYear}
                    onChange={(e) => updateField("kpkYear", e.target.value)}
                  />
                </div>
                {isCreate ? (
                  <div className="form-group">
                    <label className="form-label">Добавить в проект *</label>
                    <select
                      className="form-input"
                      value={form.projectId}
                      onChange={(e) => updateField("projectId", e.target.value)}
                      required
                    >
                      {options?.projects.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </section>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Отмена
              </button>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Сохранение..." : submitLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
