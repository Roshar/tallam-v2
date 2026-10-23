export type SelectionFieldKind = "text" | "number" | "date" | "enum" | "bool";

export interface SelectionField {
  key: string;
  label: string;
  kind: SelectionFieldKind;
  operators: string[];
  columnable: boolean;
  sortable: boolean;
  optionsSql: string | null;
}

export interface SelectionMeta {
  fields: SelectionField[];
  options: Record<string, Array<{ id: number; title: string }>>;
}

export type SelectionValue = string | number | boolean | null;

export interface SelectionFilter {
  field: string;
  op: string;
  value?: SelectionValue;
  orNull?: boolean;
}

export interface SelectionRow {
  id: string;
  fio: string;
  surname: string;
  firstname: string;
  patronymic: string | null;
  position: string | null;
  category: string | null;
  education: string | null;
  subjects: string | null;
  teachingExperience: number | null;
  age: number | null;
  email: string | null;
  lastEvaluationDate: string | null;
  evaluationsCount: number;
  lastTrainingYear: number | null;
  trainingYearUnreliable: boolean;
}

export interface SelectionWarning {
  code: string;
  message: string;
  affected: number;
}

export interface SelectionPreview {
  total: number;
  rows: SelectionRow[];
  warnings: SelectionWarning[];
  columns: string[];
}

export interface SelectionPreset {
  key: string;
  title: string;
  description: string;
  count: number;
}

export interface SavedSelection {
  id: number;
  title: string;
  entity: string;
  filters: SelectionFilter[];
  columns: string[];
  createdAt: string;
  updatedAt: string;
}

export const SELECTION_COLUMN_LABELS: Record<string, string> = {
  fio: "ФИО",
  position: "Должность",
  category: "Категория",
  education: "Образование",
  subject: "Предметы",
  teaching_experience: "Пед. стаж",
  age: "Возраст",
  email: "Email",
  last_evaluation_date: "Последняя оценка",
  evaluations_count: "Оценок",
  last_training_year: "Обучение, год",
};

export const SELECTION_OPERATOR_LABELS: Record<string, string> = {
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
  older_than_days: "старше, дней",
  empty: "пусто",
  not_empty: "заполнено",
};

export function formatSelectionCell(
  row: SelectionRow,
  key: string,
): string | number {
  switch (key) {
    case "fio":
      return row.fio;
    case "position":
      return row.position ?? "н/д";
    case "category":
      return row.category ?? "н/д";
    case "education":
      return row.education ?? "н/д";
    case "subject":
      return row.subjects ?? "н/д";
    case "teaching_experience":
      return row.teachingExperience ?? "н/д";
    case "age":
      return row.age ?? "н/д";
    case "email":
      return row.email ?? "н/д";
    case "last_evaluation_date":
      return row.lastEvaluationDate
        ? row.lastEvaluationDate.split("-").reverse().join(".")
        : "н/д";
    case "evaluations_count":
      return row.evaluationsCount;
    case "last_training_year":
      return row.lastTrainingYear ?? "н/д";
    default:
      return "н/д";
  }
}

export function isSelectionOpWithoutValue(op: string): boolean {
  return op === "is_null" || op === "not_null" || op === "empty" || op === "not_empty";
}
