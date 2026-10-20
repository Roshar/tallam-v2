import { useEffect, useRef, useState } from "react";

/**
 * Готовые тексты для ответов школам.
 *
 * Администратор копирует инструкцию и отправляет ее школе в чат или на почту.
 * Текст держим здесь, а не в переписке, чтобы формулировки не расходились:
 * школы спрашивают одно и то же, а шаги на странице подписки меняются.
 */
const RENEWAL_INSTRUCTION = `Как продлить подписку на Tallam

1. Войдите в кабинет на tallam.ru по логину и паролю школы и откройте раздел «Подписка». Если срок уже закончился, вы попадете на этот раздел сразу после входа.

2. Заполните форму «Продление подписки» данными директора: ФИО полностью, серия и номер паспорта, кем и когда выдан, код подразделения, адрес проживания, телефон, ИНН. Поставьте галочку согласия и нажмите «Отправить заявку». Договор заключается с директором как с физическим лицом, данные хранятся в зашифрованном виде.

3. Сразу после отправки заявки на странице появятся QR-код для СберБанк Онлайн и банковские реквизиты. Номер договора уже закреплен за вашей заявкой.

4. Оплатите 10 000 ₽ за 12 месяцев по QR-коду или по реквизитам. Назначение платежа не меняйте: в нем указаны название школы и номер договора. Если банк откроет форму с полями «ФИО обучающегося» и «ФИО плательщика», укажите ФИО директора; ОКТМО и КБК скопируйте с экрана.

5. После оплаты нажмите «Проверить оплату» и отправьте копию платежки в бухгалтерию ИРО ЧР на номер +7 928 898-47-37.

6. Когда администратор подтвердит поступление денег, на этой же странице появятся новый срок подписки и кнопка «Скачать договор и акт».`;

export function AdminInstructionsPage() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function copyInstruction() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(RENEWAL_INSTRUCTION);
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyError(
        "Браузер не дал доступ к буферу обмена. Выделите текст ниже и скопируйте вручную.",
      );
    }
  }

  return (
    <div className="admin-subscriptions">
      <div className="page-header-row admin-subscriptions__header">
        <div>
          <p className="admin-dashboard__eyebrow">Ответы школам</p>
          <h2 className="page-title">Инструкции</h2>
          <p className="page-subtitle">
            Готовые тексты, которые можно скопировать и отправить школе в чат
            или на почту. Формулировки совпадают с тем, что школа видит на
            странице подписки.
          </p>
        </div>
      </div>

      {copyError ? <div className="alert alert-error">{copyError}</div> : null}

      <section className="admin-instructions__card">
        <div className="admin-instructions__head">
          <div>
            <h3>Как продлить подписку на Tallam</h3>
            <p>
              Пошаговая инструкция: форма, QR-код, оплата и документы. Подходит
              для школ, у которых истекает или уже истек срок доступа.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void copyInstruction()}
          >
            {copied ? "Скопировано" : "Скопировать текст"}
          </button>
        </div>

        <pre className="admin-instructions__text">{RENEWAL_INSTRUCTION}</pre>
      </section>
    </div>
  );
}
