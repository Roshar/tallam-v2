import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  ChatIcon,
  CloseIcon,
  HistoryIcon,
  PlusIcon,
  SendIcon,
  TrashIcon,
} from "./ai/AiIcons";
import type {
  AiConversationMessage,
  AiConversationSummary,
  AiMessage,
  AiSource,
  AiUsage,
} from "../types/ai";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowTime(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function timeFromIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const AUTO_OPEN_DELAY_MS = 20_000;
const AUTO_SHOWN_PREFIX = "dika_chat_auto_shown:";
const CLOSED_PREFIX = "dika_chat_closed:";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // localStorage can be unavailable in private mode.
  }
}

function welcomeMessage(): AiMessage {
  return {
    id: newId(),
    role: "assistant",
    content:
      "Маршалла хуьлда! 👋\n\n" +
      "Меня зовут Дика. Я ваш ИИ-помощник на платформе Таллам.\n\n" +
      "Моя задача заключается в том, чтобы помогать вам в работе, собирать ваши вопросы, замечания и пожелания, а также передавать их разработчикам для улучшения платформы.\n\n" +
      "Я пока только учусь и могу чего-то не знать или не уметь. Но благодаря вашим вопросам и предложениям я смогу становиться полезнее.\n\n" +
      "Расскажите, чего вам не хватает в Таллам, что вызывает трудности или какие процессы вы хотели бы автоматизировать.\n\n" +
      "Давайте вместе сделаем Таллам лучше!",
    time: nowTime(),
    welcome: true,
  };
}

function nudgeMessage(): AiMessage {
  return {
    id: newId(),
    role: "assistant",
    content:
      "Кстати, хотите что-то улучшить в кабинете или в этом чате? Мне важно знать, что стоит поправить.",
    time: nowTime(),
    nudge: true,
  };
}

function formatSourceDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU").format(date);
}

function sourceLine(source: AiSource): string {
  if (source.type === "lesson_card") {
    return `Карточка урока №${source.cardId ?? "-"}${
      source.date ? ` от ${formatSourceDate(source.date)}` : ""
    }`;
  }
  const period =
    source.periodFrom || source.periodTo
      ? `${formatSourceDate(source.periodFrom)} - ${formatSourceDate(source.periodTo)}`
      : source.academicYearLabel ?? "";
  if (source.type === "teacher_analytics") {
    return `Аналитика педагога${period ? `: ${period}` : ""}${
      source.evaluations ? `, ${source.evaluations} оценок` : ""
    }`;
  }
  return `Данные школы${source.academicYearLabel ? `, ${source.academicYearLabel}` : ""}${
    period ? `: ${period}` : ""
  }${source.evaluations ? `, ${source.evaluations} оценок` : ""}${
    source.teachers ? `, ${source.teachers} педагогов` : ""
  }`;
}

function toUiMessage(message: AiConversationMessage): AiMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    time: timeFromIso(message.createdAt),
    sources: message.sources,
  };
}

interface CabinetChatProps {
  enabled: boolean;
}

