import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "Usage: npm run db:import-subscriptions -- /path/to/subscriptions.json",
  );
  process.exit(1);
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ");
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

function addOneYear(value) {
  const [year, month, day] = value.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return [
    year + 1,
    String(month).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
}

const raw = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
if (!Array.isArray(raw)) {
  throw new Error("Subscription import file must contain a JSON array");
}

const connection = await mysql.createConnection({
  host: process.env.DATABASE_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
  multipleStatements: true,
});

try {
  const migrationPath = new URL(
    "./init/05-school-subscriptions.sql",
    import.meta.url,
  );
  await connection.query(await fs.readFile(migrationPath, "utf8"));

  const [phoneColumns] = await connection.query(
    "SHOW COLUMNS FROM school_subscriptions LIKE 'contact_phone'",
  );
  if (!phoneColumns.length) {
    await connection.query(
      "ALTER TABLE school_subscriptions ADD COLUMN contact_phone varchar(100) DEFAULT NULL AFTER ends_on",
    );
  }

  const [accounts] = await connection.query(
    `SELECT school_id, email
     FROM users
     WHERE role = 'school_admin'`,
  );
  const [schools] = await connection.query(
    "SELECT id_school, school_name FROM schools",
  );

  const schoolByEmail = new Map(
    accounts.map((row) => [normalize(row.email), Number(row.school_id)]),
  );
  const schoolByName = new Map(
    schools.map((row) => [normalize(row.school_name), Number(row.id_school)]),
  );

  const unmatched = [];
  const latestBySchool = new Map();

  for (const row of raw) {
    const startsOn = String(row.startsOn ?? "");
    const endsOn = String(row.endsOn ?? (isIsoDate(startsOn) ? addOneYear(startsOn) : ""));

    if (!isIsoDate(startsOn) || !isIsoDate(endsOn)) {
      unmatched.push({
        schoolName: row.schoolName || "Без названия",
        reason: "Некорректная дата",
      });
      continue;
    }

    const schoolId =
      schoolByEmail.get(normalize(row.email)) ??
      schoolByName.get(normalize(row.schoolName));

    if (!schoolId) {
      unmatched.push({
        schoolName: row.schoolName || "Без названия",
        reason: "Школа не найдена",
      });
      continue;
    }

    const candidate = {
      schoolId,
      startsOn,
      endsOn,
      contactPhone: row.contactPhone
        ? String(row.contactPhone).trim().slice(0, 100)
        : null,
      sourceLabel: String(row.sourceLabel ?? "Импорт").slice(0, 100),
      note: row.note ? String(row.note).slice(0, 500) : null,
    };
    const current = latestBySchool.get(schoolId);

    if (
      !current ||
      candidate.startsOn > current.startsOn ||
      (candidate.startsOn === current.startsOn &&
        candidate.endsOn > current.endsOn)
    ) {
      latestBySchool.set(schoolId, candidate);
    }
  }

  await connection.beginTransaction();
  for (const item of latestBySchool.values()) {
    await connection.execute(
      `INSERT INTO school_subscriptions
         (school_id, starts_on, ends_on, contact_phone, source_label, note)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         contact_phone = VALUES(contact_phone),
         source_label = VALUES(source_label),
         note = VALUES(note),
         is_cancelled = 0`,
      [
        item.schoolId,
        item.startsOn,
        item.endsOn,
        item.contactPhone,
        item.sourceLabel,
        item.note,
      ],
    );
  }
  await connection.commit();

  console.log(
    JSON.stringify(
      {
        importedSchools: latestBySchool.size,
        skippedRows: unmatched.length,
        skipped: unmatched,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await connection.rollback().catch(() => {});
  throw error;
} finally {
  await connection.end();
}
