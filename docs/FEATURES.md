# Реестр фич Tallam v2

Каталог: **одна запись на фичу**. Здесь ищут контекст перед доработкой: что фича делает, где живёт, как проверить и чего она не делает.

Правила ведения — в [`CONVENTIONS.md`](CONVENTIONS.md). Общая картина проекта — в [`PROJECT.md`](../PROJECT.md). Инфраструктура — в [`ARCHITECTURE.md`](ARCHITECTURE.md).

**Формат записи** (копировать целиком):

```markdown
### Название фичи
`✅` · введено `<commit>` (<дата>, <инструмент>)

- **Что:** смысл и поведение, без пересказа кода.
- **Где:** страницы, сервисы, эндпоинты, таблицы.
- **Проверка:** конкретные шаги.
- **Ограничения:** чего фича не делает (если важно).
```

Статусы: `✅` готово · `🚧` в работе · `📋` план. Изменения после ввода — строкой `- **История:** <commit> — что изменилось`.

Коммит в шапке записи — **первый коммит, где эта область появилась**. У фич, которые с тех пор переделывались, он относится к ранней версии; актуальное поведение описано в полях «Что» и «Где». Пути к файлам — от корня репозитория.

**Инструмент:** все записи ниже введены в Cursor. Граница перехода на DeepSeek Harness — коммит `02a0581` (09.10.2026); записи после него помечаются `DeepSeek Harness`.

---

## 1. Каркас и локальный стенд

### 1.1 Монорепозиторий и сборка
`✅` · введено `f5d6b91` (01.07.2026, Cursor)

- **Что:** npm workspaces. `frontend` — React 19 + Vite + TypeScript, `backend` — Express + TypeScript. Сборка фронта в `frontend/dist`, API в `backend/dist`.
- **Где:** `package.json`, `frontend/`, `backend/`, команды `npm run dev` и `npm run build`.
- **Проверка:** `npm install && npm run build` — без ошибок TypeScript и Vite.

### 1.2 Локальный стенд
`✅` · введено `f5d6b91` (01.07.2026, Cursor)

- **Что:** MySQL 8 в Docker на хосте `:3307` и Mailpit (`:1025` SMTP, `:8025` веб-интерфейс). Импорт реального дампа, seed тестовой школы.
- **Где:** `docker-compose.yml`, `database/import-dump.sh`, `database/init/02-seed-local.sql`, `.env` (из `.env.example`).
- **Проверка:** `docker compose up -d` → `npm run dev` → `curl localhost:4000/api/health` → вход `test@test.ru` / `123456` (школа 483, «МБОУ Тестовая школа»).
- **Ограничения:** дампы SQL и `.env` в git не кладём.

### 1.3 Прод-архитектура и бэкапы
`✅` · введено `dba28c1` (18.09.2026, Cursor)

- **Что:** описание прода, схема восстановления на новом сервере и три независимые копии данных (GitHub, `/var/backups/tallam/` на VPS, офсайт-копия на ноутбуке).
- **Где:** `docs/ARCHITECTURE.md`, `scripts/backup-database.sh`, `scripts/fetch-prod-backup.sh`, `npm run backup:fetch`.
- **Проверка:** `npm run backup:fetch` → новый `backups/offsite/tallam-offsite-*.tar.gz` с `database.sql.gz`, `production.env`, `school-passwords.log`.
- **Ограничения:** каталог `backups/` в `.gitignore`; доступ на VPS — по SSH-ключу.

---

## 2. Авторизация и доступ

### 2.1 Вход и сессии
`✅` · введено `f5d6b91` (01.07.2026, Cursor)

