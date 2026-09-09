import { query } from "../db/pool.js";

export interface SchoolProfile {
  schoolId: number;
  schoolName: string;
  areaName: string;
}

export async function getSchoolProfile(
  schoolId: number,
): Promise<SchoolProfile | null> {
  const rows = await query<
    { id_school: number; school_name: string; title_area: string }[]
  >(
    `SELECT s.id_school, s.school_name, a.title_area
     FROM schools s
     INNER JOIN area a ON s.area_id = a.id_area
     WHERE s.id_school = ?
     LIMIT 1`,
    [schoolId],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    schoolId: row.id_school,
    schoolName: row.school_name.trim(),
    areaName: row.title_area.trim(),
  };
}
