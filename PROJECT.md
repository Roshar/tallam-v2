# Tallam v2 — контекст проекта

Документ для восстановления работы, если чат потеряется. Репозиторий: `git@github.com:Roshar/tallam-v2.git`. Старый монолит (Handlebars): `/Users/rasidbatukaev/Projects/tallam_2025_v1`.

Этот документ — связный рассказ о состоянии проекта. Каталог фич с путями и способами проверки — [`docs/FEATURES.md`](docs/FEATURES.md). Правила работы (обязательны) — [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md). Прод, бэкапы и восстановление — [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Журнал разработки

| Период | Инструмент |
|---|---|
| до коммита `270732d` (7 октября 2026) | Cursor |
| **начиная с `02a0581` (9 октября 2026)** | **DeepSeek Harness** |

Граница простая: всё до `270732d` («Give the accountant payment table fixed columns and shorter download buttons») писалось в Cursor. Всё, что появится в `git log` начиная с `02a0581`, — работа DeepSeek Harness. В сообщениях таких коммитов ставим трейлер `Co-authored-by: DeepSeek Harness`, чтобы граница была видна и дальше.

## Как мы работаем

Два правила, обязательные для любой доработки (подробно — в [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)):

1. **Каждая новая фича документируется.** Фича не считается сделанной, пока не добавлена запись в [`docs/FEATURES.md`](docs/FEATURES.md).
2. **Минимальное вмешательство.** Новые фичи делаются новыми файлами; существующие трогаем только в точках регистрации (роуты, навигация, API-клиент). Существующие эндпоинты и схема БД меняются только аддитивно.

## Что это

Образовательная платформа **Tallam** (анализ урока / наблюдение за учителем). v2 — переписывание на React + Express, с той же MySQL-схемой, что и production (`govzalla_t_25`).

Стек: npm workspaces (`frontend` Vite+React+TS, `backend` Express+TS), MySQL 8 в Docker на хосте `:3307`.

## Как запустить

```bash
docker compose up -d          # MySQL :3307 + Mailpit :1025/:8025
npm run db:import -- <dump.sql>   # если нужна реальная база
npm run dev                   # API :4000, web :5173
```

Локальный вход школы: `test@test.ru` / `123456` (школа `school_id = 483`, «МБОУ Тестовая школа»). Seed: `database/init/02-seed-local.sql`. Дампы SQL в git не кладём (`database/dumps/*.sql`).

Переменные: скопировать `.env.example` → `.env`. SMTP для писем опционален: локально письма уходят в Mailpit (UI на `SMTP_PREVIEW_URL`, по умолчанию `http://localhost:8025`), а если Mailpit не поднят — складываются в `backend/data/outbox`.

Локальная проверка сборки перед пушем: `npm run build` (backend `tsc`, затем frontend `vite build`).

## Что уже сделано

### Кабинет школы

Горизонтальные вкладки (`SchoolCabinetLayout.tsx`): Главная / База работников / Проект «Анализ урока» / Вакансии / Отзывы и пожелания / Подписка. Сайдбар убран. Ширина контейнера `--container-lg: 1280px`.

**Главная `/school/cabinet`**

- Имя школы, число работников.
- «Оценок за текущий год» — счётчик за текущий календарный год.
- Блок «Проведённые оценки по годам» — последние 3 года, **от текущего вниз**.
- Новости кабинета (`frontend/src/data/cabinetNews.ts`) — анонсы новых возможностей.
- API: `GET /api/school/dashboard` → `{ schoolName, teachersCount, schoolId, evaluations: { years, total } }`.
- Счёт из `card_from_project_teacher_mark3` по `YEAR(create_mark_date)`.

**Гид `/school/guide`** — пошаговая инструкция для школы: добавить учителей → включить их в проект → выбрать карту и провести анализ → работать с результатом. Со ссылками на нужные разделы.

**База работников `/school/workers`**

- Таблица, пагинация 20/50/100, Excel-экспорт.
- Добавление учителя (модалка).
- Профиль `/school/workers/:id` — просмотр/правка.
- Удаление работника с профиля: необратимо, вместе с оценками, комментариями и участием в проектах. Перед подтверждением показывается, что именно пропадёт. Подробности — [`docs/FEATURES.md`](docs/FEATURES.md), раздел 3.7.
- Статус проектов: скрывать псевдопроект `id = 1` («Не участвует в проекте»). «Вне проекта» — компактный текст.
- На профиле ссылки `(добавить в проект)` / `(исключить)`, без больших дублирующих кнопок.

### Проект «Анализ урока»

- Список участников: `/school/lesson-analysis`.
- Отдельная страница состава: `/school/lesson-analysis/members` (два списка +/−).
- «Профиль в проекте» → `/school/lesson-analysis/teachers/:id` (оценки и фильтры), **не** HR-профиль.
- Оценить: `/school/lesson-analysis/teachers/:id/evaluate` → выбор карты `method` | `full` → форма.
- POST `/api/school/projects/lesson-analysis/teachers/:teacherId/cards`.
- Карты пишутся в `card_from_project_teacher_mark3` + `outside_card2` (внешний эксперт).
- Критерии: `frontend/src/data/evaluationCriteria.ts`; подсказки — `CRITERION_HINTS` (заполнены, 71 критерий).
- Форма стилизована как в v1: шапка «Оценить урок» + ФИО, поля урока по центру, таблица с синими шапками, подсекции компетенций, select «Выбрать», иконка **?** у каждого пункта.

Ключи баллов: методическая карта — `k_2_1`…`k_2_22`; комплексная — плюс `k_1_*`, `k_3_*`, `k_4_*`. Опциональные пункты (`*`) могут иметь value `-1` для «0» и `0` для «—» — как в v1.

**Просмотр сохранённой оценки** `/school/lesson-analysis/teachers/:teacherId/cards/:cardId`

- Полная карточка по клику на строку: печать карты, скачивание методических рекомендаций (PDF), комментарий оценивающего, удаление.
- Отправка оценки учителю на почту. Логика лимитов в `card-view.service.ts`: одна и та же оценка на тот же адрес — раз в 24 ч, пауза 20 с внутри школы, 40 писем/час и 120/сутки на школу, 200/час и 800/сутки глобально. Учёт отправок — таблица `evaluation_email_sends`.
- Идентичность оценивающего показывается только для внешней оценки или когда есть комментарий.

### Вакансии `/school/vacancies`

- Раздел кабинета школы. Школа создаёт вакансии только от своего имени и видит вакансии других школ. Черновики чужих школ скрыты. Редактировать и закрывать можно только свои.
- Вкладки: «Вакансии школы» и «Вакансии других школ».
- Обязательные поля: должность (справочник `position`), один или несколько предметов (справочник `discipline_title`), описание. Школа подставляется из сессии.
- Дополнительные условия необязательны: зарплата, нагрузка, ставки, классы, смена, занятость, совместительство, срок, классное руководство, стаж, образование, контакты, срок публикации.
- Статусы: `DRAFT`, `ACTIVE`, `CLOSED`. Опубликованную вакансию нельзя вернуть в черновик, её закрывают.
- Таблица `vacancies` создаётся при старте API (`ensureVacancySchema`). Предметы хранятся списком в `subjects` (JSON) и строкой для карточки в `subject`.
- Отклики учителей пока не делаются. Позже отдельная сущность может ссылаться на `vacancies.id`.

### Отзывы и пожелания `/school/feedback`

- Переписка школы с администрацией платформы (`school_feedback`, `school_support_messages`), плюс виджет поддержки `SupportChat` и контакты поддержки.
- У администратора `/admin/feedback` со счётчиком непрочитанных и тредами `/admin/feedback/:schoolId`.

### Подписка и вход

- Session cookie `smad`, store в MySQL `sessions`.
- Забытый пароль: форма `/auth/forgot` не отправляет письмо, а создаёт **обращение** о восстановлении доступа (с капчей) — оно попадает администратору в `/admin/recovery`. Смену пароля школа выполняет по одноразовой ссылке `/auth/reset/:token`, которую администратор выдаёт из карточки школы; ссылка действует 60 минут.
- При API `401` — очистка пользователя и редирект на `/auth` (`setUnauthorizedHandler` в `frontend/src/api/client.ts`).
- При истёкшей или ещё не начавшейся подписке школа входит в систему, но сразу попадает на `/school/subscription`. Остальной кабинет закрыт, сессия не сбрасывается. Принудительная блокировка администратором тоже пускает на страницу оплаты, но остальное закрыто; полный запрет входа — отдельный признак.
- `/school/subscription`: статус срока и форма продления на физическое лицо. Паспортные данные и ИНН сохраняются в БД только в зашифрованном виде (AES-256-GCM).
- После отправки школе доступны черновики документов, QR-код и реквизиты. В QR вместо номера договора используется уникальный номер заявки `З-<id>`. Финальные связанные номера вида `Д-2026-09-0001` и `С-2026-09-0001` присваиваются только при подтверждении оплаты: год и месяц подтверждения плюс единый сквозной номер, который не сбрасывается каждый месяц. Стоимость годового доступа — 10 000 ₽.
- Школа может отметить «я оплатила» — проверка оплаты фиксируется в журнале (`cabinet.subscription_payment_check`).
- API школы: `GET /api/school/subscription`, `GET|POST /api/school/subscription/renewal`, `GET /api/school/subscription/renewal/:requestId/contract`, `POST /api/school/subscription/payment-check`. Профиль школы и оформление доступны при ограниченном входе.

### Администратор `/admin/cabinet`

- Администратор входит через вкладку «Школа»; роль определяется из `users.role`.
- После входа роль `admin` перенаправляется на `/admin/cabinet`.
- Разделы (`AdminCabinetShell.tsx`): Главная / Школы / Подписки / Продления / Расчёты / Отзывы / Вакансии / Обращения / Логи. «Проекты» и «Методисты» — пока выключены (заглушки).

**Главная.** Школы, активные/отключённые кабинеты, учителя, оценки за текущий год и всего, методисты, проекты. Последние 5 школ и диаграмма состояния кабинетов. Активные подписки, истекающие за 30 дней и истёкшие. Посещаемость: счётчик визитов кабинета (школа считается один раз в день, таблица `school_presence_days`) — за сегодня, неделю и месяц, самые активные школы и районы, список школ онлайн (`/api/admin/visits`, `/api/admin/online-schools`).

**Школы `/admin/schools`.** Список и карточка школы `/admin/schools/:schoolId`. Создание школы `/admin/schools/new`. Инструменты администратора: переименование школы, очистка работников и оценок школы (`school-purge.service.ts`), вход под учётной записью школы (impersonate), выгрузка полного дампа базы прямо в браузер потоком (`database-backup.service.ts`), ссылка на смену пароля.

**Подписки `/admin/subscriptions`.** Все школы платформы с поиском, фильтрами по статусу и району, логинами, телефонами, сроками и пагинацией. Школы без импортированных сроков показываются как «Нет данных» и не блокируются автоматически. Карточка `/admin/subscriptions/:schoolId`: профиль, статус кабинета, текущая подписка, ручное добавление/изменение периода, история, проекты и оценки за 3 года, принудительная блокировка и активация. Excel-экспорт учитывает текущие поиск, статус и район. Подписки хранятся в `school_subscriptions`.

**Продления `/admin/renewals`.** Очередь заявок. Администратор видит данные заказчика, скачивает черновики и подтверждает оплату. Подтверждение атомарно резервирует следующий глобальный номер, формирует финальные документы и добавляет годовой период: после действующей подписки либо с даты подтверждения, если срок истёк. Данные заявок — `subscription_renewal_requests`, последовательность номеров — `subscription_document_sequences`, ключ шифрования — `SUBSCRIPTION_DATA_ENCRYPTION_KEY`. Реквизиты — ГБУ ДПО «ИРО ЧР». Банковского webhook нет: оплата подтверждается вручную.

**Расчёты `/admin/settlements`.** Просмотр того, как бухгалтер сгруппировал оплаченные продления в один договор-расчёт (`contract_settlements`, `contract_settlement_items`). Только чтение.

**Обращения `/admin/recovery`.** Заявки школ на восстановление доступа (школа потеряла пароль и почту) с капчей; таблица `password_recovery_requests`. Администратор обрабатывает и закрывает заявку.

**Вакансии `/admin/vacancies`.** Общий список всех вакансий, включая черновики. Только просмотр.

**Логи `/admin/logs`.** Журнал действий с категориями «Авторизация», «Бухгалтер», «Пароли», «Подписка», «Работники», «Анализ урока», «Кабинет школы», «Система». Фильтры: тип действия, email, успешность, период дат; пагинация 20/50/100.

- API администратора под `/api/admin`, доступ только роли `admin`.

### Бухгалтер `/status`

- Отдельная страница бухгалтера (`AccountantStatusPage.tsx`), вход по логину и паролю из `ACCOUNTANT_LOGIN` / `ACCOUNTANT_PASSWORD`, роль `accountant`. В продакшене обе переменные обязательны; локальные значения по умолчанию — `durdieva67@mail.ru` / `888888`.
- API смонтирован на `/api/status` (`accountant.routes.ts`): список оплаченных продлений по районам, скачивание договора и акта по заявке, архив договоров (до 200), создание расчёта — группировка нескольких оплаченных школ в один договор (`contract-settlement.service.ts`).
- Таблица расчёта: `database/init/13-contract-settlements.sql`.

### Журнал действий

- `audit_logs`: вход и выход (в том числе вход бухгалтера и вход администратора под учётной записью школы), запрос и смена пароля, просмотры и продление подписки, скачивание документов, просмотр/создание/изменение работников, экспорт, включение в проекты, просмотр анализа урока, добавление и отправка оценки, просмотр и изменение комментария, просмотр списка и карточки вакансий, создание/изменение/закрытие вакансии, переименование школы, очистка работников, действия бухгалтера.
- Пароли, токены, паспортные данные, ИНН и адреса в журнал не попадают.

### Что ещё в коде

- Кабинет методиста `/methodist/cabinet` — заглушка (роль `methodist` уже распознаётся).
- Исходные сроки и телефоны подписок импортированы локально из Numbers без паролей. Импортёр принимает безопасный JSON: `npm run db:import-subscriptions -- /path/to/subscriptions.json`.
- Новые таблицы v2 поднимаются при старте API (`ensure*Schema`) и лежат в `database/init/`.

## Важные файлы

| Зона | Путь |
|---|---|
| Роуты фронта | `frontend/src/App.tsx` |
| API-клиент | `frontend/src/api/client.ts` |
| Оболочки кабинетов | `frontend/src/components/SchoolCabinetLayout.tsx`, `AdminCabinetShell.tsx` |
| School API | `backend/src/routes/school.routes.ts`, `controllers/school.controller.ts`, `services/school.service.ts` |
| Подписка школы | `frontend/src/pages/school/SchoolSubscriptionPage.tsx`, `styles/school-subscription.css`, `backend/src/services/school-subscription.service.ts` |
| Оформление продления | `backend/src/services/subscription-renewal.service.ts`, `services/subscription-documents.service.ts`, `database/init/07-subscription-renewal-requests.sql` |
| Расчёты бухгалтера | `backend/src/services/contract-settlement.service.ts`, `controllers/settlement.controller.ts`, `frontend/src/pages/admin/AdminSettlementsPage.tsx`, `database/init/13-contract-settlements.sql` |
| Кабинет бухгалтера | `backend/src/routes/accountant.routes.ts`, `services/accountant.service.ts`, `frontend/src/pages/AccountantStatusPage.tsx`, `styles/status.css` |
| Журнал действий | `backend/src/services/audit-log.service.ts`, `controllers/audit-log.controller.ts`, `database/init/08-audit-logs.sql` |
| Карты/оценки | `backend/src/services/card.service.ts`, `services/card-view.service.ts` |
| Учителя | `backend/src/services/teachers.service.ts` |
| Admin API | `backend/src/routes/admin.routes.ts`, `services/admin.service.ts`, `services/school-access.service.ts` |
| Admin UI | `frontend/src/pages/admin/*`, `styles/admin.css` |
| Посещаемость | `backend/src/services/school-visits.service.ts` |
| Отзывы и поддержка | `backend/src/services/school-feedback.service.ts`, `frontend/src/components/SupportChat.tsx` |
| Обращения о доступе | `backend/src/services/password-recovery.service.ts`, `frontend/src/pages/admin/AdminRecoveryPage.tsx` |
| Инструменты школы | `backend/src/services/school-purge.service.ts`, `services/database-backup.service.ts` |
| Критерии | `frontend/src/data/evaluationCriteria.ts` |
| Форма и просмотр оценки | `frontend/src/pages/school/EvaluateFormPage.tsx`, `EvaluationViewPage.tsx`, `styles/evaluate.css` |
| Новости кабинета | `frontend/src/data/cabinetNews.ts` |
| Вакансии | `backend/src/services/vacancy.service.ts`, `controllers/vacancy.controller.ts`, `frontend/src/pages/school/VacanciesPage.tsx`, `VacancyFormPage.tsx`, `VacancyViewPage.tsx` |

## Не сделано / следующее

Развёрнутый список с деталями — в [`docs/FEATURES.md`](docs/FEATURES.md), раздел «В работе и планы». Коротко:

1. **Разделы админки «Проекты» и «Методисты»** — выключены в навигации, страниц нет.
2. **Кабинет методиста** — заглушка.
3. **Собственные карты анализа школы** — анонсировано в новостях кабинета, не реализовано.
4. **Отклики учителей на вакансии** — не делаются.
5. **Банковский webhook** — оплата подтверждается только вручную администратором.
6. Не использовать production DB для записи при разработке.

## Соглашения UI

Русский интерфейс. Не плодить «бейджи-кружки» с количеством. Проектный профиль учителя ≠ кадровая карточка. Форма оценки — табличный стиль v1, не «карточный» редизайн.
