/**
 * Пилот чата поддержки в кабинете.
 *
 * Пять самых активных школ по данным за 90 дней до 22.10.2026.
 * Локально страница дополнительно открыта тестовой школе 483, чтобы
 * дизайн можно было посмотреть на стенде.
 */
export const AI_PILOT_SCHOOL_IDS: readonly number[] = [305, 423, 554, 171, 538];

export function isAiAssistantEnabled(
  schoolId: number | null | undefined,
): boolean {
  if (!schoolId) return false;
  if (import.meta.env.DEV && schoolId === 483) return true;
  return AI_PILOT_SCHOOL_IDS.includes(schoolId);
}
