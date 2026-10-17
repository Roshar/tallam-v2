-- Приглашения на активацию личного кабинета учителя.
--
-- Зачем отдельная таблица, а не поле в teacher_accounts: приглашение живет до
-- активации и может быть отозвано или перевыпущено. Это тот же принцип, что у
-- password_recovery_requests.
--
-- Почты в карточках учителей нельзя считать подтвержденными: 950 учителей
-- сидят на 254 общих школьных адресах (бывает по 40 человек на один ящик).
-- Поэтому ссылка - лишь первый шаг, а владение почтой подтверждается кодом,
-- который учитель вводит на странице активации.

CREATE TABLE IF NOT EXISTS `teacher_invites` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `token` char(64) NOT NULL,
  `id_teacher` varchar(150) NOT NULL,
  `school_id` int NOT NULL,
  `created_by` bigint(20) UNSIGNED NULL,
  `code_hash` varchar(200) NULL,
  `code_email` varchar(150) NULL,
  `code_expires_at` timestamp NULL,
  `code_attempts` int(11) NOT NULL DEFAULT 0,
  `used_at` timestamp NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teacher_invites_token` (`token`),
  KEY `idx_teacher_invites_teacher` (`id_teacher`),
  KEY `idx_teacher_invites_school` (`school_id`),
  KEY `idx_teacher_invites_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
