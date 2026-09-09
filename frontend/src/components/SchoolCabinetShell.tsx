import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SchoolProvider } from "../context/SchoolContext";
import { SchoolCabinetLayout } from "./SchoolCabinetLayout";

export function SchoolCabinetShell() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="loading-state">Загрузка...</div>;
  }

  if (!user || (user.accountType !== "school" && user.accountType !== "admin")) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SchoolProvider>
      <SchoolCabinetLayout
        userEmail={user.email}
        onLogout={() => void logout()}
      >
        <Outlet />
      </SchoolCabinetLayout>
    </SchoolProvider>
  );
}
