-- Расчёты бухгалтера по оплаченным продлениям.
-- Не меняет subscription_renewal_requests: связь только по id заявки.

CREATE TABLE IF NOT EXISTS contract_settlements (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_number varchar(50) DEFAULT NULL,
  settlement_date date NOT NULL,
  created_by varchar(255) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contract_settlements_date (settlement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contract_settlement_items (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  settlement_id bigint(20) UNSIGNED NOT NULL,
  renewal_request_id bigint(20) UNSIGNED NOT NULL,
  school_id bigint(20) UNSIGNED NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settlement_item_renewal (renewal_request_id),
  KEY idx_settlement_items_settlement (settlement_id),
  KEY idx_settlement_items_school (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
