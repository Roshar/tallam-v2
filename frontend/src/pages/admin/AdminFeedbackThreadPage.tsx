import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { SupportChat } from "../../components/SupportChat";
import type { SupportThread } from "../../types/school";

const POLL_MS = 10_000;

export function AdminFeedbackThreadPage() {
  const { schoolId = "" } = useParams();
  const id = Number(schoolId);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!Number.isInteger(id) || id <= 0) {
        setError("Некорректная школа");
        setLoading(false);
        return;
      }
      if (!silent) {
        setError("");
      }
      try {
        const data = await api.adminFeedbackThread(id);
        setThread(data);
        window.dispatchEvent(new Event("admin-feedback-updated"));
      } catch (err) {
        if (!silent) {
          setError(
            err instanceof Error ? err.message : "Не удалось загрузить переписку",
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  async function handleSubmit() {
    setFormError("");
    setSending(true);
    try {
      const data = await api.replyAdminFeedback(id, { message: draft.trim() });
      setThread(data);
      setDraft("");
      window.dispatchEvent(new Event("admin-feedback-updated"));
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Не удалось отправить ответ",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <Link to="/admin/feedback" className="teacher-profile__back">
          ← К списку сообщений
        </Link>
        <header className="school-guide__header">
          <h2 className="page-title">
            {thread?.schoolName || "Переписка со школой"}
          </h2>
          <p className="page-subtitle">
            Ответ школы увидят в разделе «Отзывы и пожелания».
          </p>
        </header>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? (
          <p className="page-subtitle">Загрузка переписки...</p>
        ) : (
          <SupportChat
            viewerRole="admin"
            messages={thread?.messages ?? []}
            emptyText="В этой переписке пока нет сообщений."
            value={draft}
            sending={sending}
            error={formError}
            onChange={setDraft}
            onSubmit={() => void handleSubmit()}
          />
        )}
      </div>
    </div>
  );
}
