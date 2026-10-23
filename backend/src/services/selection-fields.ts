/**
 * Реестр полей для конструктора списков (E1).
 *
 * ВАЖНО: SQL берётся ТОЛЬКО отсюда. Клиент присылает ключ поля и значение,
 * но никогда SQL-выражение. Это единственная защита от подстановки.
 *
 * Форма запроса: одна группировка по учителю. Поэтому:
 *  - поля-справочники (должность, категория, образование): many-to-one, берём MAX();
 *  - карты и обучение: one-to-many, агрегируем;
 *  - предметы: many-to-many, поэтому НЕ join, а EXISTS в WHERE и подзапрос
 *    в SELECT, иначе строки размножатся (у одного учителя бывает 79 карт).
 */

export type FieldKind = "text" | "number" | "date" | "enum" | "bool";

export type JoinKey =
  | "position"
  | "category"
  | "eduLevel"
  | "marks"
  | "kpk";

export const JOINS: Record<JoinKey, string> = {
  position: "LEFT JOIN position p ON p.id_position = t.position",
  category: "LEFT JOIN category c ON c.id_category = t.category_id",
  eduLevel: "LEFT JOIN edu_level e ON e.id_edu_level = t.level_of_education_id",
  marks:
    "LEFT JOIN card_from_project_teacher_mark3 m ON m.teacher_id = t.id_teacher",
  kpk: "LEFT JOIN training_kpk k ON k.teacher_id = t.id_teacher",
};

/** Год обучения в training_kpk хранится как свободный текст. Год считаем только по валидным. */
export const TRAINING_YEAR_EXPR =
  "MAX(CASE WHEN k.year_training REGEXP '^[0-9]{4}$' THEN CAST(k.year_training AS UNSIGNED) END)";

const SUBJECTS_SUBQUERY =
  "(SELECT GROUP_CONCAT(DISTINCT dt.title_discipline ORDER BY dt.title_discipline SEPARATOR ', ') " +
  "FROM discipline_middleware dm2 JOIN discipline_title dt ON dt.id_discipline = dm2.discipline_id " +
  "WHERE dm2.teacher_id = t.id_teacher)";

export interface SelectionField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Выражение для WHERE/HAVING. Только из этого файла. */
  expr: string;
  /** Выражение для SELECT (обычно MAX от expr, запрос группируется по учителю). */
  select: string;
  joins: JoinKey[];
  /** true: условие уходит в HAVING (поле содержит агрегат). */
  aggregate?: boolean;
  /** Список допустимых операторов; по умолчанию берутся из OPERATORS_BY_KIND. */
  operators?: string[];
  columnable?: boolean;
  sortable?: boolean;
  /** Источник вариантов для enum. */
  optionsSql?: string;
}

export const OPERATORS_BY_KIND: Record<FieldKind, string[]> = {
  text: ["contains", "starts_with", "eq", "empty", "not_empty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte"],
  date: ["is_null", "not_null", "before", "after", "older_than_days"],
  enum: ["eq", "neq"],
  bool: ["eq"],
};

export const OPERATOR_LABELS: Record<string, string> = {
  eq: "равно",
  neq: "не равно",
  gt: "больше",
  gte: "больше или равно",
  lt: "меньше",
  lte: "меньше или равно",
  contains: "содержит",
  starts_with: "начинается с",
  is_null: "не заполнено",
  not_null: "заполнено",
  before: "раньше",
  after: "позже",
  older_than_days: "старше (дней)",
  empty: "пусто",
  not_empty: "заполнено",
};

