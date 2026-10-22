import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import type { IroSessionUser } from "../types/session.js";

interface IroUserRow {
  id: number;
  email: string;
  password_hash: string;
  role: IroSessionUser["role"];
  status: "on" | "off";
  first_name: string;
  last_name: string;
  patronymic: string | null;
}

function publicUser(row: IroUserRow): IroSessionUser {
  return {
    id: Number(row.id),
    iroUserId: Number(row.id),
    email: row.email,
    role: row.role,
    status: row.status,
    accountType: "iro",
    firstName: row.first_name,
    lastName: row.last_name,
    patronymic: row.patronymic,
  };
}

export async function authenticate(
  email: string,
  password: string,
): Promise<IroSessionUser | null> {
  const rows = await query<IroUserRow[]>(
    `SELECT id, email, password_hash, role, status,
    first_name, last_name, patronymic
    FROM iro_users WHERE email = ? AND status = 'on' LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return null;
  await query(
    "UPDATE iro_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
    [row.id],
  );
  return publicUser(row);
}

export async function getIroUserById(id: number): Promise<IroSessionUser | null> {
  const rows = await query<IroUserRow[]>(
    `SELECT id, email, password_hash, role, status,
    first_name, last_name, patronymic
    FROM iro_users WHERE id = ? AND status = 'on' LIMIT 1`,
    [id],
  );
  return rows[0] ? publicUser(rows[0]) : null;
}
