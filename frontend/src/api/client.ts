import type {
  CreateEvaluationPayload,
  CreateTeacherPayload,
  LessonAnalysisResponse,
  ProjectTeacherProfileResponse,
  SchoolDashboard,
  SchoolProfile,
  TeacherDetailResponse,
  UpdateTeacherPayload,
  WorkerFormOptions,
  WorkersResponse,
} from "../types/school";

export type AccountType = "school" | "methodist" | "admin";

export interface User {
  id: number;
  idUser: string | null;
  email: string;
  role: string;
  schoolId: number;
  status: "on" | "off";
  accountType: AccountType;
  firstname?: string;
  surname?: string;
  patronymic?: string;
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
    path.startsWith("/api/auth/reset-password")
  );
}

function handleUnauthorizedResponse(path: string) {
  if (shouldRedirectOnUnauthorized(path)) {
    onUnauthorized?.();
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

    throw new Error(
      typeof data.error === "string" ? data.error : "Ошибка запроса",
    );
  }

  return data as T;
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

  schoolDashboard() {
    return request<SchoolDashboard>("/api/school/dashboard");
  },

  schoolProfile() {
    return request<SchoolProfile>("/api/school/profile");
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

  forgotPassword(email: string) {
    return request<{ ok: boolean; message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  validateResetToken(token: string) {
    return request<{ valid: boolean }>(`/api/auth/reset-password/${token}`);
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
