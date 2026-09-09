# Tallam v2 — контекст проекта

Документ для восстановления работы, если чат в Cursor потеряется. Репозиторий: `git@github.com:Roshar/tallam-v2.git`. Старый монолит (Handlebars): `/Users/rasidbatukaev/Projects/tallam_2025_v1`.

## Что это

Образовательная платформа **Tallam** (анализ урока / наблюдение за учителем). v2 — переписывание на React + Express, с той же MySQL-схемой, что и production (`govzalla_t_25`).

Стек: npm workspaces (`frontend` Vite+React+TS, `backend` Express+TS), MySQL 8 в Docker на хосте `:3307`.

## Как запустить

```bash
docker compose up -d          # MySQL :3307
npm run db:import -- <dump.sql>   # если нужна реальная база
npm run dev                   # API :4000, web :5173
```

Локальный вход школы: `test@test.ru` / `123456` (школа `school_id = 483`, «МБОУ Тестовая школа»). Seed: `database/init/02-seed-local.sql`. Дампы SQL в git не кладём (`database/dumps/*.sql`).

Переменные: скопировать `.env.example` → `.env`. SMTP для сброса пароля опционален; без него ссылка печатается в консоль API.

## Что уже сделано (кабинет школы)

Горизонтальные вкладки: Главная / База работников / Проект «Анализ урока». Сайдбар убран. Ширина контейнера `--container-lg: 1280px`.

### Главная `/school/cabinet`

- Имя школы, число работников.
- «Оценок за текущий год» — счётчик за текущий календарный год.
- Блок «Проведённые оценки по годам» — последние 3 года, **от текущего вниз**.
- API: `GET /api/school/dashboard` → `{ schoolName, teachersCount, schoolId, evaluations: { years, total } }`.
- Счёт из `card_from_project_teacher_mark3` по `YEAR(create_mark_date)`.

### База работников `/school/workers`

- Таблица, пагинация 20/50/100, Excel-экспорт.
- Добавление учителя (модалка).
- Профиль `/school/workers/:id` — просмотр/правка.
- Статус проектов: скрывать псевдопроект `id = 1` («Не участвует в проекте»). «Вне проекта» — компактный текст.
- На профиле ссылки `(добавить в проект)` / `(исключить)`, без больших дублирующих кнопок.

### Проект «Анализ урока»

- Список участников: `/school/lesson-analysis`.
- Отдельная страница состава: `/school/lesson-analysis/members` (два списка +/−).
- «Профиль в проекте» → `/school/lesson-analysis/teachers/:id` (оценки и фильтры), **не** HR-профиль.
- Оценить: `/evaluate` → выбор карты `method` | `full` → форма.
- POST ` /api/school/projects/lesson-analysis/teachers/:teacherId/cards`.
- Карты пишутся в `card_from_project_teacher_mark3` + `outside_card2` (внешний эксперт).
- Критерии: `frontend/src/data/evaluationCriteria.ts`.
- Форма стилизована как в v1: шапка «Оценить урок» + ФИО, поля урока по центру, таблица с синими шапками, подсекции компетенций, select «Выбрать», иконка **?** у каждого пункта.
- У `CriterionDef` есть поле `hint` — **тексты подсказок ещё не вставлены** (модалка-заглушка).

Ключи баллов: методическая карта — `k_2_1`…`k_2_22`; комплексная — плюс `k_1_*`, `k_3_*`, `k_4_*`. Опциональные пункты (`*`) могут иметь value `-1` для «0» и `0` для «—» — как в v1.

### Auth

- Session cookie `smad`, store в MySQL `sessions`.
- Сброс пароля: `/auth/forgot`, `/auth/reset/:token`.
- При API `401` — очистка пользователя и редирект на `/auth` (`setUnauthorizedHandler` в `frontend/src/api/client.ts`).

Кабинет методиста `/methodist/cabinet` — заглушка. Админка не перенесена.

## Важные файлы

| Зона | Путь |
|---|---|
| Роуты фронта | `frontend/src/App.tsx` |
| API-клиент | `frontend/src/api/client.ts` |
| School API | `backend/src/routes/school.routes.ts`, `controllers/school.controller.ts` |
| Карты/оценки | `backend/src/services/card.service.ts` |
| Учителя | `backend/src/services/teachers.service.ts` |
| Критерии | `frontend/src/data/evaluationCriteria.ts` |
| Форма оценки | `frontend/src/pages/school/EvaluateFormPage.tsx`, `styles/evaluate.css` |

## Не сделано / следующее

1. **Подсказки по баллам** — вставить тексты из v1 (`prompt` в `tallam_2025_v1/views/card_templates/school_teacher_card_add_mark_*.hbs`) в `hint` критериев; модалка уже есть.
2. **Просмотр сохранённой карты** — клик по строке оценки: полная карточка, печать, рекомендации (логика в v1 `school_card.js`).
3. Кабинет методиста и остальные роли.
4. Не использовать production DB для записи при разработке.

## Соглашения UI

Русский интерфейс. Не плодить «бейджи-кружки» с количеством. Проектный профиль учителя ≠ кадровая карточка. Форма оценки — табличный стиль v1, не «карточный» редизайн.
