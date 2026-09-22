import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { config } from "../config.js";

export interface DatabaseBackupFile {
  filename: string;
  filePath: string;
  workDir: string;
  database: string;
}

const DOCKER_CONTAINER =
  process.env.DATABASE_DUMP_CONTAINER ?? "tallam-v2-mysql";

let backupInProgress = false;

function which(binary: string): string | null {
  const result = spawnSync("/bin/sh", ["-c", `command -v ${binary}`], {
    encoding: "utf8",
  });
  const path = result.stdout.trim();
  return result.status === 0 && path ? path : null;
}

function dockerContainerRunning(name: string): boolean {
  const result = spawnSync(
    "docker",
    ["inspect", "-f", "{{.State.Running}}", name],
    { encoding: "utf8" },
  );
  return result.status === 0 && result.stdout.trim() === "true";
}

function dumpArgs(includeGtidFlag: boolean): string[] {
  const args = [
    "--single-transaction",
    "--routines",
    "--triggers",
    "--hex-blob",
    "--default-character-set=utf8mb4",
  ];
  if (includeGtidFlag) {
    args.push("--set-gtid-purged=OFF");
  }
  args.push(config.db.database);
  return args;
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

async function runDump(workDir: string, filePath: string): Promise<void> {
  const hostDump = which("mariadb-dump") ?? which("mysqldump");
  const useGtid = Boolean(hostDump?.endsWith("mysqldump"));
  const args = dumpArgs(useGtid);

  if (hostDump) {
    const cnfPath = join(workDir, "my.cnf");
    await writeFile(
      cnfPath,
      [
        "[client]",
        `host=${config.db.host}`,
        `port=${config.db.port}`,
        `user=${config.db.user}`,
        `password=${config.db.password}`,
        "",
      ].join("\n"),
      { mode: 0o600 },
    );

    await spawnDump(hostDump, ["--defaults-extra-file=" + cnfPath, ...args], {
      filePath,
    });
    return;
  }

  if (dockerContainerRunning(DOCKER_CONTAINER)) {
    await spawnDump(
      "docker",
      [
        "exec",
        "-e",
        `MYSQL_PWD=${config.db.password}`,
        DOCKER_CONTAINER,
        "mysqldump",
        `-u${config.db.user}`,
        ...dumpArgs(true),
      ],
      { filePath },
    );
    return;
  }

  throw new Error(
    "На сервере нет mariadb-dump или mysqldump. Установите клиент базы и повторите попытку.",
  );
}

async function spawnDump(
  command: string,
  args: string[],
  input: { filePath: string },
): Promise<void> {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const gzip = createGzip({ level: 6 });
  const output = createWriteStream(input.filePath, { mode: 0o600 });
  let stderr = "";

  child.stderr.on("data", (chunk: Buffer) => {
    stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000);
  });

  const closed = new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  await pipeline(child.stdout, gzip, output);
  const code = await closed;
  if (code !== 0) {
    console.error("Database dump failed:", stderr.trim());
    throw new Error("Не удалось сформировать резервную копию базы");
  }
}

async function createDatabaseBackupFile(): Promise<DatabaseBackupFile> {
  const workDir = await mkdtemp(join(tmpdir(), "tallam-db-backup-"));
  const filename = `tallam-db-${formatStamp()}.sql.gz`;
  const filePath = join(workDir, filename);

  try {
    await runDump(workDir, filePath);
    return {
      filename,
      filePath,
      workDir,
      database: config.db.database,
    };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}

export function createDatabaseBackup(): Promise<DatabaseBackupFile> {
  if (backupInProgress) {
    throw new Error("Резервная копия уже формируется. Дождитесь окончания.");
  }

  backupInProgress = true;
  return createDatabaseBackupFile().finally(() => {
    backupInProgress = false;
  });
}

export async function cleanupDatabaseBackup(
  backup: Pick<DatabaseBackupFile, "workDir">,
): Promise<void> {
  await rm(backup.workDir, { recursive: true, force: true });
}
