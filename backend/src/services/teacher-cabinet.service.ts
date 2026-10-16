import { query } from "../db/pool.js";
import {
  academicYearStartFromDate,
  formatAcademicYearLabel,
} from "./card.service.js";
import {
  type CardTypeKind,
  percentOf,
  scaleFor,
  sumKeysSql,
} from "./evaluation-scale.js";

/**
 * Данные личного кабинета учителя. Только чтение: кабинет ничего не создаёт и
 * не меняет в оценках. Все запросы ограничены одним учителем, идентификатор
 * берётся из сессии, а не из запроса.
 */

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

export interface AcademicYearOption {
  startYear: number;
  label: string;
  isCurrent: boolean;
}

export interface TeacherCardSummary {
  id: number;
  date: string;
  dateLabel: string;
  academicYearStart: number;
  cardType: CardTypeKind;
  cardTypeLabel: string;
  percent: number;
  sourceId: number;
  sourceLabel: string;
}

export interface CardTypeSummary {
  cardType: CardTypeKind;
  cardTypeLabel: string;
  /** Есть ли у учителя оценки этого типа вообще (за любые годы). */
  hasAny: boolean;
  hasDataInYear: boolean;
  evaluationsInYear: number;
  latest: { percent: number; date: string; dateLabel: string } | null;
  previous: { percent: number; date: string; dateLabel: string } | null;
  delta: number | null;
}

export interface TeacherOverview {
  cardTypeSummaries: CardTypeSummary[];
  academicYears: AcademicYearOption[];
  evaluationYears: number[];
}

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

export function currentAcademicYearStart(now = new Date()): number {
  return academicYearStartFromDate(now);
}

export function academicYearLabel(startYear: number): string {
  return formatAcademicYearLabel(startYear);
}

export function academicYearRange(startYear: number): {
  from: string;
  to: string;
} {
  return { from: `${startYear}-09-01`, to: `${startYear + 1}-09-01` };
}

function cardTypeLabel(cardType: CardTypeKind): string {
  return cardType === "method" ? "Методическая карта" : "Комплексная карта";
}

function sourceLabel(sourceId: number): string {
  if (sourceId === 1) return "Внешняя оценка";
  if (sourceId === 2) return "Внутришкольная оценка";
  return "Оценка";
}

interface CardRow {
  id_card: number;
  create_mark_date: Date;
  card_type: number;
  source_id: number;
  method_sum: number;
  full_sum: number;
}

/**
 * Все оценки учителя одним запросом: проценты считаются той же формулой, что и
 * в карточке. На главную и в историю этого достаточно, отдельные запросы на
 * каждый блок не нужны.
 */
export async function listTeacherCards(
  schoolId: number,
  teacherId: string,
): Promise<TeacherCardSummary[]> {
  const rows = await query<CardRow[]>(
    `SELECT id_card, create_mark_date, card_type, source_id,
            (${sumKeysSql(scaleFor("method").keys)}) AS method_sum,
            (${sumKeysSql(scaleFor("full").keys)}) AS full_sum
     FROM card_from_project_teacher_mark3
     WHERE teacher_id = ? AND school_id = ?
     ORDER BY create_mark_date ASC, id_card ASC`,
    [teacherId, schoolId],
  );

  return rows.map((row) => {
    const cardType: CardTypeKind = Number(row.card_type) === 2 ? "method" : "full";
    const scale = scaleFor(cardType);
    const sum = Number(
      cardType === "method" ? row.method_sum : row.full_sum,
    );
    return {
      id: Number(row.id_card),
      date: formatIsoDate(row.create_mark_date),
      dateLabel: formatDateLabel(row.create_mark_date),
      academicYearStart: academicYearStartFromDate(toDate(row.create_mark_date)),
      cardType,
      cardTypeLabel: cardTypeLabel(cardType),
      percent: percentOf(sum, scale.max),
      sourceId: Number(row.source_id),
      sourceLabel: sourceLabel(Number(row.source_id)),
    };
  });
}

function summarizeCardType(
  cards: TeacherCardSummary[],
  cardType: CardTypeKind,
  academicYearStart: number,
): CardTypeSummary {
  const ofType = cards.filter((card) => card.cardType === cardType);
  const inYear = ofType.filter(
    (card) => card.academicYearStart === academicYearStart,
  );

  const last = inYear[inYear.length - 1] ?? null;
  const prev = inYear[inYear.length - 2] ?? null;

  return {
    cardType,
    cardTypeLabel: cardTypeLabel(cardType),
    hasAny: ofType.length > 0,
    hasDataInYear: inYear.length > 0,
    evaluationsInYear: inYear.length,
    latest: last
      ? { percent: last.percent, date: last.date, dateLabel: last.dateLabel }
      : null,
    previous: prev
      ? { percent: prev.percent, date: prev.date, dateLabel: prev.dateLabel }
      : null,
    delta: last && prev ? last.percent - prev.percent : null,
  };
}

/**
 * Список учебных годов для переключателя: только те, где есть оценки, плюс
 * текущий. Новые годы не выдумываем.
 */
export function buildAcademicYears(
  cards: TeacherCardSummary[],
  now = new Date(),
): AcademicYearOption[] {
  const current = currentAcademicYearStart(now);
  const years = new Set<number>([current]);
  for (const card of cards) {
    years.add(card.academicYearStart);
  }
  return [...years]
    .sort((a, b) => b - a)
    .map((startYear) => ({
      startYear,
      label: academicYearLabel(startYear),
      isCurrent: startYear === current,
    }));
}

export function getTeacherOverview(
  cards: TeacherCardSummary[],
  academicYearStart: number,
): TeacherOverview {
  return {
    cardTypeSummaries: [
      summarizeCardType(cards, "method", academicYearStart),
      summarizeCardType(cards, "full", academicYearStart),
    ],
    academicYears: buildAcademicYears(cards),
    evaluationYears: [...new Set(cards.map((card) => card.academicYearStart))].sort(
      (a, b) => b - a,
    ),
  };
}

export function evaluationsForYear(
  cards: TeacherCardSummary[],
  academicYearStart: number,
): TeacherCardSummary[] {
  return cards
    .filter((card) => card.academicYearStart === academicYearStart)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
}
