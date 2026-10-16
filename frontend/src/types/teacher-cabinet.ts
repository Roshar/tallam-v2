import type { AcademicYearOption, AnalyticsCardType } from "./analytics";

/** Данные личного кабинета учителя. Повторяют ответы /api/teacher/*. */

export interface TeacherCabinetContext {
  teacherId: string;
  schoolId: number;
  fullName: string;
  shortName: string;
  schoolName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  disciplines: string[];
}

export interface TeacherResultPoint {
  percent: number;
  date: string;
  dateLabel: string;
}

export interface TeacherCardTypeSummary {
  cardType: AnalyticsCardType;
  cardTypeLabel: string;
  hasAny: boolean;
  hasDataInYear: boolean;
  evaluationsInYear: number;
  latest: TeacherResultPoint | null;
  previous: TeacherResultPoint | null;
  delta: number | null;
}

export interface TeacherCabinetResponse {
  context: TeacherCabinetContext;
  academicYearStart: number;
  academicYearLabel: string;
  academicYears: AcademicYearOption[];
  cardTypes: TeacherCardTypeSummary[];
  totalEvaluations: number;
  evaluationsInYear: number;
  period: { from: string; to: string };
}

export interface TeacherEvaluationItem {
  id: number;
  date: string;
  dateLabel: string;
  academicYearStart: number;
  cardType: AnalyticsCardType;
  cardTypeLabel: string;
  percent: number;
  sourceId: number;
  sourceLabel: string;
}

export interface TeacherEvaluationsResponse {
  academicYearStart: number;
  academicYearLabel: string;
  academicYears: AcademicYearOption[];
  evaluations: TeacherEvaluationItem[];
}
