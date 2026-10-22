export type UserRole =
  | "school_admin"
  | "admin"
  | "moder"
  | "methodist"
  | "accountant";

export type SchoolCabinetAccess = "full" | "billing";
export type IroRole = "iro_viewer" | "iro_methodologist" | "iro_admin";
export interface IroSessionUser {
  id: number;
  iroUserId: number;
  email: string;
  role: IroRole;
  status: "on" | "off";
  accountType: "iro";
  firstName: string;
  lastName: string;
  patronymic: string | null;
}

export interface SessionUser {
  id: number;
  idUser: string | null;
  email: string;
  role: UserRole;
  schoolId: number;
  status: "on" | "off";
  accountType: "school" | "methodist" | "admin" | "accountant";
  cabinetAccess?: SchoolCabinetAccess;
  firstname?: string;
  surname?: string;
  patronymic?: string;
  impersonatedBy?: {
    id: number;
    email: string;
  };
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
    impersonator?: SessionUser;
    iroUser?: IroSessionUser;
  }
}
