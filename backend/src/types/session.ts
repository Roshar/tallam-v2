export type UserRole =
  | "school_admin"
  | "admin"
  | "moder"
  | "methodist"
  | "accountant"
  | "teacher";

export type SchoolCabinetAccess = "full" | "billing";

export interface SessionUser {
  id: number;
  idUser: string | null;
  email: string;
  role: UserRole;
  schoolId: number;
  status: "on" | "off";
  accountType: "school" | "methodist" | "admin" | "accountant" | "teacher";
  cabinetAccess?: SchoolCabinetAccess;
  /**
   * Для accountType = "teacher": карточка учителя, к которой привязан аккаунт.
   * Все запросы кабинета учителя ограничиваются этим значением, поэтому
   * подставить чужой идентификатор через URL невозможно.
   */
  teacherId?: string;
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
  }
}
