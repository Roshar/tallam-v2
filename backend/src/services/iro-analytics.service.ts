import { query } from "../db/pool.js";
import { academicYearStartFromDate, formatAcademicYearLabel } from "./card.service.js";
import { scaleFor, sumKeysSql, type CardTypeKind } from "./evaluation-scale.js";

const MIN_TEACHERS = 3;
const range = (year: number) => ({ from: `${year}-09-01`, to: `${year + 1}-09-01` });
const n = (value: unknown) => Number(value ?? 0);
const rounded = (value: unknown) => Math.round(n(value));

export async function getAcademicYears() {
  const rows = await query<{ date: Date }[]>("SELECT DISTINCT create_mark_date AS date FROM card_from_project_teacher_mark3");
  const current = academicYearStartFromDate(new Date());
  const years = new Set(rows.map((row) => academicYearStartFromDate(new Date(row.date))));
  years.add(current);
  return [...years].sort((a, b) => b - a).map((startYear) => ({ startYear, label: formatAcademicYearLabel(startYear), isCurrent: startYear === current }));
}

export async function getAreas() {
  return query<{ id: number; title: string }[]>("SELECT id_area AS id, title_area AS title FROM area ORDER BY title_area");
}

const ACTIVE = `EXISTS (SELECT 1 FROM users au WHERE au.school_id=s.id_school AND au.role='school_admin' AND au.status='on' AND IFNULL(au.blocked_by_admin,0)=0)
 AND EXISTS (SELECT 1 FROM school_subscriptions ss WHERE ss.school_id=s.id_school AND ss.is_cancelled=0 AND CURDATE() BETWEEN ss.starts_on AND ss.ends_on)`;

export async function getDashboard(year: number) {
  const { from, to } = range(year);
  const rows = await query<Record<string, unknown>[]>(`SELECT
    (SELECT COUNT(*) FROM schools) schools,
    (SELECT COUNT(*) FROM schools s WHERE ${ACTIVE}) active,
    (SELECT COUNT(*) FROM schools s WHERE NOT (${ACTIVE})) inactive,
    (SELECT COUNT(*) FROM teachers) teachers,
    COUNT(DISTINCT c.teacher_id) evaluatedTeachers, COUNT(c.id_card) evaluations,
    SUM(c.card_type=2) methodEvaluations, SUM(c.card_type=1) fullEvaluations
    FROM card_from_project_teacher_mark3 c WHERE c.create_mark_date>=? AND c.create_mark_date<?`, [from, to]);
  const row = rows[0] ?? {};
  const teachers = n(row.teachers);
  return { schools: n(row.schools), activeSchools: n(row.active), inactiveSchools: n(row.inactive), teachers,
    evaluatedTeachers: n(row.evaluatedTeachers), evaluations: n(row.evaluations),
    coveragePercent: teachers ? Math.round(n(row.evaluatedTeachers) * 100 / teachers) : 0,
    methodEvaluations: n(row.methodEvaluations), fullEvaluations: n(row.fullEvaluations) };
}

