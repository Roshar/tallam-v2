-- Личный кабинет учителя: аккаунты учителей.
--
-- Почему отдельная таблица, а не строка в `users`:
--   * `users.school_id` объявлен NOT NULL UNIQUE, и вход школы ищет ровно одну
--     запись по `WHERE school_id = ? AND role = 'school_admin'`. Несколько
--     учителей одной школы в этой таблице сломали бы вход школе.
--   * `users.role` — ENUM, рассчитанный на аккаунт школы.
--   * В проекте уже есть образец такого разделения: методисты живут в своей
--     таблице `methodists`, а не в `users`.
--
-- Карточка учителя (`teachers`) при этом не меняется: ФИО, школа, предметы,
-- телефон остаются там и не дублируются. Здесь только то, что относится к
-- аккаунту: логин, пароль и связь с карточкой.
--
-- Задел на будущее (пока не реализовано, добавляется отдельной миграцией,
-- когда появится потребитель): подтверждение аккаунта, QR/ссылка активации,
-- настройки, профессиональный профиль, платные операции.

CREATE TABLE IF NOT EXISTS `teacher_accounts` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_teacher` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(200) NOT NULL,
  `status` enum('on','off','') NOT NULL DEFAULT 'on',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teacher_accounts_email` (`email`),
  UNIQUE KEY `uq_teacher_accounts_teacher` (`id_teacher`),
  KEY `idx_teacher_accounts_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Внешний ключ на `teachers(id_teacher)` намеренно не ставим: в унаследованной
-- схеме у `id_teacher` нет индекса, а MySQL требует индекс у целевой колонки.
-- Целостность обеспечивается приложением: аккаунт создаётся только для
-- существующей карточки, а все запросы кабинета идут через связь с ней.