- **Что:** вход школы и методиста по email и паролю. Сессия в MySQL, cookie `smad`. Роль берётся из `users.role`; администратор после входа попадает на `/admin/cabinet`. Школа входит только через вкладку «Школа».
- **Где:** `backend/src/routes/auth.routes.ts`, `backend/src/services/auth.service.ts`, `backend/src/middleware/auth.ts`, таблица `sessions`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/context/AuthContext.tsx`, `POST /api/auth/login`, `GET /api/auth/me`.
- **Проверка:** вход `test@test.ru` / `123456` → кабинет школы; вход администратора → `/admin/cabinet`.

### 2.2 Смена пароля школой
`✅` · введено `c966a2e` (09.09.2026, Cursor)

- **Что:** школа меняет пароль из кабинета, зная текущий.
- **Где:** `frontend/src/components/SchoolPasswordForm.tsx`, `POST /api/school/password`.
- **Проверка:** кабинет школы → смена пароля → повторный вход с новым паролем.
- **История:** `6aa99b5` — после смены пароля текущая сессия не рвётся.

### 2.3 «Забыли пароль» и обращения о восстановлении
`✅` · введено `c31de9b` (17.09.2026, Cursor)

- **Что:** школа, потерявшая доступ, оставляет **обращение** — не письмо. Форма `/auth/forgot` с капчей и honeypot-полем; обращение попадает администратору в `/admin/recovery`, тот закрывает его вручную.
- **Где:** `frontend/src/pages/ForgotPasswordPage.tsx`, `frontend/src/pages/admin/AdminRecoveryPage.tsx`, `backend/src/services/password-recovery.service.ts`, `backend/src/controllers/password-reset.controller.ts`, `POST /api/auth/forgot-password`, `GET /api/auth/recovery-captcha`, `GET /api/admin/recovery`, `POST /api/admin/recovery/:requestId/done`, таблица `password_recovery_requests` (`database/init/11-password-recovery-requests.sql`).
- **Проверка:** `/auth/forgot` → отправить обращение → войти админом → `/admin/recovery` → «обработано».

### 2.4 Одноразовая ссылка смены пароля от администратора
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** администратор выдаёт школе ссылку `/auth/reset/:token`, действующую 60 минут. Пароль хранится только как bcrypt-хеш.
- **Где:** `frontend/src/pages/ResetPasswordPage.tsx`, `backend/src/services/password-reset.service.ts`, `POST /api/admin/subscriptions/:schoolId/password-reset-link`, `GET|POST /api/auth/reset-password/:token`, таблица `password_reset_tokens`.
- **Проверка:** админ → карточка школы → создать ссылку → открыть её в приватном окне → задать новый пароль.

### 2.5 Ограниченный вход при неоплаченной подписке
`✅` · введено `4195ccd` (21.09.2026, Cursor)

- **Что:** при истёкшей или ещё не начавшейся подписке школа входит, но сразу попадает на `/school/subscription`; остальной кабинет закрыт, сессия не сбрасывается. Принудительная блокировка администратором тоже пускает только на страницу оплаты.
- **Где:** `backend/src/services/school-access.service.ts`, `backend/src/middleware/auth.ts` (`requireActiveSchoolCabinet`), `frontend/src/components/SchoolCabinetLayout.tsx`.
- **Проверка:** заблокировать школу в админке → войти школой → редирект на `/school/subscription`, другие разделы недоступны.

### 2.6 Выход и обработка 401
`✅` · введено `c966a2e` (09.09.2026, Cursor)

- **Что:** выход очищает сессию; при любом ответе API `401` фронт чистит пользователя и уводит на `/auth`.
- **Где:** `frontend/src/api/client.ts` (`setUnauthorizedHandler`), `POST /api/auth/logout`.
- **Проверка:** удалить cookie `smad` в браузере → следующее действие уводит на `/auth`.

### 2.7 Вход администратора под учётной записью школы
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** администратор открывает кабинет школы от её имени, чтобы помочь. В интерфейсе видно, что это вход администратора, и есть возврат к своей учётной записи.
- **Где:** `POST /api/admin/schools/:schoolId/impersonate`, `POST /api/auth/stop-impersonation`, `frontend/src/context/AuthContext.tsx`, `frontend/src/components/SchoolPasswordForm.tsx`.
- **Проверка:** админ → карточка школы → «войти как школа» → виден баннер имперсонации → возврат.

---

## 3. Кабинет школы

### 3.1 Каркас кабинета и главная
`✅` · введено `c966a2e` (09.09.2026, Cursor)

- **Что:** горизонтальные вкладки вместо сайдбара: Главная / База работников / Проект «Анализ урока» / Вакансии / Отзывы и пожелания / Подписка. На главной — имя школы, число работников, оценки за текущий год и по годам (последние 3 года, от текущего вниз).
- **Где:** `frontend/src/components/SchoolCabinetLayout.tsx`, `frontend/src/pages/school/SchoolHomePage.tsx`, `GET /api/school/dashboard`, `GET /api/school/profile`.
- **Проверка:** вход школой → главная показывает «МБОУ Тестовая школа», 16 работников, оценки по годам.

### 3.2 База работников
`✅` · введено `c966a2e` (09.09.2026, Cursor)

- **Что:** таблица работников школы с пагинацией 20/50/100 и экспортом в Excel. Псевдопроект `id = 1` («Не участвует в проекте») скрыт, «Вне проекта» показывается компактным текстом. NUMERIC-поля (СНИЛС и подобные) хранятся только цифрами.
- **Где:** `frontend/src/pages/school/WorkersPage.tsx`, `frontend/src/components/TeachersTable.tsx`, `frontend/src/components/TeacherFormModal.tsx`, `backend/src/services/teachers.service.ts`, `GET|POST /api/school/workers`, `GET /api/school/workers/export`, `GET /api/school/workers/form-options`.
- **Проверка:** «База работников» → пагинация, экспорт, добавление учителя через модалку.
- **История:** `0688c9f`, `a9a144a` — цифры вместо форматированных значений; `9b039a3`, `0912901` — новые учителя по умолчанию попадают в «Анализ урока».

### 3.3 Карточка работника
`✅` · введено `c966a2e` (09.09.2026, Cursor)

- **Что:** кадровый профиль работника: просмотр и правка. Ссылки «(добавить в проект)» / «(исключить)» — текстом, без крупных дублирующих кнопок.
- **Где:** `frontend/src/pages/school/TeacherProfilePage.tsx`, `GET|PUT /api/school/workers/:teacherId`, `POST|DELETE /api/school/workers/:teacherId/projects/:projectId`.
- **Проверка:** открыть работника из списка → изменить поле → добавить и исключить из проекта.

### 3.4 Гид по кабинету
`✅` · введено `c31de9b` (17.09.2026, Cursor)

- **Что:** пошаговая инструкция для школы из четырёх шагов: добавить учителей → включить в проект → провести анализ → работать с результатом. Со ссылками на разделы.
- **Где:** `frontend/src/pages/school/SchoolGuidePage.tsx`, роут `/school/guide`.
- **Проверка:** открыть `/school/guide`, пройти по ссылкам шагов.

### 3.5 Новости кабинета
`✅` · введено `7f1923b` (20.09.2026, Cursor)

- **Что:** блок анонсов в кабинете школы: что появилось и что планируется. Отдельно — дисклеймер, что за содержание оценочных карт отвечает ГБУ ДПО «ИРО ЧР».
- **Где:** `frontend/src/data/cabinetNews.ts`, `frontend/src/pages/school/SchoolHomePage.tsx`.
- **Проверка:** главная кабинета → блок новостей с тегами «новое» / «в работе» / «план».
- **История:** `7d05e4d` — анонс собственных карт анализа школы.

### 3.6 Отзывы и пожелания
`✅` · введено `c31de9b` (17.09.2026, Cursor)

- **Что:** переписка школы с администрацией платформы, плюс виджет поддержки и контакты поддержки внутри кабинета (не на странице входа).
- **Где:** `frontend/src/pages/school/SchoolFeedbackPage.tsx`, `frontend/src/components/SupportChat.tsx`, `frontend/src/components/SupportContacts.tsx`, `backend/src/services/school-feedback.service.ts`, `GET|POST /api/school/feedback`, `GET /api/school/feedback/unread`, таблицы `school_feedback`, `school_support_messages`.
- **Проверка:** написать в «Отзывы и пожелания» → ответить из админки → сообщение видно школе.

### 3.7 Удаление работника
`✅` · введено этим коммитом (09.10.2026, DeepSeek Harness)

- **Что:** на карточке работника есть кнопка «Удалить». Перед удалением показывается, что именно пропадёт: сколько оценок урока, комментариев и участий в проектах. Если терять есть что, удаление требует отдельной галочки подтверждения. Работник удаляется насовсем — следов в базе не остаётся.
- **Где:** `frontend/src/components/DeleteTeacherModal.tsx`, `frontend/src/pages/school/TeacherProfilePage.tsx`, `backend/src/services/teacher-delete.service.ts`, `backend/src/controllers/teacher-delete.controller.ts`, `GET /api/school/workers/:teacherId/deletion-preview`, `DELETE /api/school/workers/:teacherId`. Затрагивает `teachers`, `teachers_old`, `card_from_project_teacher_mark3`, `card_from_project_teacher_mark2`, `evaluation_comments`, `outside_card`, `outside_card2`, `methodist_static`, `evaluation_email_sends`, таблицы связки из `project_middleware_names`, `discipline_middleware`, `training_kpk`. Новое действие журнала — `teacher.delete`.
- **Проверка:** карточка работника → «Удалить» → в модалке счётчики → галочка → «Удалить навсегда» → возврат к списку без работника. В `/admin/logs`, категория «Работники», появляется «Удаление работника» с числами.
- **Ограничения:**
  - удаление необратимо и уменьшает счётчики оценок на главной странице школы;
  - затрагивается только база v2 (`tallam_v2`): `old.tallam.ru` работает со своей базой на Beget и не меняется;
  - таблица `cards` не чистится: в унаследованной схеме у неё `teacher_id int` (легаси-нумерация, не UUID), сравнение со строкой превратилось бы в `teacher_id = 0`. Таблица пуста и в проде, и локально; полная очистка школы по-прежнему чистит её по `school_id`;
  - `id_card` пересекается между `card_from_project_teacher_mark2` и `card_from_project_teacher_mark3` (локально 2568 совпадений), поэтому зависимые строки удаляются только через JOIN с картой конкретного работника, а не по списку идентификаторов;
  - работник удаляется только из своей школы: чужой идентификатор отдаёт 404.

---

## 4. Проект «Анализ урока»

### 4.1 Список участников и состав проекта
`✅` · введено `c966a2e` (09.09.2026, Cursor)

- **Что:** список участников проекта и отдельная страница состава с двумя списками «в проекте» / «вне проекта». Профиль в проекте отличается от кадровой карточки.
- **Где:** `frontend/src/pages/school/LessonAnalysisPage.tsx`, `frontend/src/pages/school/LessonAnalysisMembersPage.tsx`, `frontend/src/pages/school/ProjectTeacherPage.tsx`, `GET /api/school/projects/lesson-analysis`, `GET /api/school/projects/lesson-analysis/teachers/:teacherId`.
- **Проверка:** «Проект "Анализ урока"» → состав → добавить и исключить учителя.
- **История:** `645da60` — повторный заход не отдаёт пустой кэшированный ответ.

### 4.2 Форма оценки урока
`✅` · введено `c966a2e` (09.09.2026, Cursor)

- **Что:** выбор карты (`method` — методическая, `full` — комплексная) и заполнение критериев в табличном стиле v1: синие шапки, подсекции компетенций, select «Выбрать», иконка **?** с подсказкой у каждого пункта. Оценки пишутся в `card_from_project_teacher_mark3` и `outside_card2` (внешний эксперт).
- **Где:** `frontend/src/pages/school/EvaluateChoosePage.tsx`, `frontend/src/pages/school/EvaluateFormPage.tsx`, `frontend/src/styles/evaluate.css`, `frontend/src/data/evaluationCriteria.ts` (`CRITERION_HINTS`), `backend/src/services/card.service.ts`, `POST /api/school/projects/lesson-analysis/teachers/:teacherId/cards`.
- **Проверка:** профиль учителя в проекте → «Оценить» → выбрать карту → заполнить → сохранить.
- **Ограничения:** ключи баллов — `k_2_1`…`k_2_22` для методической и плюс `k_1_*`, `k_3_*`, `k_4_*` для комплексной. Опциональные пункты (`*`) могут иметь value `-1` («0») и `0` («—»), как в v1.
- **История:** `47d1af1` — идентичность оценивающего показывается только для внешней оценки или при комментарии, неверные даты урока отклоняются; `9d0d19a` — форма пригодна на телефоне.

### 4.3 Просмотр сохранённой оценки
`✅` · введено `c31de9b` (17.09.2026, Cursor)

- **Что:** клик по строке открывает полную карту: печать, скачивание методических рекомендаций в PDF, комментарий оценивающего, удаление оценки.
- **Где:** `frontend/src/pages/school/EvaluationViewPage.tsx`, `backend/src/services/card-view.service.ts`, `GET .../cards/:cardId`, `GET .../cards/:cardId/recommendations`, `PATCH .../cards/:cardId/comment`, `DELETE .../cards/:cardId`.
- **Проверка:** список оценок → клик по строке → печать, рекомендации, комментарий, удаление.

### 4.4 Отправка оценки учителю на почту
`✅` · введено `050b2f6` (23.09.2026, Cursor)

- **Что:** готовую оценку можно отправить учителю письмом (краткий итог и рекомендации). Если SMTP не настроен, письмо сохраняется локально в `backend/data/outbox` и открывается из приложения.
- **Где:** `backend/src/services/email.service.ts`, `backend/src/services/local-outbox.service.ts`, `backend/src/services/card-view.service.ts`, `POST .../cards/:cardId/email`, таблица `evaluation_email_sends`.
- **Проверка:** открыть оценку → отправить на почту → письмо в Mailpit (`http://localhost:8025`).
- **История:** `b403d77` — защита от повторов: та же оценка на тот же адрес раз в 24 ч, пауза 20 с внутри школы, 40/час и 120/сутки на школу, 200/час и 800/сутки глобально; `61eb653` — понятное сообщение об успешной отправке.

