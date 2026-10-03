import type { ResultSetHeader } from "mysql2";
import { query } from "../db/pool.js";

export type VacancyStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type SalaryType = "net" | "gross";
export type VacancyShift = "first" | "second" | "any";
export type EmploymentType = "full" | "partial" | "hourly";
export type EmploymentTerm = "temporary" | "permanent";

export class VacancyError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface VacancyInput {
  position: string;
  subjects: string[];
  subject: string;
  description: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryType: SalaryType | null;
  hoursPerWeek: number | null;
  rateCount: number | null;
  grades: string | null;
  shift: VacancyShift | null;
  employmentType: EmploymentType | null;
  partTime: boolean | null;
  employmentTerm: EmploymentTerm | null;
  startDate: string | null;
  classGuidance: boolean | null;
  desiredExperience: string | null;
  educationRequirements: string | null;
  extraConditions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  publishUntil: string | null;
  status: "DRAFT" | "ACTIVE";
}

export interface VacancyListItem {
  id: number;
  schoolId: number;
  schoolName: string;
  areaId: number | null;
  areaName: string | null;
  status: VacancyStatus;
  position: string;
  subject: string;
  salaryLabel: string | null;
  hoursPerWeek: number | null;
  publishedOn: string | null;
  createdOn: string;
  isOwn: boolean;
  expired: boolean;
}

export interface VacancyDetail extends VacancyListItem {
  subjects: string[];
  description: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryType: SalaryType | null;
  rateCount: number | null;
  grades: string | null;
  shift: VacancyShift | null;
  employmentType: EmploymentType | null;
  partTime: boolean | null;
  employmentTerm: EmploymentTerm | null;
  startDate: string | null;
  classGuidance: boolean | null;
  desiredExperience: string | null;
  educationRequirements: string | null;
  extraConditions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  publishUntil: string | null;
}

interface VacancyRow {
  id: number;
  schoolId: number;
  schoolName: string;
  areaId: number | null;
  areaName: string | null;
  status: VacancyStatus;
  position: string;
  subject: string;
  subjects: unknown;
  description: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryType: SalaryType | null;
  hoursPerWeek: string | number | null;
  rateCount: string | number | null;
  grades: string | null;
  shift: VacancyShift | null;
  employmentType: EmploymentType | null;
  partTime: number | null;
  employmentTerm: EmploymentTerm | null;
  startDate: string | null;
  classGuidance: number | null;
  desiredExperience: string | null;
  educationRequirements: string | null;
  extraConditions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  publishUntil: string | null;
  publishedOn: string | null;
  createdOn: string;
  expired: number;
}

const VACANCY_SELECT = `
  SELECT
    v.id,
    v.school_id AS schoolId,
    s.school_name AS schoolName,
    a.id_area AS areaId,
    a.title_area AS areaName,
    v.status,
    v.position,
    v.subject,
    v.subjects,
    v.description,
    v.salary_from AS salaryFrom,
    v.salary_to AS salaryTo,
    v.salary_type AS salaryType,
    v.hours_per_week AS hoursPerWeek,
    v.rate_count AS rateCount,
    v.grades,
    v.shift,
    v.employment_type AS employmentType,
    v.part_time AS partTime,
    v.employment_term AS employmentTerm,
    DATE_FORMAT(v.start_date, '%Y-%m-%d') AS startDate,
    v.class_guidance AS classGuidance,
    v.desired_experience AS desiredExperience,
    v.education_requirements AS educationRequirements,
    v.extra_conditions AS extraConditions,
    v.contact_name AS contactName,
    v.contact_phone AS contactPhone,
    v.contact_email AS contactEmail,
    DATE_FORMAT(v.publish_until, '%Y-%m-%d') AS publishUntil,
    DATE_FORMAT(v.published_at, '%Y-%m-%d') AS publishedOn,
    DATE_FORMAT(v.created_at, '%Y-%m-%d') AS createdOn,
    (
      v.status = 'ACTIVE'
      AND v.publish_until IS NOT NULL
      AND v.publish_until < CURDATE()
    ) AS expired
  FROM vacancies v
  JOIN schools s ON s.id_school = v.school_id
  LEFT JOIN area a ON a.id_area = s.area_id
`;