export const TEACHER_FIELDS: SelectionField[] = [
  {
    key: "fio",
    label: "ФИО",
    kind: "text",
    expr: "CONCAT_WS(' ', t.surname, t.firstname, t.patronymic)",
    select: "MAX(CONCAT_WS(' ', t.surname, t.firstname, t.patronymic))",
    joins: [],
    sortable: true,
    columnable: true,
  },
  {
    key: "position",
    label: "Должность",
    kind: "enum",
    expr: "p.id_position",
    select: "MAX(p.title_position)",
    joins: ["position"],
    columnable: true,
    optionsSql:
      "SELECT id_position AS id, title_position AS title FROM position ORDER BY title_position",
  },
  {
    key: "category",
    label: "Квалификационная категория",
    kind: "enum",
    expr: "c.id_category",
    select: "MAX(c.title_category)",
    joins: ["category"],
    columnable: true,
    optionsSql:
      "SELECT id_category AS id, title_category AS title FROM category ORDER BY id_category",
  },
  {
    key: "education",
    label: "Образование",
    kind: "enum",
    expr: "e.id_edu_level",
    select: "MAX(e.title_edu_level)",
    joins: ["eduLevel"],
    columnable: true,
    optionsSql:
      "SELECT id_edu_level AS id, title_edu_level AS title FROM edu_level ORDER BY title_edu_level",
  },
  {
    key: "subject",
    label: "Предмет",
    kind: "enum",
    expr: `EXISTS (SELECT 1 FROM discipline_middleware dm WHERE dm.teacher_id = t.id_teacher AND dm.discipline_id = ?)`,
    select: SUBJECTS_SUBQUERY,
    joins: [],
    columnable: true,
    optionsSql:
      "SELECT id_discipline AS id, title_discipline AS title FROM discipline_title ORDER BY title_discipline",
  },
  {
    key: "teaching_experience",
    label: "Педагогический стаж, лет",
    kind: "number",
    expr: "t.teaching_experience",
    select: "MAX(t.teaching_experience)",
    joins: [],
    columnable: true,
    sortable: true,
  },
  {
    key: "age",
    label: "Возраст",
    kind: "number",
    expr: "TIMESTAMPDIFF(YEAR, t.birthday, CURDATE())",
    select: "MAX(TIMESTAMPDIFF(YEAR, t.birthday, CURDATE()))",
    joins: [],
    columnable: true,
    sortable: true,
  },
  {
    key: "email",
    label: "Email",
    kind: "text",
    expr: "t.email",
    select: "MAX(t.email)",
    joins: [],
    columnable: true,
  },
  {
    key: "last_evaluation_date",
    label: "Дата последней оценки",
    kind: "date",
    expr: "MAX(m.create_mark_date)",
    select: "MAX(m.create_mark_date)",
    joins: ["marks"],
    aggregate: true,
    columnable: true,
    sortable: true,
  },
  {
    key: "evaluations_count",
    label: "Количество оценок",
    kind: "number",
    expr: "COUNT(DISTINCT m.id_card)",
    select: "COUNT(DISTINCT m.id_card)",
    joins: ["marks"],
    aggregate: true,
    columnable: true,
    sortable: true,
  },
  {
    key: "last_training_year",
    label: "Последнее обучение, год",
    kind: "number",
    expr: TRAINING_YEAR_EXPR,
    select: TRAINING_YEAR_EXPR,
    joins: ["kpk"],
    aggregate: true,
    columnable: true,
    operators: ["is_null", "not_null", "lt", "lte", "gt", "gte"],
    sortable: true,
  },
];

export function findField(key: string): SelectionField | undefined {
  return TEACHER_FIELDS.find((field) => field.key === key);
}

export interface FilterCondition {
  field: string;
  op: string;
  value?: string | number | boolean | null;
  /** Для «меньше/больше»: включать учителей, у которых значение не заполнено. */
  orNull?: boolean;
}

export class SelectionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export interface CompiledFilters {
  joins: JoinKey[];
  where: string[];
  having: string[];
  /** Параметры в порядке появления в SQL: сначала WHERE, затем HAVING. */
  params: unknown[];
}

