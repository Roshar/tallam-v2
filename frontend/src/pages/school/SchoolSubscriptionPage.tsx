import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { SchoolRenewalPanel } from "../../components/SchoolRenewalPanel";
import { useAuth } from "../../context/AuthContext";
import type { SchoolSubscriptionOverview } from "../../types/school";

function formatDate(value: string | null): string {
  if (!value) return "не указана";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function daysLabel(count: number | null, unit: "left" | "until"): string {
  if (count === null) return "—";
  if (count === 0) {
    return unit === "left" ? "истекает сегодня" : "начинается сегодня";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = "дней";
  if (mod10 === 1 && mod100 !== 11) word = "день";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    word = "дня";
  }
  return unit === "left" ? `${count} ${word}` : `через ${count} ${word}`;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function SchoolSubscriptionPage() {
  const { refresh: refreshAuth } = useAuth();
  const [data, setData] = useState<SchoolSubscriptionOverview | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [renewalSubmitted, setRenewalSubmitted] = useState(false);
  const [renewalRefreshKey, setRenewalRefreshKey] = useState(0);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentCheck, setPaymentCheck] = useState<{
    status: "waiting" | "paid";
    text: string;
  } | null>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const paymentResultRef = useRef<HTMLDivElement>(null);

  const loadSubscription = useCallback(async () => {
    try {
      setData(await api.schoolSubscription());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить подписку",
      );
    }
  }, []);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  async function handleCopyRequisites() {
    if (!data?.bank) return;
    const text = [
      `Получатель: ${data.bank.recipient}`,
      `ИНН: ${data.bank.inn}`,
      `КПП: ${data.bank.kpp}`,
      `Расчётный счёт: ${data.bank.account}`,
      `Банк: ${data.bank.bankName}`,
      `БИК: ${data.bank.bik}`,
      `Корр. счёт: ${data.bank.correspondentAccount}`,
      `Сумма: ${data.bank.amountLabel}`,
      `Назначение: ${data.bank.purpose}`,
    ].join("\n");

    try {
      await copyText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать реквизиты");
    }
  }

  async function handleRenewalSubmitted() {
    await loadSubscription();
    setRenewalSubmitted(true);
    window.setTimeout(() => {
      paymentRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  async function handleCheckPayment() {
    setCheckingPayment(true);
    setError("");
    setPaymentCheck(null);
    try {
      const [{ request }, overview] = await Promise.all([
        api.schoolRenewal(),
        api.schoolSubscription(),
      ]);
      setData(overview);
      setRenewalRefreshKey((current) => current + 1);

      if (request?.status === "paid") {
        await refreshAuth();
        setRenewalSubmitted(false);
        setPaymentCheck({
          status: "paid",
          text: "Оплата подтверждена. Подписка активирована, документы готовы, доступ к кабинету открыт.",
        });
        window.setTimeout(() => {
          paymentResultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 0);
      } else {
        setPaymentCheck({
          status: "waiting",
          text: "Оплата пока не подтверждена администратором. Повторите проверку позже.",
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось проверить оплату",
      );
    } finally {
      setCheckingPayment(false);
    }
  }

  return (
    <div className="school-sub">
      <header className="school-sub__header">
        <p className="school-sub__eyebrow">Личный кабинет школы</p>
        <h2 className="page-title">Подписка</h2>
        <p className="page-subtitle">
          Срок доступа к платформе, оплата продления и типовой договор
        </p>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {!data ? (
        <p className="page-subtitle">Загрузка данных подписки...</p>
      ) : (
        <>
          <section
            className={`school-sub__banner school-sub__banner--${data.status}`}
          >
            <div>
              <p className="school-sub__banner-kicker">
                {data.schoolName}
              </p>
              <h3>{data.title}</h3>
              <p>{data.description}</p>
            </div>
            {data.cabinetLocked ? (
              <p className="school-sub__lock">
                Остальные разделы кабинета закрыты до открытия доступа
              </p>
            ) : null}
          </section>

          <div className="school-sub__facts">
            <article>
              <span>Начало срока</span>
              <strong>{formatDate(data.startsOn)}</strong>
            </article>
            <article>
              <span>Окончание срока</span>
              <strong>{formatDate(data.endsOn)}</strong>
            </article>
            <article>
              <span>
                {data.status === "scheduled"
                  ? "До открытия"
                  : "Осталось"}
              </span>
              <strong>
                {data.status === "scheduled"
                  ? daysLabel(data.daysLeft, "until")
                  : data.status === "expired"
                    ? "срок истёк"
                    : daysLabel(data.daysLeft, "left")}
              </strong>
            </article>
            <article>
              <span>Контактный телефон</span>
              <strong>{data.phone || "не указан"}</strong>
            </article>
          </div>

          {data.progressPercent !== null ? (
            <div className="school-sub__progress">
              <div className="school-sub__progress-top">
                <span>Текущий период</span>
                <span>
                  {data.elapsedDays} из {data.totalDays} дн.
                </span>
              </div>
              <div className="school-sub__bar" aria-hidden="true">
                <div
                  className="school-sub__bar-fill"
                  style={{ width: `${Math.min(100, data.progressPercent)}%` }}
                />
              </div>
            </div>
          ) : null}

          <SchoolRenewalPanel
            key={renewalRefreshKey}
            needsPayment={data.needsPayment}
            onSubmitted={handleRenewalSubmitted}
          />

          {paymentCheck?.status === "paid" ? (
            <div
              className="alert alert-success"
              ref={paymentResultRef}
              role="status"
            >
              {paymentCheck.text}
            </div>
          ) : null}

          {data.needsPayment && data.bank ? (
            <div className="school-sub__payment-target" ref={paymentRef}>
              {renewalSubmitted ? (
                <div className="alert alert-success">
                  <strong>Заявка отправлена.</strong> Для оплаты используйте
                  QR-код или банковские реквизиты ниже. Договор и счёт появятся
                  после подтверждения оплаты администратором.
                </div>
              ) : null}
              <section className="school-sub__pay">
                <div className="school-sub__qr">
                  <h3>Оплата по QR-коду</h3>
                  <p>
                    Отсканируйте код в приложении банка. Сумма и назначение
                    платежа уже заполнены.
                  </p>
                  {data.qrImage ? (
                    <img
                      src={data.qrImage}
                      alt="QR-код для оплаты подписки"
                      width={220}
                      height={220}
                    />
                  ) : null}
                  <p className="school-sub__amount">{data.bank.amountLabel}</p>
                  <p className="school-sub__test">{data.bank.paymentNotice}</p>
                </div>

                <div className="school-sub__bank">
                  <div className="school-sub__bank-head">
                    <h3>Банковские реквизиты</h3>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleCopyRequisites()}
                    >
                      {copied ? "Скопировано" : "Скопировать"}
                    </button>
                  </div>
                  <dl>
                    <div>
                      <dt>Получатель</dt>
                      <dd>{data.bank.recipient}</dd>
                    </div>
                    <div>
                      <dt>ИНН</dt>
                      <dd>{data.bank.inn}</dd>
                    </div>
                    <div>
                      <dt>КПП</dt>
                      <dd>{data.bank.kpp}</dd>
                    </div>
                    <div>
                      <dt>Расчётный счёт</dt>
                      <dd>{data.bank.account}</dd>
                    </div>
                    <div>
                      <dt>Банк</dt>
                      <dd>{data.bank.bankName}</dd>
                    </div>
                    <div>
                      <dt>БИК</dt>
                      <dd>{data.bank.bik}</dd>
                    </div>
                    <div>
                      <dt>Корр. счёт</dt>
                      <dd>{data.bank.correspondentAccount}</dd>
                    </div>
                    <div>
                      <dt>Назначение платежа</dt>
                      <dd>{data.bank.purpose}</dd>
                    </div>
                  </dl>
                </div>
              </section>
              <div className="school-sub__payment-check">
                <div className="school-sub__payment-check-copy">
                  <h3>Уже оплатили?</h3>
                  <p>
                    Нажмите кнопку после перевода. Система проверит, подтвердил
                    ли администратор поступление оплаты. Повторная проверка не
                    списывает деньги и не создаёт новую заявку.
                  </p>
                  {paymentCheck?.status === "waiting" ? (
                    <div className="alert alert-warning" role="status">
                      {paymentCheck.text}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-primary school-sub__payment-check-btn"
                  disabled={checkingPayment}
                  onClick={() => void handleCheckPayment()}
                >
                  {checkingPayment ? "Проверяем..." : "Проверить оплату"}
                </button>
              </div>
            </div>
          ) : null}

        </>
      )}
    </div>
  );
}
