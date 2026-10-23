import ExcelJS from "exceljs";
import type { ResultSetHeader } from "mysql2";
import { query } from "../db/pool.js";
import {
  JOINS,
  SelectionError,
  TRAINING_YEAR_EXPR,
  compileFilters,
  fieldsForClient,
  findField,
  type FilterCondition,
  type SelectionField,
} from "./selection-fields.js";

const SUBJECTS_SUBQUERY =
  "(SELECT GROUP_CONCAT(DISTINCT dt.title_discipline ORDER BY dt.title_discipline SEPARATOR ', ') " +
  "FROM discipline_middleware dm2 JOIN discipline_title dt ON dt.id_discipline = dm2.discipline_id " +
  "WHERE dm2.teacher_id = t.id_teacher)";

/** Жёсткий потолок: школа и так небольшая, но защищаемся от случайных выборок. */
const MAX_ROWS = 5000;

export { SelectionError };

let schemaReady: Promise<void> | null = null;

export async function ensureSelectionSchema(): Promise<void> {
  if (schemaReady) return;
  schemaReady = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS saved_selections (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        school_id int(11) NOT NULL,
        title varchar(150) NOT NULL,
        entity varchar(40) NOT NULL DEFAULT 'teacher',
        filters json NOT NULL,
        columns json NOT NULL,
        created_by varchar(150) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY school_id (school_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  })();
  return schemaReady;
}

export interface TeacherRow {
  id: string;
  surname: string;
  firstname: string;
  patronymic: string | null;
  fio: string;
  position: string | null;
  category: string | null;
  education: string | null;
  subjects: string | null;
  teachingExperience: number | null;
  age: number | null;
  email: string | null;
  lastEvaluationDate: string | null;
  evaluationsCount: number;
  lastTrainingYear: number | null;
  trainingYearUnreliable: boolean;
}

interface RawRow {
  id_teacher: string;
  surname: string | null;
  firstname: string | null;
  patronymic: string | null;
  position: string | null;
  category: string | null;
  education: string | null;
  subjects: string | null;
  teaching_experience: number | null;
  age: number | null;
  email: string | null;
  last_evaluation_date: Date | string | null;
  evaluations_count: number | string;
  last_training_year: number | string | null;
  kpk_unreliable: number | string | null;
}

const SELECT_LIST = `
  t.id_teacher,
  MAX(t.surname) AS surname,
  MAX(t.firstname) AS firstname,
  MAX(t.patronymic) AS patronymic,
  MAX(p.title_position) AS position,
  MAX(c.title_category) AS category,
  MAX(e.title_edu_level) AS education,
  ${SUBJECTS_SUBQUERY} AS subjects,
  MAX(t.teaching_experience) AS teaching_experience,
  MAX(TIMESTAMPDIFF(YEAR, t.birthday, CURDATE())) AS age,
  MAX(t.email) AS email,
  MAX(m.create_mark_date) AS last_evaluation_date,
  COUNT(DISTINCT m.id_card) AS evaluations_count,
  ${TRAINING_YEAR_EXPR} AS last_training_year,
  SUM(
    k.year_training IS NOT NULL AND k.year_training <> ''
    AND k.year_training NOT REGEXP '^[0-9]{4}$'
  ) AS kpk_unreliable
`;

const BASE_JOINS = `${JOINS.position}
  ${JOINS.category}
  ${JOINS.eduLevel}
  ${JOINS.marks}
  ${JOINS.kpk}`;

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapRow(row: RawRow): TeacherRow {
  const fio = [row.surname, row.firstname, row.patronymic]
    .filter(Boolean)
    .join(" ");

  return {
    id: row.id_teacher,
    surname: row.surname ?? "",
    firstname: row.firstname ?? "",
    patronymic: row.patronymic,
    fio,
    position: row.position,
    category: row.category,
    education: row.education,
    subjects: row.subjects,
    teachingExperience:
      row.teaching_experience === null ? null : Number(row.teaching_experience),
    age: row.age === null ? null : Number(row.age),
    email: row.email,
    lastEvaluationDate: toIsoDate(row.last_evaluation_date),
    evaluationsCount: Number(row.evaluations_count ?? 0),
    lastTrainingYear:
      row.last_training_year === null || row.last_training_year === undefined
        ? null
        : Number(row.last_training_year),
    trainingYearUnreliable: Number(row.kpk_unreliable ?? 0) > 0,
  };
}