function renderCondition(
  field: SelectionField,
  condition: FilterCondition,
): { sql: string; params: unknown[] } {
  const { expr } = field;
  const value = condition.value;

  switch (condition.op) {
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (value === undefined || value === null || value === "") {
        throw new SelectionError(`Не задано значение для поля «${field.label}»`);
      }
      const sqlOp =
        condition.op === "eq"
          ? "="
          : condition.op === "neq"
            ? "<>"
            : condition.op === "gt"
              ? ">"
              : condition.op === "gte"
                ? ">="
                : condition.op === "lt"
                  ? "<"
                  : "<=";
      const params: unknown[] = [value];
      let sql = `${expr} ${sqlOp} ?`;
      if (condition.orNull) {
        sql = `(${sql} OR ${expr} IS NULL)`;
      }
      return { sql, params };
    }
    case "contains":
    case "starts_with": {
      if (!value) {
        throw new SelectionError(`Не задано значение для поля «${field.label}»`);
      }
      const pattern = condition.op === "contains" ? `%${value}%` : `${value}%`;
      return { sql: `${expr} LIKE ?`, params: [pattern] };
    }
    case "before":
    case "after": {
      if (!value) {
        throw new SelectionError(`Не задана дата для поля «${field.label}»`);
      }
      return {
        sql: `${expr} ${condition.op === "before" ? "<" : ">"} ?`,
        params: [value],
      };
    }
    case "older_than_days": {
      const days = Number(value);
      if (!Number.isFinite(days) || days <= 0) {
        throw new SelectionError(`Некорректный срок для поля «${field.label}»`);
      }
      return {
        sql: `${expr} < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        params: [Math.round(days)],
      };
    }
    case "is_null":
      return { sql: `${expr} IS NULL`, params: [] };
    case "not_null":
      return { sql: `${expr} IS NOT NULL`, params: [] };
    case "empty":
      return { sql: `(${expr} IS NULL OR ${expr} = '')`, params: [] };
    case "not_empty":
      return { sql: `(${expr} IS NOT NULL AND ${expr} <> '')`, params: [] };
    default:
      throw new SelectionError(`Неизвестное условие: ${condition.op}`);
  }
}

function renderWherePart(
  field: SelectionField,
  condition: FilterCondition,
): { sql: string; params: unknown[] } {
  // EXISTS-поля уже содержат подстановку значения внутри выражения.
  if (field.expr.includes("?")) {
    const value = condition.value;
    if (condition.op !== "eq") {
      throw new SelectionError(`Для поля «${field.label}» доступно только «равно»`);
    }
    if (value === undefined || value === null || value === "") {
      throw new SelectionError(`Не задано значение для поля «${field.label}»`);
    }
    return { sql: field.expr, params: [value] };
  }

  return renderCondition(field, condition);
}

export function compileFilters(
  conditions: FilterCondition[] = [],
): CompiledFilters {
  if (conditions.length > 10) {
    throw new SelectionError("Слишком много условий: максимум 10");
  }

  const joins = new Set<JoinKey>();
  const where: string[] = [];
  const having: string[] = [];
  const whereParams: unknown[] = [];
  const havingParams: unknown[] = [];

  for (const condition of conditions) {
    const field = findField(condition.field);
    if (!field) {
      throw new SelectionError(`Неизвестное поле: ${condition.field}`);
    }
    const allowed = field.operators ?? OPERATORS_BY_KIND[field.kind];
    if (!allowed.includes(condition.op)) {
      throw new SelectionError(
        `Условие «${condition.op}» неприменимо к полю «${field.label}»`,
      );
    }
    for (const join of field.joins) {
      joins.add(join);
    }

    const rendered = renderWherePart(field, condition);
    if (field.aggregate) {
      having.push(rendered.sql);
      havingParams.push(...rendered.params);
    } else {
      where.push(rendered.sql);
      whereParams.push(...rendered.params);
    }
  }

  return {
    joins: [...joins],
    where,
    having,
    params: [...whereParams, ...havingParams],
  };
}

export function fieldsForClient() {
  return TEACHER_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    kind: field.kind,
    operators: field.operators ?? OPERATORS_BY_KIND[field.kind],
    columnable: Boolean(field.columnable),
    sortable: Boolean(field.sortable),
    optionsSql: field.optionsSql ?? null,
  }));
}
