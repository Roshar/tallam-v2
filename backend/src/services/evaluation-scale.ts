/**
 * Шкала оценки для аналитики: структура разделов обеих карт и их максимумы.
 *
 * Источник структуры - `frontend/src/data/evaluationCriteria.ts` (сами критерии
 * и подписи), а значения максимумов совпадают с теми, что уже применяются при
 * показе карточки в `card-view.service.ts` (13 / 33 / 6 / 6 для комплексной,
 * 33 для методической). Формулы расчёта здесь не новые: используется та же
 * `percentOf(sum, max)`, что и в карточке.
 *
 * ВАЖНО: это описание шкалы существует в проекте уже в трёх местах (критерии на
 * фронте, `card-view.service.ts`, `card.service.ts`). Здесь появилось четвёртое -
 * сознательно, чтобы не переписывать рабочую логику оценивания. Если шкала
 * изменится, менять нужно все места; проверка ниже не даст молча разойтись
 * суммам разделов и общему максимуму карты.
 */

export type CardTypeKind = "method" | "full";

export interface ScaleSection {
  id: string;
  title: string;
  keys: string[];
  max: number;
}

export interface CardScale {
  type: CardTypeKind;
  /** Значение `card_type` в базе: 2 - методическая, 1 - комплексная. */
  dbCardType: number;
  label: string;
  keys: string[];
  max: number;
  sections: ScaleSection[];
}

const range = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);

const SUBJECT_KEYS = range("k_1_", 7); // 1.1-1.7
const METHOD_KEYS = range("k_2_", 22); // 1.1-1.22 внутри методической части
const PSYCHO_KEYS = range("k_3_", 3);
const COMM_KEYS = range("k_4_", 3);

/** Пять разделов методической карты: 6 + 12 + 6 + 6 + 3 = 33 балла. */
const METHOD_SECTIONS: ScaleSection[] = [
  {
    id: "goal",
    title: "Целеполагание на уроке",
    keys: range("k_2_", 3),
    max: 6,
  },
  {
    id: "activity",
    title: "Организация деятельности учащихся на уроке",
    keys: ["k_2_4", "k_2_5", "k_2_6", "k_2_7", "k_2_8", "k_2_9", "k_2_10", "k_2_11"],
    max: 12,
  },
  {
    id: "reflection",
    title: "Оценка и рефлексия на уроке",
    keys: ["k_2_12", "k_2_13", "k_2_14", "k_2_15"],
    max: 6,
  },
  {
    id: "info",
    title: "Информационное и техническое обеспечение урока",
    keys: ["k_2_16", "k_2_17", "k_2_18", "k_2_19", "k_2_20"],
    max: 6,
  },
  {
    id: "health",
    title: "Обеспечение условий охраны здоровья учащихся",
    keys: ["k_2_21", "k_2_22"],
    max: 3,
  },
];

export const CARD_SCALES: Record<CardTypeKind, CardScale> = {
  method: {
    type: "method",
    dbCardType: 2,
    label: "Методическая карта",
    keys: METHOD_KEYS,
    max: 33,
    sections: METHOD_SECTIONS,
  },
  full: {
    type: "full",
    dbCardType: 1,
    label: "Комплексная карта",
    keys: [...SUBJECT_KEYS, ...METHOD_KEYS, ...PSYCHO_KEYS, ...COMM_KEYS],
    max: 58,
    sections: [
      {
        id: "subject",
        title: "1. Предметные компетенции",
        keys: SUBJECT_KEYS,
        max: 13,
      },
      // Комплексная карта переиспользует те же критерии k_2_*, что и методическая.
      ...METHOD_SECTIONS.map((section) => ({ ...section })),
      {
        id: "psycho",
        title: "3. Психолого-педагогические компетенции",
        keys: PSYCHO_KEYS,
        max: 6,
      },
      {
        id: "comm",
        title: "4. Коммуникативные компетенции",
        keys: COMM_KEYS,
        max: 6,
      },
    ],
  },
};

export const CARD_TYPES: CardTypeKind[] = ["method", "full"];

export function isCardTypeKind(value: unknown): value is CardTypeKind {
  return value === "method" || value === "full";
}

/** В базе `card_type = 2` - методическая, всё остальное - комплексная. */
export function cardTypeFromDb(value: number): CardTypeKind {
  return Number(value) === 2 ? "method" : "full";
}

export function scaleFor(cardType: CardTypeKind): CardScale {
  return CARD_SCALES[cardType];
}

/** Та же формула и то же округление, что в `card-view.service.ts`. */
export function percentOf(sum: number, max: number): number {
  if (!max) return 0;
  return Math.round((sum * 100) / max);
}

export function scoreOf(row: Record<string, unknown>, key: string): number {
  return Number(row[key] ?? 0);
}

export function sumKeysOf(row: Record<string, unknown>, keys: string[]): number {
  return keys.reduce((total, key) => total + scoreOf(row, key), 0);
}

/** Сумма ключей как SQL-выражение: COALESCE защищает от NULL в старых строках. */
export function sumKeysSql(keys: string[]): string {
  return keys.map((key) => `COALESCE(\`${key}\`, 0)`).join(" + ");
}

// Проверка на старте API: суммы разделов должны сходиться с максимумом карты.
for (const scale of Object.values(CARD_SCALES)) {
  const sectionSum = scale.sections.reduce((total, section) => total + section.max, 0);
  if (sectionSum !== scale.max) {
    throw new Error(
      `Шкала ${scale.type}: сумма разделов ${sectionSum} не равна максимуму карты ${scale.max}`,
    );
  }
  const sectionKeys = scale.sections.flatMap((section) => section.keys).sort();
  const allKeys = [...scale.keys].sort();
  if (sectionKeys.join(",") !== allKeys.join(",")) {
    throw new Error(`Шкала ${scale.type}: разделы не покрывают все критерии карты`);
  }
}
