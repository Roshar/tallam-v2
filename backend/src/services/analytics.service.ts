import { query } from "../db/pool.js";
import {
  academicYearStartFromDate,
  formatAcademicYearLabel,
} from "./card.service.js";
import {
  type CardTypeKind,
  type ScaleSection,
  percentOf,
  scaleFor,
  sumKeysOf,
  sumKeysSql,
} from "./evaluation-scale.js";

/**
 * Аналитика по оценкам. Ничего не пишет и не меняет формулы оценивания:
 * читает уже сохранённые карты `card_from_project_teacher_mark3` и агрегирует их.
 *
 * Проценты считаются той же `percentOf(sum, max)`, что и в карточке
 * (`card-view.service.ts`), поэтому цифры аналитики совпадают с тем, что школа
 * видит внутри самой оценки. Опциональные критерии обрабатываются так же, как в
 * карточке - то есть значение -1 («0» на экране) уменьшает сумму, а 0 («-»)
 * оставляет максимум в знаменателе.
 */

export interface AcademicYearOption {
  startYear: number;
  label: string;
  isCurrent: boolean;
}

export interface AnalyticsPoint {
  date: string;
  dateLabel: string;
  percent: number;
  evaluations: number;
}

export interface SectionAverage {
  id: string;
  title: string;
  percent: number;
  max: number;
  averageSum: number;
  evaluations: number;
}

export interface SectionComparison {
  id: string;
  title: string;
  before: number;
  after: number;
  delta: number;
}

export interface SectionHighlight {
  id: string;
  title: string;
  percent: number;
}

export interface TeacherAnalytics {
  scope: "teacher";
  cardType: CardTypeKind;
  cardTypeLabel: string;
  academicYearStart: number;
  academicYearLabel: string;
  academicYears: AcademicYearOption[];
  /** Есть ли у учителя вообще оценки этого типа карты (за любые годы). */
  hasAnyOfType: boolean;
  /** Есть ли оценки этого типа в выбранном году. */
  hasDataInYear: boolean;
  points: AnalyticsPoint[];
  latest: { percent: number; date: string; dateLabel: string } | null;
  previous: { percent: number; date: string; dateLabel: string } | null;
  /** Изменение последней оценки к предыдущей, в процентных пунктах. */
  delta: number | null;
  sections: SectionAverage[];
  strengths: SectionHighlight[];
  weaknesses: SectionHighlight[];
  comparison: SectionComparison[];
}

export interface SchoolDistributionBucket {
  id: string;
  label: string;
  min: number;
  count: number;
}

export interface SchoolAnalytics {
  scope: "school";
  cardType: CardTypeKind;
  cardTypeLabel: string;
  academicYearStart: number;
  academicYearLabel: string;
  academicYears: AcademicYearOption[];
  hasAnyOfType: boolean;
  hasDataInYear: boolean;
  /** Средний итоговый процент оценённых учителей (по последней оценке каждого). */
  average: { percent: number; teachers: number; evaluations: number } | null;
  previousYear: {
    percent: number;
    academicYearStart: number;
    academicYearLabel: string;
    teachers: number;
  } | null;
  delta: number | null;
  points: AnalyticsPoint[];
  sections: SectionAverage[];
  distribution: SchoolDistributionBucket[];
}

