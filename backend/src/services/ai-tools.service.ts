import { query } from "../db/pool.js";
import {
  academicYearLabel,
  currentAcademicYearStart,
  getSchoolAnalytics,
  getTeacherAnalytics,
  type SchoolAnalytics,
  type TeacherAnalytics,
} from "./analytics.service.js";
import { CARD_SCALES, type CardTypeKind } from "./evaluation-scale.js";
import { getEvaluationDetail } from "./card-view.service.js";

export interface AiToolSource {
  type: "school_analytics" | "lesson_card" | "teacher_analytics";
  title: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  academicYearLabel?: string | null;
  evaluations?: number | null;
  teachers?: number | null;
  criteria?: string[];
  cardId?: number | null;
  teacherId?: string | null;
  date?: string | null;
}

export interface AiToolResult {
  data: Record<string, unknown>;
  source: AiToolSource | null;
}

export const AI_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "get_school_analytics",
      description:
        "Аналитика оценивания школы: средний процент, разделы (направления) с процентами и числом оценок, сравнение с прошлым годом. Используй для вопросов о слабых направлениях, результатах, динамике.",
      parameters: {
        type: "object",
        properties: {
          card_type: {
            type: "string",
            enum: ["full", "method"],
            description:
              "full - комплексная карта, method - методическая карта. По умолчанию full.",
          },
          academic_year_start: {
            type: "integer",
            description:
              "Год начала учебного года, например 2025 для 2025/2026. Если не указан - текущий или последний с данными.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lesson_card",
      description:
        "Данные одной карточки анализа урока по teacher_id и card_id. Используй, если пользователь дал внутреннюю ссылку на карточку.",
      parameters: {
        type: "object",
        properties: {
          teacher_id: { type: "string", description: "ID педагога из ссылки" },
          card_id: { type: "integer", description: "ID карточки из ссылки" },
        },
        required: ["teacher_id", "card_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_teacher_analytics",
      description:
        "Аналитика одного педагога: последняя оценка, динамика, разделы, сильные и слабые направления. Без ФИО.",
      parameters: {
        type: "object",
        properties: {
          teacher_id: { type: "string", description: "ID педагога" },
          card_type: {
            type: "string",
            enum: ["full", "method"],
            description: "Тип карты, по умолчанию full",
          },
          academic_year_start: {
            type: "integer",
            description: "Год начала учебного года, если нужен конкретный",
          },
        },
        required: ["teacher_id"],
        additionalProperties: false,
      },
    },
  },
] as const;

function cardTypeFrom(value: unknown): CardTypeKind {
  return value === "method" ? "method" : "full";
}

function yearFrom(value: unknown): number {
  const year = Number(value);
  const current = currentAcademicYearStart();
  if (Number.isInteger(year) && year >= 2020 && year <= current + 1) {
    return year;
  }
  return current;
}

async function periodFor(
  schoolId: number,
  cardType: CardTypeKind,
  yearStart: number,
): Promise<{ from: string | null; to: string | null }> {
  const dbType = CARD_SCALES[cardType].dbCardType;
  const rows = await query<
    { from: string | null; to: string | null }[]
  >(
    `SELECT
       DATE_FORMAT(MIN(create_mark_date), '%Y-%m-%d') AS \`from\`,
       DATE_FORMAT(MAX(create_mark_date), '%Y-%m-%d') AS \`to\`
     FROM card_from_project_teacher_mark3
     WHERE school_id = ? AND card_type = ?
       AND create_mark_date >= ? AND create_mark_date < ?`,
    [schoolId, dbType, `${yearStart}-09-01`, `${yearStart + 1}-09-01`],
  );
  return { from: rows[0]?.from ?? null, to: rows[0]?.to ?? null };
}

async function selectSchoolYear(
  schoolId: number,
  cardType: CardTypeKind,
  requestedYear: number,
): Promise<SchoolAnalytics> {
  const current = await getSchoolAnalytics(schoolId, cardType, requestedYear);
  if (current.hasDataInYear || requestedYear !== currentAcademicYearStart()) {
    return current;
  }
  for (const option of current.academicYears) {
    if (option.startYear === requestedYear) continue;
    const candidate = await getSchoolAnalytics(
      schoolId,
      cardType,
      option.startYear,
    );
    if (candidate.hasDataInYear) return candidate;
  }
  return current;
}

async function selectTeacherYear(
  schoolId: number,
  teacherId: string,
  cardType: CardTypeKind,
  requestedYear: number,
): Promise<TeacherAnalytics> {
  const current = await getTeacherAnalytics(
    schoolId,
    teacherId,
    cardType,
    requestedYear,
  );
  if (current.hasDataInYear || requestedYear !== currentAcademicYearStart()) {
    return current;
  }
  for (const option of current.academicYears) {
    if (option.startYear === requestedYear) continue;
    const candidate = await getTeacherAnalytics(
      schoolId,
      teacherId,
      cardType,
      option.startYear,
    );
    if (candidate.hasDataInYear) return candidate;
  }
  return current;
}

async function schoolAnalyticsTool(
  schoolId: number,
  args: Record<string, unknown>,
): Promise<AiToolResult> {
  const cardType = cardTypeFrom(args.card_type);
  const yearStart = yearFrom(args.academic_year_start);
  const analytics = await selectSchoolYear(schoolId, cardType, yearStart);
  const period = await periodFor(schoolId, cardType, analytics.academicYearStart);
  const sections = analytics.sections.map((section) => ({
    title: section.title,
    percent: section.percent,
    max: section.max,
    evaluations: section.evaluations,
  }));

  return {
    data: {
      hasData: analytics.hasDataInYear,
      cardType,
      cardTypeLabel: analytics.cardTypeLabel,
      academicYearLabel: analytics.academicYearLabel,
      period,
      evaluations: analytics.average?.evaluations ?? 0,
      teachers: analytics.average?.teachers ?? 0,
      averagePercent: analytics.average?.percent ?? null,
      previousYear: analytics.previousYear,
      delta: analytics.delta,
      sections,
      distribution: analytics.distribution,
    },
    source: {
      type: "school_analytics",
      title: `Аналитика школы (${analytics.cardTypeLabel})`,
      periodFrom: period.from,
      periodTo: period.to,
      academicYearLabel: analytics.academicYearLabel,
      evaluations: analytics.average?.evaluations ?? 0,
      teachers: analytics.average?.teachers ?? 0,
      criteria: sections.map((section) => section.title),
    },
  };
}

function textFromHtml(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

async function lessonCardTool(
  schoolId: number,
  args: Record<string, unknown>,
): Promise<AiToolResult> {
  const teacherId = String(args.teacher_id ?? "").trim().slice(0, 100);
  const cardId = Number(args.card_id);
  if (!teacherId || !Number.isInteger(cardId) || cardId <= 0) {
    return { data: { found: false, reason: "Некорректные параметры" }, source: null };
  }

  const detail = await getEvaluationDetail(schoolId, teacherId, cardId);
  if (!detail) {
    return {
      data: { found: false, reason: "Карточка не найдена в вашей школе" },
      source: null,
    };
  }

  return {
    data: {
      found: true,
      cardId: detail.id,
      teacherId: detail.teacher.id,
      date: detail.date,
      dateLabel: detail.dateLabel,
      cardType: detail.cardType,
      cardTypeLabel: detail.cardTypeLabel,
      subject: detail.disciplineTitle,
      classLabel: detail.classLabel,
      topic: detail.thema,
      blocks: detail.blocks.map((block) => ({
        title: block.title,
        percent: block.percent,
        level: block.level,
      })),
      comment: textFromHtml(detail.commentHtml),
    },
    source: {
      type: "lesson_card",
      title: "Карточка анализа урока",
      cardId: detail.id,
      teacherId: detail.teacher.id,
      date: detail.date,
      criteria: detail.blocks.map((block) => block.title),
    },
  };
}

async function teacherAnalyticsTool(
  schoolId: number,
  args: Record<string, unknown>,
): Promise<AiToolResult> {
  const teacherId = String(args.teacher_id ?? "").trim().slice(0, 100);
  if (!teacherId) {
    return { data: { found: false, reason: "Не указан педагог" }, source: null };
  }
  const cardType = cardTypeFrom(args.card_type);
  const yearStart = yearFrom(args.academic_year_start);
  let analytics: TeacherAnalytics;
  try {
    analytics = await selectTeacherYear(
      schoolId,
      teacherId,
      cardType,
      yearStart,
    );
  } catch {
    return {
      data: { found: false, reason: "Педагог не найден в вашей школе" },
      source: null,
    };
  }
  const period = await periodFor(schoolId, cardType, analytics.academicYearStart);

  return {
    data: {
      found: analytics.hasAnyOfType,
      hasData: analytics.hasDataInYear,
      cardType,
      cardTypeLabel: analytics.cardTypeLabel,
      academicYearLabel: analytics.academicYearLabel,
      period,
      latest: analytics.latest,
      previous: analytics.previous,
      delta: analytics.delta,
      sections: analytics.sections.map((section) => ({
        title: section.title,
        percent: section.percent,
        max: section.max,
        evaluations: section.evaluations,
      })),
      strengths: analytics.strengths,
      weaknesses: analytics.weaknesses,
    },
    source: {
      type: "teacher_analytics",
      title: `Аналитика педагога (${analytics.cardTypeLabel})`,
      periodFrom: period.from,
      periodTo: period.to,
      academicYearLabel: analytics.academicYearLabel,
      evaluations: analytics.sections[0]?.evaluations ?? null,
      teacherId,
      criteria: analytics.sections.map((section) => section.title),
    },
  };
}

export async function executeAiTool(
  name: string,
  rawArgs: string,
  schoolId: number,
): Promise<AiToolResult> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawArgs || "{}");
    if (parsed && typeof parsed === "object") {
      args = parsed as Record<string, unknown>;
    }
  } catch {
    return { data: { error: "Некорректные аргументы инструмента" }, source: null };
  }

  switch (name) {
    case "get_school_analytics":
      return schoolAnalyticsTool(schoolId, args);
    case "get_lesson_card":
      return lessonCardTool(schoolId, args);
    case "get_teacher_analytics":
      return teacherAnalyticsTool(schoolId, args);
    default:
      return { data: { error: "Инструмент недоступен" }, source: null };
  }
}

