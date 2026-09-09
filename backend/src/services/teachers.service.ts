import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { query } from "../db/pool.js";
import {
  findLessonAnalysisProject,
  getTeacherActiveProjectNames,
  getTeacherProjectMemberships,
  getTeachersActiveProjectNames,
  NO_PROJECT_ID,
  resolveProjectMiddlewareTable,
} from "./project.service.js";

export interface TeacherListItem {
  id: string;
  surname: string;
  firstname: string;
  patronymic: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  projectLabels: string[];
}

interface TeacherRow {
  id_teacher: string;
  surname: string;
  firstname: string;
  patronymic: string | null;
  phone: string | null;
  email: string | null;
  title_position: string | null;
}

function mapTeacher(
  row: TeacherRow,
  projectLabels: string[] = [],
): TeacherListItem {
  const fullName = [row.surname, row.firstname, row.patronymic]
    .filter(Boolean)
    .join(" ");

  return {
    id: row.id_teacher,
    surname: row.surname,
    firstname: row.firstname,
    patronymic: row.patronymic,
    fullName,
    phone: row.phone,
    email: row.email,
    position: row.title_position,
    projectLabels,
  };
}

async function attachProjectLabels(
  teachers: TeacherListItem[],
): Promise<TeacherListItem[]> {
  if (teachers.length === 0) {
    return teachers;
  }

  const labelsByTeacher = await getTeachersActiveProjectNames(
    teachers.map((teacher) => teacher.id),
  );

  return teachers.map((teacher) => ({
    ...teacher,
    projectLabels: labelsByTeacher.get(teacher.id) ?? [],
  }));
}

interface MiddlewareProjectRow {
  project_id: number;
  tbl_name: string;
}

function sanitizeTableName(name: string): string {
  const safe = name.replace(/[^a-z0-9_]/gi, "");
  if (safe !== name) {
    throw new Error("Invalid table name");
  }
  return safe;
}

export const WORKERS_PAGE_LIMITS = [20, 50, 100] as const;
export type WorkersPageLimit = (typeof WORKERS_PAGE_LIMITS)[number];

export interface PaginatedTeachers {
  teachers: TeacherListItem[];
  total: number;
  page: number;
  limit: WorkersPageLimit;
}

function normalizeWorkersPagination(options: {
  page?: number;
  limit?: number;
}): { page: number; limit: WorkersPageLimit } {
  const limit = WORKERS_PAGE_LIMITS.includes(options.limit as WorkersPageLimit)
    ? (options.limit as WorkersPageLimit)
    : 20;
  const page = Math.max(1, options.page ?? 1);

  return { page, limit };
}

export async function listSchoolTeachers(
  schoolId: number,
  options: { page?: number; limit?: number } = {},
): Promise<PaginatedTeachers> {
  const { page, limit } = normalizeWorkersPagination(options);

  const countRows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM teachers WHERE school_id = ?`,
    [schoolId],
  );
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);

  const rows = await query<TeacherRow[]>(
    `SELECT
       t.id_teacher,
       t.surname,
       t.firstname,
       t.patronymic,
       t.phone,
       t.email,
       p.title_position
     FROM teachers t
     LEFT JOIN position p ON t.position = p.id_position
     WHERE t.school_id = ?
     ORDER BY t.surname ASC, t.firstname ASC
     LIMIT ? OFFSET ?`,
    [schoolId, limit, (safePage - 1) * limit],
  );

  const teachers = rows.map((row) => mapTeacher(row));

  return {
    teachers: await attachProjectLabels(teachers),
    total,
    page: safePage,
    limit,
  };
}

export async function listProjectTeachers(
  schoolId: number,
  projectId: number,
): Promise<TeacherListItem[]> {
  const middlewareTable = await resolveProjectMiddlewareTable(projectId);

  if (!middlewareTable) {
    return [];
  }

  const safeTable = middlewareTable.replace(/[^a-z0-9_]/gi, "");
  if (safeTable !== middlewareTable) {
    throw new Error("Invalid project middleware table");
  }

  const rows = await query<TeacherRow[]>(
    `SELECT
       t.id_teacher,
       t.surname,
       t.firstname,
       t.patronymic,
       t.phone,
       t.email,
       p.title_position
     FROM \`${safeTable}\` mpt
     INNER JOIN teachers t ON mpt.teacher_id = t.id_teacher
     LEFT JOIN position p ON t.position = p.id_position
     WHERE t.school_id = ?
       AND mpt.in_project_status = 2
       AND mpt.project_id = ?
     ORDER BY t.surname ASC, t.firstname ASC`,
    [schoolId, projectId],
  );

  const teachers = rows.map((row) => mapTeacher(row));
  return attachProjectLabels(teachers);
}