---

## 5. Вакансии

### 5.1 Вакансии школы
`✅` · введено `d77e01b` (03.10.2026, Cursor)

- **Что:** школа публикует вакансии от своего имени и видит вакансии других школ. Черновики чужих школ скрыты, редактировать и закрывать можно только свои. Статусы `DRAFT` / `ACTIVE` / `CLOSED`; опубликованную вакансию нельзя вернуть в черновик, только закрыть. Вакансии видны только пользователям системы.
- **Где:** `frontend/src/pages/school/VacanciesPage.tsx`, `frontend/src/pages/school/VacancyFormPage.tsx`, `frontend/src/pages/school/VacancyViewPage.tsx`, `backend/src/services/vacancy.service.ts`, `backend/src/controllers/vacancy.controller.ts`, `GET|POST /api/school/vacancies`, `GET|PUT /api/school/vacancies/:vacancyId`, `POST /api/school/vacancies/:vacancyId/close`, `GET /api/school/vacancies/meta`, таблица `vacancies`.
- **Проверка:** «Вакансии» → создать → опубликовать → видна во вкладке «Вакансии других школ» под другой школой → закрыть.
- **Ограничения:** отклики учителей не делаются (см. планы).

### 5.2 Вакансии в админке
`✅` · введено `f18c334` (03.10.2026, Cursor)

