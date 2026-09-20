export const ACCOUNTING_PHONE_LABEL = "+7 928 898-47-37";
export const ACCOUNTING_PHONE_HREF = "tel:+79288984737";
export const TECH_TELEGRAM_HANDLE = "@nakata_katsu";
export const TECH_TELEGRAM_HREF = "https://t.me/nakata_katsu";

export function SupportContacts() {
  return (
    <section className="support-contacts" aria-label="Контакты поддержки">
      <h3>Контакты</h3>
      <div className="support-contacts__grid">
        <article>
          <p className="support-contacts__label">
            Договор, оплата и бухгалтерия ИРО ЧР
          </p>
          <a className="support-contacts__value" href={ACCOUNTING_PHONE_HREF}>
            {ACCOUNTING_PHONE_LABEL}
          </a>
          <p>
            Все вопросы по договору, деталям оплаты и расчётам направляйте
            сюда.
          </p>
        </article>
        <article>
          <p className="support-contacts__label">Технические вопросы</p>
          <a
            className="support-contacts__value"
            href={TECH_TELEGRAM_HREF}
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegram {TECH_TELEGRAM_HANDLE}
          </a>
          <p>
            По ошибкам, входу и работе платформы пишите в Telegram.
          </p>
        </article>
      </div>
    </section>
  );
}
