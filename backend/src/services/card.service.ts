import { pool, query } from "../db/pool.js";
import type { ResultSetHeader } from "mysql2";
import {
  findLessonAnalysisProject,
  resolveProjectMiddlewareTable,
} from "./project.service.js";

export interface EvaluationListItem {
  id: number;
  date: string;
  dateLabel: string;
  disciplineId: number;
  disciplineTitle: string;
  classLabel: string;
  sourceId: number;
  sourceLabel: string;
  cardType: number;
  cardTypeLabel: string;
  cardLinkType: "full" | "method";
}

export interface ProjectTeacherProfile {
  project: { id: number; name: string };
  teacher: {
    id: string;
    fullName: string;
    position: string | null;
  };
  filters: {
    sources: Array<{ id: number; title: string }>;
    disciplines: Array<{ id: number; title: string }>;
  };
  evaluations: EvaluationListItem[];
}

interface CardRow {
  id_card: number;
  create_mark_date: Date;
  discipline_id: number;
  title_discipline: string;
  class_id: number;
  liter_class: string | null;
  source_id: number;
  name_source: string;
  card_type: number;
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

function formatDateLabel(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getDate()} ${MONTHS_RU[date.getMonth()]} ${date.getFullYear()}`;
}

function formatIsoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSourceLabel(sourceId: number, dbName?: string | null): string {
  if (sourceId === 1) {
    return "Внешняя";
  }
  if (sourceId === 2) {
    return "Внутришкольная";
  }
  return dbName?.trim() || "—";
}

function getCardTypeLabel(cardType: number): string {
  if (cardType === 1) {
    return "Карта №1 (Комплексная)";
  }
  if (cardType === 2) {
    return "Карта №2 (Методические компетенции)";
  }
  return "—";
}

function getCardLinkType(cardType: number): "full" | "method" {
  return cardType === 2 ? "method" : "full";
}

function mapCard(row: CardRow): EvaluationListItem {
  const liter = row.liter_class?.trim();
  const classLabel = liter
    ? `${row.class_id}${liter}`
    : String(row.class_id);

  return {
    id: Number(row.id_card),
    date: formatIsoDate(row.create_mark_date),
    dateLabel: formatDateLabel(row.create_mark_date),
    disciplineId: row.discipline_id,
    disciplineTitle: row.title_discipline,
    classLabel,
    sourceId: row.source_id,
    sourceLabel: getSourceLabel(row.source_id, row.name_source),
    cardType: row.card_type,
    cardTypeLabel: getCardTypeLabel(row.card_type),
    cardLinkType: getCardLinkType(row.card_type),
  };
}

async function assertTeacherInLessonAnalysisProject(
  schoolId: number,
  teacherId: string,
): Promise<{
  project: { id: number; name: string };
  teacher: { id: string; fullName: string; position: string | null };
} | null> {
  const project = await findLessonAnalysisProject(schoolId);
  if (!project) {
    return null;
  }

  const middlewareTable = await resolveProjectMiddlewareTable(project.id_project);
  if (!middlewareTable) {
    return null;
  }

  const safeTable = middlewareTable.replace(/[^a-z0-9_]/gi, "");
  if (safeTable !== middlewareTable) {
    throw new Error("Invalid project middleware table");
  }

  const rows = await query<
    {
      id_teacher: string;
      surname: string;
      firstname: string;
      patronymic: string | null;
      title_position: string | null;
    }[]
  >(
    `SELECT
       t.id_teacher,
       t.surname,
       t.firstname,
       t.patronymic,
       p.title_position
     FROM teachers t
     INNER JOIN \`${safeTable}\` m
       ON m.teacher_id = t.id_teacher
      AND m.project_id = ?
      AND m.in_project_status = 2
     LEFT JOIN position p ON t.position = p.id_position
     WHERE t.id_teacher = ? AND t.school_id = ?
     LIMIT 1`,
    [project.id_project, teacherId, schoolId],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    project: {
      id: project.id_project,
      name: project.name_project,
    },
    teacher: {
      id: row.id_teacher,
      fullName: [row.surname, row.firstname, row.patronymic]
        .filter(Boolean)
        .join(" "),
      position: row.title_position,
    },
  };
}

