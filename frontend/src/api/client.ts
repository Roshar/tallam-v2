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

export interface SchoolDashboard {
  schoolName: string | null;
  teachersCount: number;
  schoolId: number;
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
    return request<SchoolDashboard>("/api/auth/school/dashboard");
  },
};
