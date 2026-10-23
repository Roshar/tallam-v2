# E1 и E4: как реализовать

**Дата:** 22.10.2026
**Статус:** проектное предложение. Не код, но всё проверено на локальной копии базы.
**Основание:** [`2026-10-22-school-process-automation.md`](2026-10-22-school-process-automation.md), разделы 3 (движки) и 4 (первые шаги).

Все числа ниже получены на локальной копии продакшен-дампа: 13 497 учителей, 481 школа, 53 931 карта, 13 350 записей об обучении. Текстовые поля дампа местами с битой кодировкой — числа корректны.

---

## Часть I. E1. Конструктор выборок + экспорт

### 1.1. Что это с точки зрения пользователя

Три экрана, а не один:

1. **Конструктор** — набор условий из выпадающих списков. Никакого SQL, никаких текстовых выражений.
2. **Предпросмотр** — сколько учителей попало, первые 50 строк, каких данных не хватает.
3. **Сохранённые выборки** — список, запуск в один клик, экспорт в Excel.

Ключевое решение: **поле фильтра выбирается из справочника, а не вводится руками.** Это одновременно и UX, и единственная защита от инъекций.

### 1.2. Модель данных

Одна новая таблица. Этого достаточно.

```sql
CREATE TABLE IF NOT EXISTS `saved_selections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `school_id` int NOT NULL,
  `title` varchar(150) NOT NULL,
  `entity` varchar(40) NOT NULL DEFAULT 'teacher',
  `filters` json NOT NULL,
  `columns` json NOT NULL,
  `created_by` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Почему `json`, а не таблица `saved_selection_conditions`:

- условия никогда не участвуют в запросах к БД — они читаются целиком и компилируются в SQL;
- схема условий будет меняться чаще, чем всё остальное;
- одна таблица = ноль миграций при добавлении нового оператора.

Почему `entity`: сегодня только `teacher`, завтра — `vacancy`, `mentorship`. Поле есть, но обрабатывается только `teacher`; остальные возвращают 400.

### 1.3. Реестр полей

Отдельный файл `backend/src/services/selection-fields.ts` — **белый список**. Клиент присылает только `key`; SQL берётся из реестра.

```ts
export type FieldKind = "text" | "number" | "date" | "enum" | "bool";

export interface SelectionField {
  key: string;                 // что присылает фронт
  label: string;               // что видит пользователь
  kind: FieldKind;
  /** SQL-выражение. Только из этого файла, никогда из запроса. */
  expr: string;
  /** Нужен ли join с таблицей-справочником. */
  joins?: string[];
  /** Для enum — источник вариантов. */
  optionsSql?: string;
  operators?: string[];
  sortable?: boolean;
  columnable?: boolean;
}
```

Пример наполнения — реальные поля, которые есть в базе:

```ts
export const TEACHER_FIELDS: SelectionField[] = [
  { key: "fio", label: "ФИО", kind: "text",
    expr: "CONCAT_WS(' ', t.surname, t.firstname, t.patronymic)",
    operators: ["contains", "starts_with"], sortable: true, columnable: true },

  { key: "position", label: "Должность", kind: "enum",
    expr: "p.title_position", joins: ["position"],
    optionsSql: "SELECT id_position AS id, title_position AS title FROM position ORDER BY title_position",
    columnable: true },

  { key: "category", label: "Квалификационная категория", kind: "enum",
    expr: "c.title_category", joins: ["category"],
    optionsSql: "SELECT id_category AS id, title_category AS title FROM category ORDER BY id_category",
    columnable: true },

  { key: "teaching_experience", label: "Педагогический стаж, лет", kind: "number",
    expr: "t.teaching_experience", operators: ["eq", "gt", "gte", "lt", "lte"], columnable: true },

  { key: "age", label: "Возраст", kind: "number",
    expr: "TIMESTAMPDIFF(YEAR, t.birthday, CURDATE())",
    operators: ["eq", "gt", "gte", "lt", "lte"], columnable: true },

  { key: "last_evaluation_date", label: "Дата последней оценки", kind: "date",
    expr: "MAX(m.create_mark_date)", joins: ["marks"],
    operators: ["is_null", "not_null", "before", "after", "older_than_days"] },

  { key: "evaluations_count", label: "Количество оценок", kind: "number",
    expr: "COUNT(DISTINCT m.id_card)", joins: ["marks"], operators: ["eq", "gte", "lte"] },

  { key: "last_training_year", label: "Последнее обучение, год", kind: "number",
    expr: "MAX(CAST(k.year_training AS UNSIGNED))", joins: ["kpk"],
    operators: ["is_null", "lt", "lte"] },

  { key: "subject", label: "Предмет", kind: "enum", expr: "d.title_discipline",
    joins: ["disciplines"], optionsSql: "SELECT id_discipline_title AS id, title_discipline AS title FROM discipline_title ORDER BY title_discipline" },
];
```

