export type AiSourceType =
  | "school_analytics"
  | "lesson_card"
  | "teacher_analytics";

export interface AiSource {
  type: AiSourceType;
  title: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  academicYearLabel?: string | null;
  evaluations?: number | null;
  teachers?: number | null;
  criteria?: string[];
  cardId?: number | null;
  teacherId?: string | null;
  date?: string | null;
}

export interface AiMessage {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  time: string;
  sources?: AiSource[];
  welcome?: boolean;
  error?: boolean;
  nudge?: boolean;
}

export interface AiConversationSummary {
  id: number;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface AiConversationMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: AiSource[];
  createdAt: string;
}

export interface AiConversationDetail {
  id: number;
  title: string;
  messages: AiConversationMessage[];
}

export interface AiUsage {
  used: number;
  limit: number;
  remaining: number;
  monthLabel: string;
}

export interface AiChatResponse {
  conversationId: number;
  title: string;
  message: { role: "assistant"; content: string };
  sources: AiSource[];
  usage: AiUsage;
}

export interface AiJournalEntry {
  id: number;
  schoolId: number;
  schoolName: string | null;
  userId: number | null;
  userEmail: string | null;
  question: string;
  answer: string | null;
  status: "ok" | "error" | "blocked";
  model: string | null;
  conversationId: number | null;
  conversationTitle: string | null;
  conversationExists: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  createdAt: string;
  tools: string | null;
}

export interface AiJournalResponse {
  items: AiJournalEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AiSuggestionEntry {
  id: number;
  schoolId: number;
  schoolName: string | null;
  userId: number | null;
  userEmail: string | null;
  suggestion: string;
  status: string;
  createdAt: string;
}

export interface AiRepeatedQuery {
  normalized: string;
  sample: string;
  total: number;
  schools: number;
  lastAt: string;
}

export interface AiAdminUsageItem {
  schoolId: number;
  schoolName: string | null;
  questions: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}

export interface AiAdminUsage {
  items: AiAdminUsageItem[];
  totals: {
    questions: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
  };
  monthLabel: string;
  retentionDays: number;
}
