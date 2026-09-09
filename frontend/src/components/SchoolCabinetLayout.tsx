import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useSchool } from "../context/SchoolContext";

export const SCHOOL_MENU = [
  { id: "home", label: "Главная", to: "/school/cabinet" },
  { id: "workers", label: "База работников", to: "/school/workers" },
  {
    id: "lesson-analysis",
    label: "Проект «Анализ урока»",
    to: "/school/lesson-analysis",
  },
] as const;

interface SchoolCabinetLayoutProps {
  userEmail: string;
  onLogout: () => void;
  children: ReactNode;
}

export function SchoolCabinetLayout({
  userEmail,
  onLogout,
  children,
}: SchoolCabinetLayoutProps) {
  const { profile } = useSchool();

  return (
    <div className="app-shell">
      <header className="cabinet-header">
        <nav className="cabinet-nav">
          <div className="cabinet-nav__inner page-container">
            <div className="cabinet-nav__brand">
              <div>
                <h1 className="cabinet-nav__logo">Tallam</h1>
                {profile?.schoolName ? (
                  <p className="cabinet-nav__school">{profile.schoolName}</p>
                ) : null}
              </div>
              <span className="cabinet-nav__badge">Школа</span>
            </div>
            <div className="cabinet-nav__user">
              <span className="cabinet-nav__email">{userEmail}</span>
              <button className="btn btn-ghost" type="button" onClick={onLogout}>
                Выйти
              </button>
            </div>
          </div>
        </nav>

        <nav className="cabinet-tabs" aria-label="Разделы кабинета">
          <div className="cabinet-tabs__inner page-container">
            <ul className="cabinet-menu">
              {SCHOOL_MENU.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/school/cabinet"}
                    className={({ isActive }) =>
                      `cabinet-menu__item${isActive ? " active" : ""}`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      <main className="cabinet-main">
        <div className="page-container cabinet-content">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner page-container">
          <div>
            <span>Техподдержка: </span>
            <a href="mailto:webrush@mail.ru">webrush@mail.ru</a>
          </div>
          <div>© 2020–2026, Tallam</div>
        </div>
      </footer>
    </div>
  );
}
