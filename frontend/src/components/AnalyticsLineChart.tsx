interface ChartPoint {
  label: string;
  value: number;
  /** Подпись под точкой, например дата. */
  caption?: string;
}

/**
 * Лёгкий линейный график на inline-SVG: без библиотек и лишних зависимостей.
 * Всегда рисует шкалу 0-100%, точки ставит только по фактическим данным -
 * искусственных месяцев не добавляет (это делает backend, отдавая точки).
 */
export function AnalyticsLineChart({
  points,
  ariaLabel,
  emptyLabel,
}: {
  points: ChartPoint[];
  ariaLabel: string;
  emptyLabel: string;
}) {
  if (points.length === 0) {
    return <p className="analytics-empty">{emptyLabel}</p>;
  }

  const width = 640;
  const height = 220;
  const padding = { top: 14, right: 16, bottom: 30, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xFor = (index: number): number => {
    if (points.length === 1) return padding.left + plotWidth / 2;
    return padding.left + (plotWidth * index) / (points.length - 1);
  };
  const yFor = (value: number): number =>
    padding.top + plotHeight - (plotHeight * clamp(value)) / 100;

  const path = points
    .map((point, index) => `${xFor(index)},${yFor(point.value)}`)
    .join(" ");

  const gridValues = [0, 25, 50, 75, 100];

  return (
    <div className="analytics-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="analytics-chart__svg"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yFor(value)}
              y2={yFor(value)}
              className="analytics-chart__grid"
            />
            <text
              x={padding.left - 8}
              y={yFor(value) + 4}
              textAnchor="end"
              className="analytics-chart__axis"
            >
              {value}
            </text>
          </g>
        ))}

        {points.length > 1 ? (
          <polyline points={path} className="analytics-chart__line" />
        ) : null}

        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={xFor(index)}
              cy={yFor(point.value)}
              r={points.length > 24 ? 2.5 : 4}
              className="analytics-chart__dot"
            >
              <title>{`${point.caption ?? point.label}: ${point.value}%`}</title>
            </circle>
            <text
              x={xFor(index)}
              y={yFor(point.value) - 10}
              textAnchor="middle"
              className="analytics-chart__value"
            >
              {point.value}%
            </text>
          </g>
        ))}

        <text
          x={padding.left}
          y={height - 8}
          textAnchor="start"
          className="analytics-chart__axis"
        >
          {points[0].caption ?? points[0].label}
        </text>
        {points.length > 1 ? (
          <text
            x={width - padding.right}
            y={height - 8}
            textAnchor="end"
            className="analytics-chart__axis"
          >
            {points[points.length - 1].caption ??
              points[points.length - 1].label}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