Три поля здесь — вычисляемые (`age`, `last_evaluation_date`, `last_training_year`). Именно они делают конструктор полезным: без них школа и так умеет фильтровать Excel.

### 1.4. Компилятор фильтров

```ts
export interface FilterCondition {
  field: string;
  op: string;
  value?: string | number | null;
}

export function compileFilters(conditions: FilterCondition[]): { where: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  for (const c of conditions) {
    const def = TEACHER_FIELDS.find((f) => f.key === c.field);
    if (!def) throw new SelectionError(`Неизвестное поле: ${c.field}`, 400);
    if (!(def.operators ?? DEFAULT_OPS[def.kind]).includes(c.op)) {
      throw new SelectionError(`Оператор ${c.op} неприменим к полю ${c.field}`, 400);
    }
    // expr берётся из реестра — пользовательский ввод в SQL не попадает
    parts.push(renderCondition(def.expr, c.op, params, c.value));
  }

  return { where: parts.length ? `AND ${parts.join(" AND ")}` : "", params };
}
```

Правила, без которых это опасно:

1. `expr` — только из реестра. Ни одна строка от клиента не конкатенируется в SQL.
2. Значения — только параметрами (`?`).
3. `IN`-список — плейсхолдеры по количеству элементов, не `join` строк.
4. Лимит: не более 10 условий и не более 20 колонок на выборку.
5. `ORDER BY` — только из `sortable`-полей реестра.

### 1.5. Форма SQL-запроса: главное инженерное решение

Наивный вариант — подзапросы к картам на каждого учителя. Я его замерил: **301 мс** на школе из 18 учителей (три подзапроса, ~17 мс на учителя; для школы с 95 учителями — около 1,6 с).

Причина: у `card_from_project_teacher_mark3` нет индекса по `teacher_id` (в базе только `UNIQUE(id_card)`), поэтому каждый подзапрос — полный скан 53 931 строки.

Вариант через JOIN и группировку — **56 мс**, в 5,4 раза быстрее, потому что таблица сканируется один раз:

```sql
SELECT
  t.id_teacher,
  CONCAT_WS(' ', t.surname, t.firstname, t.patronymic) AS fio,
  p.title_position,
  c.title_category,
  t.teaching_experience,
  TIMESTAMPDIFF(YEAR, t.birthday, CURDATE()) AS age,
  MAX(m.create_mark_date)  AS last_evaluation_date,
  COUNT(DISTINCT m.id_card) AS evaluations_count,
  MAX(CAST(k.year_training AS UNSIGNED)) AS last_training_year
FROM teachers t
LEFT JOIN position p  ON p.id_position = t.position
LEFT JOIN category c  ON c.id_category = t.category_id
LEFT JOIN card_from_project_teacher_mark3 m ON m.teacher_id = t.id_teacher
LEFT JOIN training_kpk k ON k.teacher_id = t.id_teacher
WHERE t.school_id = ?          -- всегда из сессии
  /* здесь условия пользователя */
GROUP BY t.id_teacher
HAVING 1 = 1                   /* здесь условия по агрегатам */
ORDER BY t.surname, t.firstname
LIMIT 51;
```

Два подводных камня, которые ломают наивную реализацию:

**Первый: условия по агрегатам нельзя писать в `WHERE`.** `WHERE MAX(m.create_mark_date) < ?` — ошибка. Поэтому компилятор делит условия на две группы:
- поля без агрегата → `WHERE`;
- поля с агрегатом (`last_evaluation_date`, `evaluations_count`, `last_training_year`) → `HAVING`.