- **Что:** общий список всех вакансий платформы, включая черновики. Только просмотр.
- **Где:** `frontend/src/pages/admin/AdminVacanciesPage.tsx`, `GET /api/admin/vacancies`.
- **Проверка:** админка → «Вакансии» → в списке есть черновики и опубликованные.

---

## 6. Подписка и оплата

### 6.1 Подписка школы: сроки и статусы
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** годовые периоды доступа в `school_subscriptions` с историей. Школа видит статус срока; администратор — активные, истекающие за 30 дней и истёкшие. Школы без импортированных сроков показываются как «Нет данных» и не блокируются автоматически.
- **Где:** `frontend/src/pages/school/SchoolSubscriptionPage.tsx`, `frontend/src/pages/admin/AdminSubscriptionsPage.tsx`, `backend/src/services/school-subscription.service.ts`, `GET /api/school/subscription`, `GET /api/admin/subscriptions`, `GET /api/admin/subscriptions/export`, `database/init/05-school-subscriptions.sql`.
- **Проверка:** кабинет школы → «Подписка»; админка → «Подписки» с поиском, фильтрами по статусу и району, экспортом.

### 6.2 Оформление продления школой
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** заявка на продление на физическое лицо: паспортные данные и ИНН сохраняются только в зашифрованном виде (AES-256-GCM). После отправки школе доступны черновики документов, QR-код и реквизиты. Годовой доступ — 10 000 ₽.
- **Где:** `frontend/src/components/SchoolRenewalPanel.tsx`, `backend/src/services/subscription-renewal.service.ts`, `GET|POST /api/school/subscription/renewal`, `GET /api/school/subscription/renewal/:requestId/contract`, таблицы `subscription_renewal_requests`, `subscription_document_sequences`, `database/init/07-subscription-renewal-requests.sql`.
- **Проверка:** «Подписка» → заполнить форму продления → получить черновики документов.
- **Ограничения:** без `SUBSCRIPTION_DATA_ENCRYPTION_KEY` старые заявки не расшифровываются; менять ключ на живой базе нельзя.

