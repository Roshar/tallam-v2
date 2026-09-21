import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { EvaluatorIdentityFields } from "../../components/EvaluatorIdentityFields";
import { isEditorEmpty, MinimalEditor } from "../../components/MinimalEditor";
import {
  FULL_GROUPS,
  METHOD_GROUPS,
  flattenCriteriaGroups,
  type CriterionDef,
} from "../../data/evaluationCriteria";
import type {
  EvaluationCardType,
  ProjectTeacherProfileResponse,
} from "../../types/school";

const CLASS_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 1);
const LITER_OPTIONS = ["", "А", "Б", "В", "Г", "Д"];

const EVALUATION_DATE_MIN = "2000-01-01";
const EVALUATION_DATE_MAX = "2100-12-31";
const EVALUATION_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidEvaluationDate(value: string): boolean {
  if (!EVALUATION_DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return value >= EVALUATION_DATE_MIN && value <= EVALUATION_DATE_MAX;
}

function emptyScores(criteria: CriterionDef[]): Record<string, string> {
  return Object.fromEntries(criteria.map((item) => [item.key, ""]));
}

export function EvaluateFormPage() {
  const { teacherId = "", cardType = "method" } = useParams();
  const navigate = useNavigate();
  const type: EvaluationCardType = cardType === "full" ? "full" : "method";
  const groups = type === "full" ? FULL_GROUPS : METHOD_GROUPS;
  const criteria = useMemo(() => flattenCriteriaGroups(groups), [groups]);

  const [profile, setProfile] = useState<ProjectTeacherProfileResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hintItem, setHintItem] = useState<CriterionDef | null>(null);

  const [disciplineId, setDisciplineId] = useState("");
  const [classId, setClassId] = useState("");
  const [literClass, setLiterClass] = useState("");
  const [sourceId, setSourceId] = useState("2");
  const [dateCreate, setDateCreate] = useState(todayIso());
  const [thema, setThema] = useState("");
  const [sourceFio, setSourceFio] = useState("");
  const [positionName, setPositionName] = useState("");
  const [sourceWorkplace, setSourceWorkplace] = useState("");
  const [commentHtml, setCommentHtml] = useState("");
  const [scores, setScores] = useState<Record<string, string>>(() =>
    emptyScores(criteria),
  );

  useEffect(() => {
    setScores(emptyScores(criteria));
  }, [criteria]);

  useEffect(() => {
    if (!teacherId) {
      setError("Не указан учитель");
      setLoading(false);
      return;
    }

    api
      .schoolLessonAnalysisTeacher(teacherId)
      .then((data) => {
        setProfile(data);
        setSourceWorkplace(data.schoolName);
        if (data.filters.disciplines[0]) {
          setDisciplineId(String(data.filters.disciplines[0].id));
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [teacherId]);

  const isExternal = sourceId === "1";
  const wantsComment = !isEditorEmpty(commentHtml);
  const needsEvaluatorIdentity = isExternal || wantsComment;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const missing = criteria.find((item) => scores[item.key] === "");
    if (missing) {
      setError(`Укажите оценку: ${missing.code}. ${missing.title}`);
      return;
    }

    if (!isValidEvaluationDate(dateCreate)) {
      setError("Укажите корректную дату урока");
      return;
    }

    if (
      needsEvaluatorIdentity &&
      (!sourceFio.trim() || !positionName.trim() || !sourceWorkplace.trim())
    ) {
      setError("Укажите ФИО, должность и место работы оценивающего");
      return;
    }

    setSubmitting(true);
    try {
      await api.createLessonAnalysisEvaluation(teacherId, {
        cardType: type,
        disciplineId: Number(disciplineId),
        classId: Number(classId),
        literClass: literClass || undefined,
        sourceId: Number(sourceId),
        dateCreate,
        thema: thema.trim(),
        sourceFio: needsEvaluatorIdentity ? sourceFio.trim() : undefined,
        positionName: needsEvaluatorIdentity ? positionName.trim() : undefined,
        sourceWorkplace: needsEvaluatorIdentity
          ? sourceWorkplace.trim()
          : undefined,
        commentHtml: wantsComment ? commentHtml : undefined,
        scores: Object.fromEntries(
          Object.entries(scores).map(([key, value]) => [key, Number(value)]),
        ),
      });

      navigate(`/school/lesson-analysis/teachers/${teacherId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="evaluate-page">
        <p className="page-subtitle">Загрузка формы...</p>
      </div>
    );
  }

  return (
    <div className="evaluate-page">
      <div className="evaluate-nav">
        <Link
          to={`/school/lesson-analysis/teachers/${teacherId}/evaluate`}
          className="teacher-profile__back"
        >
          ← Вернуться к выбору карты
        </Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <form className="evaluate-form" onSubmit={handleSubmit}>
        <section className="evaluate-meta">
          <h2 className="evaluate-meta__title">Оценить урок</h2>
          {profile ? (
            <h3 className="evaluate-meta__fio">
              ФИО: {profile.teacher.fullName}
            </h3>
          ) : null}

          {profile && profile.filters.disciplines.length === 0 ? (
            <div className="alert alert-error">
              У этого работника не выбран предмет. Откройте карточку в базе и
              отметьте предмет или «Администрация». Без предмета оценку добавить
              нельзя.
            </div>
          ) : null}

          <div className="evaluate-meta__fields">
            <div className="form-group">
              <select
                className="form-input"
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value)}
                required
                aria-label="Предмет"
              >
                <option value="">Нет предмета</option>
                {profile?.filters.disciplines.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="evaluate-meta__row">
              <div className="form-group">
                <select
                  className="form-input"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  required
                  aria-label="Класс"
                >
                  <option value="">Выберите класс</option>
                  {CLASS_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value} класс
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <select
                  className="form-input"
                  value={literClass}
                  onChange={(e) => setLiterClass(e.target.value)}
                  aria-label="Литера"
                >
                  <option value="">Выбрать литер (при наличии)</option>
                  {LITER_OPTIONS.filter(Boolean).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="evaluate-meta__row">
              <div className="form-group">
                <select
                  className="form-input"
                  value={sourceId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSourceId(next);
                    const schoolName = profile?.schoolName ?? "";
                    if (next === "2") {
                      setSourceWorkplace(schoolName);
                    } else if (sourceWorkplace === schoolName) {
                      setSourceWorkplace("");
                    }
                  }}
                  required
                  aria-label="Тип оценки"
                >
                  <option value="2">Внутришкольная оценка</option>
                  <option value="1">Внешняя оценка</option>
                </select>
              </div>
              <div className="form-group">
                <input
                  className="form-input"
                  type="date"
                  value={dateCreate}
                  min={EVALUATION_DATE_MIN}
                  max={EVALUATION_DATE_MAX}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (!next || isValidEvaluationDate(next)) {
                      setDateCreate(next);
                    }
                  }}
                  required
                  aria-label="Дата"
                />
              </div>
            </div>

            <div className="evaluate-meta__topic">
              <label className="evaluate-meta__topic-label" htmlFor="thema">
                Тема урока:
              </label>
              <input
                id="thema"
                className="form-input"
                value={thema}
                onChange={(e) => setThema(e.target.value)}
                placeholder="Напишите тему урока"
                required
              />
            </div>

            {isExternal ? (
              <EvaluatorIdentityFields
                fio={sourceFio}
                position={positionName}
                workplace={sourceWorkplace}
                onFioChange={setSourceFio}
                onPositionChange={setPositionName}
                onWorkplaceChange={setSourceWorkplace}
              />
            ) : null}
          </div>
        </section>

        <div className="evaluate-table-wrap">
          <table className="evaluate-table">
            <colgroup>
              <col />
              <col className="evaluate-table__col-score" />
            </colgroup>
            <thead>
              <tr>
                <th className="evaluate-table__label">Виды компетенций</th>
                <th className="evaluate-table__score">Оценка в баллах</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.id}>
                  <tr className="evaluate-table__group">
                    <td className="evaluate-table__label">{group.title}</td>
                    <td className="evaluate-table__score">
                      {group.maxScoreLabel}
                    </td>
                  </tr>

                  {group.subsections.map((section) => (
                    <Fragment key={`${group.id}-${section.id}`}>
                      {section.title ? (
                        <tr className="evaluate-table__subsection">
                          <td className="evaluate-table__label" colSpan={2}>
                            {section.title}
                          </td>
                        </tr>
                      ) : null}

                      {section.items.map((item) => (
                        <tr key={item.key} className="evaluate-table__item">
                          <td className="evaluate-table__label">
                            <div className="evaluate-table__criterion">
                              <span>
                                {item.code}. {item.title}
                              </span>
                              <button
                                type="button"
                                className="evaluate-hint-btn"
                                aria-label={`Подсказка по критерию ${item.code}`}
                                title="Критерии оценивания"
                                onClick={() => setHintItem(item)}
                              >
                                ?
                              </button>
                            </div>
                          </td>
                          <td className="evaluate-table__score">
                            <select
                              className="form-input evaluate-table__select"
                              value={scores[item.key] ?? ""}
                              onChange={(e) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [item.key]: e.target.value,
                                }))
                              }
                              required
                              aria-label={`Оценка ${item.code}`}
                            >
                              <option value="">Выбрать</option>
                              {item.options.map((option) => (
                                <option
                                  key={`${item.key}-${option.value}-${option.label}`}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <section className="evaluate-extras">
          <h3 id="evaluate-comment-title" className="evaluate-extras__title">
            Комментарий оценивающего
          </h3>
          <p className="evaluate-extras__hint">
            Необязательно. Можно кратко отметить особенности урока. Комментарий
            также будет включён в методические рекомендации к этому уроку.
          </p>
          <MinimalEditor
            value={commentHtml}
            onChange={setCommentHtml}
            labelledBy="evaluate-comment-title"
            placeholder="Введите комментарий или дополнение к оценке"
          />
          {!isExternal && wantsComment ? (
            <EvaluatorIdentityFields
              fio={sourceFio}
              position={positionName}
              workplace={sourceWorkplace}
              hint="Для комментария укажите ФИО, должность и место работы."
              onFioChange={setSourceFio}
              onPositionChange={setPositionName}
              onWorkplaceChange={setSourceWorkplace}
            />
          ) : null}
        </section>

        <div className="evaluate-form__actions">
          <Link
            to={`/school/lesson-analysis/teachers/${teacherId}`}
            className="btn btn-ghost"
          >
            Отмена
          </Link>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Сохранение..." : "Сохранить оценку"}
          </button>
        </div>
      </form>

      {hintItem ? (
        <div
          className="evaluate-hint-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evaluate-hint-title"
          onClick={() => setHintItem(null)}
        >
          <div
            className="evaluate-hint-modal__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="evaluate-hint-modal__head">
              <h4 id="evaluate-hint-title">
                Критерии оценивания действий учителя
              </h4>
              <button
                type="button"
                className="evaluate-hint-modal__close"
                aria-label="Закрыть"
                onClick={() => setHintItem(null)}
              >
                ×
              </button>
            </div>
            <div className="evaluate-hint-modal__body">
              <p className="evaluate-hint-modal__criterion">
                <strong>
                  {hintItem.code}. {hintItem.title}
                </strong>
              </p>
              {hintItem.hint ? (
                <div
                  className="evaluate-hint-modal__content"
                  dangerouslySetInnerHTML={{ __html: hintItem.hint }}
                />
              ) : (
                <p className="evaluate-hint-modal__placeholder">
                  Краткие пояснения по баллам для этого пункта появятся здесь.
                </p>
              )}
            </div>
            <div className="evaluate-hint-modal__footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setHintItem(null)}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
