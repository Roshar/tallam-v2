import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import mysql from "mysql2/promise";
import { config } from "./config.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import schoolRoutes from "./routes/school.routes.js";
import { syncSchoolCabinetAccess } from "./services/school-access.service.js";
import { ensureAuditLogSchema } from "./services/audit-log.service.js";

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
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: config.session.lifetime,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
}));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "tallam-v2" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/school", schoolRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(config.port, () => {
  console.log(`Tallam API listening on http://localhost:${config.port}`);
  void ensureAuditLogSchema().catch((error) => {
    console.error("Failed to initialize audit log schema:", error);
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