### 6.3 Договор и акт
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** PDF договора с актом приёма-передачи. Черновик использует номер заявки `З-<id>`; финальные связанные номера вида `Д-2026-09-0001` и `С-2026-09-0001` присваиваются только при подтверждении оплаты — год и месяц подтверждения плюс единый сквозной номер, который не сбрасывается каждый месяц.
- **Где:** `backend/src/services/subscription-documents.service.ts`, `backend/src/services/billing-details.ts` (реквизиты ГБУ ДПО «ИРО ЧР»).
- **Проверка:** скачать черновик из кабинета школы → в номере `З-<id>`; после подтверждения оплаты — финальные номера.
- **История:** `9d7e788` — резервирование номеров; `3a2f9b2`, `3dfcb31` — выравнивание PDF и разбивка подпунктов; `5bdb33d` — убран лишний счёт, остался договор с актом.

### 6.4 Реквизиты, QR и инструкция по оплате
`✅` · введено `c891afb` (19.09.2026, Cursor)

- **Что:** QR-код в официальном формате платёжки, название школы в назначении платежа и пошаговая инструкция для Сбербанк Онлайн; пояснение про КБК.
- **Где:** `frontend/src/pages/school/SchoolSubscriptionPage.tsx`, `frontend/src/styles/school-subscription.css`.
- **Проверка:** «Подписка» → блок оплаты → QR между шагами инструкции, в назначении платежа есть название школы.
- **История:** `182293d`, `2e0201f`, `983b68c`, `690ef3b` — доработки текста и расположения.

