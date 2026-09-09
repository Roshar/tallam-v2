-- Local development seed data only (not for production)
SET NAMES utf8mb4;

INSERT INTO `area` (`id_area`, `title_area`) VALUES
(1, 'Тестовый район')
ON DUPLICATE KEY UPDATE `title_area` = VALUES(`title_area`);

INSERT INTO `type_school` (`id_type`, `title_type`) VALUES
(1, 'Общеобразовательная школа')
ON DUPLICATE KEY UPDATE `title_type` = VALUES(`title_type`);

INSERT INTO `schools` (`id_school`, `area_id`, `school_name`, `type_id`) VALUES
(1, 1, 'Тестовая школа Tallam v2', 1)
ON DUPLICATE KEY UPDATE `school_name` = VALUES(`school_name`);

-- test@test.ru / 123456
INSERT INTO `users` (`id`, `id_user`, `email`, `password`, `status`, `school_id`, `role`) VALUES
(1, 'test-school-1', 'test@test.ru', '$2b$10$CTTf7wWad0Iyi0HYZKVbv.E9BD2MxNi2Pq.DGTW6xEKeRvMilPNwW', 'on', 1, 'school_admin')
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `status` = VALUES(`status`),
  `school_id` = VALUES(`school_id`),
  `role` = VALUES(`role`);

INSERT INTO `gender` (`id_gender`, `title_gender`) VALUES
(1, 'Мужской'),
(2, 'Женский')
ON DUPLICATE KEY UPDATE `title_gender` = VALUES(`title_gender`);

INSERT INTO `edu_level` (`id_level`, `title_level`) VALUES
(1, 'Высшее')
ON DUPLICATE KEY UPDATE `title_level` = VALUES(`title_level`);

INSERT INTO `teachers` (
  `id_tbl`, `id_teacher`, `surname`, `firstname`, `patronymic`, `birthday`,
  `gender_id`, `level_of_education_id`, `school_id`, `phone`, `email`, `position`
) VALUES
(1, 'teacher-1', 'Иванов', 'Иван', 'Иванович', '1985-05-15', 1, 1, 1, '+7 900 111-22-33', 'ivanov@school.ru', 1),
(2, 'teacher-2', 'Петрова', 'Мария', 'Сергеевна', '1990-09-20', 2, 1, 1, '+7 900 444-55-66', 'petrova@school.ru', 1)
ON DUPLICATE KEY UPDATE `surname` = VALUES(`surname`);
