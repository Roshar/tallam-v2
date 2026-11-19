import { useState } from "react";
import { CopyIcon } from "../../components/ai/AiIcons";

interface MessageTemplate {
  id: string;
  number: number;
  title: string;
  description: string;
  text: string;
}

const TEMPLATES: MessageTemplate[] = [
  {
    id: "after-request",
    number: 1,
    title: "После заявки",
    description: "Уточнение по заявке, оставленной на портале.",
    text: `Маршалла хуьлда!

Вы ранее оставляли заявку на портале Таллам. Хотел уточнить, остались ли у вас вопросы или возникли трудности с подключением?

Если нужна помощь, напишите, я помогу разобраться.`,
  },
  {
    id: "contract-data",
    number: 3,
    title: "Заполнение данных для договора",
    description: "Короткое сообщение для рассылки на телефоны школ.",
    text: `Маршалла хуьлда!

Чтобы завершить оформление договора, заполните, пожалуйста, данные директора в личном кабинете Таллам:
https://tallam.ru/school/contract-data

Войдите под логином и паролем школы, заполните форму и нажмите «Сохранить данные для договора». После этого договор и акт можно будет скачать в кабинете.

Если не помните пароль или что-то не открывается, напишите мне - помогу.`,
  },
  {
    id: "renewal",
    number: 2,
    title: "Продление подписки",
    description: "Короткая инструкция по продлению доступа.",
    text: `Для продления подписки необходимо войти в личный кабинет Таллам под своим логином и паролем.

Если срок подписки истек, откроется страница с подробной инструкцией по продлению.

Вам необходимо заполнить форму с данными директора, после чего появится QR-код для оплаты с инструкцией.

После оплаты можете отправить платежный документ на этот номер или номер бухгалтера, чтобы ускорить активацию подписки.`,
  },
];

export function AdminTemplatesPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function copyTemplate(template: MessageTemplate) {
    try {
      await navigator.clipboard.writeText(template.text);
      setCopiedId(template.id);
      setError("");
      window.setTimeout(
        () => setCopiedId((current) => (current === template.id ? null : current)),
        1800,
      );
    } catch {
      setError("Не удалось скопировать текст. Выделите его вручную.");
    }
  }

  return (
    <div className="admin-templates">
      <header className="admin-dashboard__heading">
        <div>
          <p className="admin-dashboard__eyebrow">Связь со школами</p>
          <h2 className="page-title">Заготовки сообщений</h2>
          <p className="page-subtitle">
            Готовые тексты для ответа школам. Нажмите «Скопировать» и вставьте
            в мессенджер или почту.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="admin-templates__grid">
        {TEMPLATES.map((template) => (
          <article key={template.id} className="admin-templates__card">
            <div className="admin-templates__head">
              <div>
                <span className="admin-templates__number">
                  Заготовка {template.number}
                </span>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
              </div>
              <button
                type="button"
                className="btn btn-primary admin-templates__copy"
                onClick={() => void copyTemplate(template)}
              >
                <CopyIcon size={15} />
                {copiedId === template.id ? "Скопировано" : "Скопировать"}
              </button>
            </div>
            <pre className="admin-templates__text">{template.text}</pre>
          </article>
        ))}
      </div>
    </div>
  );
}
