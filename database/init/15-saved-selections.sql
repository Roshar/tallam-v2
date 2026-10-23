-- Списки учителей (E1). Условия хранятся как JSON: они никогда не участвуют
-- в запросах к БД, поэтому отдельная таблица условий не нужна.
CREATE TABLE IF NOT EXISTS `saved_selections` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `school_id` int(11) NOT NULL,
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
