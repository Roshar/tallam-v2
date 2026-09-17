import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { api, schoolLandingPath } from "../api/client";
import { useAuth } from "../context/AuthContext";

const ADMIN_MENU = [
  { label: "Главная", to: "/admin/cabinet", enabled: true },
  { label: "Школы", to: "/admin/schools", enabled: true },
  { label: "Подписки", to: "/admin/subscriptions", enabled: true },
  { label: "Продления", to: "/admin/renewals", enabled: true },
  { label: "Отзывы", to: "/admin/feedback", enabled: true },
  { label: "Обращения", to: "/admin/recovery", enabled: true },
  { label: "Логи", to: "/admin/logs", enabled: true },
  { label: "Проекты", to: "/admin/projects", enabled: false },
  { label: "Методисты", to: "/admin/methodists", enabled: false },
] as const;

export function AdminCabinetShell() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const [renewalQueue, setRenewalQueue] = useState(0);
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [recoveryUnread, setRecoveryUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function loadQueue() {
      api
        .adminRenewalQueueCount()
        .then(({ awaitingConfirmation }) => {
          if (!cancelled) setRenewalQueue(awaitingConfirmation);
        })
        .catch(() => {
          if (!cancelled) setRenewalQueue(0);
        });
    }

    loadQueue();
    window.addEventListener("admin-renewals-updated", loadQueue);
    return () => {
      cancelled = true;
      window.removeEventListener("admin-renewals-updated", loadQueue);
    };
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    function loadFeedback() {
      api
        .adminFeedbackUnread()
        .then(({ unread }) => {
          if (!cancelled) setFeedbackUnread(unread);
        })
        .catch(() => {
          if (!cancelled) setFeedbackUnread(0);
        });
    }

    loadFeedback();
    window.addEventListener("admin-feedback-updated", loadFeedback);
    return () => {
      cancelled = true;
      window.removeEventListener("admin-feedback-updated", loadFeedback);
    };
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    function loadRecovery() {
      api
        .adminRecoveryUnread()
        .then(({ unread }) => {
          if (!cancelled) setRecoveryUnread(unread);
        })
        .catch(() => {
          if (!cancelled) setRecoveryUnread(0);
        });
    }

    loadRecovery();
    window.addEventListener("admin-recovery-updated", loadRecovery);
    return () => {
      cancelled = true;
      window.removeEventListener("admin-recovery-updated", loadRecovery);
    };
  }, [location.pathname]);

  if (loading) {
    return <div className="loading-state">Загрузка...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.accountType === "school") {
    return <Navigate to={schoolLandingPath(user)} replace />;
  }

  if (user.accountType !== "admin") {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="app-shell">
      <header className="cabinet-header admin-header">
        <nav className="cabinet-nav">
          <div className="cabinet-nav__inner page-container">
            <div className="cabinet-nav__brand">
              <div>
                <h1 className="cabinet-nav__logo">Tallam</h1>
                <p className="cabinet-nav__school">Панель управления платформой</p>
              </div>
              <span className="cabinet-nav__badge">Администратор</span>
            </div>

            <div className="cabinet-nav__user">
              <span className="cabinet-nav__email">{user.email}</span>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void logout()}
              >
                Выйти
              </button>
            </div>
          </div>
        </nav>

        <nav className="cabinet-tabs" aria-label="Разделы администратора">
          <div className="cabinet-tabs__inner page-container">
            <ul className="cabinet-menu">
              {ADMIN_MENU.map((item) => (
                <li key={item.to}>
                  {item.enabled ? (
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `cabinet-menu__item${isActive ? " active" : ""}`
                      }
                    >
                      {item.label}
                      {item.to === "/admin/renewals" && renewalQueue > 0 ? (
                        <span
                          className="cabinet-menu__badge"
                          aria-label={`${renewalQueue} заявок ожидают подтверждения оплаты`}
                        >
                          {renewalQueue > 99 ? "99+" : renewalQueue}
                        </span>
                      ) : null}
                      {item.to === "/admin/feedback" && feedbackUnread > 0 ? (
                        <span
                          className="cabinet-menu__badge"
                          aria-label={`${feedbackUnread} непрочитанных переписок`}
                        >
                          {feedbackUnread > 99 ? "99+" : feedbackUnread}
                        </span>
                      ) : null}
                      {item.to === "/admin/recovery" && recoveryUnread > 0 ? (
                        <span
                          className="cabinet-menu__badge"
                          aria-label={`${recoveryUnread} новых обращений`}
                        >
                          {recoveryUnread > 99 ? "99+" : recoveryUnread}
                        </span>
                      ) : null}
                    </NavLink>
                  ) : (
                    <span className="cabinet-menu__item admin-menu__disabled">
                      {item.label}
                      <span className="cabinet-menu__soon">скоро</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      <main className="cabinet-main">
        <div className="page-container cabinet-content">
          <Outlet />
        </div>
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