export async function listTeachersNotInProject(
  schoolId: number,
  projectId: number,
): Promise<TeacherListItem[]> {
  const middlewareTable = await resolveProjectMiddlewareTable(projectId);

  if (!middlewareTable) {
    return [];
  }

  const safeTable = middlewareTable.replace(/[^a-z0-9_]/gi, "");
  if (safeTable !== middlewareTable) {
    throw new Error("Invalid project middleware table");
  }

  const rows = await query<TeacherRow[]>(
    `SELECT
       t.id_teacher,
       t.surname,
       t.firstname,
       t.patronymic,
       t.phone,
       t.email,
       p.title_position
     FROM teachers t
     LEFT JOIN position p ON t.position = p.id_position
     LEFT JOIN \`${safeTable}\` mpt
       ON mpt.teacher_id = t.id_teacher AND mpt.project_id = ?
     WHERE t.school_id = ?
       AND (mpt.in_project_status IS NULL OR mpt.in_project_status != 2)
     ORDER BY t.surname ASC, t.firstname ASC`,
    [projectId, schoolId],
  );

  const teachers = rows.map((row) => mapTeacher(row));
  return attachProjectLabels(teachers);
}

export async function getLessonAnalysisTeachers(
  schoolId: number,
): Promise<{
  project: { id: number; name: string } | null;
  teachers: TeacherListItem[];
  candidates: TeacherListItem[];
}> {
  const project = await findLessonAnalysisProject(schoolId);

  if (!project) {
    return { project: null, teachers: [], candidates: [] };
  }

  const [teachers, candidates] = await Promise.all([
    listProjectTeachers(schoolId, project.id_project),
    listTeachersNotInProject(schoolId, project.id_project),
  ]);

  return {
    project: {
      id: project.id_project,
      name: project.name_project,
    },
    teachers,
    candidates,
  };
}

export interface WorkerFormOptions {
  genders: Array<{ id: number; title: string }>;
  educationLevels: Array<{ id: number; title: string }>;
  positions: Array<{ id: number; title: string }>;
  categories: Array<{ id: number; title: string }>;
  disciplines: Array<{ id: number; title: string }>;
  projects: Array<{ id: number; name: string }>;
}

export interface CreateTeacherInput {
  surname: string;
  firstname: string;
  patronymic?: string;
  birthday: string;
  snils?: string;
  genderId: number;
  specialty?: string;
  educationLevelId: number;
  diploma?: string;
  positionId: number;
  totalExperience?: number;
  teachingExperience?: number;
  categoryId?: number;
  phone?: string;
  email?: string;
  disciplineIds?: number[];
  kpkPlace?: string;
  kpkYear?: string;
  projectId: number;
}

export type UpdateTeacherInput = Omit<CreateTeacherInput, "projectId">;