### 6.5 Проверка оплаты школой
`✅` · введено `5c9f358` (21.09.2026, Cursor)

- **Что:** школа может отметить, что оплатила; действие попадает в журнал. Рядом — контакт для отправки чека.
- **Где:** `POST /api/school/subscription/payment-check`, `subscription.payment_check` в `audit_logs`.
- **Проверка:** «Подписка» → отметить оплату → запись в `/admin/logs` категории «Подписка».

### 6.6 Очередь продлений и подтверждение оплаты
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** администратор видит очередь заявок, скачивает черновики и подтверждает оплату. Подтверждение атомарно резервирует следующий глобальный номер, формирует финальные документы и добавляет годовой период — после действующей подписки либо с даты подтверждения, если срок истёк.
- **Где:** `frontend/src/pages/admin/AdminRenewalsPage.tsx`, `GET /api/admin/renewals`, `GET /api/admin/renewals/:requestId`, `GET /api/admin/renewals/:requestId/contract`, `POST /api/admin/renewals/:requestId/pay`.
- **Проверка:** админка → «Продления» → открыть заявку → подтвердить оплату → у школы появился период и финальные номера.
- **Ограничения:** банковского webhook нет, оплата подтверждается вручную. `dc05407` — заявки пронумерованы в списке.

---

## 7. Кабинет администратора

### 7.1 Дашборд
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** школы, активные и отключённые кабинеты, учителя, оценки за текущий год и всего, методисты, проекты. Последние 5 школ и диаграмма состояния кабинетов, сводка подписок.
- **Где:** `frontend/src/pages/admin/AdminDashboardPage.tsx`, `GET /api/admin/dashboard`, `frontend/src/styles/admin.css`.
- **Проверка:** вход администратором → `/admin/cabinet`.

### 7.2 Школы: список, создание, карточка
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** список школ и карточка школы с профилем, статусом кабинета, текущей подпиской и историей периодов, проектами и оценками за 3 года. Создание новой школы администратором.
- **Где:** `frontend/src/pages/admin/AdminSchoolsPage.tsx`, `frontend/src/pages/admin/AdminCreateSchoolPage.tsx`, `frontend/src/pages/admin/AdminSchoolDetailPage.tsx`, `GET|POST /api/admin/schools`, `GET /api/admin/schools/:schoolId`, `GET /api/admin/schools/areas`, `GET /api/admin/schools/email-availability`, `backend/src/services/school-register.service.ts`.
- **Проверка:** админка → «Школы» → создать школу → открыть карточку.
- **История:** `c31de9b` — регистрация школы; `18.09.2026` (`c7086d8`) — новые и существующие школы автоматически привязываются к проекту «Анализ урока».

