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
      <div className="site-footer__inner">
        <div>
          <p>Техническая поддержка:</p>
          <p>
            Эл. почта: <a href="mailto:webrush@mail.ru">webrush@mail.ru</a>
          </p>
        </div>
        <div>© 2020–2026, Tallam</div>
      </div>
    </footer>
  );
}