Функция `compileFilters` возвращает не одну строку, а структуру:

```ts
interface CompiledFilters {
  where: string;   // для WHERE
  having: string;  // для HAVING
  params: unknown[];
}
```

**Второй: агрегаты дублируются из-за декартова произведения.** Если у учителя 79 карт (реально есть такой) и 2 записи об обучении, JOIN даст 158 строк. Поэтому `COUNT(DISTINCT m.id_card)`, а не `COUNT(*)`. Это надо зафиксировать комментарием в коде, иначе следующий разработчик «оптимизирует».

### 1.6. Что обязательно проверить перед релизом

| Риск | Факт из базы | Решение |
|---|---|---|
| Мусор в годе обучения | Корректный 4-значный год только в **5 355 из 13 350** записей (40 %). Остальное — `01.02.2021?.-13.02.2021?`, `24.03.2023 ?? 31.03.2023`, `?? ????????(?)` | `last_training_year` считать только по валидным значениям + отдельный флаг «данные о обучении ненадёжны» в предпросмотре |
| «Без категории» — это не NULL | `category_id IS NULL` только у 4 из 13 497; категория «без категории» — это запись справочника с `id = 1` | фильтр по `category` — сравнение с `id_category`, а не `IS NULL` |
| Дубли в экспорте | В `training_kpk` сейчас максимум одна запись на учителя, поэтому существующий `buildTeachersBankExcel` не дублирует строки. Схема это не гарантирует | в новом экспорте не копировать форму запроса из `buildTeachersBankExcel`, использовать `GROUP BY` |
| Полный скан карт | 53 931 строка, индекса по `teacher_id` нет | JOIN-форма уже снимает проблему; индекс — следующий шаг (раздел 1.9) |
| Email | Отсутствует у **6 537 из 13 497 (48 %)** | конструктор не должен предлагать «Отправить всем по email» |
| Учителя без оценок | **4 263 (32 %)** | это и есть главный готовый фильтр: «не оценивались ни разу» |

### 1.7. API