### 7.3 Подписки: периоды, блокировка, активация
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** ручное добавление и изменение периодов подписки, принудительная блокировка и активация кабинета на выбранный срок. Блокировка полностью запрещает вход, истечение срока — только закрывает кабинет.
- **Где:** `POST /api/admin/subscriptions/:schoolId/periods`, `PATCH /api/admin/subscriptions/:schoolId/periods/:periodId`, `POST /api/admin/subscriptions/:schoolId/block`, `POST /api/admin/subscriptions/:schoolId/activate`.
- **Проверка:** карточка школы → добавить период → изменить → заблокировать → проверить вход школы.
- **История:** `7268df9` — фильтр «заблокированные, нужна оплата».

### 7.4 Инструменты администратора по школе
`✅` · введено `987c33b` (22.09.2026, Cursor)

- **Что:** переименование школы, полная очистка работников и оценок школы, выгрузка дампа всей базы прямо в браузер потоком. Все три действия пишутся в журнал.
- **Где:** `backend/src/services/school-purge.service.ts`, `backend/src/services/database-backup.service.ts`, `PATCH /api/admin/schools/:schoolId`, `POST /api/admin/schools/:schoolId/purge-workers`, `GET /api/admin/backup`.
- **Проверка:** карточка школы → переименовать; `GET /api/admin/backup` под администратором скачивает `.sql.gz`.
- **Ограничения:** очистка необратима — только для ошибочно заведённых школ.
- **История:** этим коммитом закрыто осиротение журнала рассылки — `evaluation_email_sends` школы удаляется вместе с её картами (раньше оставались строки, ссылающиеся на несуществующие карты).

### 7.5 Отзывы школ
`✅` · введено `c31de9b` (17.09.2026, Cursor)

- **Что:** список переписок с школами, счётчик непрочитанных, ответ от администрации.
- **Где:** `frontend/src/pages/admin/AdminFeedbackPage.tsx`, `frontend/src/pages/admin/AdminFeedbackThreadPage.tsx`, `GET /api/admin/feedback`, `GET /api/admin/feedback/:schoolId`, `POST /api/admin/feedback/:schoolId`, `GET /api/admin/feedback/unread-count`.
- **Проверка:** школа пишет отзыв → админка показывает счётчик → ответ виден школе.

### 7.6 Обращения о восстановлении доступа
`✅` · введено `c31de9b` (17.09.2026, Cursor)

- **Что:** очередь обращений школ, потерявших доступ, со счётчиком новых и отметкой «обработано».
- **Где:** `frontend/src/pages/admin/AdminRecoveryPage.tsx`, `GET /api/admin/recovery`, `GET /api/admin/recovery/unread-count`, `POST /api/admin/recovery/:requestId/done`.
- **Проверка:** отправить обращение с `/auth/forgot` → `/admin/recovery` → закрыть.

### 7.7 Учёт посещений кабинета
`✅` · введено `c1ea72c` (04.10.2026, Cursor)

- **Что:** визит школы считается один раз в день. На дашборде — за сегодня, неделю и месяц, самые активные школы и районы, список школ онлайн.
- **Где:** `backend/src/services/school-visits.service.ts`, `GET /api/school/presence`, `GET /api/admin/visits`, `GET /api/admin/online-schools`, таблица `school_presence_days`.
- **Проверка:** войти школой (счётчик растёт один раз в сутки) → `/admin/cabinet` → блок посещаемости.
- **Ограничения:** тестовые школы (`test@test.ru` и подобные) исключены из статистики.

### 7.8 Журнал действий
`✅` · введено `6fd9cd9` (14.09.2026, Cursor)

- **Что:** журнал `audit_logs` с фильтрами по типу действия, email, успешности и периоду, пагинация 20/50/100. Категории: Авторизация, Бухгалтер, Пароли, Подписка, Работники, Анализ урока, Кабинет школы, Система.
- **Где:** `backend/src/services/audit-log.service.ts`, `backend/src/controllers/audit-log.controller.ts`, `frontend/src/pages/admin/AdminLogsPage.tsx`, `GET /api/admin/logs`, `GET /api/admin/logs/options`, `database/init/08-audit-logs.sql`.
- **Проверка:** совершить действие школой → найти его в `/admin/logs`.
- **Ограничения:** пароли, токены, паспортные данные, ИНН и адреса в журнал не пишутся.

---

## 8. Кабинет бухгалтера

### 8.1 Приватная страница бухгалтера
`✅` · введено `dc05407` (26.09.2026, Cursor)

