import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { MinimalEditor } from "../../components/MinimalEditor";
import {
  FULL_GROUPS,
  METHOD_GROUPS,
  type CriteriaGroup,
} from "../../data/evaluationCriteria";
import type { EvaluationDetail } from "../../types/school";

export function EvaluationViewPage() {
  const { teacherId = "", cardId = "" } = useParams();
  const navigate = useNavigate();
  const numericCardId = Number(cardId);
  const [detail, setDetail] = useState<EvaluationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState("");
  const [emailError, setEmailError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentEditOpen, setCommentEditOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState("");

  useEffect(() => {
    if (!teacherId || !Number.isInteger(numericCardId) || numericCardId <= 0) {
      setError("Некорректная оценка");
      setLoading(false);
      return;
    }

    api
      .schoolLessonAnalysisEvaluation(teacherId, numericCardId)
      .then((data) => {
        setDetail(data);
        setEmail(data.teacher.email ?? "");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [teacherId, numericCardId]);

  const groups: CriteriaGroup[] = useMemo(
    () => (detail?.cardType === "full" ? FULL_GROUPS : METHOD_GROUPS),
    [detail?.cardType],
  );

  function openCommentEditor() {
    setCommentError("");
    setCommentDraft(detail?.commentHtml ?? "");
    setCommentEditOpen(true);
  }

  async function saveComment() {
    if (!detail) return;
    setCommentSaving(true);
    setCommentError("");
    try {
      const result = await api.updateLessonAnalysisEvaluationComment(
        teacherId,
        detail.id,
        commentDraft,
      );
      setDetail({ ...detail, commentHtml: result.commentHtml });
      setCommentOpen(Boolean(result.commentHtml));
      setCommentEditOpen(false);
      setNotice(
        result.commentHtml
          ? "Комментарий сохранён и будет включён в методические рекомендации"
          : "Комментарий удалён",
      );
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Не удалось сохранить комментарий",
      );
    } finally {
      setCommentSaving(false);
    }
  }

  function openEmailModal() {
    setEmailError("");
    setEmail(detail?.teacher.email ?? "");
    setEmailOpen(true);
  }

  async function downloadRecommendations() {
    if (!detail) return;
    setError("");
    setDownloading(true);
    try {
      await api.downloadEvaluationRecommendations(teacherId, detail.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось скачать рекомендации",
      );
    } finally {
      setDownloading(false);
    }
  }

  async function sendEmail() {
    if (!detail) return;
    setSending(true);
    setEmailError("");
    try {
      await api.emailLessonAnalysisEvaluation(teacherId, detail.id, email.trim());
      setNotice("Письмо отправлено учителю");
      setEmailOpen(false);
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : "Не удалось отправить письмо",
      );
    } finally {
      setSending(false);
    }
  }

  async function confirmDelete() {
    if (!detail) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteLessonAnalysisEvaluation(teacherId, detail.id);
      navigate(`/school/lesson-analysis/teachers/${teacherId}`);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Не удалось удалить оценку",
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="page-subtitle">Загрузка оценки...</p>;
  }

  if (!detail) {
    return (
      <div className="evaluate-page">
        {error ? <div className="alert alert-error">{error}</div> : null}
        <Link
          to={`/school/lesson-analysis/teachers/${teacherId}`}
          className="teacher-profile__back"
        >
          ← Вернуться к списку оценок
        </Link>
      </div>
    );
  }

  return (
    <div className="evaluate-page evaluation-view">
      <div className="evaluation-view__print-brand print-only">
        <strong>Tallam</strong>
        <span>{detail.schoolName}</span>
      </div>

      <div className="evaluate-nav print-hide">
        <Link
          to={`/school/lesson-analysis/teachers/${teacherId}`}
          className="teacher-profile__back"
        >
          ← Вернуться к списку оценок
        </Link>
        <Link
          to={`/school/lesson-analysis/teachers/${teacherId}/evaluate`}
          className="btn btn-ghost"
        >
          Оценить
        </Link>
      </div>

      {error ? <div className="alert alert-error print-hide">{error}</div> : null}
      {notice ? <div className="alert alert-success print-hide">{notice}</div> : null}

      <section className="evaluate-meta">
        <h2 className="evaluate-meta__title">Анализ урока</h2>
        <h3 className="evaluate-meta__fio">
          ФИО: <span>{detail.teacher.fullName}</span>
        </h3>

        <table className="evaluation-view__meta">
          <tbody>
            <tr>
              <th>Дата</th>
              <td>{detail.dateLabel}</td>
            </tr>
            <tr>
              <th>ФИО, должность субъекта оценивания урока</th>
              <td>{detail.evaluatorLabel}</td>
            </tr>
            <tr>
              <th>Предмет</th>
              <td>{detail.disciplineTitle}</td>
            </tr>
            <tr>
              <th>Класс</th>
              <td>{detail.classLabel}</td>
            </tr>
            <tr>
              <th>Тема</th>
              <td>{detail.thema}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="evaluate-table-wrap">
        <table className="evaluate-table">
          <colgroup>
            <col />
            <col className="evaluate-table__col-score" />
          </colgroup>
          <thead>
            <tr>
              <th className="evaluate-table__label">
                Критерии оценки урока (2 балла — признак проявляется в полной мере,
                но не регулярно; 1 балл — признак проявляется не в полной мере; 0
                баллов — признак не проявляется. «—» — материал урока не позволяет
                организовать такую работу)
              </th>
              <th className="evaluate-table__score">Оценивание в баллах</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const block = detail.blocks.find((item) => item.id === group.id);
              return (
                <Fragment key={group.id}>
                  <tr className="evaluate-table__group">
                    <td className="evaluate-table__label">{group.title}</td>
                    <td className="evaluate-table__score">{group.maxScoreLabel}</td>
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
                            {item.code}. {item.title}
                          </td>
                          <td className="evaluate-table__score">
                            {detail.displayedScores[item.key] ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  {block ? (
                    <tr
                      className={`evaluation-view__result evaluation-view__result--${block.levelStyle}`}
                    >
                      <td>
                        Результат:
                        <small>
                          100–75% — выше базового, 74–50% — базовый уровень,
                          49–0% — ниже базового
                        </small>
                      </td>
                      <td className="evaluate-table__score">
                        <strong>{block.percent}%</strong>
                        <span className="evaluation-view__level print-hide">
                          {block.level}
                        </span>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail.commentHtml ? (
        <section className="evaluation-comment">
          <div className="evaluation-comment__toolbar print-hide">
            <button
              type="button"
              className="evaluation-comment__toggle"
              aria-expanded={commentOpen}
              onClick={() => setCommentOpen((open) => !open)}
            >
              {commentOpen
                ? "Скрыть комментарий оценивающего"
                : "Показать комментарий оценивающего"}
            </button>
            <button
              type="button"
              className="evaluation-comment__edit"
              onClick={openCommentEditor}
            >
              Редактировать
            </button>
          </div>
          <p className="evaluate-extras__hint print-hide">
            Комментарий также выводится в методических рекомендациях к этому
            уроку.
          </p>
          <div
            className={`evaluation-comment__panel${commentOpen ? " is-open" : ""}`}
          >
            <h3 className="evaluation-comment__title">
              Комментарий оценивающего
            </h3>
            <div
              className="evaluation-comment__html"
              dangerouslySetInnerHTML={{ __html: detail.commentHtml }}
            />
          </div>
        </section>
      ) : (
        <section className="evaluation-comment print-hide">
          <p className="evaluate-extras__hint">
            Комментарий также будет включён в методические рекомендации к этому
            уроку.
          </p>
          <button
            type="button"
            className="evaluation-comment__add"
            onClick={openCommentEditor}
          >
            Добавить комментарий оценивающего
          </button>
        </section>
      )}

      <div className="evaluation-view__sign print-only">
        <p>
          <span>ФИО оценивающего:</span>
          <span className="evaluation-view__sign-line" />
        </p>
        <p>
          <span>Должность оценивающего:</span>
          <span className="evaluation-view__sign-line" />
        </p>
        <p>
          <span>Подпись:</span>
          <span className="evaluation-view__sign-line" />
        </p>
      </div>

      <div className="evaluation-view__actions print-hide">
        <button
          type="button"
          className="evaluation-view__action evaluation-view__action--print"
          onClick={() => window.print()}
        >
          Подготовить для печати
        </button>
        <button
          type="button"
          className="evaluation-view__action evaluation-view__action--email"
          onClick={openEmailModal}
        >
          Отправить на электронный адрес учителя
        </button>
        <button
          type="button"
          className="evaluation-view__action evaluation-view__action--method"
          disabled={downloading}
          onClick={() => void downloadRecommendations()}
        >
          {downloading
            ? "Формирование PDF..."
            : "Скачать методические рекомендации"}
        </button>
        <button
          type="button"
          className="evaluation-view__action evaluation-view__action--delete"
          onClick={() => {
            setDeleteError("");
            setDeleteOpen(true);
          }}
        >
          Удалить текущую оценку (анализ)
        </button>
      </div>

      {emailOpen ? (
        <div className="modal-overlay" onClick={() => setEmailOpen(false)}>
          <div
            className="modal-card modal-card--narrow"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <h2 className="modal-card__title">Отправить учителю</h2>
              <button
                type="button"
                className="modal-card__close"
                onClick={() => setEmailOpen(false)}
              >
                ×
              </button>
            </div>
            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendEmail();
              }}
            >
              {emailError ? (
                <div className="alert alert-error">{emailError}</div>
              ) : null}
              <label className="form-label" htmlFor="evaluation-email">
                Электронная почта
              </label>
              <input
                id="evaluation-email"
                className="form-input"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teacher@school.ru"
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEmailOpen(false)}
                >
                  Отмена
                </button>
                <button className="btn btn-primary" type="submit" disabled={sending}>
                  {sending ? "Отправка..." : "Отправить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {commentEditOpen ? (
        <div className="modal-overlay" onClick={() => setCommentEditOpen(false)}>
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <h2 className="modal-card__title">
                {detail.commentHtml
                  ? "Редактировать комментарий"
                  : "Добавить комментарий"}
              </h2>
              <button
                type="button"
                className="modal-card__close"
                onClick={() => setCommentEditOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-form evaluation-comment-modal">
              {commentError ? (
                <div className="alert alert-error">{commentError}</div>
              ) : null}
              <p className="evaluate-extras__hint">
                Комментарий также будет включён в методические рекомендации к
                этому уроку.
              </p>
              <MinimalEditor
                value={commentDraft}
                onChange={setCommentDraft}
                placeholder="Введите комментарий или дополнение к оценке"
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCommentEditOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={commentSaving}
                  onClick={() => void saveComment()}
                >
                  {commentSaving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="modal-overlay" onClick={() => setDeleteOpen(false)}>
          <div
            className="modal-card modal-card--narrow"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <h2 className="modal-card__title">Вы уверены?</h2>
              <button
                type="button"
                className="modal-card__close"
                onClick={() => setDeleteOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-form">
              {deleteError ? (
                <div className="alert alert-error">{deleteError}</div>
              ) : null}
              <p className="page-subtitle">
                Оценка будет удалена без возможности восстановления.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setDeleteOpen(false)}
                >
                  Отменить
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleting}
                  onClick={() => void confirmDelete()}
                >
                  {deleting ? "Удаление..." : "Да, удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
