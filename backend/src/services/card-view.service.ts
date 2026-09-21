import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import { pool, query } from "../db/pool.js";
import { sendMail } from "./email.service.js";
import {
  commentHtmlToPlainText,
  deleteEvaluationComment,
  getEvaluationCommentHtml,
} from "./evaluation-comment.service.js";

const require = createRequire(import.meta.url);
const FONT_REGULAR = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

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

const OPTIONAL_KEYS = new Set([
  "k_1_7",
  "k_2_10",
  "k_2_11",
  "k_2_19",
  "k_2_20",
  "k_4_3",
]);

const METHOD_KEYS = Array.from({ length: 22 }, (_, i) => `k_2_${i + 1}`);
const SUBJECT_KEYS = Array.from({ length: 7 }, (_, i) => `k_1_${i + 1}`);
const PSYCHO_KEYS = Array.from({ length: 3 }, (_, i) => `k_3_${i + 1}`);
const COMM_KEYS = Array.from({ length: 3 }, (_, i) => `k_4_${i + 1}`);

export type EvaluationLevelStyle = "success" | "good" | "danger";

export interface EvaluationBlockResult {
  id: string;
  title: string;
  percent: number;
  level: string;
  levelStyle: EvaluationLevelStyle;
}

export interface EvaluationDetail {
  id: number;
  cardType: "method" | "full";
  cardTypeLabel: string;
  date: string;
  dateLabel: string;
  thema: string;
  disciplineTitle: string;
  classLabel: string;
  sourceId: number;
  sourceLabel: string;
  evaluatorLabel: string;
  hasEvaluatorIdentity: boolean;
  teacher: {
    id: string;
    fullName: string;
    position: string | null;
    email: string | null;
  };
  schoolName: string;
  areaName: string | null;
  scores: Record<string, number>;
  displayedScores: Record<string, string>;
  blocks: EvaluationBlockResult[];
  commentHtml: string | null;
}

interface CardRow {
  id_card: number;
  teacher_id: string;
  school_id: number;
  thema: string;
  source_id: number;
  class_id: number;
  liter_class: string | null;
  card_type: number;
  create_mark_date: Date;
  title_discipline: string;
  source_fio: string | null;
  position_name: string | null;
  source_workplace: string | null;
  surname: string;
  firstname: string;
  patronymic: string | null;
  title_position: string | null;
  email: string | null;
  school_name: string;
  title_area: string | null;
  [key: string]: unknown;
}

