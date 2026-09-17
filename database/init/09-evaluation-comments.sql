CREATE TABLE IF NOT EXISTS `evaluation_comments` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `card_id` bigint(20) UNSIGNED NOT NULL,
  `school_id` bigint(20) UNSIGNED NOT NULL,
  `body_html` mediumtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_evaluation_comments_card` (`card_id`),
  KEY `idx_evaluation_comments_school` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
