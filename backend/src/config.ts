import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.APP_PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  isDev: process.env.NODE_ENV !== "production",
  db: {
    host: requireEnv("DATABASE_HOST"),
    user: requireEnv("DATABASE_USER"),
    password: process.env.DATABASE_PASSWORD ?? "",
    database: requireEnv("DATABASE"),
    port: Number(process.env.DB_PORT ?? 3306),
  },
  session: {
    name: process.env.SESSION_NAME ?? "smad",
    secret: requireEnv("SESSION_SECRET"),
    lifetime: Number(process.env.SESSION_LIFETIME ?? 7_200_000),
  },
  subscriptionDataEncryptionKey:
    process.env.SUBSCRIPTION_DATA_ENCRYPTION_KEY ?? requireEnv("SESSION_SECRET"),
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 465),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "Tallam <noreply@tallam.ru>",
  },
  passwordReset: {
    expiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 60),
  },
} as const;

export function isSmtpConfigured(): boolean {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}
