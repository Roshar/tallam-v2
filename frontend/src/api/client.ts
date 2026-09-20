import type {
  CreateEvaluationPayload,
  CreateTeacherPayload,
  EvaluationDetail,
  LessonAnalysisResponse,
  ProjectTeacherProfileResponse,
  SchoolDashboard,
  SchoolProfile,
  SchoolRenewalRequest,
  SchoolSubscriptionOverview,
  SubmitRenewalPayload,
  SupportThread,
  TeacherDetailResponse,
  UpdateTeacherPayload,
  WorkerFormOptions,
  WorkersResponse,
} from "../types/school";
import type {
  AdminDashboard,
  AdminAuditLogOptions,
  AdminAuditLogsResponse,
  AdminCreatedSchool,
  AdminEmailAvailability,
  AdminPasswordResetLink,
  AdminRecoveryRequest,
  AdminRecoveryStatus,
  AdminRenewalRequest,
  AdminRenewalsResponse,
  AdminSchoolDetail,
  AdminSchoolsResponse,
  AdminSubscriptionArea,
  AdminSubscriptionsResponse,
  AdminSupportConversation,
} from "../types/admin";

export type AccountType = "school" | "methodist" | "admin";
export type SchoolCabinetAccess = "full" | "billing";

export interface User {
  id: number;
  idUser: string | null;
  email: string;
  role: string;
  schoolId: number;
  status: "on" | "off";
  accountType: AccountType;
  cabinetAccess?: SchoolCabinetAccess;
  firstname?: string;
  surname?: string;
  patronymic?: string;
  impersonatedBy?: {
    id: number;
    email: string;
  };
}

export function schoolLandingPath(user: User): string {
  return user.accountType === "school" && user.cabinetAccess === "billing"
    ? "/school/subscription"
    : "/school/cabinet";
}

let onUnauthorized: (() => void) | null = null;

/** Вызывается AuthProvider, чтобы при 401 сбросить сессию и уйти на /auth */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function shouldRedirectOnUnauthorized(path: string): boolean {
  return !(
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/forgot-password") ||
    path.startsWith("/api/auth/recovery-captcha") ||
    path.startsWith("/api/auth/reset-password")
  );
}

function handleUnauthorizedResponse(path: string) {
  if (shouldRedirectOnUnauthorized(path)) {
    onUnauthorized?.();
  }
}

function handleSubscriptionRequired(data: { code?: string }) {
  if (
    data.code === "SUBSCRIPTION_REQUIRED" &&
    !window.location.pathname.startsWith("/school/subscription")
  ) {
    window.location.assign("/school/subscription");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorizedResponse(path);
    }
    if (response.status === 403) {
      handleSubscriptionRequired(data);
    }

    throw new Error(
      typeof data.error === "string" ? data.error : "Ошибка запроса",
    );
  }

  return data as T;
}

