import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { query } from "../db/pool.js";

interface ProjectRow extends RowDataPacket {
  id_project: number;
  name_project: string;
}

interface MiddlewareNameRow {
  project_id: number;
  tbl_name: string;
}

export const LESSON_ANALYSIS_PROJECT_KEY = "lesson-analysis";

/** Псевдо-проект «Не участвует в проекте» — не показываем как участие. */
export const NO_PROJECT_ID = 1;

export const NO_PROJECT_LABEL = "Не участвует в проекте";

export interface ProjectMembership {
  id: number;
  name: string;
  isMember: boolean;
}

function sanitizeTableName(name: string): string {
  const safe = name.replace(/[^a-z0-9_]/gi, "");
  if (safe !== name) {
    throw new Error("Invalid table name");
  }
  return safe;
}

export async function getSchoolProjects(schoolId: number): Promise<ProjectRow[]> {
  return query<ProjectRow[]>(
    `SELECT p.id_project, p.name_project
     FROM middleware_project_school mps
     INNER JOIN projects p ON p.id_project = mps.project_id
     WHERE mps.school_id = ?
     ORDER BY p.name_project`,
    [schoolId],
  );
}

export async function getSchoolRealProjects(schoolId: number): Promise<ProjectRow[]> {
  const projects = await getSchoolProjects(schoolId);
  return projects.filter((project) => project.id_project > NO_PROJECT_ID);
}

export async function resolveProjectMiddlewareTable(
  projectId: number,
): Promise<string | null> {
  const rows = await query<MiddlewareNameRow[]>(
    "SELECT project_id, tbl_name FROM project_middleware_names WHERE project_id = ? LIMIT 1",
    [projectId],
  );
  return rows[0]?.tbl_name ?? null;
}

async function getAllMiddlewareProjects(): Promise<MiddlewareNameRow[]> {
  return query<MiddlewareNameRow[]>(
    "SELECT project_id, tbl_name FROM project_middleware_names ORDER BY project_id",
  );
}

async function isTeacherInSchool(
  schoolId: number,
  teacherId: string,
): Promise<boolean> {
  const rows = await query<{ id_teacher: string }[]>(
    "SELECT id_teacher FROM teachers WHERE id_teacher = ? AND school_id = ? LIMIT 1",
    [teacherId, schoolId],
  );
  return Boolean(rows[0]);
}

async function isProjectConnectedToSchool(
  schoolId: number,
  projectId: number,
): Promise<boolean> {
  const rows = await query<{ project_id: number }[]>(
    "SELECT project_id FROM middleware_project_school WHERE school_id = ? AND project_id = ? LIMIT 1",
    [schoolId, projectId],
  );
  return Boolean(rows[0]);
}

async function getTeacherMembershipInProject(
  teacherId: string,
  projectId: number,
): Promise<boolean> {
  const table = await resolveProjectMiddlewareTable(projectId);
  if (!table) {
    return false;
  }

  const safeTable = sanitizeTableName(table);
  const rows = await query<{ in_project_status: number }[]>(
    `SELECT in_project_status
     FROM \`${safeTable}\`
     WHERE teacher_id = ? AND project_id = ?
     LIMIT 1`,
    [teacherId, projectId],
  );

  return rows[0]?.in_project_status === 2;
}

async function hasActiveRealProjects(teacherId: string): Promise<boolean> {
  const middlewareProjects = await getAllMiddlewareProjects();

  for (const project of middlewareProjects) {
    if (project.project_id <= NO_PROJECT_ID) {
      continue;
    }

    if (await getTeacherMembershipInProject(teacherId, project.project_id)) {
      return true;
    }
  }

  return false;
}

