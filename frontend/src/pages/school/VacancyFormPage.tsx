import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useSchool } from "../../context/SchoolContext";
import type {
  EmploymentTerm,
  EmploymentType,
  SalaryType,
  VacancyDetail,
  VacancyPayload,
  VacancyShift,
} from "../../types/vacancy";

interface CatalogOption {
  id: number;
  title: string;
}

type BoolValue = "" | "yes" | "no";

interface FormState {
  position: string;
  subjects: string[];
  description: string;
  salaryFrom: string;
  salaryTo: string;
  salaryType: "" | SalaryType;
  hoursPerWeek: string;
  rateCount: string;
  grades: string;
  shift: "" | VacancyShift;
  employmentType: "" | EmploymentType;
  partTime: BoolValue;
  employmentTerm: "" | EmploymentTerm;
  startDate: string;
  classGuidance: BoolValue;
  desiredExperience: string;
  educationRequirements: string;
  extraConditions: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  publishUntil: string;
}

const EMPTY: FormState = {
  position: "",
  subjects: [],
  description: "",
  salaryFrom: "",
  salaryTo: "",
  salaryType: "",
  hoursPerWeek: "",
  rateCount: "",
  grades: "",
  shift: "",
  employmentType: "",
  partTime: "",
  employmentTerm: "",
  startDate: "",
  classGuidance: "",
  desiredExperience: "",
  educationRequirements: "",
  extraConditions: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  publishUntil: "",
};

function boolToForm(value: boolean | null): BoolValue {
  if (value === null) return "";
  return value ? "yes" : "no";
}