export interface InternalLinkContext {
  context: string | null;
  sources: AiToolSource[];
}

const CARD_LINK = /\/school\/lesson-analysis\/teachers\/([^/\s?#]+)\/cards\/(\d+)/;
const TEACHER_LINK = /\/school\/(?:lesson-analysis\/teachers|workers)\/([^/\s?#]+)/;
const ANALYTICS_LINK = /\/school\/analytics(?:[?#\s]|$)/;

export async function resolveInternalLinks(
  text: string,
  schoolId: number,
): Promise<InternalLinkContext> {
  const cardMatch = text.match(CARD_LINK);
  if (cardMatch) {
    const teacherId = decodeURIComponent(cardMatch[1]);
    const cardId = Number(cardMatch[2]);
    const result = await lessonCardTool(schoolId, {
      teacher_id: teacherId,
      card_id: cardId,
    });
    const found = Boolean(result.data.found);
    return {
      context: found
        ? `Пользователь приложил внутреннюю ссылку на карточку анализа урока. Данные карточки (JSON): ${JSON.stringify(result.data)}. Используй эти данные в ответе, не говори, что не можешь открыть ссылку. Не называй ФИО педагога.`
        : `Пользователь приложил ссылку на карточку анализа урока, но карточка не найдена в его школе. Скажи об этом и предложи открыть раздел «Анализ урока».`,
      sources: result.source ? [result.source] : [],
    };
  }

  const teacherMatch = text.match(TEACHER_LINK);
  if (teacherMatch) {
    const teacherId = decodeURIComponent(teacherMatch[1]);
    const result = await teacherAnalyticsTool(schoolId, {
      teacher_id: teacherId,
    });
    if (result.data.found) {
      return {
        context: `Пользователь приложил внутреннюю ссылку на карточку педагога. Аналитика педагога (JSON): ${JSON.stringify(result.data)}. Используй ее в ответе, не называй ФИО.`,
        sources: result.source ? [result.source] : [],
      };
    }
    return {
      context:
        "Пользователь приложил ссылку на карточку педагога, но данных в его школе не найдено. Скажи об этом.",
      sources: result.source ? [result.source] : [],
    };
  }

  if (ANALYTICS_LINK.test(text)) {
    return {
      context:
        "Пользователь приложил ссылку на раздел аналитики школы. Для ответа используй инструмент get_school_analytics.",
      sources: [],
    };
  }

  if (/tallam\.ru|localhost|\/school\//.test(text)) {
    return {
      context:
        "В сообщении есть ссылка. Если это не внутренняя ссылка Tallam на карточку или аналитику, не утверждай, что открыл ее. Для данных школы используй доступные инструменты.",
      sources: [],
    };
  }

  return { context: null, sources: [] };
}
