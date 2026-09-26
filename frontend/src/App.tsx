import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AdminCabinetShell } from "./components/AdminCabinetShell";
import { SchoolCabinetShell } from "./components/SchoolCabinetShell";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { MethodistCabinetPage } from "./pages/MethodistCabinetPage";
import { SchoolHomePage } from "./pages/school/SchoolHomePage";
import { SchoolGuidePage } from "./pages/school/SchoolGuidePage";
import { SchoolFeedbackPage } from "./pages/school/SchoolFeedbackPage";
import { TeacherProfilePage } from "./pages/school/TeacherProfilePage";
import { WorkersPage } from "./pages/school/WorkersPage";
import { LessonAnalysisPage } from "./pages/school/LessonAnalysisPage";
import { LessonAnalysisMembersPage } from "./pages/school/LessonAnalysisMembersPage";
import { ProjectTeacherPage } from "./pages/school/ProjectTeacherPage";
import { EvaluateChoosePage } from "./pages/school/EvaluateChoosePage";
import { EvaluateFormPage } from "./pages/school/EvaluateFormPage";
import { EvaluationViewPage } from "./pages/school/EvaluationViewPage";
import { SchoolSubscriptionPage } from "./pages/school/SchoolSubscriptionPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminSchoolDetailPage } from "./pages/admin/AdminSchoolDetailPage";
import { AdminCreateSchoolPage } from "./pages/admin/AdminCreateSchoolPage";
import { AdminSchoolsPage } from "./pages/admin/AdminSchoolsPage";
import { AdminSubscriptionsPage } from "./pages/admin/AdminSubscriptionsPage";
import { AdminRenewalsPage } from "./pages/admin/AdminRenewalsPage";
import { AdminLogsPage } from "./pages/admin/AdminLogsPage";
import { AdminFeedbackPage } from "./pages/admin/AdminFeedbackPage";
import { AdminFeedbackThreadPage } from "./pages/admin/AdminFeedbackThreadPage";
import { AdminRecoveryPage } from "./pages/admin/AdminRecoveryPage";
import { AccountantStatusPage } from "./pages/AccountantStatusPage";
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
import "./styles/admin.css";
import "./styles/school-subscription.css";
import "./styles/status.css";

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
            <Route path="subscription" element={<SchoolSubscriptionPage />} />
            <Route path="cabinet" element={<SchoolHomePage />} />
            <Route path="guide" element={<SchoolGuidePage />} />
            <Route path="feedback" element={<SchoolFeedbackPage />} />
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
              path="lesson-analysis/teachers/:teacherId/cards/:cardId"
              element={<EvaluationViewPage />}
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
          <Route path="/status" element={<AccountantStatusPage />} />

          <Route path="/admin" element={<AdminCabinetShell />}>
            <Route path="cabinet" element={<AdminDashboardPage />} />
            <Route path="schools" element={<AdminSchoolsPage />} />
            <Route path="schools/new" element={<AdminCreateSchoolPage />} />
            <Route path="schools/:schoolId" element={<AdminSchoolDetailPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="renewals" element={<AdminRenewalsPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route
              path="feedback/:schoolId"
              element={<AdminFeedbackThreadPage />}
            />
            <Route path="recovery" element={<AdminRecoveryPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route
              path="subscriptions/:schoolId"
              element={<AdminSchoolDetailPage />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
