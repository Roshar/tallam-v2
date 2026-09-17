import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface SchoolPasswordFormProps {
  idPrefix?: string;
}

export function SchoolPasswordForm({ idPrefix = "school-password" }: SchoolPasswordFormProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user?.impersonatedBy) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setSubmitting(true);
    try {
      await api.changeSchoolPassword(password, confirmPassword);
      window.location.assign("/auth");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить пароль");
      setSubmitting(false);
    }
  }

  return (
    <section className="school-password" id="password">
      <h3>Пароль кабинета</h3>
      <p>
        Новый пароль сохраняется сразу, текущий пароль подтверждать не нужно.
      </p>
      <div className="alert alert-warning">
        Внимание: после смены пароля вам придётся войти заново. Вы будете
        выведены из личного кабинета.
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <form className="school-password__form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor={`${idPrefix}-new`}>
            Новый пароль
          </label>
          <div className="form-input-wrap">
            <input
              id={`${idPrefix}-new`}
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
          <label className="form-label" htmlFor={`${idPrefix}-confirm`}>
            Подтверждение пароля
          </label>
          <input
            id={`${idPrefix}-confirm`}
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

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Сохранение..." : "Сохранить пароль"}
        </button>
      </form>
    </section>
  );
}
