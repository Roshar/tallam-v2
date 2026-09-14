CREATE TABLE IF NOT EXISTS `school_subscriptions` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `school_id` bigint(20) UNSIGNED NOT NULL,
  `starts_on` date NOT NULL,
  `ends_on` date NOT NULL,
  `contact_phone` varchar(100) DEFAULT NULL,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT 0,
  `source_label` varchar(100) DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_school_subscription_period`
    (`school_id`, `starts_on`, `ends_on`),
  KEY `idx_school_subscriptions_school` (`school_id`),
  KEY `idx_school_subscriptions_ends_on` (`ends_on`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