export function CabinetChat({ enabled }: CabinetChatProps) {
  const { user } = useAuth();
  const userKey = user?.id ? String(user.id) : user?.email ?? "guest";
  const autoShownKey = `${AUTO_SHOWN_PREFIX}${userKey}`;
  const closedKey = `${CLOSED_PREFIX}${userKey}`;
  const [open, setOpen] = useState(false);
  const [autoShown, setAutoShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>(() => [welcomeMessage()]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [suggestionSent, setSuggestionSent] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nudged = useRef<Set<string>>(new Set());
  const sentCount = useRef(0);

  const exhausted = Boolean(usage && usage.remaining <= 0);

  useEffect(() => {
    setAutoShown(readFlag(autoShownKey));
    setDismissed(readFlag(closedKey));
  }, [autoShownKey, closedKey]);

  useEffect(() => {
    if (!enabled || open || autoShown || dismissed) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      setAutoShown(true);
      writeFlag(autoShownKey);
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, open, autoShown, dismissed, autoShownKey]);

  useEffect(() => {
    if (!enabled || !open || loaded) return;
    let active = true;
    setLoading(true);
    Promise.all([api.aiAssistantConversations(), api.aiAssistantUsage()])
      .then(async ([list, usageResponse]) => {
        if (!active) return;
        setConversations(list.items);
        setUsage(usageResponse.usage);
        if (list.items[0]) {
          const detail = await api.aiAssistantConversation(list.items[0].id);
          if (!active) return;
          setActiveId(detail.conversation.id);
          setMessages(detail.conversation.messages.map(toUiMessage));
        }
        setLoaded(true);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, open, loaded]);

  useEffect(() => {
    if (!open) return;
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [open, messages.length, typing]);

  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 110)}px`;
  }, [draft]);

  if (!enabled) return null;

  function openChat() {
    setOpen(true);
    if (!autoShown) {
      setAutoShown(true);
      writeFlag(autoShownKey);
    }
  }

  function closeChat() {
    setOpen(false);
    setDismissed(true);
    writeFlag(closedKey);
  }

  async function loadConversation(conversationId: number) {
    setLoading(true);
    setError("");
    setHistoryOpen(false);
    try {
      const detail = await api.aiAssistantConversation(conversationId);
      setActiveId(detail.conversation.id);
      setMessages(detail.conversation.messages.map(toUiMessage));
      sentCount.current = 0;
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось открыть диалог",
      );
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    setActiveId(null);
    setMessages([welcomeMessage()]);
    sentCount.current = 0;
    setDraft("");
    setError("");
    setHistoryOpen(false);
    setSuggestionOpen(false);
  }

  async function sendMessage(
    text: string,
    options?: { conversationId?: number | null; baseMessages?: AiMessage[] },
  ) {
    const content = text.trim();
    if (!content || typing || exhausted) return;
    const conversationId =
      options?.conversationId !== undefined
        ? options.conversationId
        : activeId;
    const base = options?.baseMessages ?? messages;
    const userMessage: AiMessage = {
      id: newId(),
      role: "user",
      content,
      time: nowTime(),
    };
    setMessages([...base, userMessage]);
    setDraft("");
    setError("");
    setTyping(true);

    try {
      const result = await api.aiAssistantChat({
        conversationId,
        message: content,
      });
      setActiveId(result.conversationId);
      sentCount.current += 1;
      const sent = sentCount.current;
      const key = `${result.conversationId}:${sent}`;
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          content: result.message.content,
          time: nowTime(),
          sources: result.sources,
        },
      ]);
      if (sent % 3 === 0 && !nudged.current.has(key)) {
        nudged.current.add(key);
        const nudge = nudgeMessage();
        setMessages((current) => [...current, nudge]);
      }
      setUsage(result.usage);
      const list = await api.aiAssistantConversations();
      setConversations(list.items);
    } catch (sendError) {
      setMessages(base);
      setDraft(content);
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Не удалось ответить. Попробуйте еще раз.",
      );
    } finally {
      setTyping(false);
    }
  }

  function submitDraft() {
    if (!draft.trim() || typing || exhausted) return;
    void sendMessage(draft);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitDraft();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitDraft();
    }
  }

  function dismissNudge(id: string | number) {
    setMessages((current) =>
      current.filter((message) => message.id !== id),
    );
  }

  function openSuggestion() {
    setSuggestionOpen(true);
    setSuggestionSent(false);
    setSuggestionError("");
  }

  async function submitSuggestion() {
    const text = suggestionText.trim();
    if (text.length < 5 || suggestionBusy) return;
    setSuggestionBusy(true);
    setSuggestionError("");
    try {
      await api.aiAssistantSuggestion(text);
      setSuggestionText("");
      setSuggestionSent(true);
    } catch (submitError) {
      setSuggestionError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось отправить предложение",
      );
    } finally {
      setSuggestionBusy(false);
    }
  }

  async function deleteConversation(conversation: AiConversationSummary) {
    const confirmed = window.confirm(
      "Удалить диалог из истории? Внутренний журнал платформы сохранит обращение.",
    );
    if (!confirmed) return;
    try {
      await api.aiAssistantDeleteConversation(conversation.id);
      const remaining = conversations.filter(
        (item) => item.id !== conversation.id,
      );
      setConversations(remaining);
      if (activeId === conversation.id) {
        if (remaining[0]) {
          await loadConversation(remaining[0].id);
        } else {
          startNewConversation();
        }
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить диалог",
      );
    }
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="cabinet-chat__launcher"
          onClick={openChat}
          aria-label="Открыть чат поддержки"
        >
          <ChatIcon size={20} />
          <span>Чат</span>
        </button>
      ) : (
        <section
          className="cabinet-chat"
          role="dialog"
          aria-label="Чат поддержки по кабинету"
        >
          <header className="cabinet-chat__header">
            <div className="cabinet-chat__brand">
              <strong>Чат с Дикой</strong>
              <span>Поддержка по кабинету</span>
            </div>
            <div className="cabinet-chat__actions">
              <button
                type="button"
                onClick={() => setHistoryOpen((value) => !value)}
                aria-label="История обращений"
                title="История"
              >
                <HistoryIcon size={16} />
              </button>
              <button
                type="button"
                onClick={startNewConversation}
                aria-label="Новый чат"
                title="Новый чат"
              >
                <PlusIcon size={16} />
              </button>
              <button
                type="button"
                onClick={closeChat}
                aria-label="Закрыть чат"
                title="Закрыть"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </header>

          {historyOpen ? (
            <div className="cabinet-chat__history">
              <div className="cabinet-chat__history-head">
                <strong>История</strong>
                <button
                  type="button"
                  className="cabinet-chat__link"
                  onClick={startNewConversation}
                >
                  Новый чат
                </button>
              </div>
              {!conversations.length ? (
                <p className="cabinet-chat__history-empty">
                  Пока нет сохраненных диалогов.
                </p>
              ) : null}
              {conversations.map((conversation) => (
                <div key={conversation.id} className="cabinet-chat__history-row">
                  <button
                    type="button"
                    className={`cabinet-chat__history-item${
                      conversation.id === activeId ? " is-active" : ""
                    }`}
                    onClick={() => void loadConversation(conversation.id)}
                  >
                    <span>{conversation.title}</span>
                    <small>{conversation.messageCount} сообщ.</small>
                  </button>
                  <button
                    type="button"
                    className="cabinet-chat__history-delete"
                    onClick={() => void deleteConversation(conversation)}
                    aria-label={`Удалить диалог «${conversation.title}»`}
                    title="Удалить диалог"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              <p className="cabinet-chat__history-note">
                Удаление диалога не удаляет запись из внутреннего журнала
                платформы.
              </p>
            </div>
          ) : null}

          <div className="cabinet-chat__messages" ref={messagesRef}>
            {loading ? (
              <p className="cabinet-chat__loading">Загрузка...</p>
            ) : null}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`cabinet-chat__message cabinet-chat__message--${message.role}`}
              >
                <div className="cabinet-chat__avatar">
                  {message.role === "assistant" ? "Д" : "Я"}
                </div>
                <div className="cabinet-chat__body">
                  <div className="cabinet-chat__meta">
                    <span>
                      {message.role === "assistant" ? "Дика" : "Вы"}
                    </span>
                    <time>{message.time}</time>
                  </div>
                  {message.nudge ? (
                    <div className="cabinet-chat__nudge">
                      <p>{message.content}</p>
                      <div className="cabinet-chat__nudge-actions">
                        <button type="button" onClick={openSuggestion}>
                          Да, есть предложение
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissNudge(message.id)}
                        >
                          Не сейчас
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="cabinet-chat__bubble">
                      {message.role === "assistant" ? (
                        <div className="cabinet-chat__markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                  )}
                  {message.role === "assistant" &&
                  message.sources?.length ? (
                    <details className="cabinet-chat__sources">
                      <summary>На основании данных</summary>
                      <ul>
                        {message.sources.map((source, index) => (
                          <li key={`${source.type}-${index}`}>
                            {sourceLine(source)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              </article>
            ))}
            {typing ? (
              <article className="cabinet-chat__message cabinet-chat__message--assistant">
                <div className="cabinet-chat__avatar">Д</div>
                <div className="cabinet-chat__body">
                  <div className="cabinet-chat__meta">
                    <span>Дика</span>
                    <time>печатает</time>
                  </div>
                  <div className="cabinet-chat__typing" aria-label="Дика печатает">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </article>
            ) : null}
          </div>

          {error ? (
            <div className="cabinet-chat__error" role="alert">
              {error}
            </div>
          ) : null}

          {suggestionOpen ? (
            <div className="cabinet-chat__suggestion">
              {suggestionSent ? (
                <>
                  <p>Спасибо, предложение передали. Оно поможет сделать кабинет удобнее.</p>
                  <button
                    type="button"
                    className="cabinet-chat__button"
                    onClick={() => setSuggestionOpen(false)}
                  >
                    Закрыть
                  </button>
                </>
              ) : (
                <>
                  <p>Что стоит улучшить в кабинете или в чате?</p>
                  <textarea
                    value={suggestionText}
                    maxLength={4000}
                    rows={3}
                    onChange={(event) => setSuggestionText(event.target.value)}
                    placeholder="Например: добавить сравнение результатов по четвертям"
                    aria-label="Предложение по улучшению"
                  />
                  {suggestionError ? (
                    <p className="cabinet-chat__error-text">{suggestionError}</p>
                  ) : null}
                  <div className="cabinet-chat__suggestion-actions">
                    <button
                      type="button"
                      className="cabinet-chat__link"
                      onClick={() => setSuggestionOpen(false)}
                      disabled={suggestionBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      className="cabinet-chat__button"
                      onClick={() => void submitSuggestion()}
                      disabled={
                        suggestionBusy || suggestionText.trim().length < 5
                      }
                    >
                      {suggestionBusy ? "Отправляем..." : "Отправить"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <form className="cabinet-chat__composer" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                exhausted
                  ? "Лимит обращений на этот месяц исчерпан"
                  : "Напишите вопрос по кабинету..."
              }
              aria-label="Сообщение в чат"
              disabled={typing || exhausted}
            />
            <button
              type="submit"
              className="cabinet-chat__send"
              disabled={!draft.trim() || typing || exhausted}
              aria-label="Отправить"
            >
              <SendIcon size={16} />
            </button>
          </form>
          <div className="cabinet-chat__footer">
            <p>
              Ответы носят рекомендательный характер. Проверяйте важную
              информацию.
            </p>
            <button
              type="button"
              className="cabinet-chat__link"
              onClick={openSuggestion}
            >
              Предложить улучшение
            </button>
          </div>
        </section>
      )}
    </>
  );
}
