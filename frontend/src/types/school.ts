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

export type SupportAuthorRole = "school" | "admin";

export interface SupportMessage {
  id: number;
  schoolId: number;
  authorRole: SupportAuthorRole;
  authorEmail: string;
  message: string;
  createdAt: string;
}

export interface SupportThread {
  schoolId: number;
  schoolName: string;
  messages: SupportMessage[];
}

export interface SchoolProfile {
  schoolId: number;
  schoolName: string;
  areaName: string;
  email: string;
}

export type SchoolSubscriptionPageStatus =
  | "active"
  | "expiring"
  | "expired"
  | "scheduled"
  | "missing";

export interface SchoolBankDetails {
  recipient: string;
  inn: string;
  kpp: string;
  account: string;
  bankName: string;
  bik: string;
  correspondentAccount: string;
  purpose: string;
  contractNumber: string | null;
  amount: number;
  amountLabel: string;
  paymentNotice: string;
}

export interface SchoolSubscriptionOverview {
  schoolId: number;
  schoolName: string;
  status: SchoolSubscriptionPageStatus;
  title: string;
  description: string;
  cabinetLocked: boolean;
  needsPayment: boolean;
  paymentReady: boolean;
  startsOn: string | null;
  endsOn: string | null;
  daysLeft: number | null;
  totalDays: number | null;
  elapsedDays: number | null;
  progressPercent: number | null;
  phone: string | null;
  qrPayload: string | null;
  qrImage: string | null;
  bank: SchoolBankDetails | null;
}

export type RenewalStatus =
  | "pending"
  | "documents_ready"
  | "paid"
  | "cancelled";

export interface RenewalCustomerData {
  fullName: string;
  phone: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssuedOn: string;
  divisionCode: string;
  residentialAddress: string;
  inn: string;
}

export interface SchoolRenewalRequest {
  id: number;
  schoolId: number;
  schoolName: string;
  status: RenewalStatus;
  contractNumber: string | null;
  invoiceNumber: string | null;
  issuedOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  consentAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: RenewalCustomerData;
}

export interface SubmitRenewalPayload extends RenewalCustomerData {
  consent: boolean;
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
  academicYearStart: number;
  disciplineId: number;
  disciplineTitle: string;
  classLabel: string;
  sourceId: number;
  sourceLabel: string;
  cardType: number;
  cardTypeLabel: string;
  cardLinkType: "full" | "method";
}

export type EvaluationCardType = "full" | "method";

export interface AcademicYearTab {
  startYear: number;
  label: string;
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
  academicYears: AcademicYearTab[];
  currentAcademicYearStart: number;
  schoolName: string;
  evaluations: EvaluationListItem[];
}

export interface EvaluationBlockResult {
  id: string;
  title: string;
  percent: number;
  level: string;
  levelStyle: "success" | "good" | "danger";
}

export interface EvaluationDetail {
  id: number;
  cardType: EvaluationCardType;
  cardTypeLabel: string;
  date: string;
  dateLabel: string;
  thema: string;
  disciplineTitle: string;
  classLabel: string;
  sourceId: number;
  sourceLabel: string;
  evaluatorLabel: string;
  teacher: {
    id: string;
    fullName: string;
    position: string | null;
    email: string | null;
  };
  schoolName: string;
  areaName: string | null;
  scores: Record<string, number>;
  displayedScores: Record<string, string>;
  blocks: EvaluationBlockResult[];
  commentHtml: string | null;
}

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
  commentHtml?: string;
  scores: Record<string, number>;
}
