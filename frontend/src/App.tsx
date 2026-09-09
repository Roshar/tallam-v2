import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SchoolCabinetShell } from "./components/SchoolCabinetShell";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { MethodistCabinetPage } from "./pages/MethodistCabinetPage";
import { SchoolHomePage } from "./pages/school/SchoolHomePage";
import { TeacherProfilePage } from "./pages/school/TeacherProfilePage";
import { WorkersPage } from "./pages/school/WorkersPage";
import { LessonAnalysisPage } from "./pages/school/LessonAnalysisPage";
import { LessonAnalysisMembersPage } from "./pages/school/LessonAnalysisMembersPage";
import { ProjectTeacherPage } from "./pages/school/ProjectTeacherPage";
import { EvaluateChoosePage } from "./pages/school/EvaluateChoosePage";
import { EvaluateFormPage } from "./pages/school/EvaluateFormPage";
import "./styles/variables.css";
import "./styles/components.css";
import "./styles/auth.css";
import "./styles/cabinet.css";
import "./styles/table.css";
import "./styles/modal.css";
import "./styles/teacher-profile.css";
import "./styles/project-members.css";
import "./styles/project-teacher.css";
import "./styles/evaluate.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<LoginPage />} />
          <Route path="/auth/forgot" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset/:token" element={<ResetPasswordPage />} />

          <Route path="/school" element={<SchoolCabinetShell />}>
            <Route path="cabinet" element={<SchoolHomePage />} />
            <Route path="workers" element={<WorkersPage />} />
            <Route path="workers/:teacherId" element={<TeacherProfilePage />} />
            <Route path="lesson-analysis" element={<LessonAnalysisPage />} />
            <Route
              path="lesson-analysis/members"
              element={<LessonAnalysisMembersPage />}
            />
            <Route
              path="lesson-analysis/teachers/:teacherId"
              element={<ProjectTeacherPage />}
            />
            <Route
              path="lesson-analysis/teachers/:teacherId/evaluate"
              element={<EvaluateChoosePage />}
            />
            <Route
              path="lesson-analysis/teachers/:teacherId/evaluate/:cardType"
              element={<EvaluateFormPage />}
            />
          </Route>

          <Route path="/methodist/cabinet" element={<MethodistCabinetPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
