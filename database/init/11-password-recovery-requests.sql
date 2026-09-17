CREATE TABLE IF NOT EXISTS `password_recovery_requests` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `phone` varchar(32) NOT NULL,
  `school_id` bigint(20) UNSIGNED DEFAULT NULL,
  `school_name` varchar(255) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'new',
  `ip_address` varchar(64) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `processed_by_email` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recovery_status` (`status`),
  KEY `idx_recovery_created` (`created_at`),
  KEY `idx_recovery_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
