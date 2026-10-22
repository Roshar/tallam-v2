import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, type User } from "../api";
import { useAuth } from "../components/AuthContext";

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const response = await api<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(response.user);
      navigate("/");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Ошибка",
      );
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <div className="brand">
          Tallam <b>ИРО</b>
        </div>
        <h1>Вход в аналитический контур</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button>Войти</button>
      </form>
    </main>
  );
}