export async function getProjectTeacherEvaluations(
  schoolId: number,
  teacherId: string,
  filters: { sourceId?: number; disciplineId?: number } = {},
): Promise<ProjectTeacherProfile | null> {
  const context = await assertTeacherInLessonAnalysisProject(schoolId, teacherId);
  if (!context) {
    return null;
  }

  const params: unknown[] = [teacherId, schoolId];
  let where = "WHERE cftm.teacher_id = ? AND cftm.school_id = ?";

  if (filters.sourceId) {
    where += " AND cftm.source_id = ?";
    params.push(filters.sourceId);
  }

  if (filters.disciplineId) {
    where += " AND cftm.discipline_id = ?";
    params.push(filters.disciplineId);
  }

  const [cards, disciplines, sources] = await Promise.all([
    query<CardRow[]>(
      `SELECT
         cftm.id_card,
         cftm.create_mark_date,
         cftm.discipline_id,
         dt.title_discipline,
         cftm.class_id,
         cftm.liter_class,
         cftm.source_id,
         stbl.name_source,
         cftm.card_type
       FROM card_from_project_teacher_mark3 AS cftm
       INNER JOIN discipline_title AS dt ON cftm.discipline_id = dt.id_discipline
       INNER JOIN outside_card2 AS outside ON cftm.id_card = outside.card_id
       INNER JOIN source_tbl AS stbl ON cftm.source_id = stbl.id_source
       ${where}
       ORDER BY cftm.create_mark_date DESC`,
      params,
    ),
    query<{ id_discipline: number; title_discipline: string }[]>(
      `SELECT dm.discipline_id AS id_discipline, dt.title_discipline
       FROM discipline_middleware dm
       INNER JOIN discipline_title dt ON dm.discipline_id = dt.id_discipline
       WHERE dm.teacher_id = ?
       ORDER BY dt.title_discipline`,
      [teacherId],
    ),
    query<{ id_source: number; name_source: string }[]>(
      "SELECT id_source, name_source FROM source_tbl ORDER BY id_source",
    ),
  ]);

  return {
    project: context.project,
    teacher: context.teacher,
    filters: {
      sources: sources.map((item) => ({
        id: Number(item.id_source),
        title: getSourceLabel(Number(item.id_source), item.name_source),
      })),
      disciplines: disciplines.map((item) => ({
        id: item.id_discipline,
        title: item.title_discipline,
      })),
    },
    evaluations: cards.map(mapCard),
  };
}

export async function getSchoolEvaluationYearStats(
  schoolId: number,
  yearsCount = 3,
): Promise<{
  years: Array<{ year: number; count: number }>;
  total: number;
}> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - (yearsCount - 1);

  const rows = await query<{ year: number; count: number }[]>(
    `SELECT YEAR(create_mark_date) AS year, COUNT(*) AS count
     FROM card_from_project_teacher_mark3
     WHERE school_id = ?
       AND YEAR(create_mark_date) >= ?
       AND YEAR(create_mark_date) <= ?
     GROUP BY YEAR(create_mark_date)
     ORDER BY year DESC`,
    [schoolId, startYear, currentYear],
  );

  const countByYear = new Map(
    rows.map((row) => [Number(row.year), Number(row.count)]),
  );

  const years = Array.from({ length: yearsCount }, (_, index) => {
    const year = currentYear - index;
    return {
      year,
      count: countByYear.get(year) ?? 0,
    };
  });

  return {
    years,
    total: years.reduce((sum, item) => sum + item.count, 0),
  };
}

const METHOD_KEYS = Array.from({ length: 22 }, (_, i) => `k_2_${i + 1}`);
const FULL_KEYS = [
  ...Array.from({ length: 7 }, (_, i) => `k_1_${i + 1}`),
  ...METHOD_KEYS,
  ...Array.from({ length: 3 }, (_, i) => `k_3_${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `k_4_${i + 1}`),
];

export type CardTypeKind = "method" | "full";

export interface CreateEvaluationInput {
  cardType: CardTypeKind;
  disciplineId: number;
  classId: number;
  literClass?: string;
  sourceId: number;
  dateCreate: string;
  thema: string;
  sourceFio?: string;
  positionName?: string;
  sourceWorkplace?: string;
  scores: Record<string, number>;
}

function requireScore(scores: Record<string, number>, key: string): number {
  const value = scores[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Не указан критерий ${key}`);
  }
  return value;
}

