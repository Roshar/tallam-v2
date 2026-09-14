ALTER TABLE `users`
  ADD COLUMN `blocked_by_admin` tinyint(1) NOT NULL DEFAULT 0;
