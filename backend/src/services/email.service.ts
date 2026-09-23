import nodemailer from "nodemailer";
import { config, isSmtpConfigured } from "../config.js";
import { saveLocalOutbox } from "./local-outbox.service.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth:
        config.smtp.user && config.smtp.pass
          ? { user: config.smtp.user, pass: config.smtp.pass }
          : undefined,
    });
  }

  return transporter;
}

function isConnectionRefused(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  const message = error instanceof Error ? error.message : "";
  return (
    code === "ECONNREFUSED" ||
    message.includes("ECONNREFUSED")
  );
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}): Promise<{ previewUrl: string | null }> {
  const mailer = getTransporter();
  if (mailer) {
    try {
      await mailer.sendMail({
        from: config.smtp.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments,
      });
      return { previewUrl: config.smtp.previewUrl || null };
    } catch (error) {
      if (!config.isDev || !isConnectionRefused(error)) {
        if (isConnectionRefused(error)) {
          throw new Error(
            "Почтовый сервер недоступен. Проверьте SMTP и повторите отправку.",
          );
        }
        throw error;
      }
    }
  } else if (!config.isDev) {
    throw new Error("Почтовый сервер не настроен");
  }

  const previewUrl = await saveLocalOutbox(input);
  console.info("[mail] saved to local outbox:", previewUrl);
  return { previewUrl };
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const subject = "Восстановление пароля - Tallam";
  const text = [
    "Вы запросили восстановление пароля для личного кабинета школы Tallam.",
    "",
    "Перейдите по ссылке, чтобы задать новый пароль:",
    resetUrl,
    "",
    "Ссылка действует ограниченное время. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.",
  ].join("\n");

  const html = `
    <p>Вы запросили восстановление пароля для личного кабинета школы <strong>Tallam</strong>.</p>
    <p><a href="${resetUrl}">Задать новый пароль</a></p>
    <p>Или скопируйте ссылку в браузер:<br><span>${resetUrl}</span></p>
    <p>Ссылка действует ограниченное время. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
  `;

  const mailer = getTransporter();

  if (!mailer) {
    console.info("[password-reset] SMTP not configured. Reset link:");
    console.info(resetUrl);
    return;
  }

  try {
    await mailer.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    if (config.isDev && isConnectionRefused(error)) {
      console.info("[password-reset] SMTP unavailable. Reset link:");
      console.info(resetUrl);
      return;
    }
    throw error;
  }
}
