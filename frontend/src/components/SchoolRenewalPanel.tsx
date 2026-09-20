import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type {
  RenewalCustomerData,
  SchoolRenewalRequest,
  SubmitRenewalPayload,
} from "../types/school";

const EMPTY_CUSTOMER: RenewalCustomerData = {
  fullName: "",
  phone: "",
  passportSeries: "",
  passportNumber: "",
  passportIssuedBy: "",
  passportIssuedOn: "",
  divisionCode: "",
  residentialAddress: "",
  inn: "",
};

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  const local = digits.startsWith("7") ? digits.slice(1) : digits;
  if (!local) return digits.startsWith("7") ? "+7 " : "";
  if (local.length <= 3) return `+7 ${local}`;
  if (local.length <= 6) return `+7 ${local.slice(0, 3)} ${local.slice(3)}`;
  if (local.length <= 8) {
    return `+7 ${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return `+7 ${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6, 8)}-${local.slice(8)}`;
}

const STATUS_COPY: Record<
  SchoolRenewalRequest["status"],
  { title: string; text: string }
> = {
  pending: {
    title: "Заявка ожидает подтверждения",
        text: "Для оплаты используйте QR-код или реквизиты ниже. Номер договора уже закреплён за этой заявкой. PDF договора и акта появятся после проверки платежа администратором.",
  },
  documents_ready: {
    title: "Заявка ожидает подтверждения",
    text: "Используйте QR-код или реквизиты ниже. PDF документов появятся после подтверждения оплаты администратором.",
  },
  paid: {
    title: "Оплата подтверждена",
    text: "Годовой период подписки добавлен. Договор и акт останутся доступны в этом разделе.",
  },
  cancelled: {
    title: "Заявка отменена",
    text: "Для оформления продления создайте новую заявку.",
  },
};

function formatDate(value: string | null): string {
  if (!value) return "не указана";
  return new Intl.DateTimeFormat("ru-RU").format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

export function SchoolRenewalPanel({
  needsPayment,
  onSubmitted,
}: {
  needsPayment: boolean;
  onSubmitted?: () => void | Promise<void>;
}) {
  const [request, setRequest] = useState<SchoolRenewalRequest | null>(null);
  const [customer, setCustomer] =
    useState<RenewalCustomerData>(EMPTY_CUSTOMER);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .schoolRenewal()
      .then(({ request: current }) => {
        setRequest(current);
        if (current) {
          setCustomer({ ...EMPTY_CUSTOMER, ...current.customer });
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof RenewalCustomerData>(
    field: K,
    value: RenewalCustomerData[K],
  ) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload: SubmitRenewalPayload = { ...customer, consent };
      const result = await api.submitSchoolRenewal(payload);
      setRequest(result.request);
      setCustomer(result.request.customer);
      setConsent(false);
      setSuccess(
        "Заявка сохранена. Переходим к QR-коду и реквизитам для оплаты.",
      );
      await onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить заявку");
    } finally {
      setSubmitting(false);
    }
  }

  async function download() {
    if (!request) return;
    setDownloading(true);
    setError("");
    try {
      await api.downloadSchoolRenewalDocument(request.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скачать документ");
    } finally {
      setDownloading(false);
    }
  }

  const canEdit =
    needsPayment &&
    (!request ||
      request.status === "pending" ||
      request.status === "documents_ready" ||
      request.status === "cancelled");
  const statusCopy = request ? STATUS_COPY[request.status] : null;

  if (loading) {
    return (
      <section className="school-renewal">
        <p className="page-subtitle">Загрузка заявки на продление...</p>
      </section>
    );
  }

  if (!needsPayment && !request) {
    return (
      <section className="school-renewal school-renewal--inactive">
        <div>
          <h3>Оформление продления</h3>
          <p>
            Форма появится за 30 дней до окончания текущей подписки. Стоимость
            годового доступа: 10 000 ₽.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="school-renewal">
      <div className="school-renewal__heading">
        <div>
          <p className="school-sub__eyebrow">Продление на 12 месяцев</p>
          <h3>Продление подписки</h3>
          <p>
            Договор заключается с физическим лицом, директором образовательной
            организации. Стоимость: <strong>10 000 ₽</strong>.
          </p>
        </div>
        <span className="school-renewal__secure">Данные зашифрованы</span>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      {request && statusCopy ? (
        <div
          className={`school-renewal__status school-renewal__status--${request.status}`}
        >
          <div>
            <strong>{statusCopy.title}</strong>
            <p>{statusCopy.text}</p>
          </div>
          <dl>
            <div>
              <dt>Договор</dt>
              <dd>
                {request.contractNumber
                  ? `№ ${request.contractNumber}`
                  : "ожидается"}
              </dd>
            </div>
            <div>
              <dt>Дата</dt>
              <dd>{formatDate(request.issuedOn)}</dd>
            </div>
            {request.startsOn && request.endsOn ? (
              <div>
                <dt>Новый период</dt>
                <dd>
                  {formatDate(request.startsOn)}–{formatDate(request.endsOn)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {canEdit ? (
        <form className="school-renewal__form" onSubmit={submit}>
          <h4 className="school-renewal__form-title">
            Данные заказчика (директора образовательной организации) для
            договора и акта
          </h4>
          <div className="school-renewal__field school-renewal__field--wide">
            <label className="form-label" htmlFor="renewal-full-name">
              ФИО полностью
            </label>
            <input
              id="renewal-full-name"
              className="form-input"
              value={customer.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
              placeholder="Иванов Иван Иванович"
              autoComplete="name"
              required
            />
          </div>

          <div className="school-renewal__field">
            <label className="form-label" htmlFor="renewal-passport-series">
              Серия паспорта
            </label>
            <input
              id="renewal-passport-series"
              className="form-input"
              value={customer.passportSeries}
              onChange={(event) =>
                updateField(
                  "passportSeries",
                  event.target.value.replace(/\D/g, "").slice(0, 4),
                )
              }
              inputMode="numeric"
              placeholder="9600"
              minLength={4}
              maxLength={4}
              required
            />
          </div>

          <div className="school-renewal__field">
            <label className="form-label" htmlFor="renewal-passport-number">
              Номер паспорта
            </label>
            <input
              id="renewal-passport-number"
              className="form-input"
              value={customer.passportNumber}
              onChange={(event) =>
                updateField(
                  "passportNumber",
                  event.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              inputMode="numeric"
              placeholder="123456"
              minLength={6}
              maxLength={6}
              required
            />
          </div>

          <div className="school-renewal__field school-renewal__field--wide">
            <label className="form-label" htmlFor="renewal-issued-by">
              Кем выдан паспорт
            </label>
            <input
              id="renewal-issued-by"
              className="form-input"
              value={customer.passportIssuedBy}
              onChange={(event) =>
                updateField("passportIssuedBy", event.target.value)
              }
              placeholder="Наименование подразделения"
              required
            />
          </div>

          <div className="school-renewal__field">
            <label className="form-label" htmlFor="renewal-issued-on">
              Дата выдачи
            </label>
            <input
              id="renewal-issued-on"
              className="form-input"
              type="date"
              value={customer.passportIssuedOn}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) =>
                updateField("passportIssuedOn", event.target.value)
              }
              required
            />
          </div>

          <div className="school-renewal__field">
            <label className="form-label" htmlFor="renewal-division-code">
              Код подразделения
            </label>
            <input
              id="renewal-division-code"
              className="form-input"
              value={customer.divisionCode}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
                updateField(
                  "divisionCode",
                  digits.length > 3
                    ? `${digits.slice(0, 3)}-${digits.slice(3)}`
                    : digits,
                );
              }}
              inputMode="numeric"
              placeholder="200-001"
              maxLength={7}
              required
            />
          </div>

          <div className="school-renewal__field school-renewal__field--wide">
            <label className="form-label" htmlFor="renewal-address">
              Адрес проживания
            </label>
            <input
              id="renewal-address"
              className="form-input"
              value={customer.residentialAddress}
              onChange={(event) =>
                updateField("residentialAddress", event.target.value)
              }
              placeholder="Индекс, регион, населённый пункт, улица, дом"
              autoComplete="street-address"
              required
            />
          </div>

          <div className="school-renewal__field">
            <label className="form-label" htmlFor="renewal-phone">
              Номер телефона
            </label>
            <input
              id="renewal-phone"
              className="form-input"
              type="tel"
              value={customer.phone}
              onChange={(event) =>
                updateField("phone", formatPhoneInput(event.target.value))
              }
              placeholder="+7 900 123-45-67"
              autoComplete="tel"
              required
            />
          </div>

          <div className="school-renewal__field">
            <label className="form-label" htmlFor="renewal-inn">
              ИНН физического лица
            </label>
            <input
              id="renewal-inn"
              className="form-input"
              value={customer.inn}
              onChange={(event) =>
                updateField(
                  "inn",
                  event.target.value.replace(/\D/g, "").slice(0, 12),
                )
              }
              inputMode="numeric"
              placeholder="12 цифр"
              minLength={12}
              maxLength={12}
              required
            />
          </div>

          <label className="school-renewal__consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
            />
            <span>
              Я подтверждаю достоверность сведений и согласен на обработку и
              защищённое хранение персональных данных для оформления подписки.
            </span>
          </label>

          <div className="school-renewal__actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? "Сохранение..."
                : request &&
                    (request.status === "pending" ||
                      request.status === "documents_ready")
                  ? "Обновить данные"
                  : "Отправить заявку"}
            </button>
            <p>
              Номер договора резервируется сразу при отправке заявки и больше
              не выдаётся другой школе. PDF договора и акта появятся после
              подтверждения оплаты.
            </p>
          </div>
        </form>
      ) : null}

      {request?.status === "paid" ? (
        <div className="school-renewal__documents">
          <div>
            <h4>Документы</h4>
            <p>
              Договор включает акт оказания информационно-образовательных услуг.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={downloading}
              onClick={() => void download()}
            >
              {downloading ? "Подготовка..." : "Скачать договор и акт"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

