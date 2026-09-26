import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CabinetLayout } from "../components/Layout";

export function MethodistCabinetPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="loading-state">Загрузка...</div>;
  }

  if (user?.accountType === "accountant") {
    return <Navigate to="/status" replace />;
  }

  if (!user || user.accountType !== "methodist") {
    return <Navigate to="/auth" replace />;
  }

  const fullName = [user.surname, user.firstname, user.patronymic]
    .filter(Boolean)
    .join(" ");

  return (
    <CabinetLayout
      roleLabel="Методист"
      userEmail={user.email}
      onLogout={() => void logout()}
      menu={[
        { id: "home", label: "Главная", active: true },
        { id: "schools", label: "Школы", disabled: true, soon: true },
        { id: "cards", label: "Проверка карт", disabled: true, soon: true },
      ]}
    >
      <div className="card">
        <div className="card-body">
          <h2 className="page-title">Кабинет методиста</h2>
          <p className="page-subtitle">{fullName || user.email}</p>

          <div className="cabinet-welcome">
            <p className="cabinet-welcome__title">Раздел в разработке</p>
            <p className="cabinet-welcome__text">
              Следующий этап — просмотр школ, проверка оценочных карт и
              аналитика по методистам.
            </p>
          </div>
        </div>
      </div>
    </CabinetLayout>
  );
}
