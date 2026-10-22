import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="center">Загрузка...</p>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}
