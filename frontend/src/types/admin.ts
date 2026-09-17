import type {
  RenewalCustomerData,
  RenewalStatus,
} from "./school";

export interface AdminRecentSchool {
  id: number;
  name: string;
  area: string | null;
  email: string | null;
  status: "on" | "off" | "" | null;
}

export interface AdminDashboard {
  schools: number;
  activeSchoolAccounts: number;
  blockedSchoolAccounts: number;
  teachers: number;
  evaluations: number;
  evaluationsCurrentYear: number;
  methodists: number;
  projects: number;
  currentYear: number;
  onlineSchools: number;
  recentSchools: AdminRecentSchool[];
  subscriptions: {
    total: number;
    active: number;
    expiringSoon: number;
    expired: number;
    startsLater: number;
  };
}

export type AdminSubscriptionStatus =
  | "active"
  | "expiring"
  | "expired"
  | "scheduled";

export type AdminSubscriptionListStatus = AdminSubscriptionStatus | "missing";

export interface AdminSubscription {
  id: number | null;
  schoolId: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  accountStatus: "on" | "off" | "" | null;
  phone: string | null;
  startsOn: string | null;
  endsOn: string | null;
  subscriptionStatus: AdminSubscriptionListStatus;
}

export interface AdminSubscriptionsResponse {
  items: AdminSubscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminSubscriptionArea {
  id: number;
  title: string;
}

export interface AdminEmailAvailability {
  email: string;
  available: boolean;
  reason: "invalid" | "taken" | null;
}

export interface AdminCreatedSchool {
  schoolId: number;
  schoolName: string;
  email: string;
  areaId: number;
  areaTitle: string;
}

export type AdminSchoolCabinetStatus = "active" | "blocked" | "none";

export interface AdminSchoolListItem {
  schoolId: number;
  schoolName: string;
  area: string | null;
  email: string | null;
  accountStatus: "on" | "off" | "" | null;
  cabinetStatus: AdminSchoolCabinetStatus;
  teachersCount: number;
}

export interface AdminSchoolsResponse {
  items: AdminSchoolListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminSchoolSubscription {
  id: number;
  startsOn: string;
  endsOn: string;
  phone: string | null;
  isCancelled: number;
  sourceLabel: string | null;
  note: string | null;
  createdAt: string;
  status: AdminSubscriptionStatus | "cancelled";
}

export type AdminSchoolAccessReason =
  | "active"
  | "no_account"
  | "blocked"
  | "expired"
  | "scheduled";

export interface AdminSchoolAccess {
  hasAccount: boolean;
  accountStatus: "on" | "off" | "" | null;
  blockedByAdmin: boolean;
  hasSubscriptionHistory: boolean;
  hasCoveringSubscription: boolean;
  allowed: boolean;
  canLogin: boolean;
  canUseCabinet: boolean;
  reason: AdminSchoolAccessReason;
  message: string;
}

export interface AdminSchoolDetail {
  school: {
    id: number;
    name: string;
    area: string | null;
    email: string | null;
    accountStatus: "on" | "off" | "" | null;
  };
  access: AdminSchoolAccess;
  lastLoginAt: string | null;
  stats: {
    teachers: number;
    projectTeachers: number;
    evaluations: number;
    evaluationsCurrentYear: number;
    projects: number;
    currentYear: number;
  };
  currentSubscription: AdminSchoolSubscription | null;
  subscriptions: AdminSchoolSubscription[];
  projects: Array<{ id: number; name: string }>;
  yearlyActivity: Array<{
    year: number;
    evaluations: number;
    projectTeachers: number;
  }>;
  evaluationsByYear: Array<{ year: number; count: number }>;
}

export interface AdminPasswordResetLink {
  resetUrl: string;
  expiresAt: string;
  email: string;
}

export interface AdminRenewalListItem {
  id: number;
  schoolId: number;
  schoolName: string;
  area: string | null;
  status: RenewalStatus;
  customerName: string;
  contractNumber: string | null;
  invoiceNumber: string | null;
  issuedOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminRenewalRequest {
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

export interface AdminRenewalsResponse {
  items: AdminRenewalListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type AuditLogStatus = "success" | "failure";

export interface AdminAuditLog {
  id: number;
  actorUserId: number | null;
  actorEmail: string;
  actorAccountType: string | null;
  schoolId: number | null;
  category: string;
  action: string;
  status: AuditLogStatus;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  items: AdminAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminAuditLogOptions {
  categories: Array<{ value: string; label: string }>;
  actions: Array<{ category: string; action: string; label: string }>;
}

export interface AdminSupportConversation {
  schoolId: number;
  schoolName: string;
  lastMessage: string;
  lastAuthorRole: "school" | "admin";
  lastAt: string;
  unreadCount: number;
}

export type AdminRecoveryStatus = "new" | "done";

export interface AdminRecoveryRequest {
  id: number;
  email: string;
  phone: string;
  schoolId: number | null;
  schoolName: string | null;
  status: AdminRecoveryStatus;
  ipAddress: string | null;
  createdAt: string;
  processedAt: string | null;
  processedByEmail: string | null;
}