function formToBool(value: BoolValue): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function numberOrNull(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function fromDetail(item: VacancyDetail): FormState {
  return {
    position: item.position,
    subjects: item.subjects.length ? item.subjects : item.subject ? [item.subject] : [],
    description: item.description,
    salaryFrom: item.salaryFrom === null ? "" : String(item.salaryFrom),
    salaryTo: item.salaryTo === null ? "" : String(item.salaryTo),
    salaryType: item.salaryType ?? "",
    hoursPerWeek: item.hoursPerWeek === null ? "" : String(item.hoursPerWeek),
    rateCount: item.rateCount === null ? "" : String(item.rateCount),
    grades: item.grades ?? "",
    shift: item.shift ?? "",
    employmentType: item.employmentType ?? "",
    partTime: boolToForm(item.partTime),
    employmentTerm: item.employmentTerm ?? "",
    startDate: item.startDate ?? "",
    classGuidance: boolToForm(item.classGuidance),
    desiredExperience: item.desiredExperience ?? "",
    educationRequirements: item.educationRequirements ?? "",
    extraConditions: item.extraConditions ?? "",
    contactName: item.contactName ?? "",
    contactPhone: item.contactPhone ?? "",
    contactEmail: item.contactEmail ?? "",
    publishUntil: item.publishUntil ?? "",
  };
}

function withCurrentOption(options: CatalogOption[], current: string) {
  if (!current || options.some((item) => item.title === current)) return options;
  return [{ id: 0, title: current }, ...options];
}

function subjectOptions(options: CatalogOption[], selected: string[]) {
  const extra = selected
    .filter((title) => title && !options.some((item) => item.title === title))
    .map((title) => ({ id: 0, title }));
  return [...extra, ...options];
}

function toPayload(form: FormState, status: "DRAFT" | "ACTIVE"): VacancyPayload {
  return {
    position: form.position,
    subjects: form.subjects,
    description: form.description,
    salaryFrom: numberOrNull(form.salaryFrom),
    salaryTo: numberOrNull(form.salaryTo),
    salaryType: form.salaryType || null,
    hoursPerWeek: numberOrNull(form.hoursPerWeek),
    rateCount: numberOrNull(form.rateCount),
    grades: form.grades,
    shift: form.shift || null,
    employmentType: form.employmentType || null,
    partTime: formToBool(form.partTime),
    employmentTerm: form.employmentTerm || null,
    startDate: form.startDate || null,
    classGuidance: formToBool(form.classGuidance),
    desiredExperience: form.desiredExperience,
    educationRequirements: form.educationRequirements,
    extraConditions: form.extraConditions,
    contactName: form.contactName,
    contactPhone: form.contactPhone,
    contactEmail: form.contactEmail,
    publishUntil: form.publishUntil || null,
    status,
  };
}

export function VacancyFormPage() {
  const { vacancyId } = useParams();
  const editing = Boolean(vacancyId);
  const navigate = useNavigate();
  const { profile } = useSchool();
  const [positions, setPositions] = useState<CatalogOption[]>([]);
  const [disciplines, setDisciplines] = useState<CatalogOption[]>([]);
  const [subjectQuery, setSubjectQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [currentStatus, setCurrentStatus] = useState<"DRAFT" | "ACTIVE" | "CLOSED" | null>(
    null,
  );
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState<"DRAFT" | "ACTIVE" | "CLOSED" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .vacancyFilters()
      .then((meta) => {
        setPositions(meta.positions);
        setDisciplines(meta.disciplines);
      })
      .catch(() => {
        /* списки должностей и предметов подставятся, когда справочник ответит */
      });
  }, []);

  useEffect(() => {
    if (!vacancyId) {
      setSchoolName(profile?.schoolName ?? "");
      return;
    }
    let active = true;
    setLoading(true);
    api
      .vacancy(Number(vacancyId))
      .then((item) => {
        if (!active) return;
        if (!item.isOwn) {
          navigate(`/school/vacancies/${item.id}`, { replace: true });
          return;
        }
        setForm(fromDetail(item));
        setCurrentStatus(item.status);
        setSchoolName(item.schoolName);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [vacancyId, navigate, profile?.schoolName]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSubject(title: string) {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.includes(title)
        ? current.subjects.filter((item) => item !== title)
        : [...current.subjects, title],
    }));
  }

  async function submit(status: "DRAFT" | "ACTIVE") {
    setError("");
    if (!form.subjects.length) {
      setError("Укажите хотя бы один предмет или направление");
      return;
    }
    setSaving(status);
    try {
      const payload = toPayload(form, status);
      const saved = editing
        ? await api.updateVacancy(Number(vacancyId), payload)
        : await api.createVacancy(payload);
      navigate(`/school/vacancies/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить вакансию");
    } finally {
      setSaving(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await submit(currentStatus === "ACTIVE" ? "ACTIVE" : "DRAFT");
  }

  async function closeVacancy() {
    if (!vacancyId) return;
    if (!window.confirm("Закрыть вакансию? Она пропадёт из актуального списка.")) return;
    setSaving("CLOSED");
    setError("");
    try {
      await api.closeVacancy(Number(vacancyId));
      navigate("/school/vacancies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось закрыть вакансию");
    } finally {
      setSaving(null);
    }
  }

  const lockedActive = currentStatus === "ACTIVE";

  return (
    <div className="card">
      <div className="card-body">
        <Link to="/school/vacancies" className="teacher-profile__back">
          К вакансиям школы
        </Link>
        <header className="vacancies-header">
          <div>
            <h2 className="page-title">
              {editing ? "Редактирование вакансии" : "Новая вакансия"}
            </h2>
            <p className="page-subtitle">
              Школа подставляется из вашего кабинета и в вакансии не меняется.
            </p>
          </div>
        </header>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? (
          <p className="page-subtitle">Загрузка вакансии...</p>
        ) : (
          <form className="vacancy-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="form-grid">
              <div className="form-group form-group--wide">
                <span className="form-label">Школа</span>
                <p className="vacancy-form__school">{schoolName || "Ваша школа"}</p>
              </div>
              <label className="form-group">
                <span className="form-label">
                  Должность <span className="form-required">*</span>
                </span>
                <select
                  className="form-input"
                  required
                  value={form.position}
                  onChange={(event) => update("position", event.target.value)}
                >
                  <option value="">Выберите должность</option>
                  {withCurrentOption(positions, form.position).map((item) => (
                    <option key={`${item.id}-${item.title}`} value={item.title}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-group form-group--wide">
                <span className="form-label">
                  Предмет или направление <span className="form-required">*</span>
                </span>
                <input
                  className="form-input vacancy-subjects__search"
                  type="search"
                  placeholder="Найти предмет"
                  value={subjectQuery}
                  onChange={(event) => setSubjectQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                />
                <div className="vacancy-subjects" role="group" aria-label="Предмет или направление">
                  {subjectOptions(disciplines, form.subjects)
                    .filter((item) => {
                      const query = subjectQuery.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        item.title.toLowerCase().includes(query) ||
                        form.subjects.includes(item.title)
                      );
                    })
                    .map((item) => (
                      <label key={`${item.id}-${item.title}`} className="vacancy-subjects__item">
                        <input
                          type="checkbox"
                          checked={form.subjects.includes(item.title)}
                          onChange={() => toggleSubject(item.title)}
                        />
                        <span>{item.title}</span>
                      </label>
                    ))}
                </div>
                <p className="vacancy-subjects__hint">
                  {form.subjects.length
                    ? `Выбрано: ${form.subjects.join(", ")}`
                    : "Можно выбрать несколько предметов"}
                </p>
              </div>
              <label className="form-group form-group--wide">
                <span className="form-label">
                  Описание <span className="form-required">*</span>
                </span>
                <textarea
                  className="form-input vacancy-form__text"
                  required
                  rows={5}
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </label>
            </div>

            <fieldset className="vacancy-form__extra">
              <legend>
                Дополнительные условия
                <span className="vacancy-form__optional">(необязательные поля)</span>
              </legend>
              <div className="form-grid">
                <label className="form-group">
                  <span className="form-label">Зарплата от, ₽</span>
                  <input
                    className="form-input"
                    inputMode="numeric"
                    value={form.salaryFrom}
                    onChange={(event) =>
                      update("salaryFrom", event.target.value.replace(/[^\d]/g, ""))
                    }
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Зарплата до, ₽</span>
                  <input
                    className="form-input"
                    inputMode="numeric"
                    value={form.salaryTo}
                    onChange={(event) =>
                      update("salaryTo", event.target.value.replace(/[^\d]/g, ""))
                    }
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Как указана зарплата</span>
                  <select
                    className="form-input"
                    value={form.salaryType}
                    onChange={(event) =>
                      update("salaryType", event.target.value as FormState["salaryType"])
                    }
                  >
                    <option value="">Не указано</option>
                    <option value="net">На руки</option>
                    <option value="gross">До вычета налогов</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Часов в неделю</span>
                  <input
                    className="form-input"
                    inputMode="decimal"
                    value={form.hoursPerWeek}
                    onChange={(event) => update("hoursPerWeek", event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Количество ставок</span>
                  <input
                    className="form-input"
                    inputMode="decimal"
                    value={form.rateCount}
                    onChange={(event) => update("rateCount", event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Классы</span>
                  <input
                    className="form-input"
                    value={form.grades}
                    onChange={(event) => update("grades", event.target.value)}
                    placeholder="Например, 5-9"
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Смена</span>
                  <select
                    className="form-input"
                    value={form.shift}
                    onChange={(event) => update("shift", event.target.value as FormState["shift"])}
                  >
                    <option value="">Не указано</option>
                    <option value="first">Первая смена</option>
                    <option value="second">Вторая смена</option>
                    <option value="any">Любая смена</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Тип занятости</span>
                  <select
                    className="form-input"
                    value={form.employmentType}
                    onChange={(event) =>
                      update("employmentType", event.target.value as FormState["employmentType"])
                    }
                  >
                    <option value="">Не указано</option>
                    <option value="full">Полная занятость</option>
                    <option value="partial">Неполная занятость</option>
                    <option value="hourly">Почасовая</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Совместительство</span>
                  <select
                    className="form-input"
                    value={form.partTime}
                    onChange={(event) => update("partTime", event.target.value as BoolValue)}
                  >
                    <option value="">Не указано</option>
                    <option value="yes">Да</option>
                    <option value="no">Нет</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Характер работы</span>
                  <select
                    className="form-input"
                    value={form.employmentTerm}
                    onChange={(event) =>
                      update("employmentTerm", event.target.value as FormState["employmentTerm"])
                    }
                  >
                    <option value="">Не указано</option>
                    <option value="permanent">Постоянная</option>
                    <option value="temporary">Временная</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Дата выхода</span>
                  <input
                    className="form-input"
                    type="date"
                    value={form.startDate}
                    onChange={(event) => update("startDate", event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Классное руководство</span>
                  <select
                    className="form-input"
                    value={form.classGuidance}
                    onChange={(event) =>
                      update("classGuidance", event.target.value as BoolValue)
                    }
                  >
                    <option value="">Не указано</option>
                    <option value="yes">Да</option>
                    <option value="no">Нет</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Желаемый стаж</span>
                  <input
                    className="form-input"
                    value={form.desiredExperience}
                    onChange={(event) => update("desiredExperience", event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Срок публикации</span>
                  <input
                    className="form-input"
                    type="date"
                    value={form.publishUntil}
                    onChange={(event) => update("publishUntil", event.target.value)}
                  />
                </label>
                <label className="form-group form-group--wide">
                  <span className="form-label">Требования к образованию</span>
                  <textarea
                    className="form-input vacancy-form__text"
                    rows={3}
                    value={form.educationRequirements}
                    onChange={(event) => update("educationRequirements", event.target.value)}
                  />
                </label>
                <label className="form-group form-group--wide">
                  <span className="form-label">Дополнительные условия</span>
                  <textarea
                    className="form-input vacancy-form__text"
                    rows={3}
                    value={form.extraConditions}
                    onChange={(event) => update("extraConditions", event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Контактное лицо</span>
                  <input
                    className="form-input"
                    value={form.contactName}
                    onChange={(event) => update("contactName", event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Телефон</span>
                  <input
                    className="form-input"
                    value={form.contactPhone}
                    onChange={(event) => update("contactPhone", event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Email</span>
                  <input
                    className="form-input"
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) => update("contactEmail", event.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            <div className="vacancy-form__actions">
              {lockedActive ? (
                <button className="btn btn-primary" type="submit" disabled={saving !== null}>
                  {saving === "ACTIVE" ? "Сохранение..." : "Сохранить"}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={saving !== null}
                    onClick={() => void submit("DRAFT")}
                  >
                    {saving === "DRAFT" ? "Сохранение..." : "Сохранить черновик"}
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={saving !== null}
                    onClick={() => void submit("ACTIVE")}
                  >
                    {saving === "ACTIVE" ? "Публикация..." : "Опубликовать"}
                  </button>
                </>
              )}
              {lockedActive ? (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void closeVacancy()}
                >
                  {saving === "CLOSED" ? "Закрытие..." : "Закрыть вакансию"}
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