async function downloadFile(path: string, fallbackFilename: string) {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) {
    if (response.status === 401) handleUnauthorizedResponse(path);
    const data = await response.json().catch(() => ({}));
    if (response.status === 403) handleSubscriptionRequired(data);
    throw new Error(
      typeof data.error === "string" ? data.error : "Ошибка скачивания",
    );
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*=UTF-8''(.+)/);
  const filename = match ? decodeURIComponent(match[1]) : fallbackFilename;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const api = {
  login(email: string, password: string, accountType: "school" | "methodist") {
    return request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, accountType }),
    });
  },

  logout() {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },

  me() {
    return request<{ user: User }>("/api/auth/me");
  },

  stopImpersonation() {
    return request<{ user: User; schoolId: number }>(
      "/api/auth/stop-impersonation",
      { method: "POST" },
    );
  },

  adminDashboard() {
    return request<AdminDashboard>("/api/admin/dashboard");
  },

  adminOnlineSchools() {
    return request<{ onlineSchools: number }>("/api/admin/online-schools");
  },

  adminAuditLogOptions() {
    return request<AdminAuditLogOptions>("/api/admin/logs/options");
  },

  adminAuditLogs(params?: {
    page?: number;
    limit?: number;
    category?: string;
    action?: string;
    email?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.category) search.set("category", params.category);
    if (params?.action) search.set("action", params.action);
    if (params?.email) search.set("email", params.email);
    if (params?.status) search.set("status", params.status);
    if (params?.dateFrom) search.set("dateFrom", params.dateFrom);
    if (params?.dateTo) search.set("dateTo", params.dateTo);
    const query = search.toString();
    return request<AdminAuditLogsResponse>(
      `/api/admin/logs${query ? `?${query}` : ""}`,
    );
  },

  adminSchoolAreas() {
    return request<{ items: AdminSubscriptionArea[] }>(
      "/api/admin/schools/areas",
    );
  },

  adminSchoolEmailAvailability(email: string) {
    const search = new URLSearchParams({ email });
    return request<AdminEmailAvailability>(
      `/api/admin/schools/email-availability?${search.toString()}`,
    );
  },

  createAdminSchool(payload: {
    schoolName: string;
    areaId: number;
    email: string;
    password: string;
    confirmPassword: string;
    startsOn: string;
    endsOn: string;
  }) {
    return request<AdminCreatedSchool>("/api/admin/schools", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  adminSchools(params?: {
    page?: number;
    limit?: number;
    search?: string;
    areaId?: number;
    cabinetStatus?: string;
  }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.search) search.set("search", params.search);
    if (params?.areaId) search.set("areaId", String(params.areaId));
    if (params?.cabinetStatus) search.set("cabinetStatus", params.cabinetStatus);
    const query = search.toString();
    return request<AdminSchoolsResponse>(
      `/api/admin/schools${query ? `?${query}` : ""}`,
    );
  },

  impersonateSchool(schoolId: number) {
    return request<{ user: User }>(
      `/api/admin/schools/${schoolId}/impersonate`,
      { method: "POST" },
    );
  },

  adminSubscriptions(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    areaId?: number;
  }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.search) search.set("search", params.search);
    if (params?.status) search.set("status", params.status);
    if (params?.areaId) search.set("areaId", String(params.areaId));

    const query = search.toString();
    return request<AdminSubscriptionsResponse>(
      `/api/admin/subscriptions${query ? `?${query}` : ""}`,
    );
  },

  adminSubscriptionAreas() {
    return request<{ items: AdminSubscriptionArea[] }>(
      "/api/admin/subscriptions/areas",
    );
  },

  adminSchoolDetail(schoolId: number) {
    return request<AdminSchoolDetail>(
      `/api/admin/subscriptions/${schoolId}`,
    );
  },

  async downloadAdminSubscriptions(params?: {
    search?: string;
    status?: string;
    areaId?: number;
  }) {
    const search = new URLSearchParams();
    if (params?.search) search.set("search", params.search);
    if (params?.status) search.set("status", params.status);
    if (params?.areaId) search.set("areaId", String(params.areaId));
    const query = search.toString();
    const path = `/api/admin/subscriptions/export${query ? `?${query}` : ""}`;
    const response = await fetch(path, { credentials: "include" });

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorizedResponse(path);
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(
        typeof data.error === "string" ? data.error : "Ошибка скачивания",
      );
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename\*=UTF-8''(.+)/);
    const filename = match
      ? decodeURIComponent(match[1])
      : `Подписки-школ-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  createAdminPasswordResetLink(schoolId: number) {
    return request<AdminPasswordResetLink>(
      `/api/admin/subscriptions/${schoolId}/password-reset-link`,
      { method: "POST" },
    );
  },

  blockAdminSchool(schoolId: number) {
    return request<AdminSchoolDetail>(
      `/api/admin/subscriptions/${schoolId}/block`,
      { method: "POST" },
    );
  },

  activateAdminSchool(
    schoolId: number,
    payload: { startsOn: string; endsOn: string; note?: string },
  ) {
    return request<AdminSchoolDetail>(
      `/api/admin/subscriptions/${schoolId}/activate`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  createAdminSchoolSubscription(
    schoolId: number,
    payload: {
      startsOn: string;
      endsOn: string;
      phone?: string;
      note?: string;
    },
  ) {
    return request<AdminSchoolDetail>(
      `/api/admin/subscriptions/${schoolId}/periods`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  updateAdminSchoolSubscription(
    schoolId: number,
    periodId: number,
    payload: {
      startsOn: string;
      endsOn: string;
      phone?: string;
      note?: string;
    },
  ) {
    return request<AdminSchoolDetail>(
      `/api/admin/subscriptions/${schoolId}/periods/${periodId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  schoolDashboard() {
    return request<SchoolDashboard>("/api/school/dashboard");
  },

  schoolFeedbackUnread() {
    return request<{ unread: number }>("/api/school/feedback/unread");
  },

  schoolFeedbackThread() {
    return request<SupportThread>("/api/school/feedback");
  },

  sendSchoolFeedback(payload: { message: string }) {
    return request<SupportThread>("/api/school/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  schoolProfile() {
    return request<SchoolProfile>("/api/school/profile");
  },

  schoolPresence() {
    return request<{ ok: boolean }>("/api/school/presence");
  },

  changeSchoolPassword(password: string, confirmPassword: string) {
    return request<{ ok: boolean; message: string; email: string }>(
      "/api/school/password",
      {
        method: "POST",
        body: JSON.stringify({ password, confirmPassword }),
      },
    );
  },

  schoolSubscription() {
    return request<SchoolSubscriptionOverview>("/api/school/subscription");
  },

  schoolRenewal() {
    return request<{ request: SchoolRenewalRequest | null }>(
      "/api/school/subscription/renewal",
    );
  },

  submitSchoolRenewal(payload: SubmitRenewalPayload) {
    return request<{ request: SchoolRenewalRequest }>(
      "/api/school/subscription/renewal",
      { method: "POST", body: JSON.stringify(payload) },
    );
  },

  downloadSchoolRenewalDocument(requestId: number) {
    return downloadFile(
      `/api/school/subscription/renewal/${requestId}/contract`,
      "Договор-и-акт-Таллам.pdf",
    );
  },

  adminRenewalQueueCount() {
    return request<{ awaitingConfirmation: number }>(
      "/api/admin/renewals/pending-count",
    );
  },

  adminFeedbackUnread() {
    return request<{ unread: number }>("/api/admin/feedback/unread-count");
  },

  adminRecoveryUnread() {
    return request<{ unread: number }>("/api/admin/recovery/unread-count");
  },

  adminRecoveryRequests(status: "all" | AdminRecoveryStatus = "all") {
    const search = new URLSearchParams();
    if (status !== "all") search.set("status", status);
    const query = search.toString();
    return request<{ items: AdminRecoveryRequest[] }>(
      `/api/admin/recovery${query ? `?${query}` : ""}`,
    );
  },

  markAdminRecoveryDone(requestId: number) {
    return request<AdminRecoveryRequest>(
      `/api/admin/recovery/${requestId}/done`,
      { method: "POST" },
    );
  },

  adminFeedbackConversations() {
    return request<{ items: AdminSupportConversation[] }>(
      "/api/admin/feedback",
    );
  },

  adminFeedbackThread(schoolId: number) {
    return request<SupportThread>(`/api/admin/feedback/${schoolId}`);
  },

  replyAdminFeedback(schoolId: number, payload: { message: string }) {
    return request<SupportThread>(`/api/admin/feedback/${schoolId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  adminRenewals(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.status) search.set("status", params.status);
    if (params?.search) search.set("search", params.search);
    const query = search.toString();
    return request<AdminRenewalsResponse>(
      `/api/admin/renewals${query ? `?${query}` : ""}`,
    );
  },

  adminRenewal(requestId: number) {
    return request<{ request: AdminRenewalRequest }>(
      `/api/admin/renewals/${requestId}`,
    );
  },

  payAdminRenewal(requestId: number) {
    return request<{ request: AdminRenewalRequest }>(
      `/api/admin/renewals/${requestId}/pay`,
      { method: "POST" },
    );
  },

  downloadAdminRenewalDocument(requestId: number) {
    return downloadFile(
      `/api/admin/renewals/${requestId}/contract`,
      "Договор-и-акт-Таллам.pdf",
    );
  },

  schoolWorkers(params?: { page?: number; limit?: number }) {
    const search = new URLSearchParams();
    if (params?.page) {
      search.set("page", String(params.page));
    }
    if (params?.limit) {
      search.set("limit", String(params.limit));
    }

    const query = search.toString();
    return request<WorkersResponse>(
      `/api/school/workers${query ? `?${query}` : ""}`,
    );
  },

  schoolWorkerFormOptions() {
    return request<WorkerFormOptions>("/api/school/workers/form-options");
  },

  createSchoolWorker(payload: CreateTeacherPayload) {
    return request<{ teacher: import("../types/school").TeacherListItem }>(
      "/api/school/workers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  schoolWorker(teacherId: string) {
    return request<TeacherDetailResponse>(`/api/school/workers/${teacherId}`);
  },

  updateSchoolWorker(teacherId: string, payload: UpdateTeacherPayload) {
    return request<TeacherDetailResponse>(`/api/school/workers/${teacherId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  addWorkerToProject(teacherId: string, projectId: number) {
    return request<TeacherDetailResponse>(
      `/api/school/workers/${teacherId}/projects/${projectId}`,
      { method: "POST" },
    );
  },

  removeWorkerFromProject(teacherId: string, projectId: number) {
    return request<TeacherDetailResponse>(
      `/api/school/workers/${teacherId}/projects/${projectId}`,
      { method: "DELETE" },
    );
  },

  async downloadWorkersBank() {
    const response = await fetch("/api/school/workers/export", {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorizedResponse("/api/school/workers/export");
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(
        typeof data.error === "string" ? data.error : "Ошибка скачивания",
      );
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename\*=UTF-8''(.+)/);
    const filename = match
      ? decodeURIComponent(match[1])
      : `Список - ${new Date().getFullYear()}.xlsx`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  schoolLessonAnalysis() {
    return request<LessonAnalysisResponse>("/api/school/projects/lesson-analysis");
  },

  schoolLessonAnalysisTeacher(
    teacherId: string,
    filters?: { source?: string; discipline?: string },
  ) {
    const search = new URLSearchParams();
    if (filters?.source) {
      search.set("source", filters.source);
    }
    if (filters?.discipline) {
      search.set("discipline", filters.discipline);
    }
    const query = search.toString();
    return request<ProjectTeacherProfileResponse>(
      `/api/school/projects/lesson-analysis/teachers/${teacherId}${
        query ? `?${query}` : ""
      }`,
    );
  },

  createLessonAnalysisEvaluation(
    teacherId: string,
    payload: CreateEvaluationPayload,
  ) {
    return request<{ cardId: number }>(
      `/api/school/projects/lesson-analysis/teachers/${teacherId}/cards`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  schoolLessonAnalysisEvaluation(teacherId: string, cardId: number) {
    return request<EvaluationDetail>(
      `/api/school/projects/lesson-analysis/teachers/${teacherId}/cards/${cardId}`,
    );
  },

  downloadEvaluationRecommendations(teacherId: string, cardId: number) {
    return downloadFile(
      `/api/school/projects/lesson-analysis/teachers/${teacherId}/cards/${cardId}/recommendations`,
      "rekomendacii.pdf",
    );
  },

  updateLessonAnalysisEvaluationComment(
    teacherId: string,
    cardId: number,
    commentHtml: string,
  ) {
    return request<{ commentHtml: string | null }>(
      `/api/school/projects/lesson-analysis/teachers/${teacherId}/cards/${cardId}/comment`,
      {
        method: "PATCH",
        body: JSON.stringify({ commentHtml }),
      },
    );
  },

  emailLessonAnalysisEvaluation(
    teacherId: string,
    cardId: number,
    email: string,
  ) {
    return request<{ ok: boolean }>(
      `/api/school/projects/lesson-analysis/teachers/${teacherId}/cards/${cardId}/email`,
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
  },

  deleteLessonAnalysisEvaluation(teacherId: string, cardId: number) {
    return request<{ ok: boolean }>(
      `/api/school/projects/lesson-analysis/teachers/${teacherId}/cards/${cardId}`,
      { method: "DELETE" },
    );
  },

  forgotPassword(payload: {
    email: string;
    phone: string;
    captchaId: string;
    captchaAnswer: string;
    website?: string;
  }) {
    return request<{ ok: boolean; message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  recoveryCaptcha() {
    return request<{ captchaId: string; imageSvg: string }>(
      "/api/auth/recovery-captcha",
    );
  },

  validateResetToken(token: string) {
    return request<{ valid: boolean; schoolName: string }>(
      `/api/auth/reset-password/${token}`,
    );
  },

  resetPassword(token: string, password: string, confirmPassword: string) {
    return request<{ ok: boolean; message: string }>(
      `/api/auth/reset-password/${token}`,
      {
        method: "POST",
        body: JSON.stringify({ password, confirmPassword }),
      },
    );
  },
};