function orderByClause(sort?: { field?: string; dir?: string }): string {
  const field = findField(sort?.field ?? "fio");
  if (!field || !field.sortable) {
    throw new SelectionError("По этому полю сортировка недоступна");
  }
  const dir = sort?.dir === "desc" ? "DESC" : "ASC";
  // Сортируем по тому же агрегату, что и в SELECT: алиасы в ORDER BY
  // конфликтуют с именами колонок `teachers` при ONLY_FULL_GROUP_BY.
  return `ORDER BY ${field.select} IS NULL, ${field.select} ${dir}`;
}

async function runTeacherQuery(
  schoolId: number,
  filters: FilterCondition[],
  sort?: { field?: string; dir?: string },
): Promise<TeacherRow[]> {
  const compiled = compileFilters(filters);

  const whereSql = [`t.school_id = ?`, ...compiled.where].join(" AND ");
  const havingSql = compiled.having.length
    ? `HAVING ${compiled.having.join(" AND ")}`
    : "";

  const sql = `
    SELECT ${SELECT_LIST}
    FROM teachers t
    ${BASE_JOINS}
    WHERE ${whereSql}
    GROUP BY t.id_teacher
    ${havingSql}
    ${orderByClause(sort)}
    LIMIT ${MAX_ROWS}
  `;

  const rows = await query<RawRow[]>(sql, [schoolId, ...compiled.params]);
  return rows.map(mapRow);
}

export interface SelectionWarning {
  code: string;
  message: string;
  affected: number;
}

export interface SelectionPreview {
  total: number;
  rows: TeacherRow[];
  warnings: SelectionWarning[];
  columns: string[];
}

function buildWarnings(rows: TeacherRow[]): SelectionWarning[] {
  const warnings: SelectionWarning[] = [];

  const unreliable = rows.filter((row) => row.trainingYearUnreliable).length;
  if (unreliable > 0) {
    warnings.push({
      code: "kpk_year_unreliable",
      message:
        "Год обучения записан в нераспознанном виде и не учитывался при отборе",
      affected: unreliable,
    });
  }

  const noEmail = rows.filter((row) => !row.email).length;
  if (noEmail > 0) {
    warnings.push({
      code: "no_email",
      message: "Учителя без email: уведомления на почту им недоступны",
      affected: noEmail,
    });
  }

  return warnings;
}

export async function previewSelection(
  schoolId: number,
  filters: FilterCondition[],
  columns: string[],
  sort?: { field?: string; dir?: string },
): Promise<SelectionPreview & { allRows: TeacherRow[] }> {
  const rows = await runTeacherQuery(schoolId, filters, sort);
  const validColumns = normalizeColumns(columns);

  return {
    total: rows.length,
    rows: rows.slice(0, 50),
    allRows: rows,
    warnings: buildWarnings(rows),
    columns: validColumns,
  };
}

export interface SelectionPreset {
  key: string;
  title: string;
  description: string;
  test: (row: TeacherRow) => boolean;
}

const now = () => new Date();
const daysSince = (iso: string | null): number | null => {
  if (!iso) return null;
  const diff = now().getTime() - new Date(`${iso}T00:00:00`).getTime();
  return Math.floor(diff / 86_400_000);
};

