import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SiteFooter, SiteHeader } from "../components/Layout";

type Tab = "school" | "methodist";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [tab, setTab] = useState<Tab>("school");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="app-shell">
      <SiteHeader centered />
      <main className="main-auth">
        <div className="white-container">
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={`tab${tab === "school" ? " active" : ""}`}
              onClick={() => setTab("school")}
            >
              Школа
            </button>
            <button
              type="button"
              role="tab"
              className={`tab${tab === "methodist" ? " active" : ""}`}
              onClick={() => setTab("methodist")}
            >
              Методист
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error ? <p className="form-error">{error}</p> : null}

            <div className="form-field">
              <input
                className="form-input"
                type="text"
                name="email"
                placeholder="Логин"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-field">
              <input
                className="form-input"
                type="password"
                name="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Вход..." : "Войти"}
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
