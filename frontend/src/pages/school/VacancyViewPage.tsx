import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { VacancyDetail } from "../../types/vacancy";
import {
  EMPLOYMENT_TERM_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  SHIFT_LABELS,
  VACANCY_STATUS_LABELS,
  formatHours,
  formatRates,
  formatVacancyDate,
  yesNo,
} from "../../types/vacancy";

function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function VacancyViewPage() {
  const { vacancyId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<VacancyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .vacancy(Number(vacancyId))
      .then((data) => {
        if (active) setItem(data);
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
  }, [vacancyId]);

  async function closeVacancy() {
    if (!item) return;
    if (!window.confirm("Закрыть вакансию? Она пропадёт из актуального списка.")) return;
    setClosing(true);
    setError("");
    try {
      const closed = await api.closeVacancy(item.id);
      setItem(closed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось закрыть вакансию");
    } finally {
      setClosing(false);
    }
  }

  const backTo = item?.isOwn
    ? "/school/vacancies"
    : "/school/vacancies?tab=others";

  return (
    <div className="card">
      <div className="card-body">
        <Link to={backTo} className="teacher-profile__back">
          К списку вакансий
        </Link>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? (
          <p className="page-subtitle">Загрузка вакансии...</p>
        ) : !item ? null : (
          <article className="vacancy-view">
            <header className="vacancy-card__top">
              <h2 className="page-title">{item.position}</h2>
              <span
                className={`vacancy-status vacancy-status--${
                  item.expired ? "expired" : item.status.toLowerCase()
                }`}
              >
                {item.expired && item.status === "ACTIVE"
                  ? "Срок публикации истёк"
                  : VACANCY_STATUS_LABELS[item.status]}
              </span>
            </header>
            <p className="vacancy-card__school">
              {item.schoolName}
              {item.areaName ? `, ${item.areaName}` : ""}
            </p>
            <p className="vacancy-card__subject">{item.subject}</p>
            <p className="vacancy-view__description">{item.description}</p>

            <dl className="vacancy-view__facts">
              <Fact label="Зарплата" value={item.salaryLabel ?? ""} />
              <Fact label="Нагрузка" value={formatHours(item.hoursPerWeek)} />
              <Fact label="Ставки" value={formatRates(item.rateCount)} />
              <Fact label="Классы" value={item.grades ?? ""} />
              <Fact label="Смена" value={item.shift ? SHIFT_LABELS[item.shift] : ""} />
              <Fact
                label="Тип занятости"
                value={item.employmentType ? EMPLOYMENT_TYPE_LABELS[item.employmentType] : ""}
              />
              <Fact label="Совместительство" value={yesNo(item.partTime)} />
              <Fact
                label="Характер работы"
                value={item.employmentTerm ? EMPLOYMENT_TERM_LABELS[item.employmentTerm] : ""}
              />
              <Fact label="Дата выхода" value={formatVacancyDate(item.startDate)} />
              <Fact label="Классное руководство" value={yesNo(item.classGuidance)} />
              <Fact label="Желаемый стаж" value={item.desiredExperience ?? ""} />
              <Fact label="Образование" value={item.educationRequirements ?? ""} />
              <Fact label="Дополнительные условия" value={item.extraConditions ?? ""} />
              <Fact label="Контактное лицо" value={item.contactName ?? ""} />
              <Fact label="Телефон" value={item.contactPhone ?? ""} />
              <Fact label="Email" value={item.contactEmail ?? ""} />
              <Fact
                label="Срок публикации"
                value={formatVacancyDate(item.publishUntil)}
              />
              <Fact
                label="Дата публикации"
                value={
                  item.publishedOn
                    ? formatVacancyDate(item.publishedOn)
                    : formatVacancyDate(item.createdOn)
                }
              />
            </dl>

            {item.isOwn ? (
              <div className="vacancy-form__actions">
                <Link className="btn btn-primary" to={`/school/vacancies/${item.id}/edit`}>
                  Редактировать
                </Link>
                {item.status !== "CLOSED" ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={closing}
                    onClick={() => void closeVacancy()}
                  >
                    {closing ? "Закрытие..." : "Закрыть вакансию"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => navigate("/school/vacancies")}
                  >
                    К моим вакансиям
                  </button>
                )}
              </div>
            ) : null}
          </article>
        )}
      </div>
    </div>
  );
}