Все маршруты — в `school.routes.ts`, под существующими `requireAuth, requireRole("school"), requireSchoolSession`. `school_id` берётся только из сессии — как в `getSchoolId(req)` из `analytics.controller.ts`.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/school/selections/fields` | реестр полей + варианты для enum |
| POST | `/api/school/selections/preview` | компиляция, `COUNT(*)`, первые 50 строк, предупреждения о данных |
| POST | `/api/school/selections` | сохранить выборку |
| GET | `/api/school/selections` | список сохранённых |
| GET | `/api/school/selections/:id` | одна выборка |
| DELETE | `/api/school/selections/:id` | удалить |
| POST | `/api/school/selections/:id/export` | Excel, аудит `teacher.export` |

Пример запроса:

```json
POST /api/school/selections/preview
{
  "filters": [
    { "field": "last_training_year", "op": "lt", "value": 2023 },
    { "field": "evaluations_count", "op": "gte", "value": 1 }
  ],
  "sort": { "field": "fio", "dir": "asc" }
}
```

Пример ответа:

```json
{
  "total": 41,
  "rows": [
    { "id": "b9a46773-…", "fio": "Иванова Мария Петровна", "category": "Первая",
      "teaching_experience": 12, "last_evaluation_date": "2026-04-16", "evaluations_count": 3,
      "last_training_year": 2021 }
  ],
  "warnings": [
    { "code": "kpk_year_unreliable", "message": "У 17 из 41 учителя год обучения записан в нераспознанном виде и не участвовал в фильтре" }
  ]
}
```

Предупреждения — не украшение. Без них школа получит список и будет уверена, что он полный.

### 1.8. Экспорт

Повторяем существующий шаблон один в один (см. `buildTeachersBankExcel` + `exportWorkers`):

- сервис возвращает `{ buffer, filename }`;
- контроллер ставит `Content-Type` и `Content-Disposition` с `filename*=UTF-8''`;
- ExcelJS, шапка из `columns` выборки, автоширина, даты в формате `ДД-ММ-ГГГГ`.

Ограничения: не более 10 000 строк на файл, не более 20 колонок, таймаут 15 с. Если больше — не «подождите», а честное «сузьте выборку».

### 1.9. Производительность: что дальше

JOIN-форма достаточна на текущих объёмах. Но карт становится больше примерно на 10 тыс. в год, и для ИРО-контура те же запросы будут считаться по всем 481 школе.

Предложение (требует согласования, так как это DDL на прод-схеме):

```sql
-- database/init/15-selection-indexes.sql
CREATE INDEX `idx_marks_teacher` ON `card_from_project_teacher_mark3` (`teacher_id`, `create_mark_date`);
CREATE INDEX `idx_marks_school`  ON `card_from_project_teacher_mark3` (`school_id`, `create_mark_date`);
CREATE INDEX `idx_kpk_teacher`   ON `training_kpk` (`teacher_id`);
CREATE INDEX `idx_teachers_id_teacher` ON `teachers` (`id_teacher`);
```

Индекс — аддитивная и обратимая операция, но она меняет прод-схему, поэтому только по согласованию и с замером до/после. Замер уже есть: 301 мс → 56 мс без индексов.

### 1.10. Чего в E1 не делать

- не давать поле «SQL-выражение» или «свой фильтр» — это конец безопасности;
- не делать `SELECT *` — только реестр `columnable`;
- не давать доступ к чужим школам даже глобальному админу в этом API (у админки свой контур);
- не превращать это в отчётный конструктор с группировками и сводными таблицами — это следующий продукт и он съест ресурс.

---

## Часть II. E4. «Дело учителя»

### 2.1. Где живёт и чем отличается от соседних экранов

В проекте уже есть три разных взгляда на учителя, и четвёртый нужен именно потому, что они разные:

| Экран | Маршрут | Что показывает |
|---|---|---|
| Кадровая карточка | `/school/workers/:id` | поля `teachers`, редактирование |
| Проектный профиль | `/school/lesson-analysis/teachers/:id` | оценки и фильтры проекта |
| Аналитика учителя | панель `TeacherAnalyticsPanel` | динамика по карте |
| **Дело учителя** | `/school/workers/:id/dossier` | **всё вместе, только чтение** |

Почему вложенный маршрут, а не новый верхнеуровневый: «дело» — это продолжение карточки работника, а не отдельный раздел кабинета. Так пользователь не теряет привычную навигацию, а мы не трогаем `SchoolCabinetLayout.tsx` сверх одного пункта.

Ключевой принцип: **экран только читает.** Никаких инлайн-редактирований — иначе он превратится в копию карточки и разойдётся с ней.

### 2.2. Контракт ответа

Один агрегирующий эндпоинт:

```
GET /api/school/workers/:teacherId/dossier
```

Ответ устроен так, что **каждая секция необязательна**: если данных нет — `null`, фронт рисует заглушку с пояснением, а не пустое место.

```json
{
  "identity": {
    "id": "b9a46773-…", "fullName": "Иванова Мария Петровна",
    "birthday": "1985-03-14", "age": 41,
    "position": "Учитель", "category": "Первая", "categoryId": 2,
    "levelOfEducation": "Высшее", "specialty": "Математика",
    "totalExperience": 15, "teachingExperience": 12,
    "email": null, "phone": "+7…",
    "subjects": ["Математика", "Алгебра"],
    "projectNames": ["Анализ урока"]
  },
  "dataQuality": {
    "missing": ["email", "specialty"],
    "stale": ["training"],
    "score": 78
  },
  "evaluation": {
    "lastMethod": { "cardId": 1234, "date": "2026-04-16", "percent": 82, "level": "оптимальный" },
    "lastFull":   { "cardId": 1180, "date": "2026-02-02", "percent": 74, "level": "достаточный" },
    "counts": { "method": 3, "full": 2 },
    "firstEvaluationDate": "2023-10-11"
  },
  "training": {
    "items": [{ "year": 2021, "place": "ИРО ЧР, «Современный урок»", "yearReliable": true }],
    "lastReliableYear": 2021,
    "hasUnreliableYears": false
  },
  "mentoring": null,
  "portfolio": null,
  "documents": null,
  "deadlines": [
    { "kind": "professional_development", "label": "Право на ДПО (не реже 1 раза в 3 года)",
      "dueAt": "2024-09-01", "state": "overdue", "source": "training_kpk" }
  ]
}
```

### 2.3. Откуда берётся каждая секция

| Секция | Источник | Статус |
|---|---|---|
| `identity` | `teachers`, `position`, `category`, `edu_level`, `discipline_middleware` + `discipline_title`, `middleware_project_teachers` | **есть полностью** |
| `evaluation` | `card_from_project_teacher_mark3` (+ `evaluation-scale.ts` для процента) | **есть полностью** |
| `training` | `training_kpk` | есть, но год ненадёжен в 60 % записей |
| `deadlines` | вычисляется из `training_kpk`; аттестация — нет данных | частично |
| `mentoring` | нет таблицы | заглушка |
| `portfolio` | нет таблицы | заглушка |
| `documents` | нет таблицы | заглушка |

Отсюда честная оценка: **на первом этапе полноценно работают 3 секции из 7.** Это не недостаток реализации, а состояние базы. Экран, который показывает три секции и честно объясняет отсутствие четырёх, полезнее экрана, который выглядит полным и врёт.

### 2.4. Реализация сервиса

Новый файл `backend/src/services/teacher-dossier.service.ts`. Существующие сервисы не меняются.

```ts
export async function getTeacherDossier(schoolId: number, teacherId: string) {
  // 1. Проверка принадлежности школе — обязательна и всегда первая
  const [teacher] = await query(`
    SELECT t.*, p.title_position, c.title_category, e.title_edu_level
    FROM teachers t
    LEFT JOIN position p ON p.id_position = t.position
    LEFT JOIN category c ON c.id_category = t.category_id
    LEFT JOIN edu_level e ON e.id_edu_level = t.level_of_education_id
    WHERE t.id_teacher = ? AND t.school_id = ?
    LIMIT 1`, [teacherId, schoolId]);

  if (!teacher) throw new DossierError("Работник не найден", 404);

  // 2. Остальные секции — параллельно, каждая своим запросом
  const [subjects, evaluation, training, projects] = await Promise.all([
    loadSubjects(schoolId, teacherId),
    loadEvaluationSummary(schoolId, teacherId),
    loadTraining(teacherId),
    loadProjectNames(schoolId, teacherId),
  ]);

  return { identity: …, dataQuality: buildQuality(...), evaluation, training,
           mentoring: null, portfolio: null, documents: null,
           deadlines: buildDeadlines(training) };
}
```

Три правила этого сервиса:

1. **Никакой бизнес-логики оценивания.** Проценты берутся из `evaluation-scale.ts` теми же функциями, что и в `card-view.service.ts`. Если появится нужда пересчитать — вызываем существующее, а не пишем второй расчёт.
2. **Полная аналитика не дублируется.** В секции `evaluation` — только последние карты и количества. Кнопка «Открыть аналитику» ведёт на существующую страницу с `getTeacherAnalytics`, где динамика уже посчитана правильно.
3. **Один запрос на секцию.** Не «запрос в цикле по картам» — иначе 79 карт дадут 79 запросов.

Сводка по оценкам одним запросом:

```sql
SELECT
  COUNT(*)                                            AS total,
  MIN(create_mark_date)                               AS first_date,
  MAX(create_mark_date)                               AS last_date,
  SUM(card_type = 2)                                  AS method_count,
  SUM(card_type = 1)                                  AS full_count
