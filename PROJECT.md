# Tallam v2 — контекст проекта

Документ для восстановления работы, если чат в Cursor потеряется. Репозиторий: `git@github.com:Roshar/tallam-v2.git`. Старый монолит (Handlebars): `/Users/rasidbatukaev/Projects/tallam_2025_v1`.

Как устроен прод, что делать если удалят VPS, и как делать бэкап: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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

Горизонтальные вкладки: Главная / База работников / Проект «Анализ урока» / Подписка. Сайдбар убран. Ширина контейнера `--container-lg: 1280px`.

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
- При истёкшей или ещё не начавшейся подписке школа входит в систему, но сразу попадает на `/school/subscription`. Остальной кабинет закрыт, сессия не сбрасывается. Принудительная блокировка администратором по-прежнему полностью запрещает вход.
- `/school/subscription`: статус срока и форма продления на физическое лицо. Паспортные данные и ИНН сохраняются в БД только в зашифрованном виде (AES-256-GCM).
- После отправки школе доступны черновики документов, QR-код и реквизиты. В QR вместо номера договора используется уникальный номер заявки `З-<id>`. Финальные связанные номера вида `Д-2026-09-0001` и `С-2026-09-0001` присваиваются только при подтверждении оплаты: год и месяц подтверждения плюс единый сквозной номер, который не сбрасывается каждый месяц. Стоимость годового доступа — 10 000 ₽.
- API школы: `GET /api/school/subscription`, `GET|POST /api/school/subscription/renewal`, `GET /api/school/subscription/renewal/:requestId/contract|invoice`. Профиль школы и оформление доступны при ограниченном входе.
- Действия школы записываются в `audit_logs`: авторизация и выход, запрос/смена пароля, просмотры и продление подписки, скачивание документов, просмотр/создание/изменение работников, экспорт, включение в проекты, просмотр анализа урока и добавление оценки. Пароли, токены, паспортные данные, ИНН и адреса в журнал не попадают.

Кабинет методиста `/methodist/cabinet` — заглушка.

### Администратор `/admin/cabinet`

- Администратор входит через вкладку «Школа»; роль определяется из `users.role`.
- После входа роль `admin` перенаправляется на `/admin/cabinet`.
- Дашборд: школы, активные/отключённые кабинеты, учителя, оценки за текущий год и всего, методисты, проекты.
- Показываются последние 5 школ и диаграмма состояния кабинетов.
- Подписки хранятся в `school_subscriptions`: начало, окончание, контактный телефон, отмена, источник и примечание; таблица допускает историю периодов.
- На дашборде: активные подписки, истекающие за 30 дней и истёкшие.
- `/admin/subscriptions`: все школы платформы с поиском, фильтрами по статусу и району, логинами, телефонами, сроками и пагинацией. Школы без импортированных сроков показываются со статусом «Нет данных» и не блокируются автоматически.
- Клик по названию школы открывает карточку `/admin/subscriptions/:schoolId`: профиль, статус кабинета, текущая подписка, ручное добавление периода, история, проекты и оценки за 3 года.
- Excel-экспорт учитывает текущие поиск, статус и район.
- Администратор может создать одноразовую ссылку для самостоятельной смены пароля школой — из списка и со страницы школы. Ссылка действует 60 минут; пароль хранится только как bcrypt-хеш.
- По окончании подписки остальные разделы кабинета школы закрываются, но вход на страницу оплаты остаётся. Принудительная блокировка полностью запрещает вход.
- Со страницы школы можно принудительно заблокировать кабинет или активировать его на выбранный срок. В заявках на продление используются реквизиты ГБУ ДПО «ИРО ЧР» из типового счёта.
- `/admin/renewals`: очередь заявок на продление. Администратор видит данные заказчика, скачивает черновики и окончательно подтверждает оплату. Подтверждение атомарно резервирует следующий глобальный номер, формирует финальные документы и добавляет годовой период: после действующей подписки либо с даты подтверждения, если срок уже истёк.
- Данные заявок хранятся в `subscription_renewal_requests`, глобальная последовательность номеров — в `subscription_document_sequences`; ключ шифрования задаётся через `SUBSCRIPTION_DATA_ENCRYPTION_KEY`.
- `/admin/logs`: журнал действий с категориями «Авторизация», «Пароли», «Подписка», «Работники» и «Анализ урока». Фильтры: тип действия, email, успешность, период дат; пагинация 20/50/100. Подтверждение оплаты фиксируется в журнале в момент ручного подтверждения администратором — банковского webhook пока нет.
- Исходные сроки и телефоны импортированы локально из Numbers без паролей. Общий импортёр принимает безопасный JSON:
  `npm run db:import-subscriptions -- /path/to/subscriptions.json`.
- API: `GET /api/admin/dashboard`, `GET /api/admin/subscriptions`, `GET /api/admin/subscriptions/areas`, `GET /api/admin/subscriptions/export`, `GET /api/admin/subscriptions/:schoolId`, `POST /api/admin/subscriptions/:schoolId/password-reset-link`, `POST /api/admin/subscriptions/:schoolId/block`, `POST /api/admin/subscriptions/:schoolId/activate`, `POST /api/admin/subscriptions/:schoolId/periods`; доступ только роли `admin`.
- Разделы «Школы», «Проекты» и «Методисты» в новой админке пока заглушки.

## Важные файлы

| Зона | Путь |
|---|---|
| Роуты фронта | `frontend/src/App.tsx` |
| API-клиент | `frontend/src/api/client.ts` |
| School API | `backend/src/routes/school.routes.ts`, `controllers/school.controller.ts`, `services/school-subscription.service.ts` |
| Оформление продления | `backend/src/services/subscription-renewal.service.ts`, `services/subscription-documents.service.ts`, `database/init/07-subscription-renewal-requests.sql` |
| Журнал действий | `backend/src/services/audit-log.service.ts`, `controllers/audit-log.controller.ts`, `database/init/08-audit-logs.sql` |
| Карты/оценки | `backend/src/services/card.service.ts` |
| Учителя | `backend/src/services/teachers.service.ts` |
| Admin API | `backend/src/routes/admin.routes.ts`, `services/admin.service.ts`, `services/school-access.service.ts` |
| Admin UI | `frontend/src/pages/admin/AdminDashboardPage.tsx`, `AdminSubscriptionsPage.tsx`, `AdminSchoolDetailPage.tsx`, `styles/admin.css` |
| Подписка школы | `frontend/src/pages/school/SchoolSubscriptionPage.tsx`, `styles/school-subscription.css` |
| Заявки на продление | `frontend/src/pages/admin/AdminRenewalsPage.tsx` |
| Логи администратора | `frontend/src/pages/admin/AdminLogsPage.tsx` |
| Критерии | `frontend/src/data/evaluationCriteria.ts` |
| Форма оценки | `frontend/src/pages/school/EvaluateFormPage.tsx`, `styles/evaluate.css` |

## Не сделано / следующее

1. **Подсказки по баллам** — вставить тексты из v1 (`prompt` в `tallam_2025_v1/views/card_templates/school_teacher_card_add_mark_*.hbs`) в `hint` критериев; модалка уже есть.
2. **Просмотр сохранённой карты** — клик по строке оценки: полная карточка, печать, рекомендации (логика в v1 `school_card.js`).
3. Кабинет методиста и остальные разделы админки.
5. Не использовать production DB для записи при разработке.

## Соглашения UI

Русский интерфейс. Не плодить «бейджи-кружки» с количеством. Проектный профиль учителя ≠ кадровая карточка. Форма оценки — табличный стиль v1, не «карточный» редизайн.
