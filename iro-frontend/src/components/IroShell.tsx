import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, setUnauthorized, type User } from "../api";
import { useAuth } from "./AuthContext";

const roleLabels: Record<User["role"], string> = {
  iro_viewer: "Наблюдатель",
  iro_methodologist: "Методист",
  iro_admin: "Администратор ИРО",
};

export function IroShell() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setUnauthorized(() => {
      setUser(null);
      navigate("/login");
    });
  }, [navigate, setUser]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    navigate("/login");
  }

  return (
    <div>
      <header>
        <div className="brand">
          Tallam <b>ИРО</b>
        </div>
        <nav>
          <NavLink to="/" end>
            Главная
          </NavLink>
          <NavLink to="/schools">Школы</NavLink>
          <NavLink to="/analytics">Аналитика</NavLink>
          <NavLink to="/cards">Карты оценивания</NavLink>
        </nav>
        <div className="profile">
          <span>{user ? roleLabels[user.role] : ""}</span>
          <button className="link" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
