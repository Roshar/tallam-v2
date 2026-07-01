import mysql from "mysql2/promise";
import { config } from "../config.js";

export const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

export async function query<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}
