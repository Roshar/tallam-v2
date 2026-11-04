import { useState } from "react";

/**
 * Сообщение о восстановлении после атаки на Beget.
 *
 * Показывается на странице входа и в кабинете школы, пока школа не скроет его
 * крестиком. Флаг хранится в localStorage, чтобы баннер не возвращался после
 * каждого перехода.
 */
const STORAGE_KEY = "tallam-incident-2026-11-hidden";

export function IncidentNotice({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [hidden, setHidden] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Приватный режим: скрываем до перезагрузки.
    }
  }

  if (compact) {
    return (
      <section
        className={`incident-notice incident-notice--compact ${className}`.trim()}
        role="status"
        aria-label="Сообщение о восстановлении работы"
      >
        <div className="incident-notice__icon" aria-hidden="true">
          !
        </div>
        <div className="incident-notice__body">
          <h2 className="incident-notice__title">
            Восстановление работы Tallam после кибератаки
          </h2>
          <p>
            В ночь с 1 на 2 ноября провайдер Beget подвергся масштабной
            кибератаке, сервер платформы утрачен. Мы восстановили работу из
            резервной копии от <strong>22 октября</strong>; данные после этой
            даты могли не сохраниться.
          </p>
          <p>
            Если не хватает данных или оплаченный доступ не отображается,
            напишите: Telegram{" "}
            <a
              href="https://t.me/nakata_katsu"
              target="_blank"
              rel="noreferrer"
            >
              @nakata_katsu
            </a>
            , Email <a href="mailto:webrush@mail.ru">webrush@mail.ru</a> -
            проверим и <strong>сразу восстановим доступ</strong>.
          </p>
        </div>
        <button
          type="button"
          className="incident-notice__close"
          aria-label="Скрыть сообщение"
          onClick={dismiss}
        >
          ×
        </button>
      </section>
    );
  }

  return (
    <section
      className={`incident-notice ${className}`.trim()}
      role="status"
      aria-label="Сообщение о восстановлении работы"
    >
      <div className="incident-notice__icon" aria-hidden="true">
        !
      </div>
      <div className="incident-notice__body">
        <h2 className="incident-notice__title">
          Восстановление работы Tallam после кибератаки
        </h2>
        <p>
          В ночь с 1 на 2 ноября инфраструктура провайдера Beget подверглась
          масштабной кибератаке, в результате которой был утрачен сервер, на
          котором размещалась платформа Tallam.
        </p>
        <p>
          Мы восстановили работу системы из резервной копии от{" "}
          <strong>22 октября</strong>. На данный момент сайт, база данных, вход
          в систему и проведение оцениваний работают в штатном режиме.
        </p>
        <p>
          Обратите внимание: данные, внесенные после 22 октября, могли не
          сохраниться. Это может касаться новых оценок, платежей, продлений и
          других изменений.
        </p>
        <p>
          Если вы обнаружили отсутствие данных или другую проблему, напишите
          нам:
          <br />
          Telegram:{" "}
          <a
            href="https://t.me/nakata_katsu"
            target="_blank"
            rel="noreferrer"
          >
            @nakata_katsu
          </a>
          <br />
          Email: <a href="mailto:webrush@mail.ru">webrush@mail.ru</a>
        </p>
        <p>
          Если вы ранее оплачивали доступ к Tallam, но после восстановления
          система показывает, что доступ отсутствует, также напишите нам. Мы
          проверим информацию и <strong>сразу восстановим доступ</strong>.
        </p>
        <p className="incident-notice__thanks">Спасибо за понимание.</p>
      </div>
      <button
        type="button"
        className="incident-notice__close"
        aria-label="Скрыть сообщение"
        onClick={dismiss}
      >
        ×
      </button>
    </section>
  );
}
