import type { Request, Response } from "express";
import {
  AiAssistantError,
  chatWithAssistant,
  createAiSuggestion,
  deleteAiConversation,
  getConversationForUser,
  getMonthlyUsage,
  isAiAssistantSchool,
  listConversations,
} from "../services/ai-assistant.service.js";

function schoolUser(req: Request) {
  return req.session.user ?? null;
}

export async function chat(req: Request, res: Response) {
  const user = schoolUser(req);
  if (!user) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  if (!isAiAssistantSchool(user.schoolId)) {
    return res.status(403).json({
      error: "Чат поддержки пока доступен только участникам пилота",
    });
  }

  try {
    const result = await chatWithAssistant({
      schoolId: user.schoolId,
      userId: user.id,
      conversationId: Number(req.body?.conversationId) || null,
      message: req.body?.message,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AiAssistantError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("AI assistant chat error:", error);
    return res.status(500).json({ error: "Не удалось получить ответ" });
  }
}

export async function conversations(req: Request, res: Response) {
  const user = schoolUser(req);
  if (!user) return res.status(401).json({ error: "Требуется авторизация" });
  if (!isAiAssistantSchool(user.schoolId)) {
    return res.status(403).json({ error: "Чат поддержки пока недоступен" });
  }
  try {
    return res.json({
      items: await listConversations(user.schoolId, user.id),
    });
  } catch (error) {
    console.error("AI conversations error:", error);
    return res.status(500).json({ error: "Не удалось загрузить диалоги" });
  }
}

export async function conversation(req: Request, res: Response) {
  const user = schoolUser(req);
  if (!user) return res.status(401).json({ error: "Требуется авторизация" });
  if (!isAiAssistantSchool(user.schoolId)) {
    return res.status(403).json({ error: "Чат поддержки пока недоступен" });
  }
  try {
    const id = Number(req.params.conversationId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Некорректный диалог" });
    }
    return res.json({
      conversation: await getConversationForUser(user.schoolId, user.id, id),
    });
  } catch (error) {
    if (error instanceof AiAssistantError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("AI conversation error:", error);
    return res.status(500).json({ error: "Не удалось загрузить диалог" });
  }
}

export async function usage(req: Request, res: Response) {
  const user = schoolUser(req);
  if (!user) return res.status(401).json({ error: "Требуется авторизация" });
  if (!isAiAssistantSchool(user.schoolId)) {
    return res.status(403).json({ error: "Чат поддержки пока недоступен" });
  }
  try {
    return res.json({ usage: await getMonthlyUsage(user.schoolId) });
  } catch (error) {
    console.error("AI usage error:", error);
    return res.status(500).json({ error: "Не удалось загрузить лимиты" });
  }
}


export async function deleteConversation(req: Request, res: Response) {
  const user = schoolUser(req);
  if (!user) return res.status(401).json({ error: "Требуется авторизация" });
  if (!isAiAssistantSchool(user.schoolId)) {
    return res.status(403).json({ error: "Чат поддержки пока недоступен" });
  }
  try {
    const conversationId = Number(req.params.conversationId);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: "Некорректный диалог" });
    }
    await deleteAiConversation({
      schoolId: user.schoolId,
      userId: user.id,
      conversationId,
    });
    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof AiAssistantError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("AI delete conversation error:", error);
    return res.status(500).json({ error: "Не удалось удалить диалог" });
  }
}

export async function suggestion(req: Request, res: Response) {
  const user = schoolUser(req);
  if (!user) return res.status(401).json({ error: "Требуется авторизация" });
  if (!isAiAssistantSchool(user.schoolId)) {
    return res.status(403).json({ error: "Чат поддержки пока недоступен" });
  }
  try {
    const result = await createAiSuggestion({
      schoolId: user.schoolId,
      userId: user.id,
      suggestion: req.body?.suggestion,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AiAssistantError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("AI suggestion error:", error);
    return res.status(500).json({ error: "Не удалось сохранить предложение" });
  }
}