function formatDateLabel(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS_RU[date.getMonth()]} ${date.getFullYear()}`;
}

function formatIsoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function scoreNumber(row: CardRow, key: string): number {
  return Number(row[key] ?? 0);
}

function displayScore(key: string, value: number): string {
  if (OPTIONAL_KEYS.has(key)) {
    if (value === -1) return "0";
    if (value === 0) return "—";
  }
  return String(value);
}

function sumKeys(row: CardRow, keys: string[]): number {
  return keys.reduce((total, key) => total + scoreNumber(row, key), 0);
}

function percentOf(sum: number, max: number): number {
  return Math.round((sum * 100) / max);
}

function levelFromPercent(
  percent: number,
): Pick<EvaluationBlockResult, "level" | "levelStyle"> {
  if (percent >= 75) {
    return {
      level: "Выше базового уровня",
      levelStyle: "success",
    };
  }
  if (percent >= 50) {
    return {
      level: "Базовый уровень",
      levelStyle: "good",
    };
  }
  return {
    level: "Ниже базового уровня (критический)",
    levelStyle: "danger",
  };
}

function blockResult(
  id: string,
  title: string,
  sum: number,
  max: number,
): EvaluationBlockResult {
  const percent = percentOf(sum, max);
  return {
    id,
    title,
    percent,
    ...levelFromPercent(percent),
  };
}

function isEvaluatorPlaceholder(value: string): boolean {
  return !value || value === "Школа";
}

function hasRealEvaluatorIdentity(row: CardRow): boolean {
  const fio = row.source_fio?.trim() || "";
  const position = row.position_name?.trim() || "";
  return !isEvaluatorPlaceholder(fio) || !isEvaluatorPlaceholder(position);
}

function formatEvaluatorLabel(row: CardRow): string {
  const fio = row.source_fio?.trim() || "";
  const position = row.position_name?.trim() || "";
  const workplace = row.source_workplace?.trim() || "";

  if (Number(row.source_id) !== 1 && isEvaluatorPlaceholder(fio) && isEvaluatorPlaceholder(position)) {
    return "Внутришкольная";
  }

  const label = [fio, position]
    .filter((value) => value && value !== "Школа")
    .join(", ");
  if (workplace && workplace !== "Школа") {
    return label ? `${label} (${workplace})` : workplace;
  }
  if (Number(row.source_id) === 1) {
    return label || "Внешняя оценка";
  }
  return label || "Внутришкольная";
}

function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_NO_SUCH_TABLE"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function levelNumFromSum(
  sum: number,
  highMin: number,
  highMax: number,
  baseMin: number,
  baseMax: number,
  lowMax: number,
): number {
  if (sum >= highMin && sum <= highMax) return 3;
  if (sum >= baseMin && sum <= baseMax) return 2;
  if (sum <= lowMax) return 1;
  return 1;
}

function levelNumSmall(sum: number): number {
  if (sum >= 4 && sum <= 6) return 3;
  if (sum === 3) return 2;
  return 1;
}

export async function getEvaluationDetail(
  schoolId: number,
  teacherId: string,
  cardId: number,
): Promise<EvaluationDetail | null> {
  const rows = await query<CardRow[]>(
    `SELECT
       cftm.id_card, cftm.teacher_id, cftm.school_id, cftm.thema, cftm.source_id,
       cftm.class_id, cftm.liter_class, cftm.card_type, cftm.create_mark_date,
       cftm.k_1_1, cftm.k_1_2, cftm.k_1_3, cftm.k_1_4, cftm.k_1_5, cftm.k_1_6, cftm.k_1_7,
       cftm.k_2_1, cftm.k_2_2, cftm.k_2_3, cftm.k_2_4, cftm.k_2_5, cftm.k_2_6, cftm.k_2_7,
       cftm.k_2_8, cftm.k_2_9, cftm.k_2_10, cftm.k_2_11, cftm.k_2_12, cftm.k_2_13,
       cftm.k_2_14, cftm.k_2_15, cftm.k_2_16, cftm.k_2_17, cftm.k_2_18, cftm.k_2_19,
       cftm.k_2_20, cftm.k_2_21, cftm.k_2_22, cftm.k_3_1, cftm.k_3_2, cftm.k_3_3,
       cftm.k_4_1, cftm.k_4_2, cftm.k_4_3,
       dt.title_discipline,
       outside.source_fio, outside.position_name, outside.source_workplace,
       t.surname, t.firstname, t.patronymic, t.email, p.title_position,
       s.school_name, a.title_area
     FROM card_from_project_teacher_mark3 AS cftm
     INNER JOIN discipline_title AS dt ON cftm.discipline_id = dt.id_discipline
     INNER JOIN outside_card2 AS outside ON cftm.id_card = outside.card_id
     INNER JOIN teachers AS t ON t.id_teacher = cftm.teacher_id
     LEFT JOIN position AS p ON t.position = p.id_position
     INNER JOIN schools AS s ON s.id_school = cftm.school_id
     LEFT JOIN area AS a ON s.area_id = a.id_area
     WHERE cftm.id_card = ? AND cftm.teacher_id = ? AND cftm.school_id = ?
     LIMIT 1`,
    [cardId, teacherId, schoolId],
  );

  const row = rows[0];
  if (!row) return null;

  const cardType = Number(row.card_type) === 2 ? "method" : "full";
  const keys = cardType === "full"
    ? [...SUBJECT_KEYS, ...METHOD_KEYS, ...PSYCHO_KEYS, ...COMM_KEYS]
    : METHOD_KEYS;
  const scores = Object.fromEntries(
    keys.map((key) => [key, scoreNumber(row, key)]),
  );
  const displayedScores = Object.fromEntries(
    keys.map((key) => [key, displayScore(key, scores[key] ?? 0)]),
  );

  const liter = row.liter_class?.trim();
  const blocks: EvaluationBlockResult[] =
    cardType === "full"
      ? [
          blockResult(
            "subject",
            "1. ПРЕДМЕТНЫЕ КОМПЕТЕНЦИИ",
            sumKeys(row, SUBJECT_KEYS),
            13,
          ),
          blockResult(
            "method",
            "2. МЕТОДИЧЕСКИЕ КОМПЕТЕНЦИИ",
            sumKeys(row, METHOD_KEYS),
            33,
          ),
          blockResult(
            "psycho",
            "3. ПСИХОЛОГО-ПЕДАГОГИЧЕСКИЕ КОМПЕТЕНЦИИ",
            sumKeys(row, PSYCHO_KEYS),
            6,
          ),
          blockResult(
            "comm",
            "4. КОММУНИКАТИВНЫЕ КОМПЕТЕНЦИИ",
            sumKeys(row, COMM_KEYS),
            6,
          ),
        ]
      : [
          blockResult(
            "method",
            "1. МЕТОДИЧЕСКИЕ КОМПЕТЕНЦИИ",
            sumKeys(row, METHOD_KEYS),
            33,
          ),
        ];

  const evaluatorLabel = formatEvaluatorLabel(row);
  const commentHtml = await getEvaluationCommentHtml(
    Number(row.id_card),
    schoolId,
  );

  return {
    id: Number(row.id_card),
    cardType,
    cardTypeLabel:
      cardType === "method"
        ? "Карта №2 (Методические компетенции)"
        : "Карта №1 (Комплексная)",
    date: formatIsoDate(row.create_mark_date),
    dateLabel: formatDateLabel(row.create_mark_date),
    thema: row.thema,
    disciplineTitle: row.title_discipline,
    classLabel: liter ? `${row.class_id} «${liter}»` : String(row.class_id),
    sourceId: Number(row.source_id),
    sourceLabel: Number(row.source_id) === 1 ? "Внешняя" : "Внутришкольная",
    evaluatorLabel,
    hasEvaluatorIdentity: hasRealEvaluatorIdentity(row),
    teacher: {
      id: row.teacher_id,
      fullName: [row.surname, row.firstname, row.patronymic]
        .filter(Boolean)
        .join(" "),
      position: row.title_position,
      email: row.email?.trim() || null,
    },
    schoolName: row.school_name?.trim() || "",
    areaName: row.title_area?.trim() || null,
    scores,
    displayedScores,
    blocks,
    commentHtml,
  };
}

export async function deleteEvaluation(
  schoolId: number,
  teacherId: string,
  cardId: number,
): Promise<boolean> {
  const existing = await getEvaluationDetail(schoolId, teacherId, cardId);
  if (!existing) return false;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await deleteEvaluationComment(connection, cardId, schoolId);
    await connection.query("DELETE FROM outside_card2 WHERE card_id = ?", [
      cardId,
    ]);
    await connection.query(
      "DELETE FROM card_from_project_teacher_mark3 WHERE id_card = ? AND school_id = ? AND teacher_id = ?",
      [cardId, schoolId, teacherId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return true;
}

interface RecommendationRow {
  k_id: string;
  val: number;
  title: string;
  content: string;
  category: string | null;
}

async function loadRecommendations(
  keys: string[],
  scores: Record<string, number>,
): Promise<RecommendationRow[]> {
  if (keys.length === 0) return [];
  const placeholders = keys.map(() => "?").join(", ");
  try {
    const rows = await query<RecommendationRow[]>(
      `SELECT k_id, val, title, content, category
       FROM recommendation2023
       WHERE k_id IN (${placeholders})`,
      keys,
    );
    const byKeyVal = new Map(
      rows.map((row) => [`${row.k_id}:${Number(row.val)}`, row]),
    );
    return keys
      .map((key) => byKeyVal.get(`${key}:${scores[key] ?? 0}`))
      .filter((row): row is RecommendationRow => Boolean(row));
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

async function conclusionFor(
  blockNumber: number,
  levelNum: number,
): Promise<string | null> {
  try {
    const rows = await query<{ content: string }[]>(
      "SELECT content FROM conclusion_recommendation WHERE block_number = ? AND level_num = ? LIMIT 1",
      [blockNumber, levelNum],
    );
    return rows[0]?.content ?? null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

function writeParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  options: PDFKit.Mixins.TextOptions = {},
) {
  const width =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.text(text, doc.page.margins.left, doc.y, {
    width,
    lineGap: 2,
    ...options,
  });
  doc.moveDown(0.45);
}

export async function buildRecommendationsPdf(
  detail: EvaluationDetail,
): Promise<Buffer> {
  const keys =
    detail.cardType === "full"
      ? [...SUBJECT_KEYS, ...METHOD_KEYS, ...PSYCHO_KEYS, ...COMM_KEYS]
      : METHOD_KEYS;

  const items = await loadRecommendations(keys, detail.scores);

  const conclusions: string[] = [];
  if (detail.cardType === "full") {
    const subjectSum = SUBJECT_KEYS.reduce(
      (sum, key) => sum + (detail.scores[key] ?? 0),
      0,
    );
    const methodSum = METHOD_KEYS.reduce(
      (sum, key) => sum + (detail.scores[key] ?? 0),
      0,
    );
    const psychoSum = PSYCHO_KEYS.reduce(
      (sum, key) => sum + (detail.scores[key] ?? 0),
      0,
    );
    const commSum = COMM_KEYS.reduce(
      (sum, key) => sum + (detail.scores[key] ?? 0),
      0,
    );
    const texts = await Promise.all([
      conclusionFor(1, levelNumFromSum(subjectSum, 10, 13, 6, 9, 5)),
      conclusionFor(2, levelNumFromSum(methodSum, 25, 34, 17, 24, 16)),
      conclusionFor(3, levelNumSmall(psychoSum)),
      conclusionFor(4, levelNumSmall(commSum)),
    ]);
    conclusions.push(...texts.filter((item): item is string => Boolean(item)));
  } else {
    const methodSum = METHOD_KEYS.reduce(
      (sum, key) => sum + (detail.scores[key] ?? 0),
      0,
    );
    const text = await conclusionFor(
      2,
      levelNumFromSum(methodSum, 25, 34, 17, 24, 16),
    );
    if (text) conclusions.push(text);
  }

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: "Методические рекомендации",
      Author: "Tallam",
    },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont("Regular", FONT_REGULAR);
  doc.registerFont("Bold", FONT_BOLD);

  doc.font("Bold").fontSize(12);
  writeParagraph(doc, `ФИО учителя: ${detail.teacher.fullName}`);
  writeParagraph(doc, `Школа: ${detail.schoolName}`);
  if (detail.areaName) {
    writeParagraph(doc, `Город/район: ${detail.areaName}`);
  }
  doc.moveDown(0.6);
  doc.font("Bold").fontSize(13);
  writeParagraph(doc, "ЗАКЛЮЧЕНИЕ ПО ИТОГУ АНАЛИЗА УРОКА", {
    align: "center",
  });
  doc.moveDown(0.4);

  let lastCategory = "";
  for (const item of items) {
    if (item.category && item.category !== lastCategory) {
      lastCategory = item.category;
      doc.font("Bold").fontSize(11);
      writeParagraph(doc, `Категория: ${item.category}`);
    }
    doc.font("Bold").fontSize(10);
    writeParagraph(doc, item.title);
    doc.font("Regular").fontSize(10);
    writeParagraph(doc, item.content);
  }

  for (const conclusion of conclusions) {
    doc.moveDown(0.3);
    doc.font("Bold").fontSize(10);
    writeParagraph(doc, "Экспертная оценка:");
    doc.font("Regular").fontSize(10);
    writeParagraph(doc, conclusion);
  }

  const commentText = detail.commentHtml
    ? commentHtmlToPlainText(detail.commentHtml)
    : "";
  if (commentText) {
    doc.moveDown(0.5);
    doc.font("Bold").fontSize(11);
    writeParagraph(doc, "Комментарий оценивающего");
    doc.font("Regular").fontSize(10);
    writeParagraph(doc, commentText);
  }

  doc.end();
  return done;
}

export async function sendEvaluationToTeacher(
  detail: EvaluationDetail,
  email: string,
): Promise<void> {
  const pdf = await buildRecommendationsPdf(detail);
  const blockLines = detail.blocks
    .map((block) => `${block.title}: ${block.percent}% — ${block.level}`)
    .join("\n");

  await sendMail({
    to: email,
    subject: `Анализ урока — ${detail.teacher.fullName}`,
    text: [
      `Здравствуйте!`,
      ``,
      `Вам направлены результаты анализа урока на платформе Tallam.`,
      ``,
      `Учитель: ${detail.teacher.fullName}`,
      `Дата: ${detail.dateLabel}`,
      `Предмет: ${detail.disciplineTitle}`,
      `Класс: ${detail.classLabel}`,
      `Тема: ${detail.thema}`,
      `Карта: ${detail.cardTypeLabel}`,
      ``,
      blockLines,
      ``,
      `Методические рекомендации приложены к письму.`,
    ].join("\n"),
    html: `
      <p>Здравствуйте!</p>
      <p>Вам направлены результаты анализа урока на платформе <strong>Tallam</strong>.</p>
      <p>
        Учитель: ${escapeHtml(detail.teacher.fullName)}<br>
        Дата: ${escapeHtml(detail.dateLabel)}<br>
        Предмет: ${escapeHtml(detail.disciplineTitle)}<br>
        Класс: ${escapeHtml(detail.classLabel)}<br>
        Тема: ${escapeHtml(detail.thema)}<br>
        Карта: ${escapeHtml(detail.cardTypeLabel)}
      </p>
      <p>${detail.blocks
        .map(
          (block) =>
            `${escapeHtml(block.title)}: <strong>${block.percent}%</strong> — ${escapeHtml(block.level)}`,
        )
        .join("<br>")}</p>
      <p>Методические рекомендации приложены к письму.</p>
    `,
    attachments: [
      {
        filename: `rekomendacii-${detail.id}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
}
