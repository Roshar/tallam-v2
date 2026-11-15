import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type {
  RenewalCustomerData,
  SchoolContractData,
  SubmitRenewalPayload,
} from "../../types/school";

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
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  const normalized = digits.startsWith("8")
    ? `7${digits.slice(1)}`
    : digits.startsWith("7")
      ? digits
      : `7${digits}`;
  const parts = [
    "+7",
    normalized.slice(1, 4),
    normalized.slice(4, 7),
    normalized.slice(7, 9),
    normalized.slice(9, 11),
  ].filter(Boolean);
  return parts.length > 1
    ? `${parts[0]} ${parts[1]} ${parts[2]}-${parts[3]}-${parts[4]}`
    : parts[0];
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU").format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

export function SchoolContractDataPage() {
  const [data, setData] = useState<SchoolContractData | null>(null);
  const [customer, setCustomer] =
    useState<RenewalCustomerData>(EMPTY_CUSTOMER);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    api
      .schoolContractData()
      .then((response) => {
        if (!active) return;
        setData(response);
        setCustomer(response.customer);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateField<K extends keyof RenewalCustomerData>(
    field: K,
    value: RenewalCustomerData[K],
  ) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: SubmitRenewalPayload = { ...customer, consent };
      const response = await api.saveSchoolContractData(payload);
      setData(response);
      setCustomer(response.customer);
      setSuccess(
        "Данные сохранены. Договор и акт сформированы и доступны для скачивания.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить данные");
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    if (!data?.requestId) return;
    setDownloading(true);
    setError("");
    try {
      await api.downloadSchoolRenewalDocument(data.requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скачать договор");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <p className="page-subtitle">Загрузка данных для договора...</p>;
  }

  if (!data?.required) {
    return (
      <section className="school-renewal school-renewal--inactive">
        <h2 className="page-title">Данные для договора</h2>
        <p>
          Для вашей школы отдельный запрос на данные для договора не требуется.
        </p>
        <Link to="/school/subscription" className="btn btn-secondary">
          Вернуться к подписке
        </Link>
      </section>
    );
  }

  return (
    <div className="school-contract-page">
      <header className="school-contract-page__heading">
        <div>
          <p className="school-sub__eyebrow">Договор с ГБУ ДПО «ИРО ЧР»</p>
          <h2 className="page-title">Данные для договора</h2>
          <p className="page-subtitle">
            Заполните данные директора образовательной организации. Они нужны
            для договора и акта, сохраняются в зашифрованном виде и доступны
            только школе и бухгалтерии.
          </p>
        </div>
        <Link to="/school/subscription" className="btn btn-ghost">
          К подписке
        </Link>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      {data.submitted || data.documentAvailable ? (
        <section className="school-renewal__status school-renewal__status--paid">
          <div>
            <strong>Данные для договора сохранены</strong>
            <p>
              Договор сформирован. Если нужно изменить данные, отправьте форму
              повторно.
            </p>
          </div>
          <dl>
            <div>
              <dt>Договор</dt>
              <dd>{data.contractNumber ?? "формируется"}</dd>
            </div>
            <div>
              <dt>Дата</dt>
              <dd>{formatDate(data.issuedOn)}</dd>
            </div>
            <div>
              <dt>Период</dt>
              <dd>
                {formatDate(data.startsOn)} - {formatDate(data.endsOn)}
              </dd>
            </div>
          </dl>
          {data.documentAvailable ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void download()}
              disabled={downloading}
            >
              {downloading ? "Файл..." : "Скачать договор и акт"}
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="school-renewal">
        <div className="school-renewal__heading">
          <div>
            <h3>Данные заказчика для договора</h3>
            <p>
              Договор заключается с физическим лицом, директором
              образовательной организации. Стоимость годового доступа:{" "}
              <strong>10 000 ₽</strong>.
            </p>
          </div>
          <span className="school-renewal__secure">Данные зашифрованы</span>
        </div>

        <form className="school-renewal__form" onSubmit={submit}>
          <h4 className="school-renewal__form-title">
            Данные заказчика (директора образовательной организации) для
            договора и акта
          </h4>
          <div className="school-renewal__field school-renewal__field--wide">
            <label className="form-label" htmlFor="contract-full-name">
              ФИО полностью
            </label>
            <input
              id="contract-full-name"
              className="form-input"
              value={customer.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
              placeholder="Иванов Иван Иванович"
              autoComplete="name"
              required
            />
          </div>
          <div className="school-renewal__field">
            <label className="form-label" htmlFor="contract-passport-series">
              Серия паспорта
            </label>
            <input
              id="contract-passport-series"
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
            <label className="form-label" htmlFor="contract-passport-number">
              Номер паспорта
            </label>
            <input
              id="contract-passport-number"
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
            <label className="form-label" htmlFor="contract-issued-by">
              Кем выдан паспорт
            </label>
            <input
              id="contract-issued-by"
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
            <label className="form-label" htmlFor="contract-issued-on">
              Дата выдачи
            </label>
            <input
              id="contract-issued-on"
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
            <label className="form-label" htmlFor="contract-division-code">
              Код подразделения
            </label>
            <input
              id="contract-division-code"
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
            <label className="form-label" htmlFor="contract-address">
              Адрес проживания
            </label>
            <input
              id="contract-address"
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
            <label className="form-label" htmlFor="contract-phone">
              Номер телефона
            </label>
            <input
              id="contract-phone"
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
            <label className="form-label" htmlFor="contract-inn">
              ИНН физического лица
            </label>
            <input
              id="contract-inn"
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
              защищённое хранение персональных данных для оформления договора.
            </span>
          </label>
          <div className="school-renewal__actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Сохранение..." : "Сохранить данные для договора"}
            </button>
            <p>
              После сохранения договор и акт можно будет скачать здесь и в
              кабинете бухгалтера.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