export const SELECTION_PRESETS: SelectionPreset[] = [
  {
    key: "never_evaluated",
    title: "Ни разу не оценивались",
    description: "У учителя нет ни одной карты в системе",
    test: (row) => row.evaluationsCount === 0,
  },
  {
    key: "no_eval_year",
    title: "Не оценивались больше года",
    description: "Последняя оценка старше 12 месяцев или её нет",
    test: (row) => {
      const days = daysSince(row.lastEvaluationDate);
      return days === null || days > 365;
    },
  },
  {
    key: "no_training_3y",
    title: "Без повышения квалификации 3 года",
    description: "Последнее обучение раньше трёх лет назад или данных нет",
    test: (row) =>
      row.lastTrainingYear === null ||
      row.lastTrainingYear < now().getFullYear() - 3,
  },
  {
    key: "experience_lt_5",
    title: "Педагогический стаж до 5 лет",
    description: "Молодые специалисты и учителя с небольшим стажем",
    test: (row) =>
      row.teachingExperience !== null && row.teachingExperience < 5,
  },
  {
    key: "age_60",
    title: "60 лет и старше",
    description: "Для планирования кадров и нагрузки",
    test: (row) => row.age !== null && row.age >= 60,
  },
  {
    key: "no_email",
    title: "Без email",
    description: "Не смогут получать оценки на почту и войти по приглашению",
    test: (row) => !row.email,
  },
];

export interface PresetWithCount {
  key: string;
  title: string;
  description: string;
  count: number;
}

/**
 * Все готовые списки считаются из одного запроса: школа небольшая
 * (медиана 29 учителей), поэтому дешевле один раз прочитать строки,
 * чем выполнять шесть отдельных запросов.
 */
export async function presetCounts(
  schoolId: number,
): Promise<PresetWithCount[]> {
  const rows = await runTeacherQuery(schoolId, [], { field: "fio" });
  return SELECTION_PRESETS.map((preset) => ({
    key: preset.key,
    title: preset.title,
    description: preset.description,
    count: rows.filter((row) => preset.test(row)).length,
  }));
}

export async function presetRows(
  schoolId: number,
  presetKey: string,
): Promise<TeacherRow[]> {
  const preset = SELECTION_PRESETS.find((item) => item.key === presetKey);
  if (!preset) {
    throw new SelectionError("Список не найден", 404);
  }
  const rows = await runTeacherQuery(schoolId, [], { field: "fio" });
  return rows.filter((row) => preset.test(row));
}

function normalizeColumns(columns: string[]): string[] {
  const requested = Array.isArray(columns) ? columns : [];
  const valid = requested
    .map((key) => findField(key))
    .filter((field): field is SelectionField => Boolean(field?.columnable))
    .map((field) => field.key);

  if (valid.length === 0) return ["fio", "position", "category", "age"];
  return valid.slice(0, 12);
}

export interface SavedSelection {
  id: number;
  title: string;
  entity: string;
  filters: FilterCondition[];
  columns: string[];
  createdAt: string;
  updatedAt: string;
}

interface SavedRow {
  id: number;
  title: string;
  entity: string;
  filters: string | FilterCondition[];
  columns: string | string[];
  created_at: Date | string;
  updated_at: Date | string;
}

function parseJson<T>(value: string | T): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function mapSaved(row: SavedRow): SavedSelection {
  return {
    id: Number(row.id),
    title: row.title,
    entity: row.entity,
    filters: parseJson<FilterCondition[]>(row.filters),
    columns: parseJson<string[]>(row.columns),
    createdAt: toIsoDate(row.created_at) ?? "",
    updatedAt: toIsoDate(row.updated_at) ?? "",
  };
}

export async function listSavedSelections(
  schoolId: number,
): Promise<SavedSelection[]> {
  await ensureSelectionSchema();
  const rows = await query<SavedRow[]>(
    `SELECT id, title, entity, filters, columns, created_at, updated_at
     FROM saved_selections WHERE school_id = ? ORDER BY updated_at DESC, id DESC`,
    [schoolId],
  );
  return rows.map(mapSaved);
}

export async function getSavedSelection(
  schoolId: number,
  id: number,
): Promise<SavedSelection> {
  await ensureSelectionSchema();
  const rows = await query<SavedRow[]>(
    `SELECT id, title, entity, filters, columns, created_at, updated_at
     FROM saved_selections WHERE school_id = ? AND id = ? LIMIT 1`,
    [schoolId, id],
  );
  if (!rows[0]) throw new SelectionError("Список не найден", 404);
  return mapSaved(rows[0]);
}