export interface TeacherDetail {
  id: string;
  surname: string;
  firstname: string;
  patronymic: string | null;
  fullName: string;
  birthday: string;
  snils: string | null;
  genderId: number;
  genderTitle: string | null;
  specialty: string | null;
  educationLevelId: number;
  educationLevelTitle: string | null;
  diploma: string | null;
  positionId: number;
  positionTitle: string | null;
  totalExperience: number | null;
  teachingExperience: number | null;
  categoryId: number | null;
  categoryTitle: string | null;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  disciplineIds: number[];
  disciplines: Array<{ id: number; title: string }>;
  kpkPlace: string | null;
  kpkYear: string | null;
  activeProjects: Array<{ id: number; name: string }>;
  projectMemberships: Array<{ id: number; name: string; isMember: boolean }>;
}

interface TeacherDetailRow {
  id_teacher: string;
  surname: string;
  firstname: string;
  patronymic: string | null;
  birthday: Date;
  snils: number | null;
  gender_id: number;
  gender_title: string | null;
  specialty: string | null;
  level_of_education_id: number;
  title_edu_level: string | null;
  diploma: string | null;
  position: number;
  title_position: string | null;
  total_experience: number | null;
  teaching_experience: number | null;
  category_id: number | null;
  title_category: string | null;
  phone: string | null;
  email: string | null;
  avatar: string | null;
}

