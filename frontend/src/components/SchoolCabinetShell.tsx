import { Navigate, Outlet, useLocation } from "react-router-dom";
import { schoolLandingPath } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { SchoolProvider } from "../context/SchoolContext";
import { SchoolCabinetLayout } from "./SchoolCabinetLayout";

export function SchoolCabinetShell() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading-state">Загрузка...</div>;
  }

  if (!user || user.accountType !== "school") {
    return <Navigate to={user?.accountType === "admin" ? "/admin/cabinet" : "/auth"} replace />;
  }

  if (
    user.accountType === "school" &&
    user.cabinetAccess === "billing" &&
    location.pathname !== "/school/subscription"
  ) {
    return <Navigate to={schoolLandingPath(user)} replace />;
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
