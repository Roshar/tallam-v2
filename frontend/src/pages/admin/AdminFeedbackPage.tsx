import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { AdminSupportConversation } from "../../types/admin";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminFeedbackPage() {
  const [items, setItems] = useState<AdminSupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.adminFeedbackConversations();
      setItems(data.items);
      window.dispatchEvent(new Event("admin-feedback-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить отзывы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="card">
      <div className="card-body">
        <header className="school-guide__header">
          <h2 className="page-title">Отзывы и пожелания</h2>
          <p className="page-subtitle">
            Сообщения школ. Откройте переписку, чтобы ответить.
          </p>
        </header>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? (
          <p className="page-subtitle">Загрузка сообщений...</p>
        ) : items.length === 0 ? (
          <p className="page-subtitle">Пока нет сообщений от школ.</p>
        ) : (
          <ul className="support-inbox">
            {items.map((item) => (
              <li key={item.schoolId}>
                <Link
                  to={`/admin/feedback/${item.schoolId}`}
                  className="support-inbox__item"
                >
                  <div className="support-inbox__top">
                    <strong>{item.schoolName}</strong>
                    <span>
                      {item.unreadCount > 0 ? (
                        <b className="support-inbox__unread">{item.unreadCount}</b>
                      ) : null}
                      <time dateTime={item.lastAt}>
                        {formatDateTime(item.lastAt)}
                      </time>
                    </span>
                  </div>
                  <p>
                    {item.lastAuthorRole === "admin" ? "Вы: " : ""}
                    {item.lastMessage}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
