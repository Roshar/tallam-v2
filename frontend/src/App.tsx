import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { MethodistCabinetPage } from "./pages/MethodistCabinetPage";
import { SchoolCabinetPage } from "./pages/SchoolCabinetPage";
import "./styles/variables.css";
import "./styles/auth.css";
import "./styles/cabinet.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<LoginPage />} />
          <Route path="/school/cabinet" element={<SchoolCabinetPage />} />
          <Route path="/methodist/cabinet" element={<MethodistCabinetPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
