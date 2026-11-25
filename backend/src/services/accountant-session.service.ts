import { config } from "../config.js";
import type { SessionUser } from "../types/session.js";

/**
 * Сессия бухгалтера. Бухгалтер входит по общему логину из конфигурации,
 * отдельной записи в users у него нет. Тот же объект используется при
 * входе администратора под бухгалтером.
 */
export function buildAccountantSession(): SessionUser {
  return {
    id: 0,
    idUser: "accountant",
    email: config.accountant.login,
    role: "accountant",
    schoolId: 0,
    status: "on",
    accountType: "accountant",
  };
}
