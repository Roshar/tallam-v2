/**
 * Чат поддержки в кабинете.
 *
 * Включён для всех школ, включая подключённые после аварии.
 */
export function isAiAssistantEnabled(
  schoolId: number | null | undefined,
): boolean {
  return typeof schoolId === "number" && schoolId > 0;
}
