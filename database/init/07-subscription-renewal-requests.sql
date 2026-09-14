CREATE TABLE IF NOT EXISTS `subscription_renewal_requests` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `school_id` bigint(20) UNSIGNED NOT NULL,
  `customer_ciphertext` longtext NOT NULL,
  `customer_iv` varchar(64) NOT NULL,
  `customer_auth_tag` varchar(64) NOT NULL,
  `status` enum('pending','documents_ready','paid','cancelled')
    NOT NULL DEFAULT 'pending',
  `contract_number` varchar(50) DEFAULT NULL,
  `invoice_number` varchar(50) DEFAULT NULL,
  `issued_on` date DEFAULT NULL,
  `starts_on` date DEFAULT NULL,
  `ends_on` date DEFAULT NULL,
  `consent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` timestamp NULL DEFAULT NULL,
  `processed_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_renewal_school_created` (`school_id`, `created_at`),
  KEY `idx_renewal_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscription_document_sequences` (
  `period_key` char(7) NOT NULL,
  `last_number` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`period_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