let schemaReady: Promise<void> | null = null;

const MAX_SUBJECTS = 15;

export async function ensureVacancySchema(): Promise<void> {
  if (!schemaReady) {
    // Отклики учителей позже ссылаются на vacancies.id отдельной таблицей.
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS vacancies (
          id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
          school_id bigint(20) UNSIGNED NOT NULL,
          status enum('DRAFT','ACTIVE','CLOSED') NOT NULL DEFAULT 'DRAFT',
          position varchar(200) NOT NULL,
          subject text NOT NULL,
          subjects json DEFAULT NULL,
          description text NOT NULL,
          salary_from int(10) UNSIGNED DEFAULT NULL,
          salary_to int(10) UNSIGNED DEFAULT NULL,
          salary_type enum('net','gross') DEFAULT NULL,
          hours_per_week decimal(4,1) DEFAULT NULL,
          rate_count decimal(4,2) DEFAULT NULL,
          grades varchar(200) DEFAULT NULL,
          shift enum('first','second','any') DEFAULT NULL,
          employment_type enum('full','partial','hourly') DEFAULT NULL,
          part_time tinyint(1) DEFAULT NULL,
          employment_term enum('temporary','permanent') DEFAULT NULL,
          start_date date DEFAULT NULL,
          class_guidance tinyint(1) DEFAULT NULL,
          desired_experience varchar(200) DEFAULT NULL,
          education_requirements text DEFAULT NULL,
          extra_conditions text DEFAULT NULL,
          contact_name varchar(200) DEFAULT NULL,
          contact_phone varchar(50) DEFAULT NULL,
          contact_email varchar(200) DEFAULT NULL,
          publish_until date DEFAULT NULL,
          published_at timestamp NULL DEFAULT NULL,
          closed_at timestamp NULL DEFAULT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_vacancies_school_status (school_id, status),
          KEY idx_vacancies_status_published (status, published_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      const columns = await query<{ name: string; dataType: string }[]>(
        `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'vacancies'
           AND COLUMN_NAME IN ('subject', 'subjects')`,
      );
      const subjectType = columns.find((column) => column.name === "subject")?.dataType;
      if (subjectType && subjectType !== "text") {
        const indexes = await query<{ name: string }[]>(
          `SELECT INDEX_NAME AS name
           FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'vacancies'
             AND INDEX_NAME = 'idx_vacancies_subject'`,
        );
        if (indexes.length) {
          await query("ALTER TABLE vacancies DROP INDEX idx_vacancies_subject");
        }
        await query("ALTER TABLE vacancies MODIFY subject text NOT NULL");
      }
      if (!columns.some((column) => column.name === "subjects")) {
        await query("ALTER TABLE vacancies ADD COLUMN subjects json DEFAULT NULL AFTER subject");
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function longText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new VacancyError("Проверьте выбранные значения в дополнительных условиях");
  }
  return value as T;
}

function optionalBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "boolean") {
    throw new VacancyError("Проверьте поля «да / нет» в дополнительных условиях");
  }
  return value;
}

function optionalMoney(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(amount) || amount < 0 || amount > 10_000_000) {
    throw new VacancyError(`${label} укажите целое число от 0 до 10 000 000`);
  }
  return amount;
}

function optionalDecimal(
  value: unknown,
  label: string,
  min: number,
  max: number,
  digits: number,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < min || amount > max) {
    throw new VacancyError(`${label} укажите число от ${min} до ${max}`);
  }
  const factor = 10 ** digits;
  return Math.round(amount * factor) / factor;
}

function optionalDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new VacancyError(`${label} укажите корректную дату`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new VacancyError(`${label} укажите корректную дату`);
  }
  return value;
}

function optionalEmail(value: unknown): string | null {
  const email = text(value, 200);
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new VacancyError("Укажите корректный email контактного лица");
  }
  return email.toLowerCase();
}

function optionalPhone(value: unknown): string | null {
  const phone = text(value, 50);
  if (!phone) return null;
  if (!/^[0-9+()\-\s]{5,50}$/.test(phone)) {
    throw new VacancyError("Укажите корректный телефон контактного лица");
  }
  return phone;
}

