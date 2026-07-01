export type UserRole = "school_admin" | "admin" | "moder" | "methodist";

export interface SessionUser {
  id: number;
  idUser: string | null;
  email: string;
  role: UserRole;
  schoolId: number;
  status: "on" | "off";
  accountType: "school" | "methodist" | "admin";
  firstname?: string;
  surname?: string;
  patronymic?: string;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}