export async function createProjectTeacherEvaluation(
  schoolId: number,
  teacherId: string,
  input: CreateEvaluationInput,
): Promise<{ cardId: number }> {
  const context = await assertTeacherInLessonAnalysisProject(schoolId, teacherId);
  if (!context) {
    throw new Error("Teacher not in project");
  }

  if (![1, 2].includes(input.sourceId)) {
    throw new Error("Invalid source");
  }

  if (!input.disciplineId || !input.classId || !input.thema.trim() || !input.dateCreate) {
    throw new Error("Missing required fields");
  }

  if (input.sourceId === 1) {
    if (
      !input.sourceFio?.trim() ||
      !input.positionName?.trim() ||
      !input.sourceWorkplace?.trim()
    ) {
      throw new Error("Outside evaluator fields required");
    }
  }

  const literClass = input.literClass?.trim() ?? "";
  const cardType = input.cardType === "full" ? 1 : 2;
  const keys = input.cardType === "full" ? FULL_KEYS : METHOD_KEYS;
  const scoreValues = keys.map((key) => requireScore(input.scores, key));

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let insertSql: string;
    let insertParams: unknown[];

    if (input.cardType === "full") {
      insertSql = `INSERT INTO card_from_project_teacher_mark3 (
        teacher_id, discipline_id, source_id, school_id, thema, class_id, liter_class,
        k_1_1, k_1_2, k_1_3, k_1_4, k_1_5, k_1_6, k_1_7,
        k_2_1, k_2_2, k_2_3, k_2_4, k_2_5, k_2_6, k_2_7, k_2_8, k_2_9, k_2_10, k_2_11,
        k_2_12, k_2_13, k_2_14, k_2_15, k_2_16, k_2_17, k_2_18, k_2_19, k_2_20, k_2_21, k_2_22,
        k_3_1, k_3_2, k_3_3, k_4_1, k_4_2, k_4_3,
        create_mark_date, card_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      insertParams = [
        teacherId,
        input.disciplineId,
        input.sourceId,
        schoolId,
        input.thema.trim(),
        input.classId,
        literClass,
        ...scoreValues,
        input.dateCreate,
        cardType,
      ];
    } else {
      insertSql = `INSERT INTO card_from_project_teacher_mark3 (
        teacher_id, discipline_id, source_id, school_id, thema, class_id, liter_class,
        k_2_1, k_2_2, k_2_3, k_2_4, k_2_5, k_2_6, k_2_7, k_2_8, k_2_9, k_2_10, k_2_11,
        k_2_12, k_2_13, k_2_14, k_2_15, k_2_16, k_2_17, k_2_18, k_2_19, k_2_20, k_2_21, k_2_22,
        create_mark_date, card_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      insertParams = [
        teacherId,
        input.disciplineId,
        input.sourceId,
        schoolId,
        input.thema.trim(),
        input.classId,
        literClass,
        ...scoreValues,
        input.dateCreate,
        cardType,
      ];
    }

    const [result] = await connection.execute<ResultSetHeader>(insertSql, insertParams);
    const cardId = Number(result.insertId);
    if (!cardId) {
      throw new Error("Failed to create card");
    }

    const outsideFio =
      input.sourceId === 1 ? input.sourceFio!.trim() : "Школа";
    const outsidePosition =
      input.sourceId === 1 ? input.positionName!.trim() : "Школа";
    const outsideWorkplace =
      input.sourceId === 1 ? input.sourceWorkplace!.trim() : "Школа";

    await connection.execute(
      `INSERT INTO outside_card2
        (card_id, source_fio, position_name, source_workplace, source_id)
       VALUES (?, ?, ?, ?, ?)`,
      [cardId, outsideFio, outsidePosition, outsideWorkplace, input.sourceId],
    );

    await connection.commit();
    return { cardId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
