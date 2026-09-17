import { mkdir, appendFile, chmod } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export type PasswordNotebookAction = "created" | "changed" | "reset";

function clean(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

export async function appendSchoolPasswordNote(input: {
  action: PasswordNotebookAction;
  schoolId: number;
  schoolName: string;
  email: string;
  password: string;
  actor: string;
}): Promise<void> {
  const filePath = config.schoolPasswordLog;
  await mkdir(path.dirname(filePath), { recursive: true });

  const line = [
    new Date().toISOString(),
    input.action,
    `schoolId=${input.schoolId}`,
    `school=${clean(input.schoolName)}`,
    `email=${clean(input.email)}`,
    `password=${clean(input.password)}`,
    `by=${clean(input.actor)}`,
  ].join("\t");

  await appendFile(filePath, `${line}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(filePath, 0o600).catch(() => {
    /* файл мог быть создан ранее с другими правами */
  });
}
