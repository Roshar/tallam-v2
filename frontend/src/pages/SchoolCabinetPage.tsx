import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, type SchoolDashboard } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { SiteFooter, SiteHeader } from "../components/Layout";

export function SchoolCabinetPage() {
  const { user, loading, logout } = useAuth();
  const [dashboard, setDashboard] = useState<SchoolDashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.accountType === "methodist") {
      return;
    }

    api
      .schoolDashboard()
      .then(setDashboard)
      .catch((err: Error) => setError(err.message));
  }, [user]);

  if (loading) {
    return <div className="app-shell" />;
  }

  if (!user || (user.accountType !== "school" && user.accountType !== "admin")) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <div className="cabinet-topbar">
        <span className="cabinet-topbar__email">{user.email}</span>
        <button className="btn-secondary" type="button" onClick={() => void logout()}>
          Выйти
        </button>
      </div>

      <main className="cabinet-page">
        <section className="cabinet-card">
          <h2>Личный кабинет школы</h2>
          <p>Добро пожаловать в Tallam v2</p>

          {error ? <p className="form-error">{error}</p> : null}

          {dashboard ? (
            <dl className="cabinet-meta">
              <div>
                <dt>Школа</dt>
                <dd>{dashboard.schoolName ?? "—"}</dd>
              </div>
              <div>
                <dt>Учителей в базе</dt>
                <dd>{dashboard.teachersCount}</dd>
              </div>
              <div>
                <dt>ID школы</dt>
                <dd>{dashboard.schoolId}</dd>
              </div>
            </dl>
          ) : (
            <p>Загрузка данных...</p>
          )}

          <div className="cabinet-actions">
            <button className="btn-secondary" type="button" disabled>
              Учителя (скоро)
            </button>
            <button className="btn-secondary" type="button" disabled>
              Оценочные карты (скоро)
            </button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
