import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setTokenValid(false);
      setTokenError("Ссылка недействительна");
      return;
    }

    api
      .validateResetToken(token)
      .then((result) => {
        setSchoolName(result.schoolName);
        setTokenValid(true);
      })
      .catch((err: Error) => {
        setTokenValid(false);
        setTokenError(err.message);
      })
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const result = await api.resetPassword(token, password, confirmPassword);
      setMessage(result.message);
      setTimeout(() => navigate("/auth"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка смены пароля");
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
          Создание нового пароля для школы
          {schoolName ? `: ${schoolName}` : ""}
        </p>
      </aside>

      <section className="auth-panel">
        <div className="auth-mobile-header">
          <h1 className="auth-mobile-header__logo">Tallam</h1>
        </div>

        <div className="auth-card">
          <h2 className="auth-card__title">Новый пароль</h2>
          <p className="auth-card__subtitle">
            {schoolName ? (
              <>
                Школа: <strong>{schoolName}</strong>
                <br />
              </>
            ) : null}
            Придумайте новый пароль для входа в личный кабинет
          </p>

          {checking ? (
            <p className="auth-card__subtitle">Проверка ссылки...</p>
          ) : null}

          {!checking && !tokenValid ? (
            <>
              <div className="alert alert-error">{tokenError}</div>
              <p className="auth-card__support">
                <Link to="/auth/forgot">Оставить обращение</Link>
              </p>
            </>
          ) : null}

          {!checking && tokenValid ? (
            <>
              <p className="auth-card__support">
                Открытие страницы не аннулирует ссылку. Она станет
                недействительной только после успешной смены пароля или
                истечения срока.
              </p>
              <form onSubmit={handleSubmit}>
                {error ? <div className="alert alert-error">{error}</div> : null}
                {message ? (
                  <div className="alert alert-success">{message}</div>
                ) : null}

                <div className="form-group">
                  <label className="form-label" htmlFor="password">
                    Новый пароль
                  </label>
                  <div className="form-input-wrap">
                    <input
                      id="password"
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Минимум 6 символов"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="form-input-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? "Скрыть" : "Показать"}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    Подтверждение пароля
                  </label>
                  <input
                    id="confirmPassword"
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Сохранение..." : "Сохранить пароль"}
                </button>
              </form>
            </>
          ) : null}

          {!checking && tokenValid && !message ? (
            <p className="auth-card__support">
              <Link to="/auth">← Вернуться ко входу</Link>
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
