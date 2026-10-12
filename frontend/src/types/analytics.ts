/** Типы аналитики оценок: ответы `/api/school/analytics` и аналитики работника. */

export type AnalyticsCardType = "method" | "full";

export interface AcademicYearOption {
  startYear: number;
  label: string;
  isCurrent: boolean;
}

export interface AnalyticsPoint {
  date: string;
  dateLabel: string;
  percent: number;
  evaluations: number;
}

export interface SectionAverage {
  id: string;
  title: string;
  percent: number;
  max: number;
  averageSum: number;
  evaluations: number;
}

export interface SectionComparison {
  id: string;
  title: string;
  before: number;
  after: number;
  delta: number;
}

export interface SectionHighlight {
  id: string;
  title: string;
  percent: number;
}

export interface TeacherAnalytics {
  scope: "teacher";
  cardType: AnalyticsCardType;
  cardTypeLabel: string;
  academicYearStart: number;
  academicYearLabel: string;
  academicYears: AcademicYearOption[];
  hasAnyOfType: boolean;
  hasDataInYear: boolean;
  points: AnalyticsPoint[];
  latest: { percent: number; date: string; dateLabel: string } | null;
  previous: { percent: number; date: string; dateLabel: string } | null;
  delta: number | null;
  sections: SectionAverage[];
  strengths: SectionHighlight[];
  weaknesses: SectionHighlight[];
  comparison: SectionComparison[];
}

export interface SchoolDistributionBucket {
  id: string;
  label: string;
  min: number;
  count: number;
}

export interface SchoolAnalytics {
  scope: "school";
  cardType: AnalyticsCardType;
  cardTypeLabel: string;
  academicYearStart: number;
  academicYearLabel: string;
  academicYears: AcademicYearOption[];
  hasAnyOfType: boolean;
  hasDataInYear: boolean;
  average: { percent: number; teachers: number; evaluations: number } | null;
  previousYear: {
    percent: number;
    academicYearStart: number;
    academicYearLabel: string;
    teachers: number;
  } | null;
  delta: number | null;
  points: AnalyticsPoint[];
  sections: SectionAverage[];
  distribution: SchoolDistributionBucket[];
}

export interface TeacherAnalyticsResponse {
  analytics: TeacherAnalytics;
}

export interface SchoolAnalyticsResponse {
  analytics: SchoolAnalytics;
}
