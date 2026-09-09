-- Project and teacher membership seed for local development

INSERT INTO `position` (`id_position`, `title_position`) VALUES
(1, 'Учитель'),
(2, 'Заместитель директора')
ON DUPLICATE KEY UPDATE `title_position` = VALUES(`title_position`);

UPDATE `teachers` SET `position` = 1 WHERE `school_id` = 1;

INSERT INTO `projects` (`id_project`, `name_project`, `picture`) VALUES
(2, 'Анализ урока', 'project_mark.png')
ON DUPLICATE KEY UPDATE `name_project` = VALUES(`name_project`);

INSERT INTO `project_middleware_names` (`id`, `project_id`, `tbl_name`) VALUES
(1, 2, 'middleware_teachers_project_name_mark')
ON DUPLICATE KEY UPDATE `tbl_name` = VALUES(`tbl_name`);

INSERT INTO `middleware_project_school` (`id`, `school_id`, `project_id`) VALUES
(1, 1, 2)
ON DUPLICATE KEY UPDATE `project_id` = VALUES(`project_id`);

-- teacher-1 participates in project, teacher-2 is in school base only
INSERT INTO `middleware_teachers_project_name_mark`
  (`id`, `teacher_id`, `in_project_status`, `project_id`)
VALUES
(1, 'teacher-1', 2, 2),
(2, 'teacher-2', 1, 2)
ON DUPLICATE KEY UPDATE
  `in_project_status` = VALUES(`in_project_status`),
  `project_id` = VALUES(`project_id`);
