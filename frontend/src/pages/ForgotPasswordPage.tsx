import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const result = await api.forgotPassword(email.trim());
      setMessage(result.message);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка запроса");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <h1 className="auth-brand__logo">Tallam</h1>
        <div className="auth-brand__line" />
        <p className="auth-brand__tagline">
          Восстановление доступа к личному кабинету школы
        </p>
      </aside>

      <section className="auth-panel">
        <div className="auth-mobile-header">
          <h1 className="auth-mobile-header__logo">Tallam</h1>
        </div>

        <div className="auth-card">
          <h2 className="auth-card__title">Забыли пароль?</h2>
          <p className="auth-card__subtitle">
            Укажите email школы — мы отправим ссылку для создания нового пароля
          </p>

          <form onSubmit={handleSubmit}>
            {error ? <div className="alert alert-error">{error}</div> : null}
            {message ? <div className="alert alert-success">{message}</div> : null}

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email школы
              </label>
              <input
                id="email"
                className="form-input"
                type="email"
                name="email"
                placeholder="example@school.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Отправка..." : "Отправить ссылку"}
            </button>
          </form>

          <p className="auth-card__support">
            <Link to="/auth">← Вернуться ко входу</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