- **Что:** отдельная страница `/status` со своим входом (логин и пароль из `ACCOUNTANT_LOGIN` / `ACCOUNTANT_PASSWORD`, роль `accountant`). Список оплаченных продлений с фильтром по районам, поиском школы, скачиванием договора и акта и архивом договоров.
- **Где:** `frontend/src/pages/AccountantStatusPage.tsx`, `frontend/src/styles/status.css`, `backend/src/routes/accountant.routes.ts` (монтируется на `/api/status`), `backend/src/services/accountant.service.ts`, `POST /api/status/login`, `GET /api/status/renewals`, `GET /api/status/renewals/:requestId/contract`, `GET /api/status/renewals/archive`, `GET /api/status/areas`.
- **Проверка:** `/status` → вход бухгалтером → список оплат, скачивание документов, архив.
- **Ограничения:** в продакшене обе переменные обязательны; локальные значения по умолчанию — `durdieva67@mail.ru` / `888888`. Доступ к остальным разделам платформы у роли `accountant` отсутствует.
- **История:** `417fc3d` — сессия бухгалтера не теряется, поиск школы очищается после выхода.

### 8.2 Расчёты: несколько оплат в один договор
`✅` · введено `cf08cd1` (07.10.2026, Cursor)

- **Что:** бухгалтер группирует несколько оплаченных школ в один договор-расчёт. Администратор видит эти расчёты только на чтение.
- **Где:** `backend/src/services/contract-settlement.service.ts`, `backend/src/controllers/settlement.controller.ts`, `GET /api/admin/settlements`, `GET /api/admin/settlements/:settlementId`, `POST /api/status/settlements`, `frontend/src/pages/admin/AdminSettlementsPage.tsx`, таблицы `contract_settlements`, `contract_settlement_items`, `database/init/13-contract-settlements.sql`.
- **Проверка:** `/status` → выбрать несколько оплаченных школ → создать расчёт → увидеть его в `/admin/settlements`.
- **Ограничения:** заявки на продление не меняются — связь только по `renewal_request_id`, одна заявка входит максимум в один расчёт.
- **История:** `270732d` — фиксированные колонки таблицы и короткие кнопки скачивания.

---

## 9. Документация и процесс

### 9.1 Журнал проекта
`✅` · введено `02a0581` (09.10.2026, DeepSeek Harness)

- **Что:** `PROJECT.md` приведён в соответствие с кодом. Добавлен раздел «Журнал разработки» с границей: до `270732d` — Cursor, дальше — DeepSeek Harness.
- **Где:** `PROJECT.md`.
- **Проверка:** сверить перечисленные разделы кабинета с `frontend/src/App.tsx`.

### 9.2 Регламент и реестр фич
`✅` · введено этим коммитом (09.10.2026, DeepSeek Harness)

- **Что:** договорённость документировать каждую фичу и не трогать лишнее зафиксирована письменно.
- **Где:** `docs/CONVENTIONS.md` (правила), `docs/FEATURES.md` (этот реестр), `AGENTS.md` (короткий указатель для агентов).
- **Проверка:** следующая фича получает запись по шаблону из начала этого файла.

---

## В работе и планы

### 10.1 Собственные карты анализа школы
`📋` · анонсировано в новостях кабинета (`7d05e4d`)

- **Что:** школа сможет создавать свои карты анализа для оценивания своих учителей.
- **Где:** пока только анонс в `frontend/src/data/cabinetNews.ts`.
- **Ограничения:** сейчас доступны только две встроенные карты — методическая и комплексная.

### 10.2 Разделы админки «Проекты» и «Методисты»
`📋` · заглушки с `6fd9cd9`

- **Что:** пункты навигации выключены (`enabled: false`), страниц нет.
- **Где:** `frontend/src/components/AdminCabinetShell.tsx`.

### 10.3 Кабинет методиста
`📋` · заглушка с `6fd9cd9`

- **Что:** `/methodist/cabinet` распознаёт роль `methodist`, но содержимого нет.
- **Где:** `frontend/src/pages/MethodistCabinetPage.tsx`.

### 10.4 Отклики учителей на вакансии
`📋` · ожидается после `d77e01b`

- **Что:** отклик учителя на вакансию отдельной сущностью со ссылкой на `vacancies.id`.
- **Ограничения:** сейчас вакансия — только объявление.

### 10.5 Банковский webhook для оплаты
`📋`

- **Что:** автоматическое подтверждение оплаты вместо ручного.
- **Ограничения:** сейчас оплата подтверждается администратором вручную в `/admin/renewals`.