export async function createSavedSelection(
  schoolId: number,
  input: {
    title: string;
    filters: FilterCondition[];
    columns: string[];
    createdBy?: string | null;
  },
): Promise<SavedSelection> {
  await ensureSelectionSchema();
  const title = (input.title ?? "").trim();
  if (!title) throw new SelectionError("Укажите название списка");
  if (title.length > 150) throw new SelectionError("Слишком длинное название");

  // Компиляция на сохранении: невалидные условия не попадут в базу.
  compileFilters(input.filters ?? []);
  const columns = normalizeColumns(input.columns ?? []);

  const result = await query<ResultSetHeader>(
    `INSERT INTO saved_selections (school_id, title, entity, filters, columns, created_by)
     VALUES (?, ?, 'teacher', ?, ?, ?)`,
    [
      schoolId,
      title,
      JSON.stringify(input.filters ?? []),
      JSON.stringify(columns),
      input.createdBy ?? null,
    ],
  );

  return getSavedSelection(schoolId, Number(result.insertId));
}

export async function deleteSavedSelection(
  schoolId: number,
  id: number,
): Promise<void> {
  await ensureSelectionSchema();
  const rows = await query<{ id: number }[]>(
    "SELECT id FROM saved_selections WHERE school_id = ? AND id = ? LIMIT 1",
    [schoolId, id],
  );
  if (!rows[0]) throw new SelectionError("Список не найден", 404);
  await query("DELETE FROM saved_selections WHERE school_id = ? AND id = ?", [
    schoolId,
    id,
  ]);
}

export async function selectionOptions() {
  const fields = fieldsForClient();
  const options: Record<string, Array<{ id: number; title: string }>> = {};

  for (const field of fields) {
    if (!field.optionsSql) continue;
    options[field.key] = await query<Array<{ id: number; title: string }>>(
      field.optionsSql,
    );
  }

  return { fields, options };
}

const COLUMN_LABELS: Record<string, string> = {
  fio: "ФИО",
  position: "Должность",
  category: "Категория",
  education: "Образование",
  subject: "Предметы",
  teaching_experience: "Пед. стаж",
  age: "Возраст",
  email: "Email",
  last_evaluation_date: "Последняя оценка",
  evaluations_count: "Оценок",
  last_training_year: "Обучение, год",
};

function cellValue(row: TeacherRow, key: string): string | number {
  switch (key) {
    case "fio":
      return row.fio;
    case "position":
      return row.position ?? "";
    case "category":
      return row.category ?? "";
    case "education":
      return row.education ?? "";
    case "subject":
      return row.subjects ?? "";
    case "teaching_experience":
      return row.teachingExperience ?? "";
    case "age":
      return row.age ?? "";
    case "email":
      return row.email ?? "";
    case "last_evaluation_date":
      return row.lastEvaluationDate
        ? row.lastEvaluationDate.split("-").reverse().join(".")
        : "";
    case "evaluations_count":
      return row.evaluationsCount;
    case "last_training_year":
      return row.lastTrainingYear ?? "";
    default:
      return "";
  }
}

export async function buildSelectionExcel(
  rows: TeacherRow[],
  columns: string[],
  title: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const validColumns = normalizeColumns(columns);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Список");

  worksheet.columns = validColumns.map((key) => ({
    header: COLUMN_LABELS[key] ?? key,
    key,
    width: key === "fio" || key === "subject" ? 34 : 16,
  }));

  for (const row of rows) {
    const record: Record<string, string | number> = {};
    for (const key of validColumns) {
      record[key] = cellValue(row, key);
    }
    worksheet.addRow(record);
  }

  worksheet.getRow(1).font = { bold: true };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, " ").trim() || "Список";
  const date = new Date().toISOString().slice(0, 10).split("-").reverse().join(".");
  return { buffer, filename: `${safeTitle} от ${date}.xlsx` };
}
