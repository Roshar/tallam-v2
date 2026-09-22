import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import type { Response } from "express";
import { config } from "../config.js";

const DUMP_CANDIDATES = [
  "/usr/bin/mariadb-dump",
  "/usr/local/bin/mariadb-dump",
  "/usr/bin/mysqldump",
  "/usr/local/bin/mysqldump",
];
const DOCKER_CONTAINER =
  process.env.DATABASE_DUMP_CONTAINER ?? "tallam-v2-mysql";
const DUMP_TIMEOUT_MS = 15 * 60 * 1000;

let backupInProgress = false;

function which(binary: string): string | null {
  const result = spawnSync("/bin/sh", ["-c", `command -v ${binary}`], {
    encoding: "utf8",
    timeout: 2000,
  });
  const path = result.stdout.trim();
  return result.status === 0 && path ? path : null;
}

function dockerContainerRunning(name: string): boolean {
  const result = spawnSync(
    "docker",
    ["inspect", "-f", "{{.State.Running}}", name],
    { encoding: "utf8", timeout: 2000 },
  );
  return result.status === 0 && result.stdout.trim() === "true";
}

function escapeCnfValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function formatStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function dumpFlags(binary: string): string[] {
  const args = [
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    "--default-character-set=utf8mb4",
  ];
  if (binary.endsWith("mysqldump")) {
    args.push("--set-gtid-purged=OFF");
  }
  args.push(config.db.database);
  return args;
}

function resolveHostDump(): string | null {
  for (const candidate of DUMP_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return which("mariadb-dump") ?? which("mysqldump");
}

async function prepareDumpCommand(workDir: string): Promise<{
  command: string;
  args: string[];
}> {
  const hostDump = resolveHostDump();
  if (hostDump) {
    const cnfPath = join(workDir, "my.cnf");
    await writeFile(
      cnfPath,
      [
        "[client]",
        `host=${config.db.host}`,
        `port=${config.db.port}`,
        `user=${config.db.user}`,
        `password=${escapeCnfValue(config.db.password)}`,
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
    return {
      command: hostDump,
      args: [`--defaults-extra-file=${cnfPath}`, ...dumpFlags(hostDump)],
    };
  }

  if (dockerContainerRunning(DOCKER_CONTAINER)) {
    return {
      command: "docker",
      args: [
        "exec",
        "-e",
        `MYSQL_PWD=${config.db.password}`,
        DOCKER_CONTAINER,
        "mysqldump",
        `-u${config.db.user}`,
        ...dumpFlags("mysqldump"),
      ],
    };
  }

  throw new Error(
    "На сервере нет mariadb-dump или mysqldump. Установите клиент базы и повторите попытку.",
  );
}

export async function streamDatabaseBackup(res: Response): Promise<{
  filename: string;
  database: string;
}> {
  if (backupInProgress) {
    throw new Error("Резервная копия уже формируется. Дождитесь окончания.");
  }

  backupInProgress = true;
  const workDir = await mkdtemp(join(tmpdir(), "tallam-db-backup-"));
  const filename = `tallam-db-${formatStamp()}.sql.gz`;
  let child: ChildProcess | null = null;
  let finished = false;

  const cleanup = async () => {
    if (finished) return;
    finished = true;
    backupInProgress = false;
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
    await rm(workDir, { recursive: true, force: true });
  };

  try {
    const { command, args } = await prepareDumpCommand(workDir);
    child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const gzip = createGzip({ level: 6 });
    let stderr = "";

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000);
    });

    const timer = setTimeout(() => {
      console.error("Database dump timed out");
      child?.kill("SIGTERM");
      if (!res.writableEnded) res.destroy();
      void cleanup();
    }, DUMP_TIMEOUT_MS);

    child.on("error", (error) => {
      console.error("Database dump spawn error:", error);
      clearTimeout(timer);
      void cleanup();
      if (!res.headersSent) {
        res.status(500).json({
          error: "Не удалось сформировать резервную копию базы",
        });
        return;
      }
      if (!res.writableEnded) res.destroy();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code && code !== 0) {
        console.error("Database dump failed:", stderr.trim());
        if (!res.headersSent) {
          void cleanup();
          res.status(500).json({
            error: "Не удалось сформировать резервную копию базы",
          });
          return;
        }
        if (!res.writableEnded) res.destroy();
      }
    });

    res.on("close", () => {
      clearTimeout(timer);
      void cleanup();
    });

    res.locals.auditDetails = {
      filename,
      database: config.db.database,
    };
    res.status(200);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    if (!child.stdout) {
      throw new Error("Не удалось сформировать резервную копию базы");
    }

    await pipeline(child.stdout, gzip, res);
    clearTimeout(timer);
    await cleanup();
    return { filename, database: config.db.database };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
