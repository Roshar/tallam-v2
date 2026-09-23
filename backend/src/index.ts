import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import mysql from "mysql2/promise";
import { config } from "./config.js";
import { sessionCookieOptions } from "./lib/session-cookie.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import schoolRoutes from "./routes/school.routes.js";
import { syncSchoolCabinetAccess } from "./services/school-access.service.js";
import { ensureAllSchoolsHaveLessonAnalysisProject } from "./services/project.service.js";
import { ensureAuditLogSchema } from "./services/audit-log.service.js";
import { ensureEvaluationCommentSchema } from "./services/evaluation-comment.service.js";
import { ensureSchoolFeedbackSchema } from "./services/school-feedback.service.js";
import { ensureRecoverySchema } from "./services/password-recovery.service.js";
import { requireAuth } from "./middleware/auth.js";
import {
  isSafeOutboxName,
  OUTBOX_DIR,
} from "./services/local-outbox.service.js";

const MySQLStore = MySQLStoreFactory(session);

const app = express();

const sessionConnection = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 5,
});

const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 900_000,
    expiration: config.session.lifetime,
    createDatabaseTable: true,
    schema: {
      tableName: "sessions",
      columnNames: {
        session_id: "session_id",
        expires: "expires",
        data: "data",
      },
    },
  },
  sessionConnection as never,
);

app.set("trust proxy", 1);

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(session({
  name: config.session.name,
  secret: config.session.secret,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: config.session.lifetime,
    ...sessionCookieOptions(),
  },
}));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "tallam-v2" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/school", schoolRoutes);

if (config.isDev) {
  app.get("/api/dev/outbox/:file", requireAuth, (req, res) => {
    const file = String(req.params.file ?? "");
    if (!isSafeOutboxName(file)) {
      return res.status(400).json({ error: "Некорректный файл" });
    }
    return res.sendFile(path.join(OUTBOX_DIR, file), (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ error: "Письмо не найдено" });
      }
    });
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(config.port, () => {
  console.log(`Tallam API listening on http://localhost:${config.port}`);
  void ensureAuditLogSchema().catch((error) => {
    console.error("Failed to initialize audit log schema:", error);
  });
  void ensureEvaluationCommentSchema().catch((error) => {
    console.error("Failed to initialize evaluation comments schema:", error);
  });
  void ensureSchoolFeedbackSchema().catch((error) => {
    console.error("Failed to initialize school feedback schema:", error);
  });
  void ensureRecoverySchema().catch((error) => {
    console.error("Failed to initialize recovery requests schema:", error);
  });
  void ensureAllSchoolsHaveLessonAnalysisProject()
    .then((count) => {
      if (count) {
        console.log(
          `Connected ${count} schools to the lesson analysis project`,
        );
      }
    })
    .catch((error) => {
      console.error(
        "Failed to connect schools to the lesson analysis project:",
        error,
      );
    });
  void syncSchoolCabinetAccess()
    .then((count) => {
      if (count) {
        console.log(`Blocked ${count} school cabinets with expired subscriptions`);
      }
    })
    .catch((error) => {
      console.error("Failed to sync expired school cabinets:", error);
    });
});

setInterval(() => {
  void syncSchoolCabinetAccess().catch((error) => {
    console.error("Failed to sync expired school cabinets:", error);
  });
}, 15 * 60 * 1000);
