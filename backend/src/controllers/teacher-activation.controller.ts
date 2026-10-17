import type { Request, Response } from "express";
import {
  completeActivation,
  createInvites,
  getActivationOverview,
  getActivationPreview,
  revokeTeacherAccount,
  sendActivationCode,
  sendTeacherInvite,
} from "../services/teacher-activation.service.js";

/**
 * Активация кабинета учителя.
 *
 * Публичная часть работает по одноразовой ссылке-токену и не требует входа:
 * именно по ней учитель попадает в кабинет. Школьная часть защищена ролью
 * school, школа видит только своих учителей.
 */

const PASSWORD_MIN = 6;

export async function preview(req: Request, res: Response) {
  try {
    const data = await getActivationPreview(String(req.params.token ?? ""));
    if (!data) {
      return res
        .status(404)
        .json({ error: "Ссылка недействительна или устарела" });
    }
    return res.json(data);
  } catch (error) {
    console.error("Activation preview error:", error);
    return res.status(500).json({ error: "Не удалось открыть ссылку" });
  }
}

export async function requestCode(req: Request, res: Response) {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    return res.status(400).json({ error: "Укажите почту" });
  }

  try {
    const result = await sendActivationCode(
      String(req.params.token ?? ""),
      String(email),
    );
    if ("error" in result) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({
      ok: true,
      message: "Если адрес доступен, код отправлен на указанную почту",
    });
  } catch (error) {
    console.error("Activation code error:", error);
    return res.status(500).json({ error: "Не удалось отправить код" });
  }
}

export async function complete(req: Request, res: Response) {
  const { email, code, password } = req.body as {
    email?: string;
    code?: string;
    password?: string;
  };

  if (!email?.trim() || !code?.trim() || !password) {
    return res.status(400).json({ error: "Заполните все поля" });
  }
  if (password.length < PASSWORD_MIN) {
    return res
      .status(400)
      .json({ error: `Пароль должен быть не короче ${PASSWORD_MIN} символов` });
  }
  if (!/^\d{6}$/.test(code.trim())) {
    return res.status(400).json({ error: "Код состоит из 6 цифр" });
  }

  try {
    const result = await completeActivation({
      token: String(req.params.token ?? ""),
      email: String(email),
      code: String(code),
      password: String(password),
    });
    if ("error" in result) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Activation complete error:", error);
    return res.status(500).json({ error: "Не удалось активировать кабинет" });
  }
}

export async function overview(req: Request, res: Response) {
  const schoolId = req.session.user?.schoolId;
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  try {
    return res.json(await getActivationOverview(schoolId));
  } catch (error) {
    console.error("Activation overview error:", error);
    return res.status(500).json({ error: "Не удалось загрузить сводку" });
  }
}

export async function invite(req: Request, res: Response) {
  const schoolId = req.session.user?.schoolId;
  const userId = req.session.user?.id;
  if (!schoolId || !userId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const body = req.body as { teacherIds?: unknown; all?: unknown };
  const requested = Array.isArray(body.teacherIds)
    ? body.teacherIds.filter((id): id is string => typeof id === "string")
    : [];

  let teacherIds = requested;

  if (teacherIds.length === 0 && body.all === true) {
    const data = await getActivationOverview(schoolId);
    teacherIds = data.teachers
      .filter((item) => item.status !== "activated")
      .map((item) => item.idTeacher);
  }

  if (teacherIds.length === 0) {
    return res.status(400).json({ error: "Не выбрано ни одного учителя" });
  }
  if (teacherIds.length > 200) {
    return res.status(400).json({ error: "За один раз не больше 200 учителей" });
  }

  try {
    const links = await createInvites({ schoolId, createdBy: userId, teacherIds });
    return res.json({ links });
  } catch (error) {
    console.error("Activation invite error:", error);
    return res.status(500).json({ error: "Не удалось создать приглашения" });
  }
}

/** Одно письмо конкретному учителю. Школа подтверждает адрес вручную. */
export async function sendInvite(req: Request, res: Response) {
  const schoolId = req.session.user?.schoolId;
  const userId = req.session.user?.id;
  if (!schoolId || !userId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }

  const { teacherId } = req.body as { teacherId?: unknown };
  if (typeof teacherId !== "string" || !teacherId.trim()) {
    return res.status(400).json({ error: "Не указан учитель" });
  }

  try {
    const result = await sendTeacherInvite({
      schoolId,
      createdBy: userId,
      idTeacher: teacherId.trim(),
    });
    if ("error" in result) {
      return res
        .status(result.status)
        .json({ error: result.error, reason: result.reason ?? null });
    }
    return res.json({ ok: true, sentTo: result.sentTo });
  } catch (error) {
    console.error("Activation send error:", error);
    return res.status(500).json({ error: "Не удалось отправить письмо" });
  }
}

export async function revoke(req: Request, res: Response) {
  const schoolId = req.session.user?.schoolId;
  if (!schoolId) {
    return res.status(403).json({ error: "Доступ только для школы" });
  }
  const { teacherId } = req.body as { teacherId?: string };
  if (!teacherId) {
    return res.status(400).json({ error: "Не указан учитель" });
  }

  try {
    const done = await revokeTeacherAccount(schoolId, teacherId);
    if (!done) {
      return res.status(404).json({ error: "Аккаунт не найден" });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("Activation revoke error:", error);
    return res.status(500).json({ error: "Не удалось отозвать доступ" });
  }
}
