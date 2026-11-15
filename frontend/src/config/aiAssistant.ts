/**
 * Чат поддержки в кабинете.
 *
 * Включён для пяти пилотных школ и для 12 школ, подключённых после аварии.
 */
const AI_PILOT_SCHOOL_IDS: readonly number[] = [305, 423, 554, 171, 538];
const AI_AFTER_INCIDENT_SCHOOL_IDS: readonly number[] = [
  69, 76, 114, 144, 206, 213, 231, 408, 413, 416, 529, 541,
];

export function isAiAssistantEnabled(
  schoolId: number | null | undefined,
): boolean {
  if (typeof schoolId !== "number" || schoolId <= 0) return false;
  if (import.meta.env.DEV && schoolId === 483) return true;
  return (
    AI_PILOT_SCHOOL_IDS.includes(schoolId) ||
    AI_AFTER_INCIDENT_SCHOOL_IDS.includes(schoolId)
  );
}