async function syncWithoutProjectBucket(teacherId: string): Promise<void> {
  const table = await resolveProjectMiddlewareTable(NO_PROJECT_ID);
  if (!table) {
    return;
  }

  const safeTable = sanitizeTableName(table);
  const inProjectStatus = (await hasActiveRealProjects(teacherId)) ? 1 : 2;

  await query(
    `UPDATE \`${safeTable}\`
     SET in_project_status = ?
     WHERE teacher_id = ? AND project_id = ?`,
    [inProjectStatus, teacherId, NO_PROJECT_ID],
  );
}

export async function getTeacherActiveProjectNames(
  teacherId: string,
): Promise<string[]> {
  const middlewareProjects = await getAllMiddlewareProjects();
  const activeProjects: string[] = [];

  for (const project of middlewareProjects) {
    if (project.project_id <= NO_PROJECT_ID) {
      continue;
    }

    if (await getTeacherMembershipInProject(teacherId, project.project_id)) {
      const rows = await query<{ name_project: string }[]>(
        "SELECT name_project FROM projects WHERE id_project = ? LIMIT 1",
        [project.project_id],
      );
      if (rows[0]) {
        activeProjects.push(rows[0].name_project);
      }
    }
  }

  return activeProjects;
}

export async function getTeachersActiveProjectNames(
  teacherIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const teacherId of teacherIds) {
    result.set(teacherId, []);
  }

  if (teacherIds.length === 0) {
    return result;
  }

  const middlewareProjects = await getAllMiddlewareProjects();

  for (const project of middlewareProjects) {
    if (project.project_id <= NO_PROJECT_ID) {
      continue;
    }

    const safeTable = sanitizeTableName(project.tbl_name);
    const placeholders = teacherIds.map(() => "?").join(", ");
    const rows = await query<{ teacher_id: string; name_project: string }[]>(
      `SELECT m.teacher_id, p.name_project
       FROM \`${safeTable}\` m
       INNER JOIN projects p ON p.id_project = m.project_id
       WHERE m.teacher_id IN (${placeholders})
         AND m.in_project_status = 2
         AND m.project_id = ?`,
      [...teacherIds, project.project_id],
    );

    for (const row of rows) {
      const labels = result.get(row.teacher_id) ?? [];
      labels.push(row.name_project);
      result.set(row.teacher_id, labels);
    }
  }

  return result;
}

export async function getTeacherProjectMemberships(
  schoolId: number,
  teacherId: string,
): Promise<ProjectMembership[]> {
  const projects = await getSchoolRealProjects(schoolId);
  const memberships: ProjectMembership[] = [];

  for (const project of projects) {
    memberships.push({
      id: project.id_project,
      name: project.name_project,
      isMember: await getTeacherMembershipInProject(teacherId, project.id_project),
    });
  }

  return memberships;
}

export async function addTeacherToProject(
  schoolId: number,
  teacherId: string,
  projectId: number,
): Promise<void> {
  if (projectId <= NO_PROJECT_ID) {
    throw new Error("Invalid project");
  }

  if (!(await isTeacherInSchool(schoolId, teacherId))) {
    throw new Error("Teacher not found");
  }

  if (!(await isProjectConnectedToSchool(schoolId, projectId))) {
    throw new Error("Project not connected to school");
  }

  const table = await resolveProjectMiddlewareTable(projectId);
  if (!table) {
    throw new Error("Project middleware not found");
  }

  const safeTable = sanitizeTableName(table);
  await query(
    `UPDATE \`${safeTable}\`
     SET in_project_status = 2, project_id = ?
     WHERE teacher_id = ?`,
    [projectId, teacherId],
  );

  await syncWithoutProjectBucket(teacherId);
}

export async function removeTeacherFromProject(
  schoolId: number,
  teacherId: string,
  projectId: number,
): Promise<void> {
  if (projectId <= NO_PROJECT_ID) {
    throw new Error("Invalid project");
  }

  if (!(await isTeacherInSchool(schoolId, teacherId))) {
    throw new Error("Teacher not found");
  }

  if (!(await isProjectConnectedToSchool(schoolId, projectId))) {
    throw new Error("Project not connected to school");
  }

  const table = await resolveProjectMiddlewareTable(projectId);
  if (!table) {
    throw new Error("Project middleware not found");
  }

  const safeTable = sanitizeTableName(table);
  await query(
    `UPDATE \`${safeTable}\`
     SET in_project_status = 1, project_id = ?
     WHERE teacher_id = ?`,
    [projectId, teacherId],
  );

  await syncWithoutProjectBucket(teacherId);
}

