import type { ReactNode } from "react";
import type {
  AnalyticsCardType,
  SchoolDistributionBucket,
  SectionAverage,
  SectionHighlight,
} from "../types/analytics";

const CARD_TYPE_LABELS: Record<AnalyticsCardType, string> = {
  method: "Методическая",
  full: "Комплексная",
};

export function AnalyticsCardTypeSwitch({
  value,
  onChange,
  disabled,
}: {
  value: AnalyticsCardType;
  onChange: (value: AnalyticsCardType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="analytics-switch" role="tablist" aria-label="Тип карты">
      {(Object.keys(CARD_TYPE_LABELS) as AnalyticsCardType[]).map((type) => {
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`analytics-switch__item${selected ? " active" : ""}`}
            onClick={() => onChange(type)}
            disabled={disabled}
          >
            {CARD_TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}

/** Порог тот же, что в карточке оценки: 75 - выше базового, 50 - базовый. */
function levelClass(percent: number): string {
  if (percent >= 75) return "analytics-bar--high";
  if (percent >= 50) return "analytics-bar--mid";
  return "analytics-bar--low";
}

export function AnalyticsSectionBars({
  sections,
  emptyLabel,
}: {
  sections: SectionAverage[];
  emptyLabel: string;
}) {
  if (sections.length === 0) {
    return <p className="analytics-empty">{emptyLabel}</p>;
  }

  return (
    <ul className="analytics-bars">
      {sections.map((section) => (
        <li key={section.id} className="analytics-bars__row">
          <div className="analytics-bars__head">
            <span className="analytics-bars__title">{section.title}</span>
            <span className="analytics-bars__value">{section.percent}%</span>
          </div>
          <div
            className="analytics-bars__track"
            role="img"
            aria-label={`${section.title}: ${section.percent}%`}
          >
            <div
              className={`analytics-bars__fill ${levelClass(section.percent)}`}
              style={{ width: `${Math.min(100, Math.max(0, section.percent))}%` }}
            />
          </div>
          <div className="analytics-bars__meta">
            средний балл {section.averageSum} из {section.max}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsHighlights({
  strengths,
  weaknesses,
}: {
  strengths: SectionHighlight[];
  weaknesses: SectionHighlight[];
}) {
  if (strengths.length === 0 && weaknesses.length === 0) {
    return null;
  }

  return (
    <div className="analytics-highlights">
      <div className="analytics-highlights__column">
        <h4 className="analytics-highlights__title analytics-highlights__title--good">
          Сильные стороны
        </h4>
        {strengths.length ? (
          <ul className="analytics-highlights__list">
            {strengths.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                <strong>{item.percent}%</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="analytics-empty">Пока нечего выделить.</p>
        )}
      </div>

      <div className="analytics-highlights__column">
        <h4 className="analytics-highlights__title analytics-highlights__title--weak">
          Зоны развития
        </h4>
        {weaknesses.length ? (
          <ul className="analytics-highlights__list">
            {weaknesses.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                <strong>{item.percent}%</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="analytics-empty">
            Все разделы идут на одном уровне - слабых мест не выделяется.
          </p>
        )}
      </div>
    </div>
  );
}

export function AnalyticsDistribution({
  buckets,
}: {
  buckets: SchoolDistributionBucket[];
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <ul className="analytics-bars">
      {buckets.map((bucket) => (
        <li key={bucket.id} className="analytics-bars__row">
          <div className="analytics-bars__head">
            <span className="analytics-bars__title">{bucket.label}</span>
            <span className="analytics-bars__value">
              {bucket.count}{" "}
              {bucket.count === 1 ? "учитель" : bucket.count < 5 ? "учителя" : "учителей"}
            </span>
          </div>
          <div className="analytics-bars__track">
            <div
              className={`analytics-bars__fill ${levelClass(bucket.min)}`}
              style={{ width: `${(bucket.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsDelta({
  delta,
  suffix = "п.п.",
}: {
  delta: number | null;
  suffix?: string;
}) {
  if (delta === null || delta === 0 || Number.isNaN(delta)) {
    return null;
  }

  const sign = delta > 0 ? "+" : "−";
  const kind = delta > 0 ? "up" : "down";

  return (
    <span className={`analytics-delta analytics-delta--${kind}`}>
      {sign}
      {Math.abs(delta)} {suffix}
    </span>
  );
}

export function AnalyticsCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="analytics-card">
      <header className="analytics-card__header">
        <h3 className="analytics-card__title">{title}</h3>
        {hint ? <p className="analytics-card__hint">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}
