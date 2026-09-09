import type { ReactNode } from "react";

interface SiteHeaderProps {
  centered?: boolean;
}

export function SiteHeader({ centered = false }: SiteHeaderProps) {
  return (
    <header className={`main-header${centered ? " main-header--center" : ""}`}>
      <h1 className="main-header__heading">Tallam</h1>
      <div className="main-header__blue-line" />
      <p className="main-header__info">
        Информационно-аналитическая платформа
      </p>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner page-container">
        <div>
          <span>Техподдержка: </span>
          <a href="mailto:webrush@mail.ru">webrush@mail.ru</a>
        </div>
        <div>© 2020–2026, Tallam</div>
      </div>
    </footer>
  );
}

interface CabinetLayoutProps {
  roleLabel: string;
  userEmail: string;
  onLogout: () => void;
  menu: Array<{
    id: string;
    label: string;
    active?: boolean;
    disabled?: boolean;
    soon?: boolean;
  }>;
  children: ReactNode;
}

export function CabinetLayout({
  roleLabel,
  userEmail,
  onLogout,
  menu,
  children,
}: CabinetLayoutProps) {
  return (
    <div className="app-shell">
      <nav className="cabinet-nav">
        <div className="cabinet-nav__inner page-container">
          <div className="cabinet-nav__brand">
            <h1 className="cabinet-nav__logo">Tallam</h1>
            <span className="cabinet-nav__badge">{roleLabel}</span>
          </div>
          <div className="cabinet-nav__user">
            <span className="cabinet-nav__email">{userEmail}</span>
            <button className="btn btn-ghost" type="button" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <main className="cabinet-main">
        <div className="page-container cabinet-sidebar-layout">
          <aside className="cabinet-sidebar">
            <p className="cabinet-sidebar__title">Разделы</p>
            <ul className="cabinet-menu">
              {menu.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`cabinet-menu__item${item.active ? " active" : ""}`}
                    disabled={item.disabled}
                  >
                    {item.label}
                    {item.soon ? <span className="cabinet-menu__soon">скоро</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="cabinet-content">{children}</div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
