export type VacancyStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type SalaryType = "net" | "gross";
export type VacancyShift = "first" | "second" | "any";
export type EmploymentType = "full" | "partial" | "hourly";
export type EmploymentTerm = "temporary" | "permanent";

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

export interface VacancyPayload {
  position: string;
  subjects: string[];
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

export interface VacancyListResponse {
  items: VacancyListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VacancyFiltersMeta {
  areas: { id: number; title: string }[];
  subjects: string[];
  positions: { id: number; title: string }[];
  disciplines: { id: number; title: string }[];
}

export const VACANCY_STATUS_LABELS: Record<VacancyStatus, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Опубликована",
  CLOSED: "Закрыта",
};

export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  net: "На руки",
  gross: "До вычета налогов",
};

export const SHIFT_LABELS: Record<VacancyShift, string> = {
  first: "Первая смена",
  second: "Вторая смена",
  any: "Любая смена",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full: "Полная занятость",
  partial: "Неполная занятость",
  hourly: "Почасовая",
};

export const EMPLOYMENT_TERM_LABELS: Record<EmploymentTerm, string> = {
  temporary: "Временная работа",
  permanent: "Постоянная работа",
};

export function formatVacancyDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

export function formatHours(value: number | null) {
  if (value === null) return "";
  const text = Number.isInteger(value) ? String(value) : String(value);
  return `${text} ч. в неделю`;
}

export function formatRates(value: number | null) {
  if (value === null) return "";
  const text = Number.isInteger(value)
    ? String(value)
    : String(value).replace(".", ",");
  return `${text} ст.`;
}

export function yesNo(value: boolean | null) {
  if (value === null) return "";
  return value ? "Да" : "Нет";
}
