import nodemailer from "nodemailer";
import { config, isSmtpConfigured } from "../config.js";

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
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  return transporter;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const subject = "Восстановление пароля — Tallam";
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

  await mailer.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  });
}