function formatBirthday(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapTeacherDetail(
  row: TeacherDetailRow,
  disciplines: Array<{ id: number; title: string }>,
  kpk: { place: string | null; year: string | null },
  projectMemberships: Array<{ id: number; name: string; isMember: boolean }>,
): TeacherDetail {
  const fullName = [row.surname, row.firstname, row.patronymic]
    .filter(Boolean)
    .join(" ");

  const activeProjects = projectMemberships
    .filter((project) => project.isMember)
    .map((project) => ({ id: project.id, name: project.name }));

  return {
    id: row.id_teacher,
    surname: row.surname,
    firstname: row.firstname,
    patronymic: row.patronymic,
    fullName,
    birthday: formatBirthday(row.birthday),
    snils: row.snils != null ? String(row.snils) : null,
    genderId: row.gender_id,
    genderTitle: row.gender_title,
    specialty: row.specialty,
    educationLevelId: row.level_of_education_id,
    educationLevelTitle: row.title_edu_level,
    diploma: row.diploma,
    positionId: row.position,
    positionTitle: row.title_position,
    totalExperience: row.total_experience,
    teachingExperience: row.teaching_experience,
    categoryId: row.category_id,
    categoryTitle: row.title_category,
    phone: row.phone,
    email: row.email,
    avatar: row.avatar,
    disciplineIds: disciplines.map((item) => item.id),
    disciplines,
    kpkPlace: kpk.place,
    kpkYear: kpk.year,
    activeProjects,
    projectMemberships,
  };
}

export async function getSchoolTeacher(
  schoolId: number,
  teacherId: string,
): Promise<TeacherDetail | null> {
  const rows = await query<TeacherDetailRow[]>(
    `SELECT
       t.id_teacher,
       t.surname,
       t.firstname,
       t.patronymic,
       t.birthday,
       t.snils,
       t.gender_id,
       t.specialty,
       t.level_of_education_id,
       t.diploma,
       t.position,
       t.total_experience,
       t.teaching_experience,
       t.category_id,
       t.phone,
       t.email,
       t.avatar,
       p.title_position,
       e.title_edu_level,
       c.title_category,
       g.gender_title
     FROM teachers t
     LEFT JOIN position p ON t.position = p.id_position
     LEFT JOIN edu_level e ON t.level_of_education_id = e.id_edu_level
     LEFT JOIN category c ON t.category_id = c.id_category
     LEFT JOIN gender g ON t.gender_id = g.id_gender
     WHERE t.id_teacher = ? AND t.school_id = ?
     LIMIT 1`,
    [teacherId, schoolId],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const [disciplineRows, kpkRows, projectMemberships] = await Promise.all([
    query<{ id_discipline: number; title_discipline: string }[]>(
      `SELECT dm.discipline_id AS id_discipline, dt.title_discipline
       FROM discipline_middleware dm
       INNER JOIN discipline_title dt ON dm.discipline_id = dt.id_discipline
       WHERE dm.teacher_id = ?
       ORDER BY dt.title_discipline`,
      [teacherId],
    ),
    query<{ place_training: string | null; year_training: string | null }[]>(
      "SELECT place_training, year_training FROM training_kpk WHERE teacher_id = ? LIMIT 1",
      [teacherId],
    ),
    getTeacherProjectMemberships(schoolId, teacherId),
  ]);

  const disciplines = disciplineRows.map((item) => ({
    id: item.id_discipline,
    title: item.title_discipline,
  }));

  const kpk = kpkRows[0];

  return mapTeacherDetail(
    row,
    disciplines,
    {
      place: kpk?.place_training ?? null,
      year: kpk?.year_training ?? null,
    },
    projectMemberships,
  );
}

export async function updateSchoolTeacher(
  schoolId: number,
  teacherId: string,
  input: UpdateTeacherInput,
): Promise<TeacherDetail | null> {
  const existing = await query<{ id_teacher: string }[]>(
    "SELECT id_teacher FROM teachers WHERE id_teacher = ? AND school_id = ? LIMIT 1",
    [teacherId, schoolId],
  );

  if (!existing[0]) {
    return null;
  }

  await query(
    `UPDATE teachers SET
       surname = ?,
       firstname = ?,
       patronymic = ?,
       birthday = ?,
       snils = ?,
       gender_id = ?,
       specialty = ?,
       level_of_education_id = ?,
       diploma = ?,
       position = ?,
       total_experience = ?,
       teaching_experience = ?,
       category_id = ?,
       phone = ?,
       email = ?
     WHERE id_teacher = ? AND school_id = ?`,
    [
      input.surname.trim(),
      input.firstname.trim(),
      input.patronymic?.trim() || null,
      input.birthday,
      input.snils || null,
      input.genderId,
      input.specialty?.trim() || null,
      input.educationLevelId,
      input.diploma?.trim() || null,
      input.positionId,
      input.totalExperience ?? null,
      input.teachingExperience ?? null,
      input.categoryId ?? null,
      input.phone?.trim() || null,
      input.email?.trim() || null,
      teacherId,
      schoolId,
    ],
  );

  const kpkRows = await query<{ id_training: number }[]>(
    "SELECT id_training FROM training_kpk WHERE teacher_id = ? LIMIT 1",
    [teacherId],
  );

  if (input.kpkPlace || input.kpkYear) {
    if (kpkRows[0]) {
      await query(
        "UPDATE training_kpk SET year_training = ?, place_training = ? WHERE teacher_id = ?",
        [input.kpkYear || null, input.kpkPlace || null, teacherId],
      );
    } else {
      await query(
        "INSERT INTO training_kpk (year_training, place_training, teacher_id) VALUES (?, ?, ?)",
        [input.kpkYear || null, input.kpkPlace || null, teacherId],
      );
    }
  } else if (kpkRows[0]) {
    await query("DELETE FROM training_kpk WHERE teacher_id = ?", [teacherId]);
  }

  await query("DELETE FROM discipline_middleware WHERE teacher_id = ?", [teacherId]);

  if (input.disciplineIds?.length) {
    for (const disciplineId of input.disciplineIds) {
      await query(
        "INSERT INTO discipline_middleware (teacher_id, discipline_id) VALUES (?, ?)",
        [teacherId, disciplineId],
      );
    }
  }

  return getSchoolTeacher(schoolId, teacherId);
}

interface ExcelTeacherRow {
  surname: string;
  firstname: string;
  patronymic: string | null;
  birthday: Date;
  snils: number | null;
  specialty: string | null;
  total_experience: number | null;
  teaching_experience: number | null;
  email: string | null;
  phone: string | null;
  title_position: string | null;
  title_edu_level: string | null;
  title_category: string | null;
  gender_title: string | null;
  school_name: string;
  title_area: string;
  year_training: string | null;
  place_training: string | null;
}

export async function getWorkerFormOptions(
  schoolId: number,
): Promise<WorkerFormOptions> {
  const [genders, educationLevels, positions, categories, disciplines, projects] =
    await Promise.all([
      query<{ id_gender: number; gender_title: string }[]>(
        "SELECT id_gender, gender_title FROM gender ORDER BY id_gender",
      ),
      query<{ id_edu_level: number; title_edu_level: string }[]>(
        "SELECT id_edu_level, title_edu_level FROM edu_level ORDER BY id_edu_level",
      ),
      query<{ id_position: number; title_position: string }[]>(
        "SELECT id_position, title_position FROM position ORDER BY title_position",
      ),
      query<{ id_category: number; title_category: string }[]>(
        "SELECT id_category, title_category FROM category ORDER BY id_category",
      ),
      query<{ id_discipline: number; title_discipline: string }[]>(
        "SELECT id_discipline, title_discipline FROM discipline_title ORDER BY title_discipline",
      ),
      query<{ id_project: number; name_project: string }[]>(
        `SELECT p.id_project, p.name_project
         FROM middleware_project_school mps
         INNER JOIN projects p ON p.id_project = mps.project_id
         WHERE mps.school_id = ?
         ORDER BY p.id_project`,
        [schoolId],
      ),
    ]);

  return {
    genders: genders.map((g) => ({ id: g.id_gender, title: g.gender_title })),
    educationLevels: educationLevels.map((e) => ({
      id: e.id_edu_level,
      title: e.title_edu_level,
    })),
    positions: positions.map((p) => ({
      id: p.id_position,
      title: p.title_position,
    })),
    categories: categories.map((c) => ({
      id: c.id_category,
      title: c.title_category,
    })),
    disciplines: disciplines.map((d) => ({
      id: d.id_discipline,
      title: d.title_discipline,
    })),
    projects: projects.map((p) => ({
      id: p.id_project,
      name: p.name_project,
    })),
  };
}

export async function createSchoolTeacher(
  schoolId: number,
  input: CreateTeacherInput,
): Promise<TeacherListItem> {
  const idTeacher = randomUUID();

  await query(
    `INSERT INTO teachers (
       id_teacher, surname, firstname, patronymic, birthday, snils,
       gender_id, specialty, level_of_education_id, diploma, position,
       total_experience, teaching_experience, category_id, phone, email, school_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      idTeacher,
      input.surname.trim(),
      input.firstname.trim(),
      input.patronymic?.trim() || null,
      input.birthday,
      input.snils || null,
      input.genderId,
      input.specialty?.trim() || null,
      input.educationLevelId,
      input.diploma?.trim() || null,
      input.positionId,
      input.totalExperience ?? null,
      input.teachingExperience ?? null,
      input.categoryId ?? null,
      input.phone?.trim() || null,
      input.email?.trim() || null,
      schoolId,
    ],
  );

  const middlewareProjects = await query<MiddlewareProjectRow[]>(
    "SELECT project_id, tbl_name FROM project_middleware_names ORDER BY project_id",
  );

  for (const project of middlewareProjects) {
    const table = sanitizeTableName(project.tbl_name);
    const inProjectStatus = project.project_id === input.projectId ? 2 : 1;
    await query(
      `INSERT INTO \`${table}\` (teacher_id, in_project_status, project_id) VALUES (?, ?, ?)`,
      [idTeacher, inProjectStatus, project.project_id],
    );
  }

  if (input.disciplineIds?.length) {
    for (const disciplineId of input.disciplineIds) {
      await query(
        "INSERT INTO discipline_middleware (teacher_id, discipline_id) VALUES (?, ?)",
        [idTeacher, disciplineId],
      );
    }
  }

  if (input.kpkPlace || input.kpkYear) {
    await query(
      "INSERT INTO training_kpk (year_training, place_training, teacher_id) VALUES (?, ?, ?)",
      [input.kpkYear || null, input.kpkPlace || null, idTeacher],
    );
  }

  const created = await query<TeacherRow[]>(
    `SELECT t.id_teacher, t.surname, t.firstname, t.patronymic, t.phone, t.email, p.title_position
     FROM teachers t
     LEFT JOIN position p ON t.position = p.id_position
     WHERE t.id_teacher = ?
     LIMIT 1`,
    [idTeacher],
  );

  return mapTeacher(created[0], await getTeacherActiveProjectNames(idTeacher));
}

export async function buildTeachersBankExcel(
  schoolId: number,
): Promise<{ buffer: Buffer; filename: string }> {
  const rows = await query<ExcelTeacherRow[]>(
    `SELECT
       t.surname, t.firstname, t.patronymic, t.birthday, t.snils, t.specialty,
       t.total_experience, t.teaching_experience, t.email, t.phone,
       p.title_position, e.title_edu_level, c.title_category, g.gender_title,
       s.school_name, a.title_area, k.year_training, k.place_training
     FROM teachers t
     LEFT JOIN position p ON t.position = p.id_position
     LEFT JOIN edu_level e ON t.level_of_education_id = e.id_edu_level
     LEFT JOIN category c ON t.category_id = c.id_category
     LEFT JOIN gender g ON t.gender_id = g.id_gender
     INNER JOIN schools s ON t.school_id = s.id_school
     INNER JOIN area a ON s.area_id = a.id_area
     LEFT JOIN training_kpk k ON t.id_teacher = k.teacher_id
     WHERE t.school_id = ?
     ORDER BY t.surname ASC, t.firstname ASC`,
    [schoolId],
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Банк педагогов");

  worksheet.columns = [
    { header: "ФИО", key: "fio", width: 40 },
    { header: "Дата рождения", key: "birthday", width: 14 },
    { header: "СНИЛС", key: "snils", width: 16 },
    { header: "Полных лет", key: "fullYear", width: 10 },
    { header: "Район", key: "title_area", width: 30 },
    { header: "Образовательная организация", key: "school_name", width: 35 },
    { header: "Должность", key: "title_position", width: 25 },
    { header: "ВО, СПО/ Специальность по диплому", key: "specialty", width: 30 },
    { header: "Общий стаж", key: "total_experience", width: 12 },
    { header: "Пед. стаж", key: "teaching_experience", width: 12 },
    { header: "Место, программа (тема) КПК", key: "place_training", width: 35 },
    { header: "КПК в последний раз (год)", key: "year_training", width: 18 },
    { header: "Категория", key: "title_category", width: 20 },
    { header: "Личный электронный адрес", key: "email", width: 28 },
    { header: "Номер телефона", key: "phone", width: 18 },
    { header: "Пол", key: "gender_title", width: 12 },
  ];

  const currentYear = new Date().getFullYear();

  for (const row of rows) {
    const birth = new Date(row.birthday);
    const fio = [row.surname, row.firstname, row.patronymic].filter(Boolean).join(" ");
    const d = birth.getDate().toString().padStart(2, "0");
    const m = (birth.getMonth() + 1).toString().padStart(2, "0");
    const y = birth.getFullYear();

    worksheet.addRow({
      fio,
      birthday: `${d}-${m}-${y}`,
      snils: row.snils ?? "",
      fullYear: currentYear - y,
      title_area: row.title_area,
      school_name: row.school_name,
      title_position: row.title_position ?? "",
      specialty: row.specialty ?? "",
      total_experience: row.total_experience ?? "",
      teaching_experience: row.teaching_experience ?? "",
      place_training: row.place_training ?? "",
      year_training: row.year_training ?? "",
      title_category: row.title_category ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      gender_title: row.gender_title ?? "",
    });
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const filename = `Список - ${currentYear}.xlsx`;

  return { buffer, filename };
}
