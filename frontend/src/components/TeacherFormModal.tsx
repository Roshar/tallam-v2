import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
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

function defaultProjectId(projects: Array<{ id: number; name: string }>): string {
  const lesson = projects.find(
    (project) =>
      Number(project.id) > 1 && /анализ/i.test(project.name),
  );
  if (lesson) return String(lesson.id);
  const real = projects.find((project) => Number(project.id) > 1);
  if (real) return String(real.id);
  return "";
}

function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

function formatSnilsInput(value: string): string {
  const digits = digitsOnly(value, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhoneInput(value: string): string {
  const digits = digitsOnly(value, 11).replace(/^8/, "7");
  const local = digits.startsWith("7") ? digits.slice(1) : digits;
  if (!local) return digits.startsWith("7") ? "+7" : "";
  if (local.length <= 3) return `+7-${local}`;
  if (local.length <= 6) return `+7-${local.slice(0, 3)}-${local.slice(3)}`;
  if (local.length <= 8) {
    return `+7-${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return `+7-${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6, 8)}-${local.slice(8)}`;
}

const emptyForm: TeacherFormState = {
  surname: "",
  firstname: "",
  patronymic: "",
  birthday: "",
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
  projectId: "",
};

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="form-label" htmlFor={htmlFor}>
      {children}
      {required ? (
        <span className="form-required" title="Обязательное поле">
          *
        </span>
      ) : null}
    </label>
  );
}

function mapTeacherToForm(teacher: TeacherDetail): TeacherFormState {
  return {
    surname: teacher.surname,
    firstname: teacher.firstname,
    patronymic: teacher.patronymic ?? "",
    birthday: teacher.birthday,
    snils: formatSnilsInput(teacher.snils ?? ""),
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
    phone: formatPhoneInput(teacher.phone ?? ""),
    email: teacher.email ?? "",
    disciplineIds: teacher.disciplineIds,
    kpkPlace: teacher.kpkPlace ?? "",
    kpkYear: teacher.kpkYear ?? "",
    projectId: "1",
  };
}

function buildPayload(form: TeacherFormState): UpdateTeacherPayload {
  const snils = digitsOnly(form.snils, 11);
  return {
    surname: form.surname.trim(),
    firstname: form.firstname.trim(),
    patronymic: form.patronymic.trim() || undefined,
    birthday: form.birthday,
    snils: snils || undefined,
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
    phone: form.phone || undefined,
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
  const formTopRef = useRef<HTMLDivElement>(null);

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
          setForm({
            ...emptyForm,
            projectId: defaultProjectId(formOptions.projects),
          });
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, mode, teacherId]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const card = formTopRef.current?.closest(".modal-card");
    if (card instanceof HTMLElement) {
      card.scrollTop = 0;
    }
  }, [error]);

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

    if (form.disciplineIds.length === 0) {
      setError(
        "Выберите хотя бы один предмет. Без предмета нельзя добавить оценку урока. Если это не учитель, отметьте «Администрация».",
      );
      return;
    }

    const snils = digitsOnly(form.snils, 11);
    if (snils && snils.length !== 11) {
      setError("СНИЛС должен содержать 11 цифр");
      return;
    }

    const phone = digitsOnly(form.phone, 11);
    if (phone && phone.length !== 11) {
      setError("Телефон должен содержать 11 цифр");
      return;
    }

    if (form.kpkYear && !/^\d{4}$/.test(form.kpkYear)) {
      setError("Год КПК должен содержать 4 цифры");
      return;
    }

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
            <div ref={formTopRef} />
            {error ? <div className="alert alert-error">{error}</div> : null}

            <p className="form-legend">
              <span className="form-required">*</span> обязательные поля
            </p>

            <section className="modal-section">
              <h3 className="modal-section__title">Личные данные</h3>
              <div className="form-grid">
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-surname" required>
                    Фамилия
                  </FieldLabel>
                  <input
                    id="teacher-surname"
                    className="form-input"
                    value={form.surname}
                    onChange={(e) => updateField("surname", e.target.value)}
                    placeholder="Ахмедов"
                    autoComplete="family-name"
                    required
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-firstname" required>
                    Имя
                  </FieldLabel>
                  <input
                    id="teacher-firstname"
                    className="form-input"
                    value={form.firstname}
                    onChange={(e) => updateField("firstname", e.target.value)}
                    placeholder="Ахмед"
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-patronymic">Отчество</FieldLabel>
                  <input
                    id="teacher-patronymic"
                    className="form-input"
                    value={form.patronymic}
                    onChange={(e) => updateField("patronymic", e.target.value)}
                    placeholder="Ахмедович"
                    autoComplete="additional-name"
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-birthday" required>
                    Дата рождения
                  </FieldLabel>
                  <input
                    id="teacher-birthday"
                    className="form-input"
                    type="date"
                    value={form.birthday}
                    onChange={(e) => updateField("birthday", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-snils">СНИЛС</FieldLabel>
                  <input
                    id="teacher-snils"
                    className="form-input"
                    value={form.snils}
                    onChange={(e) =>
                      updateField("snils", formatSnilsInput(e.target.value))
                    }
                    placeholder="123-456-789-00"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={14}
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-gender" required>
                    Пол
                  </FieldLabel>
                  <select
                    id="teacher-gender"
                    className="form-input"
                    value={form.genderId}
                    onChange={(e) => updateField("genderId", e.target.value)}
                    required
                  >
                    <option value="">Выберите пол</option>
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
                  <FieldLabel htmlFor="teacher-education" required>
                    Уровень образования
                  </FieldLabel>
                  <select
                    id="teacher-education"
                    className="form-input"
                    value={form.educationLevelId}
                    onChange={(e) => updateField("educationLevelId", e.target.value)}
                    required
                  >
                    <option value="">Выберите уровень образования</option>
                    {options?.educationLevels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-specialty">Специальность</FieldLabel>
                  <input
                    id="teacher-specialty"
                    className="form-input"
                    value={form.specialty}
                    onChange={(e) => updateField("specialty", e.target.value)}
                    placeholder="Учитель математики"
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-diploma">
                    Серия и номер диплома
                  </FieldLabel>
                  <input
                    id="teacher-diploma"
                    className="form-input"
                    value={form.diploma}
                    onChange={(e) => updateField("diploma", e.target.value)}
                    placeholder="123456 0000000"
                  />
                </div>
              </div>
            </section>

            <section className="modal-section">
              <h3 className="modal-section__title">Профессиональные данные</h3>
              <div className="form-grid">
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-position" required>
                    Должность
                  </FieldLabel>
                  <select
                    id="teacher-position"
                    className="form-input"
                    value={form.positionId}
                    onChange={(e) => updateField("positionId", e.target.value)}
                    required
                  >
                    <option value="">Выберите должность</option>
                    {options?.positions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-total-exp">Общий стаж</FieldLabel>
                  <input
                    id="teacher-total-exp"
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    value={form.totalExperience}
                    onChange={(e) =>
                      updateField("totalExperience", digitsOnly(e.target.value, 2))
                    }
                    placeholder="Например, 12"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-teach-exp">
                    Педагогический стаж
                  </FieldLabel>
                  <input
                    id="teacher-teach-exp"
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    value={form.teachingExperience}
                    onChange={(e) =>
                      updateField(
                        "teachingExperience",
                        digitsOnly(e.target.value, 2),
                      )
                    }
                    placeholder="Например, 8"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-category">Категория</FieldLabel>
                  <select
                    id="teacher-category"
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
                  <FieldLabel required>Преподаваемые дисциплины</FieldLabel>
                  <p className="form-field-hint">
                    Нужно выбрать хотя бы один предмет. Если это замдиректора
                    или другой административный работник, отметьте
                    «Администрация». Можно выбрать несколько.
                  </p>
                  <div className="discipline-list" role="group">
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
                  <FieldLabel htmlFor="teacher-phone">Телефон</FieldLabel>
                  <input
                    id="teacher-phone"
                    className="form-input"
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      updateField("phone", formatPhoneInput(e.target.value))
                    }
                    placeholder="+7-900-000-00-00"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={16}
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-email">Email</FieldLabel>
                  <input
                    id="teacher-email"
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      updateField("email", e.target.value.replace(/\s/g, ""))
                    }
                    placeholder="teacher@school.ru"
                    autoComplete="email"
                  />
                </div>
              </div>
            </section>

            <section className="modal-section">
              <h3 className="modal-section__title">Повышение квалификации</h3>
              <div className="form-grid">
                <div className="form-group form-group--wide">
                  <FieldLabel htmlFor="teacher-kpk-place">
                    Место, программа (тема) КПК
                  </FieldLabel>
                  <input
                    id="teacher-kpk-place"
                    className="form-input"
                    value={form.kpkPlace}
                    onChange={(e) => updateField("kpkPlace", e.target.value)}
                    placeholder="ГБУ ДПО «ИРО ЧР», название программы"
                  />
                </div>
                <div className="form-group">
                  <FieldLabel htmlFor="teacher-kpk-year">
                    Год прохождения КПК
                  </FieldLabel>
                  <input
                    id="teacher-kpk-year"
                    className="form-input"
                    value={form.kpkYear}
                    onChange={(e) =>
                      updateField("kpkYear", digitsOnly(e.target.value, 4))
                    }
                    placeholder="2025"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                  />
                </div>
                {isCreate ? (
                  <div className="form-group">
                    <FieldLabel htmlFor="teacher-project" required>
                      Добавить в проект
                    </FieldLabel>
                    <select
                      id="teacher-project"
                      className="form-input"
                      value={form.projectId}
                      onChange={(e) => updateField("projectId", e.target.value)}
                      required
                    >
                      <option value="">Выберите проект</option>
                      {options?.projects.map((item) => (
                        <option key={String(item.id)} value={String(item.id)}>
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
