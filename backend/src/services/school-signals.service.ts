import { query } from "../db/pool.js";
import { percentOf, scaleFor, sumKeysSql } from "./evaluation-scale.js";

/**
 * Сигналы для главной страницы школы: они отвечают на вопрос
 * «что мне сегодня нужно сделать», а не «что такое Таллам».
 *
 * Порог внимания 50 % от максимума карты: это операционный ориентир для
 * дашборда, а не педагогическая оценка. Он не участвует в аналитике и
 * ничего не записывает в карты.
 */
const ATTENTION_PERCENT = 50;
const STALE_DAYS = 365;

export interface SchoolSignals {
  /** Учителя, у которых нет ни одной карты. */
  neverEvaluated: number;
  /** Последняя оценка ниже порога. */
  attention: number;
  /** Последняя оценка старше года. */
  staleEvaluated: number;
}

export async function getSchoolSignals(
  schoolId: number,
): Promise<SchoolSignals> {
  const methodScale = scaleFor("method");
  const fullScale = scaleFor("full");

  const [neverRows, latestRows] = await Promise.all([
    query<{ c: number | string }[]>(
      `SELECT COUNT(*) AS c
       FROM teachers t
       WHERE t.school_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM card_from_project_teacher_mark3 m
           WHERE m.teacher_id = t.id_teacher
         )`,
      [schoolId],
    ),
    query<
      {
        card_type: number | string;
        created: Date | string;
        method_sum: number | string | null;
        full_sum: number | string | null;
      }[]
    >(
      `SELECT card_type, create_mark_date AS created,
              ${sumKeysSql(methodScale.keys)} AS method_sum,
              ${sumKeysSql(fullScale.keys)} AS full_sum
       FROM (
         SELECT m.*, ROW_NUMBER() OVER (
           PARTITION BY m.teacher_id
           ORDER BY m.create_mark_date DESC, m.id_card DESC
         ) AS rn
         FROM card_from_project_teacher_mark3 m
         WHERE m.school_id = ?
       ) x
       WHERE rn = 1`,
      [schoolId],
    ),
  ]);

  let attention = 0;
  let staleEvaluated = 0;
  const now = Date.now();

  for (const row of latestRows) {
    const isMethod = Number(row.card_type) === methodScale.dbCardType;
    const scale = isMethod ? methodScale : fullScale;
    const sum = Number(
      (isMethod ? row.method_sum : row.full_sum) ?? 0,
    );

    if (percentOf(sum, scale.max) < ATTENTION_PERCENT) {
      attention += 1;
    }

    const date = row.created instanceof Date ? row.created : new Date(row.created);
    const days = Math.floor((now - date.getTime()) / 86_400_000);
    if (Number.isFinite(days) && days > STALE_DAYS) {
      staleEvaluated += 1;
    }
  }

  return {
    neverEvaluated: Number(neverRows[0]?.c ?? 0),
    attention,
    staleEvaluated,
  };
}