export class AnalyticsError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MONTHS_RU = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatIsoDate(value: Date | string): string {
  const date = toDate(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(value: Date | string): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS_RU[date.getMonth()]} ${date.getFullYear()}`;
}

/** Учебный год идёт с сентября по август - та же логика, что в проекте. */
function academicYearRange(startYear: number): { from: string; to: string } {
  return { from: `${startYear}-09-01`, to: `${startYear + 1}-09-01` };
}

export function currentAcademicYearStart(now = new Date()): number {
  return academicYearStartFromDate(now);
}

export function academicYearLabel(startYear: number): string {
  return formatAcademicYearLabel(startYear);
}

interface YearBoundsRow {
  min_date: Date | null;
  max_date: Date | null;
}

/**
 * Список учебных годов для переключателя: только те, где есть данные, плюс
 * текущий год. Искусственные годы не добавляем.
 */
async function buildAcademicYears(
  boundsSql: string,
  params: unknown[],
): Promise<AcademicYearOption[]> {
  const rows = await query<YearBoundsRow[]>(boundsSql, params);
  const bounds = rows[0];
  const current = currentAcademicYearStart();

  const startYears = new Set<number>([current]);
  if (bounds?.min_date) {
    const oldest = academicYearStartFromDate(toDate(bounds.min_date));
    for (let year = oldest; year <= current; year += 1) {
      startYears.add(year);
    }
  }

  return [...startYears]
    .sort((a, b) => b - a)
    .map((startYear) => ({
      startYear,
      label: academicYearLabel(startYear),
      isCurrent: startYear === current,
    }));
}

const YEAR_BOUNDS_SQL = `SELECT MIN(create_mark_date) AS min_date, MAX(create_mark_date) AS max_date
   FROM card_from_project_teacher_mark3
   WHERE school_id = ?`;

const TEACHER_YEAR_BOUNDS_SQL = `SELECT MIN(create_mark_date) AS min_date, MAX(create_mark_date) AS max_date
   FROM card_from_project_teacher_mark3
   WHERE school_id = ? AND teacher_id = ?`;

async function countEvaluations(
  sql: string,
  params: unknown[],
): Promise<number> {
  const rows = await query<{ count: number }[]>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

async function cardTypeHasAny(
  schoolId: number,
  teacherId: string | null,
  cardType: CardTypeKind,
): Promise<boolean> {
  const scale = scaleFor(cardType);
  const teacherFilter = teacherId ? " AND teacher_id = ?" : "";
  const params: unknown[] = [schoolId, scale.dbCardType];
  if (teacherId) params.push(teacherId);

  const count = await countEvaluations(
    `SELECT COUNT(*) AS count FROM card_from_project_teacher_mark3
     WHERE school_id = ? AND card_type = ?${teacherFilter}`,
    params,
  );
  return count > 0;
}

function cardTypeLabel(cardType: CardTypeKind): string {
  return cardType === "method" ? "Методическая карта" : "Комплексная карта";
}

interface TeacherCardRow {
  id_card: number;
  create_mark_date: Date;
  [key: string]: unknown;
}

function sectionAverageFromCards(
  section: ScaleSection,
  cards: TeacherCardRow[],
): SectionAverage | null {
  if (cards.length === 0) return null;
  const totalSum = cards.reduce(
    (sum, card) => sum + sumKeysOf(card, section.keys),
    0,
  );
  const averageSum = totalSum / cards.length;
  return {
    id: section.id,
    title: section.title,
    percent: percentOf(averageSum, section.max),
    max: section.max,
    averageSum: Math.round(averageSum * 10) / 10,
    evaluations: cards.length,
  };
}

export async function getTeacherAnalytics(
  schoolId: number,
  teacherId: string,
  cardType: CardTypeKind,
  academicYearStart: number,
): Promise<TeacherAnalytics> {
  const teacherRows = await query<{ id_teacher: string }[]>(
    "SELECT id_teacher FROM teachers WHERE id_teacher = ? AND school_id = ? LIMIT 1",
    [teacherId, schoolId],
  );
  if (!teacherRows[0]) {
    throw new AnalyticsError("Работник не найден", 404);
  }

  const scale = scaleFor(cardType);
  const { from, to } = academicYearRange(academicYearStart);

  const [cards, academicYears, hasAnyOfType] = await Promise.all([
    query<TeacherCardRow[]>(
      `SELECT id_card, create_mark_date, ${scale.keys.map((key) => `\`${key}\``).join(", ")}
       FROM card_from_project_teacher_mark3
       WHERE teacher_id = ? AND school_id = ? AND card_type = ?
         AND create_mark_date >= ? AND create_mark_date < ?
       ORDER BY create_mark_date ASC, id_card ASC`,
      [teacherId, schoolId, scale.dbCardType, from, to],
    ),
    buildAcademicYears(TEACHER_YEAR_BOUNDS_SQL, [schoolId, teacherId]),
    cardTypeHasAny(schoolId, teacherId, cardType),
  ]);

  const perCardPercents = new Map<number, number>();
  const points: AnalyticsPoint[] = cards.map((card) => {
    const sum = sumKeysOf(card, scale.keys);
    const percent = percentOf(sum, scale.max);
    perCardPercents.set(Number(card.id_card), percent);
    return {
      date: formatIsoDate(card.create_mark_date),
      dateLabel: formatDateLabel(card.create_mark_date),
      percent,
      evaluations: 1,
    };
  });

  const lastCard = cards[cards.length - 1] ?? null;
  const prevCard = cards[cards.length - 2] ?? null;

  const latest = lastCard
    ? {
        percent: perCardPercents.get(Number(lastCard.id_card)) ?? 0,
        date: formatIsoDate(lastCard.create_mark_date),
        dateLabel: formatDateLabel(lastCard.create_mark_date),
      }
    : null;
  const previous = prevCard
    ? {
        percent: perCardPercents.get(Number(prevCard.id_card)) ?? 0,
        date: formatIsoDate(prevCard.create_mark_date),
        dateLabel: formatDateLabel(prevCard.create_mark_date),
      }
    : null;

  const sections = scale.sections
    .map((section) => sectionAverageFromCards(section, cards))
    .filter((section): section is SectionAverage => section !== null);

  const ranked = [...sections].sort((a, b) => b.percent - a.percent);
  const strengths: SectionHighlight[] =
    ranked.length >= 3 ? ranked.slice(0, 2).map(toHighlight) : [];
  // Зонами развития считаем только то, что строго ниже сильных сторон: иначе при
  // одинаковых процентах один и тот же раздел попал бы в оба списка.
  const strengthCutoff = strengths.length
    ? Math.min(...strengths.map((section) => section.percent))
    : 0;
  const weaknesses: SectionHighlight[] =
    ranked.length >= 3
      ? ranked
          .filter((section) => section.percent < strengthCutoff)
          .slice(-2)
          .reverse()
          .map(toHighlight)
      : [];

  const comparison: SectionComparison[] =
    lastCard && prevCard
      ? scale.sections.map((section) => {
          const before = percentOf(
            sumKeysOf(prevCard, section.keys),
            section.max,
          );
          const after = percentOf(
            sumKeysOf(lastCard, section.keys),
            section.max,
          );
          return {
            id: section.id,
            title: section.title,
            before,
            after,
            delta: after - before,
          };
        })
      : [];

  return {
    scope: "teacher",
    cardType,
    cardTypeLabel: cardTypeLabel(cardType),
    academicYearStart,
    academicYearLabel: academicYearLabel(academicYearStart),
    academicYears,
    hasAnyOfType,
    hasDataInYear: cards.length > 0,
    points,
    latest,
    previous,
    delta: latest && previous ? latest.percent - previous.percent : null,
    sections,
    strengths,
    weaknesses,
    comparison,
  };
}

function toHighlight(section: SectionAverage): SectionHighlight {
  return { id: section.id, title: section.title, percent: section.percent };
}

const DISTRIBUTION_BUCKETS = [
  { id: "90-100", label: "90-100%", min: 90, max: 101 },
  { id: "80-89", label: "80-89%", min: 80, max: 90 },
  { id: "70-79", label: "70-79%", min: 70, max: 80 },
  { id: "60-69", label: "60-69%", min: 60, max: 70 },
  { id: "under-60", label: "ниже 60%", min: -Infinity, max: 60 },
];

/**
 * Средний процент школы: берём последнюю оценку каждого учителя за год, чтобы
 * один учитель не учитывался несколько раз. Оконная функция - один запрос
 * вместо N+1.
 */
async function latestPercentPerTeacher(
  schoolId: number,
  cardType: CardTypeKind,
  academicYearStart: number,
): Promise<number[]> {
  const scale = scaleFor(cardType);
  const { from, to } = academicYearRange(academicYearStart);

  const rows = await query<{ percent: number }[]>(
    `SELECT t.percent
     FROM (
       SELECT teacher_id,
              ROUND((${sumKeysSql(scale.keys)}) * 100 / ?) AS percent,
              ROW_NUMBER() OVER (
                PARTITION BY teacher_id
                ORDER BY create_mark_date DESC, id_card DESC
              ) AS rn
       FROM card_from_project_teacher_mark3
       WHERE school_id = ? AND card_type = ?
         AND create_mark_date >= ? AND create_mark_date < ?
     ) t
     WHERE t.rn = 1`,
    [scale.max, schoolId, scale.dbCardType, from, to],
  );

  return rows.map((row) => Number(row.percent));
}

async function averageOfYear(
  schoolId: number,
  cardType: CardTypeKind,
  academicYearStart: number,
): Promise<{ percent: number; teachers: number } | null> {
  const percents = await latestPercentPerTeacher(
    schoolId,
    cardType,
    academicYearStart,
  );
  if (percents.length === 0) return null;

  const total = percents.reduce((sum, value) => sum + value, 0);
  return {
    percent: Math.round(total / percents.length),
    teachers: percents.length,
  };
}

export async function getSchoolAnalytics(
  schoolId: number,
  cardType: CardTypeKind,
  academicYearStart: number,
): Promise<SchoolAnalytics> {
  const scale = scaleFor(cardType);
  const { from, to } = academicYearRange(academicYearStart);
  const params = [schoolId, scale.dbCardType, from, to];

  const [
    academicYears,
    hasAnyOfType,
    evaluationsInYear,
    percents,
    timeSeries,
    sectionRows,
    previousYearAverage,
  ] = await Promise.all([
    buildAcademicYears(YEAR_BOUNDS_SQL, [schoolId]),
    cardTypeHasAny(schoolId, null, cardType),
    countEvaluations(
      `SELECT COUNT(*) AS count FROM card_from_project_teacher_mark3
       WHERE school_id = ? AND card_type = ?
         AND create_mark_date >= ? AND create_mark_date < ?`,
      params,
    ),
    latestPercentPerTeacher(schoolId, cardType, academicYearStart),
    query<{ day: Date; evaluations: number; percent: number }[]>(
      `SELECT DATE(create_mark_date) AS day,
              COUNT(*) AS evaluations,
              AVG((${sumKeysSql(scale.keys)}) * 100 / ?) AS percent
       FROM card_from_project_teacher_mark3
       WHERE school_id = ? AND card_type = ?
         AND create_mark_date >= ? AND create_mark_date < ?
       GROUP BY DATE(create_mark_date)
       ORDER BY day ASC`,
      [scale.max, ...params],
    ),
    query<Record<string, unknown>[]>(
      `SELECT COUNT(*) AS evaluations,
              ${scale.sections
                .map(
                  (section, index) =>
                    `AVG(${sumKeysSql(section.keys)}) AS s_${index}`,
                )
                .join(", ")}
       FROM card_from_project_teacher_mark3
       WHERE school_id = ? AND card_type = ?
         AND create_mark_date >= ? AND create_mark_date < ?`,
      params,
    ),
    averageOfYear(schoolId, cardType, academicYearStart - 1),
  ]);

  const sectionAggregate = sectionRows[0] ?? {};
  const evaluationsCount = Number(sectionAggregate.evaluations ?? 0);

  const sections: SectionAverage[] = scale.sections
    .map((section, index) => {
      const averageSum = Number(sectionAggregate[`s_${index}`] ?? 0);
      return {
        id: section.id,
        title: section.title,
        percent: percentOf(averageSum, section.max),
        max: section.max,
        averageSum: Math.round(averageSum * 10) / 10,
        evaluations: evaluationsCount,
      };
    })
    .filter((section) => evaluationsCount > 0);

  const average =
    percents.length > 0
      ? {
          percent: Math.round(
            percents.reduce((sum, value) => sum + value, 0) / percents.length,
          ),
          teachers: percents.length,
          evaluations: evaluationsInYear,
        }
      : null;

  const distribution: SchoolDistributionBucket[] = DISTRIBUTION_BUCKETS.map(
    (bucket) => ({
      id: bucket.id,
      label: bucket.label,
      min: bucket.min === -Infinity ? 0 : bucket.min,
      count: percents.filter(
        (percent) => percent >= bucket.min && percent < bucket.max,
      ).length,
    }),
  );

  return {
    scope: "school",
    cardType,
    cardTypeLabel: cardTypeLabel(cardType),
    academicYearStart,
    academicYearLabel: academicYearLabel(academicYearStart),
    academicYears,
    hasAnyOfType,
    hasDataInYear: evaluationsCount > 0,
    average,
    previousYear: previousYearAverage
      ? {
          percent: previousYearAverage.percent,
          academicYearStart: academicYearStart - 1,
          academicYearLabel: academicYearLabel(academicYearStart - 1),
          teachers: previousYearAverage.teachers,
        }
      : null,
    delta:
      average && previousYearAverage
        ? average.percent - previousYearAverage.percent
        : null,
    points: timeSeries.map((row) => {
      const day = toDate(row.day);
      return {
        date: formatIsoDate(day),
        dateLabel: formatDateLabel(day),
        percent: Math.round(Number(row.percent)),
        evaluations: Number(row.evaluations),
      };
    }),
    sections,
    distribution,
  };
}

/** Проверка, что оценка вообще существует - для корректных пустых состояний. */
export async function schoolHasAnyEvaluations(
  schoolId: number,
): Promise<boolean> {
  const count = await countEvaluations(
    "SELECT COUNT(*) AS count FROM card_from_project_teacher_mark3 WHERE school_id = ?",
    [schoolId],
  );
  return count > 0;
}
