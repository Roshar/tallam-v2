import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { SupportChat } from "../../components/SupportChat";
import type { SupportThread } from "../../types/school";

const POLL_MS = 10_000;

export function SchoolFeedbackPage() {
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setError("");
    }
    try {
      const data = await api.schoolFeedbackThread();
      setThread(data);
      window.dispatchEvent(new Event("school-feedback-updated"));
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
  }, []);

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
      const data = await api.sendSchoolFeedback({ message: draft.trim() });
      setThread(data);
      setDraft("");
      window.dispatchEvent(new Event("school-feedback-updated"));
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Не удалось отправить сообщение",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <header className="school-guide__header">
          <h2 className="page-title">Отзывы и пожелания</h2>
          <p className="page-subtitle">
            Напишите администрации платформы. Ответ появится в этой переписке.
          </p>
        </header>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? (
          <p className="page-subtitle">Загрузка переписки...</p>
        ) : (
          <SupportChat
            viewerRole="school"
            messages={thread?.messages ?? []}
            emptyText="Пока нет сообщений. Напишите отзыв или пожелание, и администрация ответит здесь."
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
