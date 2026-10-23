import { query } from "../db/pool.js";
import {
  CARD_TYPES,
  percentOf,
  scaleFor,
  sumKeysOf,
  type CardTypeKind,
} from "./evaluation-scale.js";
import { getTeacherActiveProjectNames } from "./project.service.js";

export class DossierError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

interface TeacherRow {
  id_teacher: string;
  surname: string;
  firstname: string;
  patronymic: string | null;
  birthday: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  position: string | null;
  category: string | null;
  category_id: number | null;
  education: string | null;
  total_experience: number | null;
  teaching_experience: number | null;
}

interface CardRow extends Record<string, unknown> {
  id_card: number;
  card_type: number;
  create_mark_date: Date | string;
}

interface TrainingRow {
  year_training: string | null;
  place_training: string | null;
}

export interface DossierDeadline {
  kind: string;
  label: string;
  state: "ok" | "due_soon" | "overdue" | "unknown";
  detail: string;
  dueYear: number | null;
}

export interface DossierSection<T> {
  available: boolean;
  note?: string;
  data: T | null;
}

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function lastCardOfType(cards: CardRow[], cardType: CardTypeKind) {
  const dbType = scaleFor(cardType).dbCardType;
  const ofType = cards
    .filter((card) => Number(card.card_type) === dbType)
    .sort((a, b) => {
      const left = new Date(a.create_mark_date).getTime();
      const right = new Date(b.create_mark_date).getTime();
      return right - left;
    });

  const last = ofType[0];
  if (!last) return { last: null, count: 0 };

  const scale = scaleFor(cardType);
  return {
    last: {
      cardId: Number(last.id_card),
      date: toIsoDate(last.create_mark_date),
      dateLabel: formatDate(toIsoDate(last.create_mark_date)),
      percent: percentOf(sumKeysOf(last, scale.keys), scale.max),
      max: scale.max,
    },
    count: ofType.length,
  };
}

async function loadCards(
  schoolId: number,
  teacherId: string,
): Promise<CardRow[]> {
  const scaleKeys = [...new Set(CARD_TYPES.flatMap((t) => scaleFor(t).keys))];
  const columns = scaleKeys.map((key) => `\`${key}\``).join(", ");
  return query<CardRow[]>(
    `SELECT id_card, card_type, create_mark_date, ${columns}
     FROM card_from_project_teacher_mark3
     WHERE teacher_id = ? AND school_id = ?
     ORDER BY create_mark_date DESC, id_card DESC`,
    [teacherId, schoolId],
  );
}

