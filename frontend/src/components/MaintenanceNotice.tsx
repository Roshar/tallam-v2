import { Link } from "react-router-dom";

export function MaintenanceNotice() {
  return (
    <div className="maintenance-notice" role="status">
      <p className="maintenance-notice__title">Доступна новая версия</p>
      <p>
        Платформа Tallam обновлена. Если вы нашли проблему или ошибку, сообщите
        об этом в разделе{" "}
        <Link to="/school/feedback">«Отзывы и пожелания»</Link>.
      </p>
    </div>
  );
}