function parseSubjects(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  const titles: string[] = [];
  for (const item of raw) {
    const title = text(item, 200);
    if (!title || titles.includes(title)) continue;
    titles.push(title);
  }
  if (!titles.length) {
    throw new VacancyError("Укажите хотя бы один предмет или направление");
  }
  if (titles.length > MAX_SUBJECTS) {
    throw new VacancyError(`Можно выбрать не больше ${MAX_SUBJECTS} предметов`);
  }
  return titles;
}

function storedSubjects(value: unknown, fallback: string): string[] {
  let parsed = value;
  if (typeof value === "string" && value.trim()) {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      parsed = null;
    }
  }
  if (Array.isArray(parsed)) {
    const titles = parsed.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (titles.length) return titles;
  }
  return fallback ? [fallback] : [];
}

export function parseVacancyInput(body: unknown): VacancyInput {
  const source = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const position = text(source.position, 200);
  const subjects = parseSubjects(source.subjects);
  const subject = subjects.join(", ");
  const description = longText(source.description, 5000);
  if (!position || position.length < 2) {
    throw new VacancyError("Укажите должность");
  }
  if (!description || description.length < 10) {
    throw new VacancyError("Опишите вакансию хотя бы в нескольких словах");
  }

  const salaryFrom = optionalMoney(source.salaryFrom, "В поле «Зарплата от»");
  const salaryTo = optionalMoney(source.salaryTo, "В поле «Зарплата до»");
  if (salaryFrom !== null && salaryTo !== null && salaryFrom > salaryTo) {
    throw new VacancyError("Зарплата «от» не может быть больше зарплаты «до»");
  }

  const status = source.status === "ACTIVE" ? "ACTIVE" : source.status === "DRAFT" ? "DRAFT" : null;
  if (!status) {
    throw new VacancyError("Укажите, опубликовать вакансию или сохранить черновик");
  }

  return {
    position,
    subjects,
    subject,
    description,
    salaryFrom,
    salaryTo,
    salaryType: optionalEnum(source.salaryType, ["net", "gross"] as const),
    hoursPerWeek: optionalDecimal(source.hoursPerWeek, "В поле «Часов в неделю»", 0, 60, 1),
    rateCount: optionalDecimal(source.rateCount, "В поле «Количество ставок»", 0, 5, 2),
    grades: text(source.grades, 200),
    shift: optionalEnum(source.shift, ["first", "second", "any"] as const),
    employmentType: optionalEnum(source.employmentType, ["full", "partial", "hourly"] as const),
    partTime: optionalBool(source.partTime),
    employmentTerm: optionalEnum(source.employmentTerm, ["temporary", "permanent"] as const),
    startDate: optionalDate(source.startDate, "В поле «Дата выхода»"),
    classGuidance: optionalBool(source.classGuidance),
    desiredExperience: text(source.desiredExperience, 200),
    educationRequirements: longText(source.educationRequirements, 2000),
    extraConditions: longText(source.extraConditions, 2000),
    contactName: text(source.contactName, 200),
    contactPhone: optionalPhone(source.contactPhone),
    contactEmail: optionalEmail(source.contactEmail),
    publishUntil: optionalDate(source.publishUntil, "В поле «Срок публикации»"),
    status,
  };
}

