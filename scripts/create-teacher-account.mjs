#!/usr/bin/env node
/**
 * Создать аккаунт личного кабинета для существующего учителя.
 *
 * Аккаунт хранит только логин, пароль и связь с карточкой — данные учителя
 * (ФИО, школа, предметы) остаются в `teachers` и не копируются.
 *
 * Запуск из корня репозитория:
 *   node scripts/create-teacher-account.mjs <id_teacher|email из карточки> <email для входа> <пароль>
 *
 * Пример:
 *   node scripts/create-teacher-account.mjs 9f06ed32-29ee-4deb-816a-e4cad68112e3 \
 *     akhmedov@example.ru пароль123
 *
 * Повторный запуск для того же учителя или email обновляет пароль.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function loadEnv() {
  const result = {};
  try {
    const content = readFileSync(path.join(root, ".env"), "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      result[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env может отсутствовать — тогда работаем на переменных окружения
  }
  return { ...result, ...process.env };
}

const [identifier, loginEmail, password] = process.argv.slice(2);

if (!identifier || !loginEmail || !password) {
  console.error(
    "Использование: node scripts/create-teacher-account.mjs <id_teacher|email карточки> <email для входа> <пароль>",
  );
  process.exit(1);
}

const env = loadEnv();
const connection = await mysql.createConnection({
  host: env.DATABASE_HOST || "127.0.0.1",
  port: Number(env.DB_PORT || 3306),
  user: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE,
});

try {
  // На свежей базе таблицы может не быть: API создаёт её при старте, но скрипт
  // должен работать и без запущенного API. Источник схемы — файл миграции.
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teacher_accounts'`,
  );
  if (tables.length === 0) {
    const sql = readFileSync(
      path.join(root, "database", "init", "14-teacher-accounts.sql"),
      "utf8",
    );
    for (const statement of sql
      .split(";")
      .map((chunk) => chunk.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean)) {
      await connection.query(statement);
    }
    console.log("→ создана таблица teacher_accounts");
  }

  const byEmail = identifier.includes("@");
  const [teachers] = await connection.query(
    byEmail
      ? "SELECT id_teacher, surname, firstname, patronymic, school_id, email FROM teachers WHERE email = ? LIMIT 1"
      : "SELECT id_teacher, surname, firstname, patronymic, school_id, email FROM teachers WHERE id_teacher = ? LIMIT 1",
    [identifier],
  );

  if (teachers.length === 0) {
    console.error(`❌ Учитель не найден: ${identifier}`);
    process.exit(1);
  }

  const teacher = teachers[0];
  const fullName = [teacher.surname, teacher.firstname, teacher.patronymic]
    .filter(Boolean)
    .join(" ");
  const hash = await bcrypt.hash(password, 10);

  await connection.query(
    `INSERT INTO teacher_accounts (id_teacher, email, password, status)
     VALUES (?, ?, ?, 'on')
     ON DUPLICATE KEY UPDATE password = VALUES(password), email = VALUES(email), status = 'on'`,
    [teacher.id_teacher, loginEmail.trim().toLowerCase(), hash],
  );

  const [[account]] = await connection.query(
    "SELECT id, email, status FROM teacher_accounts WHERE id_teacher = ? LIMIT 1",
    [teacher.id_teacher],
  );

  console.log("✅ Аккаунт готов");
  console.log(`   учитель: ${fullName} (школа ${teacher.school_id})`);
  console.log(`   id_teacher: ${teacher.id_teacher}`);
  console.log(`   логин: ${account.email}`);
  console.log(`   запись в teacher_accounts: id ${account.id}, статус ${account.status}`);
  console.log("   вход: вкладка «Учитель» на странице входа");
} finally {
  await connection.end();
}
