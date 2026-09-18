export function MaintenanceNotice({
  variant = "page",
}: {
  variant?: "banner" | "page";
}) {
  return (
    <div
      className={`maintenance-notice maintenance-notice--${variant}`}
      role="status"
    >
      <p className="maintenance-notice__title">Технические работы</p>
      <p>
        Сейчас на платформе идут технические работы до 20.09.2026.
      </p>
      <p>
        Оплата по подпискам, продлениям и новым договорам будет доступна с
        20.09.2026 с 09:00.
      </p>
      <p className="maintenance-notice__link-row">
        Пока можно пользоваться предыдущей версией:{" "}
        <a href="https://old.tallam.ru" target="_blank" rel="noopener noreferrer">
          old.tallam.ru
        </a>
      </p>
    </div>
  );
}