export async function getTeacherDossier(schoolId: number, teacherId: string) {
  const teacherRows = await query<TeacherRow[]>(
    `SELECT t.id_teacher, t.surname, t.firstname, t.patronymic, t.birthday,
            t.email, t.phone, t.specialty, t.total_experience, t.teaching_experience,
            p.title_position AS position, c.title_category AS category,
            t.category_id, e.title_edu_level AS education
     FROM teachers t
     LEFT JOIN position p ON p.id_position = t.position
     LEFT JOIN category c ON c.id_category = t.category_id
     LEFT JOIN edu_level e ON e.id_edu_level = t.level_of_education_id
     WHERE t.id_teacher = ? AND t.school_id = ?
     LIMIT 1`,
    [teacherId, schoolId],
  );

  const teacher = teacherRows[0];
  if (!teacher) {
    throw new DossierError("Работник не найден", 404);
  }

  const [subjects, cards, training, projects] = await Promise.all([
    query<{ title_discipline: string }[]>(
      `SELECT dt.title_discipline
       FROM discipline_middleware dm
       JOIN discipline_title dt ON dt.id_discipline = dm.discipline_id
       WHERE dm.teacher_id = ?
       ORDER BY dt.title_discipline`,
      [teacherId],
    ),
    loadCards(schoolId, teacherId),
    query<TrainingRow[]>(
      `SELECT year_training, place_training FROM training_kpk
       WHERE teacher_id = ? ORDER BY year_training DESC`,
      [teacherId],
    ),
    getTeacherActiveProjectNames(teacherId).catch(() => [] as string[]),
  ]);

  const method = lastCardOfType(cards, "method");
  const full = lastCardOfType(cards, "full");

  const age = teacher.birthday
    ? Math.floor(
        (Date.now() - new Date(teacher.birthday).getTime()) / 31_557_600_000,
      )
    : null;

  const fullName = [teacher.surname, teacher.firstname, teacher.patronymic]
    .filter(Boolean)
    .join(" ");

  // Обучение: год хранится как свободный текст, доверяем только четырём цифрам.
  const trainingItems = training.map((row) => {
    const raw = (row.year_training ?? "").trim();
    const reliable = /^\d{4}$/.test(raw);
    return {
      year: reliable ? Number(raw) : null,
      rawYear: raw || null,
      place: row.place_training,
      yearReliable: reliable,
    };
  });
  const reliableYears = trainingItems
    .map((item) => item.year)
    .filter((year): year is number => year !== null);
  const lastTrainingYear = reliableYears.length ? Math.max(...reliableYears) : null;
  const hasUnreliableYears = trainingItems.some((item) => !item.yearReliable);

  const currentYear = new Date().getFullYear();
  const deadlines: DossierDeadline[] = [
    (() => {
      if (lastTrainingYear === null) {
        return {
          kind: "professional_development",
          label: "Повышение квалификации",
          state: "unknown" as const,
          detail: hasUnreliableYears
            ? "Год обучения записан неточно"
            : "В системе нет данных об обучении",
          dueYear: null,
        };
      }
      const dueYear = lastTrainingYear + 3;
      if (currentYear - lastTrainingYear > 3) {
        return {
          kind: "professional_development",
          label: "Повышение квалификации",
          state: "overdue" as const,
          detail: `Просрочено на ${currentYear - dueYear} г.`,
          dueYear,
        };
      }
      if (currentYear - lastTrainingYear === 3) {
        return {
          kind: "professional_development",
          label: "Повышение квалификации",
          state: "due_soon" as const,
          detail: "Срок подходит в этом году",
          dueYear,
        };
      }
      return {
        kind: "professional_development",
        label: "Повышение квалификации",
        state: "ok" as const,
        detail: `Действует до ${dueYear} года`,
        dueYear,
      };
    })(),
    {
      kind: "attestation",
      label: "Аттестация",
      state: "unknown",
      detail: "Дата предыдущей аттестации не хранится",
      dueYear: null,
    },
  ];

  // Полнота карточки: только то, что реально влияет на справки и документы.
  const checks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: "email", label: "не заполнен email", ok: Boolean(teacher.email) },
    {
      key: "specialty",
      label: "не указана специальность по диплому",
      ok: Boolean(teacher.specialty),
    },
    {
      key: "position",
      label: "не указана должность",
      ok: Boolean(teacher.position),
    },
    {
      key: "education",
      label: "не указано образование",
      ok: Boolean(teacher.education),
    },
    {
      key: "experience",
      label: "не указан педагогический стаж",
      ok: teacher.teaching_experience !== null,
    },
    {
      key: "subjects",
      label: "не указаны предметы",
      ok: subjects.length > 0,
    },
    {
      key: "training",
      label: "нет данных об обучении",
      ok: trainingItems.length > 0,
    },
  ];
  const missing = checks.filter((check) => !check.ok);
  const qualityScore = Math.round(
    ((checks.length - missing.length) / checks.length) * 100,
  );

  return {
    identity: {
      id: teacher.id_teacher,
      fullName,
      surname: teacher.surname,
      firstname: teacher.firstname,
      patronymic: teacher.patronymic,
      birthday: toIsoDate(teacher.birthday),
      age,
      position: teacher.position,
      category: teacher.category,
      education: teacher.education,
      specialty: teacher.specialty,
      totalExperience:
        teacher.total_experience === null
          ? null
          : Number(teacher.total_experience),
      teachingExperience:
        teacher.teaching_experience === null
          ? null
          : Number(teacher.teaching_experience),
      email: teacher.email,
      phone: teacher.phone,
      subjects: subjects.map((row) => row.title_discipline),
      projectNames: projects,
    },
    dataQuality: {
      score: qualityScore,
      missing: missing.map((check) => check.label),
    },
    evaluation: {
      method,
      full,
      total: cards.length,
      firstEvaluationDate: cards.length
        ? toIsoDate(cards[cards.length - 1].create_mark_date)
        : null,
    },
    training: {
      items: trainingItems,
      lastReliableYear: lastTrainingYear,
      hasUnreliableYears,
    },
    deadlines,
    mentoring: {
      available: false,
      data: null,
      note: "Наставничество пока не ведётся в системе",
    },
    portfolio: {
      available: false,
      data: null,
      note: "Портфолио появится позже: разработки, публикации, награды",
    },
  };
}

export type TeacherDossier = Awaited<ReturnType<typeof getTeacherDossier>>;
