import { FormEvent, useRef, useState } from "react";
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
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (user?.impersonatedBy) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setError("");
    setSuccess("");

    const form = new FormData(event.currentTarget);
    const nextPassword = String(form.get("password") ?? "");
    const nextConfirm = String(form.get("confirmPassword") ?? "");

    if (nextPassword !== nextConfirm) {
      setError("Пароли не совпадают");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await api.changeSchoolPassword(nextPassword, nextConfirm);
      setPassword("");
      setConfirmPassword("");
      setSuccess(
        result.message ||
          "Пароль обновлён. При следующем входе используйте новый пароль.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить пароль");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="school-password" id="password">
      <h3>Пароль кабинета</h3>
      <p>
        Новый пароль сохраняется сразу, текущий пароль подтверждать не нужно.
        Сеанс останется открытым.
      </p>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

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
              name="password"
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
            name="confirmPassword"
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
