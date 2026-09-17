import { FormEvent, useEffect, useRef } from "react";
import type { SupportAuthorRole, SupportMessage } from "../types/school";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

interface SupportChatProps {
  viewerRole: SupportAuthorRole;
  messages: SupportMessage[];
  emptyText: string;
  value: string;
  sending: boolean;
  error: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function SupportChat({
  viewerRole,
  messages,
  emptyText,
  value,
  sending,
  error,
  onChange,
  onSubmit,
}: SupportChatProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="support-chat">
      <div className="support-chat__list" ref={listRef}>
        {messages.length === 0 ? (
          <p className="support-chat__empty">{emptyText}</p>
        ) : (
          messages.map((item) => {
            const mine = item.authorRole === viewerRole;
            return (
              <article
                key={item.id}
                className={`support-chat__bubble${mine ? " support-chat__bubble--mine" : ""}`}
              >
                <p className="support-chat__meta">
                  {item.authorRole === "admin" ? "Администрация" : "Школа"}
                  <time dateTime={item.createdAt}>
                    {formatDateTime(item.createdAt)}
                  </time>
                </p>
                <p className="support-chat__text">{item.message}</p>
              </article>
            );
          })
        )}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <form className="support-chat__form" onSubmit={handleSubmit}>
        <label className="form-label" htmlFor="support-message">
          Сообщение
        </label>
        <textarea
          id="support-message"
          className="form-input support-chat__textarea"
          rows={4}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Напишите отзыв, пожелание или вопрос"
        />
        <button className="btn btn-primary" type="submit" disabled={sending}>
          {sending ? "Отправка..." : "Отправить"}
        </button>
      </form>
    </div>
  );
}
