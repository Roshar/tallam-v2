import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { TablePagination } from "../../components/TablePagination";
import type { WorkersPageLimit } from "../../types/school";
import type { VacancyFiltersMeta, VacancyListItem } from "../../types/vacancy";
import {
  VACANCY_STATUS_LABELS,
  formatHours,
  formatVacancyDate,
} from "../../types/vacancy";

type Scope = "others" | "mine";

const INTRO =
  "Публикуйте вакансии вашей школы и просматривайте предложения других школ. Все вакансии доступны только пользователям системы «Таллам» и не публикуются в открытом доступе.";

function statusText(item: VacancyListItem) {
  if (item.expired && item.status === "ACTIVE") return "Срок публикации истёк";
  return VACANCY_STATUS_LABELS[item.status];
}

export function VacanciesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scope: Scope = searchParams.get("tab") === "others" ? "others" : "mine";
  const [meta, setMeta] = useState<VacancyFiltersMeta>({
    areas: [],
    subjects: [],
    positions: [],
    disciplines: [],
  });
  const [items, setItems] = useState<VacancyListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<WorkersPageLimit>(20);
  const [total, setTotal] = useState(0);
  const [subjectInput, setSubjectInput] = useState("");
  const [subject, setSubject] = useState("");
  const [schoolInput, setSchoolInput] = useState("");
  const [school, setSchool] = useState("");
  const [salaryInput, setSalaryInput] = useState("");
  const [salaryFrom, setSalaryFrom] = useState("");
  const [hoursInput, setHoursInput] = useState("");
  const [hoursFrom, setHoursFrom] = useState("");
  const [areaId, setAreaId] = useState(0);
  const [status, setStatus] = useState(scope === "mine" ? "any" : "actual");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closingId, setClosingId] = useState<number | null>(null);

  useEffect(() => {
    api
      .vacancyFilters()
      .then(setMeta)
      .catch(() => {
        /* список откроется и без подсказок фильтра */
      });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSubject(subjectInput.trim());
      setSchool(schoolInput.trim());
      setSalaryFrom(salaryInput.trim());
      setHoursFrom(hoursInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [subjectInput, schoolInput, salaryInput, hoursInput]);

  useEffect(() => {
    setStatus(scope === "mine" ? "any" : "actual");
    setPage(1);
  }, [scope]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .vacancies({
        scope,
        subject,
        school,
        salaryFrom,
        hoursFrom,
        areaId,
        status,
        page,
        limit,
      })
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setTotal(data.pagination.total);
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
  }, [scope, subject, school, salaryFrom, hoursFrom, areaId, status, page, limit]);

  function openTab(next: Scope) {
    const params = new URLSearchParams(searchParams);
    if (next === "others") params.set("tab", "others");
    else params.delete("tab");
    setSearchParams(params);
  }

  async function closeItem(item: VacancyListItem) {
    if (!window.confirm(`Закрыть вакансию «${item.position}»?`)) return;
    setClosingId(item.id);
    setError("");
    try {
      await api.closeVacancy(item.id);
      const data = await api.vacancies({
        scope,
        subject,
        school,
        salaryFrom,
        hoursFrom,
        areaId,
        status,
        page,
        limit,
      });
      setItems(data.items);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось закрыть вакансию");
    } finally {
      setClosingId(null);
    }
  }

  return (
    <div className="card vacancies-page">
      <div className="card-body">
        <header className="vacancies-header">
          <div>
            <h2 className="page-title">Вакансии</h2>
            <p className="page-subtitle">{INTRO}</p>
          </div>
          <Link to="/school/vacancies/new" className="btn btn-primary">
            Создать вакансию
          </Link>
        </header>

        <div className="vacancies-tabs" role="tablist" aria-label="Списки вакансий">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "mine"}
            className={`vacancies-tabs__item${scope === "mine" ? " active" : ""}`}
            onClick={() => openTab("mine")}
          >
            Вакансии школы
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "others"}
            className={`vacancies-tabs__item${scope === "others" ? " active" : ""}`}
            onClick={() => openTab("others")}
          >
            Вакансии других школ
          </button>
        </div>

        <div className="vacancies-filters">
          <label className="form-group">
            <span className="form-label">Предмет</span>
            <input
              className="form-input"
              list="vacancy-subjects"
              value={subjectInput}
              onChange={(event) => setSubjectInput(event.target.value)}
              placeholder="Например, математика"
            />
            <datalist id="vacancy-subjects">
              {meta.disciplines.map((item) => (
                <option key={item.id} value={item.title} />
              ))}
            </datalist>
          </label>
          <label className="form-group">
            <span className="form-label">Район</span>
            <select
              className="form-input"
              value={areaId}
              onChange={(event) => {
                setAreaId(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={0}>Все районы</option>
              {meta.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.title}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Школа</span>
            <input
              className="form-input"
              value={schoolInput}
              onChange={(event) => setSchoolInput(event.target.value)}
              placeholder="Название школы"
            />
          </label>
          <label className="form-group">
            <span className="form-label">Зарплата от, ₽</span>
            <input
              className="form-input"
              inputMode="numeric"
              value={salaryInput}
              onChange={(event) => setSalaryInput(event.target.value.replace(/[^\d]/g, ""))}
            />
          </label>
          <label className="form-group">
            <span className="form-label">Нагрузка, ч/нед от</span>
            <input
              className="form-input"
              inputMode="decimal"
              value={hoursInput}
              onChange={(event) => setHoursInput(event.target.value.replace(/[^\d.,]/g, ""))}
            />
          </label>
          <label className="form-group">
            <span className="form-label">Статус</span>
            <select
              className="form-input"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {scope === "mine" ? (
                <>
                  <option value="any">Все</option>
                  <option value="DRAFT">Черновики</option>
                  <option value="ACTIVE">Опубликованные</option>
                  <option value="CLOSED">Закрытые</option>
                </>
              ) : (
                <>
                  <option value="actual">Актуальные</option>
                  <option value="closed">Закрытые</option>
                  <option value="any">Все</option>
                </>
              )}
            </select>
          </label>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        {loading ? (
          <p className="page-subtitle">Загрузка вакансий...</p>
        ) : items.length === 0 ? (
          <p className="page-subtitle vacancies-empty">
            {scope === "mine"
              ? "У вашей школы пока нет вакансий."
              : "Вакансий других школ по этим условиям нет."}
          </p>
        ) : (
          <div className="vacancy-list">
            {items.map((item) => (
              <article key={item.id} className="vacancy-card">
                <div className="vacancy-card__top">
                  <h3>
                    <Link to={`/school/vacancies/${item.id}`}>{item.position}</Link>
                  </h3>
                  <span className={`vacancy-status vacancy-status--${item.expired ? "expired" : item.status.toLowerCase()}`}>
                    {statusText(item)}
                  </span>
                </div>
                <p className="vacancy-card__school">
                  {item.schoolName}
                  {item.areaName ? `, ${item.areaName}` : ""}
                </p>
                <p className="vacancy-card__subject">{item.subject}</p>
                <ul className="vacancy-card__facts">
                  {item.salaryLabel ? <li>{item.salaryLabel}</li> : null}
                  {item.hoursPerWeek !== null ? <li>{formatHours(item.hoursPerWeek)}</li> : null}
                  <li>
                    {item.publishedOn
                      ? `Опубликована ${formatVacancyDate(item.publishedOn)}`
                      : `Создана ${formatVacancyDate(item.createdOn)}`}
                  </li>
                </ul>
                {item.isOwn ? (
                  <div className="vacancy-card__actions">
                    <Link
                      className="btn btn-outline"
                      to={`/school/vacancies/${item.id}/edit`}
                    >
                      Редактировать
                    </Link>
                    {item.status !== "CLOSED" ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={closingId === item.id}
                        onClick={() => void closeItem(item)}
                      >
                        {closingId === item.id ? "Закрытие..." : "Закрыть"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <TablePagination
          page={page}
          limit={limit}
          total={total}
          disabled={loading}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
