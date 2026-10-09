import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { TeacherDeletionSummary } from "../types/school";

interface DeleteTeacherModalProps {
  open: boolean;
  teacherId: string;
  onClose: () => void;
  onDeleted: (deleted: TeacherDeletionSummary) => void;
}

/**
 * Удаление работника необратимо: вместе с карточкой уходят его оценки урока,
 * комментарии и участие в проектах. Поэтому сначала показываем, что именно
 * пропадёт, и требуем подтверждения, если терять есть что.
 */
export function DeleteTeacherModal({
  open,
  teacherId,
  onClose,
  onDeleted,
}: DeleteTeacherModalProps) {
  const [preview, setPreview] = useState<TeacherDeletionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !teacherId) {
      return;
    }

    setPreview(null);
    setConfirmed(false);
    setError("");
    setLoading(true);

    api
      .workerDeletionPreview(teacherId)
      .then((response) => setPreview(response.preview))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, teacherId]);

  if (!open) {
    return null;
  }

  const losses = preview
    ? [
        { label: "оценок урока", value: preview.evaluations },
        { label: "комментариев", value: preview.comments },
        { label: "участий в проектах", value: preview.projects },
      ].filter((item) => item.value > 0)
    : [];

  const hasLoss = losses.length > 0;
  const canSubmit = Boolean(preview) && !submitting && !loading && (!hasLoss || confirmed);

  async function handleDelete() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await api.deleteSchoolWorker(teacherId);
      onDeleted(response.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить работника");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={() => (submitting ? undefined : onClose())}
    >
      <div
        className="modal-card modal-card--narrow"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-delete-title"
      >
        <div className="modal-card__header">
          <h2 id="teacher-delete-title" className="modal-card__title">
            Удалить работника?
          </h2>
          <button
            type="button"
            className="modal-card__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="modal-form">
          {error ? <div className="alert alert-error">{error}</div> : null}

          {loading ? (
            <p className="page-subtitle">Проверяем, что будет удалено...</p>
          ) : preview ? (
            <>
              <p>
                <strong>{preview.fullName}</strong> будет удалён из базы
                работников школы. Восстановить карточку не получится.
              </p>

              {hasLoss ? (
                <div className="alert alert-error">
                  <div>Вместе с работником будет удалено безвозвратно:</div>
                  {losses.map((item) => (
                    <div key={item.label}>
                      {item.label} — <strong>{item.value}</strong>
                    </div>
                  ))}
                  <div>
                    Оценки исчезнут из статистики школы на главной странице.
                  </div>
                </div>
              ) : (
                <p className="page-subtitle">
                  Оценок урока у этого работника нет — удалится только сама
                  карточка.
                </p>
              )}

              {hasLoss ? (
                <label className="modal-card__consent">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={submitting}
                  />
                  <span>
                    Понимаю, что оценки и комментарии будут удалены навсегда
                  </span>
                </label>
              ) : null}
            </>
          ) : null}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void handleDelete()}
              disabled={!canSubmit}
            >
              {submitting ? "Удаляем..." : "Удалить навсегда"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
