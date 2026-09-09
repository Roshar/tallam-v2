export interface ProjectMembership {
  id: number;
  name: string;
  isMember: boolean;
}

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

export interface SchoolDashboard {
  schoolName: string | null;
  teachersCount: number;
  schoolId: number;
  evaluations: {
    years: Array<{ year: number; count: number }>;
    total: number;
  };
}

export interface SchoolProfile {
  schoolId: number;
  schoolName: string;
  areaName: string;
  email: string;
}

export interface WorkerFormOptions {
  genders: Array<{ id: number; title: string }>;
  educationLevels: Array<{ id: number; title: string }>;
  positions: Array<{ id: number; title: string }>;
  categories: Array<{ id: number; title: string }>;
  disciplines: Array<{ id: number; title: string }>;
  projects: Array<{ id: number; name: string }>;
}

export interface CreateTeacherPayload {
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

export type UpdateTeacherPayload = Omit<CreateTeacherPayload, "projectId">;

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
  projectMemberships: ProjectMembership[];
}

export interface TeacherDetailResponse {
  teacher: TeacherDetail;
}

export type WorkersPageLimit = 20 | 50 | 100;

export interface WorkersResponse {
  teachers: TeacherListItem[];
  total: number;
  page: number;
  limit: WorkersPageLimit;
}

export interface LessonAnalysisResponse {
  project: { id: number; name: string } | null;
  teachers: TeacherListItem[];
  candidates: TeacherListItem[];
}

export interface EvaluationListItem {
  id: number;
  date: string;
  dateLabel: string;
  disciplineId: number;
  disciplineTitle: string;
  classLabel: string;
  sourceId: number;
  sourceLabel: string;
  cardType: number;
  cardTypeLabel: string;
  cardLinkType: "full" | "method";
}

export interface ProjectTeacherProfileResponse {
  project: { id: number; name: string };
  teacher: {
    id: string;
    fullName: string;
    position: string | null;
  };
  filters: {
    sources: Array<{ id: number; title: string }>;
    disciplines: Array<{ id: number; title: string }>;
  };
  evaluations: EvaluationListItem[];
}

export type EvaluationCardType = "method" | "full";

export interface CreateEvaluationPayload {
  cardType: EvaluationCardType;
  disciplineId: number;
  classId: number;
  literClass?: string;
  sourceId: number;
  dateCreate: string;
  thema: string;
  sourceFio?: string;
  positionName?: string;
  sourceWorkplace?: string;
  scores: Record<string, number>;
}
