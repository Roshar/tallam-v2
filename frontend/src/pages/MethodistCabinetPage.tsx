import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SiteFooter, SiteHeader } from "../components/Layout";

export function MethodistCabinetPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="app-shell" />;
  }

  if (!user || user.accountType !== "methodist") {
    return <Navigate to="/auth" replace />;
  }

  const fullName = [user.surname, user.firstname, user.patronymic]
    .filter(Boolean)
    .join(" ");

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
          <h2>Кабинет методиста</h2>
          <p>{fullName || user.email}</p>
          <p>Раздел в разработке — следующий этап после школьного кабинета.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
