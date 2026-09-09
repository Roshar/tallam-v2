import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Tab = "school" | "methodist";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [tab, setTab] = useState<Tab>("school");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    if (user.accountType === "school" || user.accountType === "admin") {
      return <Navigate to="/school/cabinet" replace />;
    }
    if (user.accountType === "methodist") {
      return <Navigate to="/methodist/cabinet" replace />;
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email.trim(), password, tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
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
          Информационно-аналитическая платформа для систематизации оценки уроков
        </p>
        <ul className="auth-brand__features">
          <li>База учителей и накопление оценок</li>
          <li>Оценочные карты прямо на уроке</li>
          <li>Автоматические заключения и рекомендации</li>
        </ul>
      </aside>

      <section className="auth-panel">
        <div className="auth-mobile-header">
          <h1 className="auth-mobile-header__logo">Tallam</h1>
        </div>

        <div className="auth-card">
          <h2 className="auth-card__title">Вход в систему</h2>
          <p className="auth-card__subtitle">
            {tab === "school"
              ? "Личный кабинет образовательной организации"
              : "Кабинет методиста"}
          </p>

          <div className="segmented-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "school"}
              className={`segmented-tabs__btn${tab === "school" ? " active" : ""}`}
              onClick={() => setTab("school")}
            >
              Школа
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "methodist"}
              className={`segmented-tabs__btn${tab === "methodist" ? " active" : ""}`}
              onClick={() => setTab("methodist")}
            >
              Методист
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error ? <div className="alert alert-error">{error}</div> : null}

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Логин (email)
              </label>
              <input
                id="email"
                className="form-input"
                type="text"
                name="email"
                placeholder="example@school.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Пароль
              </label>
              <div className="form-input-wrap">
                <input
                  id="password"
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="form-input-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? "Скрыть" : "Показать"}
                </button>
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Вход..." : "Войти"}
            </button>

            {tab === "school" ? (
              <p className="auth-forgot-link">
                <Link to="/auth/forgot">Забыли пароль?</Link>
              </p>
            ) : null}
          </form>

          <p className="auth-card__support">
            Нужна помощь?{" "}
            <a href="mailto:webrush@mail.ru">webrush@mail.ru</a>
          </p>
        </div>
      </section>
    </div>
  );
}
