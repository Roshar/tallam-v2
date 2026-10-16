import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Оболочка личного кабинета учителя: шапка, меню и защита маршрутов.
 *
 * Меню намеренно описано массивом: позже сюда добавятся «Вакансии»,
 * «Материалы» и «План развития» без переписывания разметки.
 */
const TEACHER_SECTIONS: Array<{ to: string; label: string }> = [
  { to: "/teacher/cabinet", label: "Главная" },
  { to: "/teacher/evaluations", label: "Мои оценки" },
  { to: "/teacher/profile", label: "Профиль" },
];

export function TeacherCabinetShell() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="loading-state">Загрузка...</div>;
  }

  if (!user || user.accountType !== "teacher") {
    const next =
      user?.accountType === "admin"
        ? "/admin/cabinet"
        : user?.accountType === "accountant"
          ? "/status"
          : user?.accountType === "school"
            ? "/school/cabinet"
            : "/auth";
    return <Navigate to={next} replace />;
  }

  return (
    <div className="app-shell">
      <header className="cabinet-nav">
        <div className="cabinet-nav__inner page-container">
          <div className="cabinet-nav__brand">
            <span className="cabinet-nav__logo">Таллам</span>
            <span className="cabinet-nav__school">Личный кабинет учителя</span>
          </div>
          <div className="cabinet-nav__user">
            <span className="cabinet-nav__email">{user.email}</span>
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <nav className="cabinet-tabs" aria-label="Разделы кабинета">
        <div className="cabinet-tabs__inner page-container">
          <ul className="cabinet-menu">
            {TEACHER_SECTIONS.map((section) => (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  end={section.to === "/teacher/cabinet"}
                  className={({ isActive }) =>
                    `cabinet-menu__item${isActive ? " active" : ""}`
                  }
                >
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main className="cabinet-main">
        <div className="page-container cabinet-content">
          <Outlet />
        </div>
      </main>

      <footer className="site-footer">
        <div className="page-container">Таллам — платформа анализа урока</div>
      </footer>
    </div>
  );
}
