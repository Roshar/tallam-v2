import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { TeacherDossier } from "../../types/dossier";

const DEADLINE_CLASS: Record<string, string> = {
  ok: "dossier__deadline dossier__deadline--ok",
  due_soon: "dossier__deadline dossier__deadline--soon",
  overdue: "dossier__deadline dossier__deadline--overdue",
  unknown: "dossier__deadline dossier__deadline--unknown",
};

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function TeacherDossierPage() {
  const { teacherId = "" } = useParams();
  const [dossier, setDossier] = useState<TeacherDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .teacherDossier(teacherId)
      .then((data) => {
        if (!cancelled) setDossier(data.dossier);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="page-subtitle">Загрузка…</p>
        </div>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-error">{error || "Работник не найден"}</div>
          <Link className="btn btn-outline" to="/school/workers">
            Вернуться к базе работников
          </Link>
        </div>
      </div>
    );
  }

  const { identity, evaluation, training, deadlines, dataQuality } = dossier;
  const subtitleParts = [
    identity.position,
    identity.category,
    identity.teachingExperience !== null
      ? `стаж ${identity.teachingExperience} ${plural(
          identity.teachingExperience,
          "год",
          "года",
          "лет",
        )}`
      : null,
  ].filter(Boolean);

  return (
    <div className="dossier">
      <div className="card dossier__header-card">
        <div className="card-body">
          <div className="dossier__header">
            <div>
              <h2 className="page-title">{identity.fullName}</h2>
              <p className="page-subtitle">
                {subtitleParts.join(" · ")}
                {identity.subjects.length > 0 && (
                  <> · {identity.subjects.join(", ")}</>
                )}
              </p>
            </div>
            <div className="dossier__header-actions">
              <Link
                className="btn btn-outline btn-sm"
                to={`/school/workers/${identity.id}`}
              >
                Кадровая карточка
              </Link>
              <Link
                className="btn btn-outline btn-sm"
                to={`/school/lesson-analysis/teachers/${identity.id}`}
              >
                Проект «Анализ урока»
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="dossier__grid">
        <div className="dossier__main">
          <section className="card">
            <div className="card-body">
              <h3 className="dossier__section-title">Оценки</h3>
              <div className="dossier__cards">
                <EvaluationCard
                  title="Методическая карта"
                  teacherId={identity.id}
                  block={evaluation.method}
                />
                <EvaluationCard
                  title="Комплексная карта"
                  teacherId={identity.id}
                  block={evaluation.full}
                />
              </div>
              {evaluation.total === 0 && (
                <p className="dossier__empty">
                  Оценок пока нет.{" "}
                  <Link
                    to={`/school/lesson-analysis/teachers/${identity.id}/evaluate`}
                  >
                    Провести анализ урока
                  </Link>
                </p>
              )}
              {evaluation.total > 0 && (
                <p className="dossier__hint">
                  Всего {evaluation.total}{" "}
                  {plural(evaluation.total, "оценка", "оценки", "оценок")}
                  {evaluation.firstEvaluationDate && (
                    <>
                      {" "}
                      с{" "}
                      {evaluation.firstEvaluationDate
                        .split("-")
                        .reverse()
                        .join(".")}
                    </>
                  )}
                </p>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-body">
              <h3 className="dossier__section-title">Обучение</h3>
              {training.items.length === 0 ? (
                <p className="dossier__empty">
                  В системе нет данных о повышении квалификации.
                </p>
              ) : (
                <ul className="dossier__training">
                  {training.items.map((item, index) => (
                    <li key={`${item.rawYear ?? "year"}-${index}`}>
                      <span className="dossier__training-year">
                        {item.yearReliable ? item.year : "год не распознан"}
                      </span>
                      <span>{item.place ?? "место не указано"}</span>
                    </li>
                  ))}
                </ul>
              )}
              {training.hasUnreliableYears && (
                <p className="dossier__hint">
                  Часть годов записана свободным текстом и не учитывается в
                  расчёте сроков.
                </p>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-body">
              <h3 className="dossier__section-title">Наставничество</h3>
              <p className="dossier__empty">{dossier.mentoring.note}</p>
            </div>
          </section>

          <section className="card">
            <div className="card-body">
              <h3 className="dossier__section-title">Портфолио</h3>
              <p className="dossier__empty">{dossier.portfolio.note}</p>
            </div>
          </section>
        </div>

        <aside className="dossier__side">
          <section className="card">
            <div className="card-body">
              <h3 className="dossier__section-title">Обратить внимание</h3>
              <ul className="dossier__deadlines">
                {deadlines.map((deadline) => (
                  <li className={DEADLINE_CLASS[deadline.state]} key={deadline.kind}>
                    <span className="dossier__deadline-label">
                      {deadline.label}
                    </span>
                    <span className="dossier__deadline-detail">
                      {deadline.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card">
            <div className="card-body">
              <h3 className="dossier__section-title">
                Полнота карточки {dataQuality.score}%
              </h3>
              {dataQuality.missing.length === 0 ? (
                <p className="dossier__hint">Все основные поля заполнены.</p>
              ) : (
                <ul className="dossier__missing">
                  {dataQuality.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <Link
                className="btn btn-outline btn-sm dossier__fill"
                to={`/school/workers/${identity.id}`}
              >
                Дополнить карточку
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function EvaluationCard({
  title,
  teacherId,
  block,
}: {
  title: string;
  teacherId: string;
  block: { last: { dateLabel: string | null; percent: number } | null; count: number };
}) {
  if (!block.last) {
    return (
      <div className="dossier__eval dossier__eval--empty">
        <span className="dossier__eval-title">{title}</span>
        <span className="dossier__eval-empty">Нет оценок</span>
      </div>
    );
  }

  return (
    <div className="dossier__eval">
      <span className="dossier__eval-title">{title}</span>
      <span className="dossier__eval-value">{block.last.percent}%</span>
      <span className="dossier__eval-meta">
        {block.last.dateLabel} · всего {block.count}
      </span>
      <div className="dossier__eval-links">
        <Link
          className="dossier__link"
          to={`/school/lesson-analysis/teachers/${teacherId}`}
        >
          История и аналитика
        </Link>
      </div>
    </div>
  );
}