export interface SchoolFilters { year: number; status: string; areaId?: number; coverageMin?: number; coverageMax?: number; search: string; page: number; pageSize: number; sort: string }
export async function getSchools(input: SchoolFilters) {
  const { from, to } = range(input.year);
  const where: string[] = [];
  const params: unknown[] = [from, to];
  if (input.status === "active") where.push("x.isActive=1");
  if (input.status === "inactive") where.push("x.isActive=0");
  if (input.areaId) { where.push("x.areaId=?"); params.push(input.areaId); }
  if (input.search) { where.push("x.schoolName LIKE ?"); params.push(`%${input.search}%`); }
  if (input.coverageMin !== undefined) { where.push("x.coveragePercent>=?"); params.push(input.coverageMin); }
  if (input.coverageMax !== undefined) { where.push("x.coveragePercent<=?"); params.push(input.coverageMax); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order: Record<string, string> = { name: "schoolName ASC", coverage: "coveragePercent DESC", evaluations: "evaluations DESC", recent: "lastEvaluationDate DESC" };
  const base = `SELECT s.id_school schoolId, s.school_name schoolName, s.area_id areaId, a.title_area area,
    COUNT(DISTINCT t.id_teacher) teachers, COUNT(DISTINCT c.teacher_id) evaluatedTeachers,
    CASE WHEN COUNT(DISTINCT t.id_teacher)=0 THEN 0 ELSE ROUND(COUNT(DISTINCT c.teacher_id)*100/COUNT(DISTINCT t.id_teacher)) END coveragePercent,
    COUNT(DISTINCT c.id_card) evaluations, MAX(c.create_mark_date) lastEvaluationDate,
    CASE WHEN EXISTS(SELECT 1 FROM users u WHERE u.school_id=s.id_school AND u.role='school_admin' AND u.status='on' AND IFNULL(u.blocked_by_admin,0)=0) THEN 'on' ELSE 'off' END accountStatus,
    CASE WHEN EXISTS(SELECT 1 FROM school_subscriptions ss WHERE ss.school_id=s.id_school AND ss.is_cancelled=0 AND CURDATE() BETWEEN ss.starts_on AND ss.ends_on) THEN 'active' ELSE 'inactive' END subscriptionStatus,
    CASE WHEN ${ACTIVE} THEN 1 ELSE 0 END isActive
    FROM schools s LEFT JOIN area a ON a.id_area=s.area_id LEFT JOIN teachers t ON t.school_id=s.id_school
    LEFT JOIN card_from_project_teacher_mark3 c ON c.school_id=s.id_school AND c.create_mark_date>=? AND c.create_mark_date<?
    GROUP BY s.id_school,s.school_name,s.area_id,a.title_area`;
  const countRows = await query<{ total: number }[]>(`SELECT COUNT(*) total FROM (${base}) x ${clause}`, params);
  const dataParams = [...params, input.pageSize, (input.page - 1) * input.pageSize];
  const items = await query<Record<string, unknown>[]>(`SELECT x.* FROM (${base}) x ${clause} ORDER BY ${order[input.sort] ?? order.name} LIMIT ? OFFSET ?`, dataParams);
  return { items: items.map(({ isActive: _ignored, ...row }) => row), total: n(countRows[0]?.total), page: input.page, pageSize: input.pageSize };
}

function highlights(sections: Array<{ title: string; averagePercent: number; max: number }>) {
  const ranked = [...sections].sort((a,b) => b.averagePercent-a.averagePercent);
  return { strongSections: ranked.slice(0,2), weakSections: ranked.length >= 3 ? ranked.slice(-2).reverse() : [] };
}

async function scopeAnalytics(year: number, cardType: CardTypeKind, schoolId?: number) {
  const scale = scaleFor(cardType); const { from, to } = range(year);
  const school = schoolId ? " AND school_id=?" : ""; const p: unknown[] = [scale.dbCardType, from, to]; if (schoolId) p.push(schoolId);
  const latestSql = `SELECT * FROM (SELECT c.*, ROW_NUMBER() OVER(PARTITION BY teacher_id ORDER BY create_mark_date DESC,id_card DESC) rn FROM card_from_project_teacher_mark3 c WHERE card_type=? AND create_mark_date>=? AND create_mark_date<?${school}) q WHERE rn=1`;
  const [latest, countRows, sectionRows] = await Promise.all([
    query<Record<string, unknown>[]>(latestSql, p),
    query<{ evaluations:number }[]>(`SELECT COUNT(*) evaluations FROM card_from_project_teacher_mark3 WHERE card_type=? AND create_mark_date>=? AND create_mark_date<?${school}`, p),
    query<Record<string, unknown>[]>(`SELECT ${scale.sections.map((s,i)=>`AVG(${sumKeysSql(s.keys)}) s${i}`).join(",")} FROM (${latestSql}) l`, p),
  ]);
  const percents = latest.map(r => n(Object.keys(r).filter(k=>scale.keys.includes(k)).reduce((sum,k)=>sum+n(r[k]),0))*100/scale.max);
  const sections = scale.sections.map((s,i)=>({ title:s.title, averagePercent: rounded(n(sectionRows[0]?.[`s${i}`])*100/s.max), max:s.max }));
  return { teachers: latest.length, evaluations:n(countRows[0]?.evaluations), averagePercent: percents.length ? rounded(percents.reduce((a,b)=>a+b,0)/percents.length):null, sections, percents };
}

export async function getSchoolAnalytics(schoolId:number, year:number, cardType:CardTypeKind) {
  const exists = await query<{ teachers:number }[]>("SELECT COUNT(*) teachers FROM teachers WHERE school_id=?",[schoolId]);
  const [current, previous] = await Promise.all([scopeAnalytics(year,cardType,schoolId),scopeAnalytics(year-1,cardType,schoolId)]);
  const teachers=n(exists[0]?.teachers), insufficient=current.teachers<MIN_TEACHERS;
  const safeSections=insufficient?[]:current.sections; const h=highlights(safeSections);
  return { teachers,evaluatedTeachers:current.teachers,coveragePercent:teachers?rounded(current.teachers*100/teachers):0,evaluations:current.evaluations,
    averagePercent:insufficient?null:current.averagePercent,dynamics:insufficient||previous.teachers<MIN_TEACHERS||current.averagePercent===null||previous.averagePercent===null?null:current.averagePercent-previous.averagePercent,
    sections:safeSections,...h,insufficient };
}

export async function getRepublicAnalytics(year:number,cardType:CardTypeKind) {
  const [current,previous,schools] = await Promise.all([scopeAnalytics(year,cardType),scopeAnalytics(year-1,cardType),query<{schoolId:number; evaluated:number}[]>(`SELECT s.id_school schoolId,COUNT(DISTINCT c.teacher_id) evaluated FROM schools s LEFT JOIN card_from_project_teacher_mark3 c ON c.school_id=s.id_school AND c.card_type=? AND c.create_mark_date>=? AND c.create_mark_date<? GROUP BY s.id_school`,[scaleFor(cardType).dbCardType,range(year).from,range(year).to])]);
  const buckets=[{label:"<50",min:-Infinity,max:50},{label:"50-59",min:50,max:60},{label:"60-69",min:60,max:70},{label:"70-74",min:70,max:75},{label:"75-84",min:75,max:85},{label:"85-100",min:85,max:Infinity}];
  return { averagePercent:current.averagePercent,evaluations:current.evaluations,schoolsWithData:schools.filter(s=>n(s.evaluated)>=MIN_TEACHERS).length,schoolsWithoutEnoughData:schools.filter(s=>n(s.evaluated)<MIN_TEACHERS).length,
    dynamics:current.averagePercent===null||previous.averagePercent===null?null:current.averagePercent-previous.averagePercent,sections:current.sections,...highlights(current.sections),distribution:buckets.map(b=>({label:b.label,count:current.percents.filter(v=>v>=b.min&&v<b.max).length})) };
}
