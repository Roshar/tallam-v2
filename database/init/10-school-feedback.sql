CREATE TABLE IF NOT EXISTS `school_support_messages` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `school_id` bigint(20) UNSIGNED NOT NULL,
  `author_role` varchar(16) NOT NULL,
  `author_email` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `unread_for_admin` tinyint(1) NOT NULL DEFAULT 0,
  `unread_for_school` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_support_school` (`school_id`),
  KEY `idx_support_created` (`created_at`),
  KEY `idx_support_unread_admin` (`unread_for_admin`),
  KEY `idx_support_unread_school` (`unread_for_school`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
