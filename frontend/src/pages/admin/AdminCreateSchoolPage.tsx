import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { AdminSubscriptionArea } from "../../types/admin";

type EmailStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function AdminCreateSchoolPage() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<AdminSubscriptionArea[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [areaId, setAreaId] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [startsOn, setStartsOn] = useState(isoDate(new Date()));
  const [endsOn, setEndsOn] = useState(addDays(isoDate(new Date()), 365));
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .adminSchoolAreas()
      .then((data) => setAreas(data.items))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailStatus("idle");
      return;
    }

    setEmailStatus("checking");
    const timeout = window.setTimeout(() => {
      api
        .adminSchoolEmailAvailability(trimmed)
        .then((result) => {
          if (result.reason === "invalid") {
            setEmailStatus("invalid");
            return;
          }
          setEmailStatus(result.available ? "available" : "taken");
        })
        .catch(() => setEmailStatus("idle"));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [email]);

  const emailHint =
    emailStatus === "checking"
      ? "Проверяем адрес в базе..."
      : emailStatus === "available"
        ? "Адрес свободен"
        : emailStatus === "taken"
          ? "Этот адрес уже зарегистрирован"
          : emailStatus === "invalid"
            ? "Укажите корректный email"
            : "Логин для входа в кабинет школы";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!areaId) {
      setError("Выберите район");
      return;
    }
    if (emailStatus === "taken" || emailStatus === "invalid") {
      setError("Укажите свободный корректный email");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (!startsOn || !endsOn) {
      setError("Укажите срок подписки");
      return;
    }
    if (endsOn < startsOn) {
      setError("Дата окончания не может быть раньше даты начала");
      return;
    }

    setSubmitting(true);
    try {
      const school = await api.createAdminSchool({
        schoolName,
        areaId,
        email,
        password,
        confirmPassword,
        startsOn,
        endsOn,
      });
      navigate(`/admin/schools/${school.schoolId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось зарегистрировать школу",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-create-school">
      <Link className="admin-school-detail__back" to="/admin/schools">
        ← К списку школ
      </Link>

      <header className="admin-create-school__header">
        <p className="admin-dashboard__eyebrow">Регистрация</p>
        <h2 className="page-title">Новая школа</h2>
        <p className="page-subtitle">
          Создаёт образовательную организацию, кабинет и срок подписки
        </p>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <form className="admin-create-school__form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="school-name">
            Наименование образовательной организации
          </label>
          <input
            id="school-name"
            className="form-input"
            value={schoolName}
            onChange={(event) => setSchoolName(event.target.value)}
            placeholder="МБОУ «Средняя школа №...»"
            minLength={5}
            maxLength={255}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="school-area">
            Район
          </label>
          <select
            id="school-area"
            className="form-input"
            value={areaId}
            onChange={(event) => setAreaId(Number(event.target.value))}
            required
          >
            <option value={0}>Выберите район</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="school-email">
            Логин (email)
          </label>
          <input
            id="school-email"
            className="form-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="school@example.ru"
            autoComplete="off"
            required
          />
          <p
            className={`admin-create-school__hint admin-create-school__hint--${emailStatus}`}
          >
            {emailHint}
          </p>
        </div>

        <div className="admin-create-school__passwords">
          <div className="form-group">
            <label className="form-label" htmlFor="school-password">
              Пароль
            </label>
            <div className="form-input-wrap">
              <input
                id="school-password"
                className="form-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                placeholder="Минимум 6 символов"
                required
              />
              <button
                type="button"
                className="form-input-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Скрыть" : "Показать"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="school-password-confirm">
              Подтверждение пароля
            </label>
            <input
              id="school-password-confirm"
              className="form-input"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              placeholder="Повторите пароль"
              required
            />
          </div>
        </div>

        <fieldset className="admin-create-school__subscription">
          <legend>
            Срок подписки <span className="form-required">*</span>
          </legend>
          <p className="admin-create-school__hint">
            Укажите даты доступа к кабинету. Позже их можно изменить в карточке
            школы.
          </p>
          <div className="admin-activate-form__presets">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const start = isoDate(new Date());
                setStartsOn(start);
                setEndsOn(addDays(start, 6));
              }}
            >
              7 дней
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const start = isoDate(new Date());
                setStartsOn(start);
                setEndsOn(addDays(start, 29));
              }}
            >
              30 дней
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const start = isoDate(new Date());
                setStartsOn(start);
                setEndsOn(addDays(start, 364));
              }}
            >
              1 год
            </button>
          </div>
          <div className="admin-activate-form__dates">
            <label>
              <span>
                Начало <span className="form-required">*</span>
              </span>
              <input
                className="form-input"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                required
              />
            </label>
            <label>
              <span>
                Окончание <span className="form-required">*</span>
              </span>
              <input
                className="form-input"
                type="date"
                value={endsOn}
                min={startsOn}
                onChange={(event) => setEndsOn(event.target.value)}
                required
              />
            </label>
          </div>
        </fieldset>

        <button
          className="btn btn-primary admin-create-school__submit"
          type="submit"
          disabled={submitting || emailStatus === "taken" || emailStatus === "checking"}
        >
          {submitting ? "Сохранение..." : "Зарегистрировать школу"}
        </button>
      </form>
    </div>
  );
}