export async function findLessonAnalysisProject(
  schoolId: number,
): Promise<ProjectRow | null> {
  const rows = await query<ProjectRow[]>(
    `SELECT p.id_project, p.name_project
     FROM middleware_project_school mps
     INNER JOIN projects p ON p.id_project = mps.project_id
     WHERE mps.school_id = ?
       AND p.id_project > ?
       AND (
         p.name_project LIKE '%Анализ%'
         OR p.name_project LIKE '%анализ%'
       )
     ORDER BY p.id_project
     LIMIT 1`,
    [schoolId, NO_PROJECT_ID],
  );

  if (rows[0]) {
    return rows[0];
  }

  const fallback = await query<ProjectRow[]>(
    `SELECT p.id_project, p.name_project
     FROM middleware_project_school mps
     INNER JOIN projects p ON p.id_project = mps.project_id
     WHERE mps.school_id = ?
       AND p.id_project > ?
     ORDER BY p.id_project
     LIMIT 1`,
    [schoolId, NO_PROJECT_ID],
  );

  return fallback[0] ?? null;
}

const LESSON_ANALYSIS_PROJECT_SQL = `
  SELECT id_project, name_project
  FROM projects
  WHERE id_project > ?
    AND (
      name_project LIKE '%Анализ%'
      OR name_project LIKE '%анализ%'
    )
  ORDER BY id_project
  LIMIT 1
`;

export async function findGlobalLessonAnalysisProject(
  connection?: PoolConnection,
): Promise<ProjectRow | null> {
  if (connection) {
    const [rows] = await connection.query<ProjectRow[]>(
      LESSON_ANALYSIS_PROJECT_SQL,
      [NO_PROJECT_ID],
    );
    return rows[0] ?? null;
  }
  const rows = await query<ProjectRow[]>(LESSON_ANALYSIS_PROJECT_SQL, [
    NO_PROJECT_ID,
  ]);
  return rows[0] ?? null;
}

export async function attachSchoolToLessonAnalysisProject(
  schoolId: number,
  connection?: PoolConnection,
): Promise<number | null> {
  const project = await findGlobalLessonAnalysisProject(connection);
  if (!project) {
    return null;
  }

  const existingSql = `
    SELECT id
    FROM middleware_project_school
    WHERE school_id = ? AND project_id = ?
    LIMIT 1
  `;
  const insertSql = `
    INSERT INTO middleware_project_school (school_id, project_id)
    VALUES (?, ?)
  `;
  const lookup = [schoolId, project.id_project];

  if (connection) {
    const [existing] = await connection.query<RowDataPacket[]>(
      existingSql,
      lookup,
    );
    if (!existing[0]) {
      await connection.execute(insertSql, lookup);
    }
  } else {
    const existing = await query<RowDataPacket[]>(existingSql, lookup);
    if (!existing[0]) {
      await query(insertSql, lookup);
    }
  }

  return Number(project.id_project);
}

export async function ensureAllSchoolsHaveLessonAnalysisProject(): Promise<number> {
  const project = await findGlobalLessonAnalysisProject();
  if (!project) {
    return 0;
  }

  const result = await query<ResultSetHeader>(
    `INSERT INTO middleware_project_school (school_id, project_id)
     SELECT s.id_school, ?
     FROM schools s
     LEFT JOIN middleware_project_school m
       ON m.school_id = s.id_school AND m.project_id = ?
     WHERE m.id IS NULL`,
    [project.id_project, project.id_project],
  );

  return Number(result.affectedRows ?? 0);
}