FROM card_from_project_teacher_mark3
WHERE teacher_id = ? AND school_id = ?;
```

Последние карты по каждому типу:

```sql
SELECT m.* FROM card_from_project_teacher_mark3 m
JOIN (
  SELECT card_type, MAX(create_mark_date) AS d
  FROM card_from_project_teacher_mark3
  WHERE teacher_id = ? AND school_id = ?
  GROUP BY card_type
) last ON last.card_type = m.card_type AND last.d = m.create_mark_date
WHERE m.teacher_id = ? AND m.school_id = ?;
```

### 2.5. Сроки: что вычисляется, а что нет

| Срок | Вычислимо сегодня | Комментарий |
|---|---|---|
| Право на ДПО (не реже 1 раза в 3 года, ст. 47 ФЗ-273) | да, из `training_kpk` | но год ненадёжен в 60 % записей |
| Аттестация на соответствие (раз в 5 лет) | **нет** | в базе нет даты предыдущей аттестации |
| Срок действия категории | **нет** | есть `category_id`, но нет даты присвоения |
| Окончание наставничества | нет | нет таблицы |

Это и есть аргумент за таблицу `attestation_cases` (N5 из записки о направлениях): без дат экран сроков остаётся наполовину декоративным.

### 2.6. Фронт

Новый файл `frontend/src/pages/school/TeacherDossierPage.tsx` + `styles/dossier.css`. Регистрация — только в `App.tsx`, как требуют конвенции.

Раскладка:

```
┌─────────────────────────────────────────────────────────┐
│ Иванова Мария Петровна          [Печать] [Карточка →]   │
│ Учитель · Первая · стаж 12 лет · Математика, Алгебра    │
├──────────────────────────────┬──────────────────────────┤
│ Оценки                       │ Сроки                    │
│  методическая  82 · 16.04.26 │  ДПО — просрочено        │
│  комплексная   74 · 02.02.26 │  аттестация — нет данных │
│  всего 5 оценок с 2023       │                          │
├──────────────────────────────┤ Полнота данных 78 %      │
│ Обучение                     │  нет email               │
│  2021 · ИРО ЧР               │  нет специальности       │
├──────────────────────────────┤                          │
│ Наставничество — нет данных  │                          │
│ Портфолио — нет данных       │                          │
└──────────────────────────────┴──────────────────────────┘
```

Компоненты: `DossierHeader`, `DossierSection`, `DossierQualityCard`, `DossierDeadlines`, `DossierEmptyState`.

Печать: готовая печать карты уже есть — переиспользуем подход (`@media print`), а не PDF-генератор на сервере.

### 2.7. Права и приватность

- только роль `school` и только своя школа (`school_id` из сессии);
- ИРО этот эндпоинт не использует вообще — у него отдельный контур без ФИО;
- `auditHttpAction({ category: "teachers", action: "teacher.dossier_view" })`, как у остальных операций с работниками;
- в ответ не попадают `snils` и паспортные данные — они не нужны на этом экране (в кадровой карточке остаются).

### 2.8. Этапы

| Этап | Что | Срок |
|---|---|---|
| 1 | `identity` + `evaluation` + `training` + `dataQuality` + заглушки | 2–3 дня |
| 2 | `deadlines` по обучению, печать, ссылки на аналитику | +1 день |
| 3 | `mentoring` (таблица `mentorships`) | после появления сущности |
| 4 | `portfolio` (`evidence_items`), `documents` | после появления сущности |
| 5 | `attestation_cases` → сроки аттестации | после N5 |

### 2.9. Частые ошибки, которых нужно избежать

1. **Открыть дело по `id_teacher` без проверки `school_id`** — типичная дыра при копировании кода из админки.
2. **Считать проценты заново «чтобы не тянуть сервис»** — появятся два расчёта, которые разойдутся.
3. **Заполнить заглушки пустыми блоками** — пользователь решит, что данных нет вообще. Нужен текст: «Наставничество пока не ведётся в системе».
4. **Сделать экран редактируемым** — он станет вторым редактором карточки.
5. **Не учитывать `NULL` в стаже и категории** — у части учителей поля пустые, шаблон должен это пережить (в выборке 3 учителя без стажа, 4 без категории — мало, но в отдельных школах бывает больше).

---

## Итог

- **E1** — одна таблица `saved_selections`, реестр полей в отдельном файле, компилятор с разделением на `WHERE` и `HAVING`, JOIN-форма запроса (замер: 56 мс против 301 мс). Главная сложность не в коде, а в грязных данных: год обучения корректен только в 40 % записей.
- **E4** — один агрегирующий эндпоинт, семь секций, из которых сегодня полностью работают три, и это надо честно показывать. Экран только читает и не дублирует аналитику.
- Оба блока не меняют существующие таблицы и не требуют ни кабинета учителя, ни новой модели компетенций.
