import { query } from "../db/pool.js";

let schemaReady: Promise<void> | null = null;

export async function ensureIroSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS iro_users (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        email varchar(255) NOT NULL,
        password_hash varchar(255) NOT NULL,
        role enum('iro_viewer','iro_methodologist','iro_admin') NOT NULL,
        status enum('on','off') NOT NULL DEFAULT 'on',
        first_name varchar(100) NOT NULL,
        last_name varchar(100) NOT NULL,
        patronymic varchar(100) DEFAULT NULL,
        last_login_at timestamp NULL DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by_iro_user_id bigint(20) UNSIGNED DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_iro_users_email (email),
        KEY idx_iro_users_status_role (status, role),
        KEY idx_iro_users_created_by (created_by_iro_user_id),
        CONSTRAINT fk_iro_users_created_by FOREIGN KEY (created_by_iro_user_id)
          REFERENCES iro_users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}
