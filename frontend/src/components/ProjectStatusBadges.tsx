interface ProjectStatusBadgesProps {
  labels: string[];
  /** Компактный вид для таблицы: «Вне проекта» вместо длинной фразы */
  compact?: boolean;
}

export function ProjectStatusBadges({
  labels,
  compact = false,
}: ProjectStatusBadgesProps) {
  if (labels.length === 0) {
    return (
      <span
        className={`project-status${compact ? " project-status--muted" : " project-badge project-badge--neutral"}`}
      >
        {compact ? "Вне проекта" : "Не участвует в проекте"}
      </span>
    );
  }

  if (compact) {
    return (
      <span className="project-status project-status--active" title={labels.join(", ")}>
        {labels.join(", ")}
      </span>
    );
  }

  return (
    <div className="project-badges">
      {labels.map((label) => (
        <span key={label} className="project-badge project-badge--active">
          {label}
        </span>
      ))}
    </div>
  );
}