function moneyLabel(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

export function salaryLabel(
  salaryFrom: number | null,
  salaryTo: number | null,
  salaryType: SalaryType | null,
): string | null {
  let range = "";
  if (salaryFrom !== null && salaryTo !== null) {
    range = `от ${moneyLabel(salaryFrom)} до ${moneyLabel(salaryTo)}`;
  } else if (salaryFrom !== null) {
    range = `от ${moneyLabel(salaryFrom)}`;
  } else if (salaryTo !== null) {
    range = `до ${moneyLabel(salaryTo)}`;
  }
  if (!range) return null;
  if (salaryType === "net") return `${range}, на руки`;
  if (salaryType === "gross") return `${range}, до вычета налогов`;
  return range;
}

function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function toBool(value: number | null): boolean | null {
  if (value === null || value === undefined) return null;
  return Boolean(Number(value));
}

function mapListItem(row: VacancyRow, viewerSchoolId: number): VacancyListItem {
  const salaryFrom = toNumber(row.salaryFrom);
  const salaryTo = toNumber(row.salaryTo);
  return {
    id: Number(row.id),
    schoolId: Number(row.schoolId),
    schoolName: row.schoolName.trim(),
    areaId: row.areaId === null ? null : Number(row.areaId),
    areaName: row.areaName?.trim() || null,
    status: row.status,
    position: row.position,
    subject: row.subject,
    salaryLabel: salaryLabel(salaryFrom, salaryTo, row.salaryType),
    hoursPerWeek: toNumber(row.hoursPerWeek),
    publishedOn: row.publishedOn,
    createdOn: row.createdOn,
    isOwn: Number(row.schoolId) === viewerSchoolId,
    expired: Boolean(Number(row.expired)),
  };
}

function mapDetail(row: VacancyRow, viewerSchoolId: number): VacancyDetail {
  return {
    ...mapListItem(row, viewerSchoolId),
    subjects: storedSubjects(row.subjects, row.subject),
    description: row.description,
    salaryFrom: toNumber(row.salaryFrom),
    salaryTo: toNumber(row.salaryTo),
    salaryType: row.salaryType,
    rateCount: toNumber(row.rateCount),
    grades: row.grades,
    shift: row.shift,
    employmentType: row.employmentType,
    partTime: toBool(row.partTime),
    employmentTerm: row.employmentTerm,
    startDate: row.startDate,
    classGuidance: toBool(row.classGuidance),
    desiredExperience: row.desiredExperience,
    educationRequirements: row.educationRequirements,
    extraConditions: row.extraConditions,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    publishUntil: row.publishUntil,
  };
}

async function findRow(id: number): Promise<VacancyRow | null> {
  const rows = await query<VacancyRow[]>(
    `${VACANCY_SELECT} WHERE v.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listVacancyFilters(viewerSchoolId: number) {
  await ensureVacancySchema();
  const [areas, subjects] = await Promise.all([
    query<{ id: number; title: string }[]>(
      `SELECT DISTINCT a.id_area AS id, a.title_area AS title
       FROM vacancies v
       JOIN schools s ON s.id_school = v.school_id
       JOIN area a ON a.id_area = s.area_id
       WHERE v.status <> 'DRAFT' OR v.school_id = ?
       ORDER BY a.title_area ASC`,
      [viewerSchoolId],
    ),
    query<{ subject: string }[]>(
      `SELECT DISTINCT v.subject AS subject
       FROM vacancies v
       WHERE v.status <> 'DRAFT' OR v.school_id = ?
       ORDER BY v.subject ASC`,
      [viewerSchoolId],
    ),
  ]);

  const [positions, disciplines] = await Promise.all([
    query<{ id: number; title: string }[]>(
      `SELECT id_position AS id, title_position AS title
       FROM position
       ORDER BY title_position ASC`,
    ),
    query<{ id: number; title: string }[]>(
      `SELECT id_discipline AS id, title_discipline AS title
       FROM discipline_title
       ORDER BY title_discipline ASC`,
    ),
  ]);

  return {
    areas: areas.map((area) => ({
      id: Number(area.id),
      title: area.title.trim(),
    })),
    subjects: subjects.map((item) => item.subject),
    positions: positions.map((item) => ({
      id: Number(item.id),
      title: item.title.trim(),
    })),
    disciplines: disciplines.map((item) => ({
      id: Number(item.id),
      title: item.title.trim(),
    })),
  };
}

async function assertCatalogValues(position: string, subjects: string[]) {
  const placeholders = subjects.map(() => "?").join(", ");
  const [positions, disciplines] = await Promise.all([
    query<{ id: number }[]>(
      "SELECT id_position AS id FROM position WHERE title_position = ? LIMIT 1",
      [position],
    ),
    query<{ title: string }[]>(
      `SELECT title_discipline AS title
       FROM discipline_title
       WHERE title_discipline IN (${placeholders})`,
      subjects,
    ),
  ]);
  if (!positions[0]) {
    throw new VacancyError("Выберите должность из списка");
  }
  const found = new Set(disciplines.map((item) => item.title));
  if (subjects.some((title) => !found.has(title))) {
    throw new VacancyError("Выберите предметы из списка");
  }
}

export async function listVacancies(input: {
  viewerSchoolId: number;
  scope: "others" | "mine";
  subject: string;
  areaId: number | null;
  school: string;
  salaryFrom: number | null;
  hoursFrom: number | null;
  status: string;
  page: number;
  limit: number;
}) {
  await ensureVacancySchema();
  const page = Math.max(1, input.page);
  const limit = Math.min(50, Math.max(10, input.limit));
  const offset = (page - 1) * limit;
  const params: Array<string | number> = [];
  const conditions: string[] = [];

  if (input.scope === "mine") {
    conditions.push("v.school_id = ?");
    params.push(input.viewerSchoolId);
    if (input.status === "DRAFT" || input.status === "ACTIVE" || input.status === "CLOSED") {
      conditions.push("v.status = ?");
      params.push(input.status);
    }
  } else {
    conditions.push("v.school_id <> ?");
    params.push(input.viewerSchoolId);
    conditions.push("v.status <> 'DRAFT'");
    if (input.status === "closed") {
      conditions.push(`(
        v.status = 'CLOSED'
        OR (
          v.status = 'ACTIVE'
          AND v.publish_until IS NOT NULL
          AND v.publish_until < CURDATE()
        )
      )`);
    } else if (input.status !== "any") {
      conditions.push("v.status = 'ACTIVE'");
      conditions.push("(v.publish_until IS NULL OR v.publish_until >= CURDATE())");
    }
  }

  if (input.subject) {
    conditions.push("v.subject LIKE ?");
    params.push(`%${input.subject}%`);
  }
  if (input.areaId) {
    conditions.push("s.area_id = ?");
    params.push(input.areaId);
  }
  if (input.school) {
    conditions.push("s.school_name LIKE ?");
    params.push(`%${input.school}%`);
  }
  if (input.salaryFrom !== null) {
    conditions.push(`(
      (v.salary_to IS NOT NULL AND v.salary_to >= ?)
      OR (v.salary_to IS NULL AND v.salary_from IS NOT NULL AND v.salary_from >= ?)
    )`);
    params.push(input.salaryFrom, input.salaryFrom);
  }
  if (input.hoursFrom !== null) {
    conditions.push("v.hours_per_week IS NOT NULL AND v.hours_per_week >= ?");
    params.push(input.hoursFrom);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const order =
    input.scope === "mine"
      ? "v.updated_at DESC, v.id DESC"
      : "v.published_at DESC, v.id DESC";

  const [rows, countRows] = await Promise.all([
    query<VacancyRow[]>(
      `${VACANCY_SELECT} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    query<{ count: number }[]>(
      `SELECT COUNT(*) AS count
       FROM vacancies v
       JOIN schools s ON s.id_school = v.school_id
       LEFT JOIN area a ON a.id_area = s.area_id
       ${where}`,
      params,
    ),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  return {
    items: rows.map((row) => mapListItem(row, input.viewerSchoolId)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listAdminVacancies(pageInput: number, limitInput: number) {
  await ensureVacancySchema();
  const page = Math.max(1, pageInput);
  const limit = [20, 50, 100].includes(limitInput) ? limitInput : 20;
  const offset = (page - 1) * limit;

  const [rows, countRows] = await Promise.all([
    query<VacancyRow[]>(
      `${VACANCY_SELECT} ORDER BY v.created_at DESC, v.id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    ),
    query<{ count: number }[]>(
      `SELECT COUNT(*) AS count
       FROM vacancies v
       JOIN schools s ON s.id_school = v.school_id
       LEFT JOIN area a ON a.id_area = s.area_id`,
    ),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  return {
    items: rows.map((row) => mapListItem(row, 0)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getVacancy(id: number, viewerSchoolId: number) {
  await ensureVacancySchema();
  const row = await findRow(id);
  if (!row || (Number(row.schoolId) !== viewerSchoolId && row.status === "DRAFT")) {
    throw new VacancyError("Вакансия не найдена", 404);
  }
  return mapDetail(row, viewerSchoolId);
}

function inputParams(input: VacancyInput) {
  return [
    input.position,
    input.subject,
    JSON.stringify(input.subjects),
    input.description,
    input.salaryFrom,
    input.salaryTo,
    input.salaryType,
    input.hoursPerWeek,
    input.rateCount,
    input.grades,
    input.shift,
    input.employmentType,
    input.partTime === null ? null : input.partTime ? 1 : 0,
    input.employmentTerm,
    input.startDate,
    input.classGuidance === null ? null : input.classGuidance ? 1 : 0,
    input.desiredExperience,
    input.educationRequirements,
    input.extraConditions,
    input.contactName,
    input.contactPhone,
    input.contactEmail,
    input.publishUntil,
  ];
}

export async function createVacancy(schoolId: number, input: VacancyInput) {
  await ensureVacancySchema();
  await assertCatalogValues(input.position, input.subjects);
  const result = await query<ResultSetHeader>(
    `INSERT INTO vacancies (
       school_id, status, position, subject, subjects, description,
       salary_from, salary_to, salary_type, hours_per_week, rate_count,
       grades, shift, employment_type, part_time, employment_term,
       start_date, class_guidance, desired_experience, education_requirements,
       extra_conditions, contact_name, contact_phone, contact_email,
       publish_until, published_at
     ) VALUES (
       ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ${input.status === "ACTIVE" ? "CURRENT_TIMESTAMP" : "NULL"}
     )`,
    [schoolId, input.status, ...inputParams(input)],
  );
  return getVacancy(Number(result.insertId), schoolId);
}

export async function updateVacancy(
  id: number,
  schoolId: number,
  input: VacancyInput,
) {
  await ensureVacancySchema();
  const current = await findRow(id);
  if (!current) {
    throw new VacancyError("Вакансия не найдена", 404);
  }
  if (Number(current.schoolId) !== schoolId) {
    throw new VacancyError("Нельзя редактировать вакансию другой школы", 403);
  }
  if (current.status === "ACTIVE" && input.status === "DRAFT") {
    throw new VacancyError("Опубликованную вакансию можно закрыть, но не вернуть в черновик");
  }
  await assertCatalogValues(input.position, input.subjects);

  const nextStatus = input.status;
  await query(
    `UPDATE vacancies
     SET status = ?,
         position = ?,
         subject = ?,
         subjects = ?,
         description = ?,
         salary_from = ?,
         salary_to = ?,
         salary_type = ?,
         hours_per_week = ?,
         rate_count = ?,
         grades = ?,
         shift = ?,
         employment_type = ?,
         part_time = ?,
         employment_term = ?,
         start_date = ?,
         class_guidance = ?,
         desired_experience = ?,
         education_requirements = ?,
         extra_conditions = ?,
         contact_name = ?,
         contact_phone = ?,
         contact_email = ?,
         publish_until = ?,
         published_at = CASE
           WHEN ? = 'ACTIVE' AND published_at IS NULL THEN CURRENT_TIMESTAMP
           ELSE published_at
         END,
         closed_at = CASE WHEN ? = 'ACTIVE' OR ? = 'DRAFT' THEN NULL ELSE closed_at END
     WHERE id = ? AND school_id = ?`,
    [nextStatus, ...inputParams(input), nextStatus, nextStatus, nextStatus, id, schoolId],
  );
  return getVacancy(id, schoolId);
}

export async function closeVacancy(id: number, schoolId: number) {
  await ensureVacancySchema();
  const current = await findRow(id);
  if (!current) {
    throw new VacancyError("Вакансия не найдена", 404);
  }
  if (Number(current.schoolId) !== schoolId) {
    throw new VacancyError("Нельзя закрыть вакансию другой школы", 403);
  }
  if (current.status !== "CLOSED") {
    await query(
      `UPDATE vacancies
       SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND school_id = ?`,
      [id, schoolId],
    );
  }
  return getVacancy(id, schoolId);
}
