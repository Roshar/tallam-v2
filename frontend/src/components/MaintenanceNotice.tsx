import { Link } from "react-router-dom";
import { SupportContacts } from "./SupportContacts";

export function MaintenanceNotice({
  variant = "page",
  showFeedbackLink = false,
  showContacts = false,
}: {
  variant?: "banner" | "page";
  showFeedbackLink?: boolean;
  showContacts?: boolean;
}) {
  return (
    <div
      className={`maintenance-notice maintenance-notice--${variant}`}
      role="status"
    >
      <p className="maintenance-notice__title">Доступна новая версия</p>
      <p>
        Платформа Tallam обновлена. Если вы нашли проблему или ошибку, сообщите
        об этом
        {showFeedbackLink ? (
          <>
            {" "}
            в разделе{" "}
            <Link to="/school/feedback">«Отзывы и пожелания»</Link>.
          </>
        ) : (
          <> после входа в разделе «Отзывы и пожелания».</>
        )}
      </p>
      {showContacts ? <SupportContacts variant="compact" /> : null}
    </div>
  );
}
