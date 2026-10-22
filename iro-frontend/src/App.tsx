import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import { IroShell } from "./components/IroShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SchoolAnalyticsPage } from "./pages/SchoolAnalyticsPage";
import { SchoolsPage } from "./pages/SchoolsPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <IroShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="schools" element={<SchoolsPage />} />
          <Route path="schools/:schoolId" element={<SchoolAnalyticsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route
            path="cards"
            element={
              <>
                <h1>Карты оценивания</h1>
                <div className="empty">Просмотр карт появится на этапе 2.</div>
              </>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
