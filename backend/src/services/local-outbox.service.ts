import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OUTBOX_DIR = path.resolve(__dirname, "../../data/outbox");

export function isSafeOutboxName(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

export async function saveLocalOutbox(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}): Promise<string> {
  await mkdir(OUTBOX_DIR, { recursive: true });
  const id = stamp();
  const links: string[] = [];

  for (const attachment of input.attachments ?? []) {
    const safeName = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${id}-${safeName}`;
    await writeFile(path.join(OUTBOX_DIR, fileName), attachment.content);
    links.push(
      `<p><a href="/api/dev/outbox/${encodeURIComponent(fileName)}">${escapeHtml(attachment.filename)}</a></p>`,
    );
  }

  const htmlName = `${id}.html`;
  const page = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(input.subject)}</title>
    <style>
      body { font-family: sans-serif; max-width: 720px; margin: 2rem auto; color: #1d2a3a; }
      .meta { color: #5b6b7c; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <p class="meta">Кому: ${escapeHtml(input.to)}</p>
    <h1>${escapeHtml(input.subject)}</h1>
    ${input.html}
    ${links.join("\n")}
  </body>
</html>
`;
  await writeFile(path.join(OUTBOX_DIR, htmlName), page, "utf8");
  return `/api/dev/outbox/${htmlName}`;
}
