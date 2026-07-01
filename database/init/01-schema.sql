-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Хост: localhost
-- Время создания: Июл 01 2026 г., 23:30
-- Версия сервера: 5.7.21-20-beget-5.7.21-20-1-log
-- Версия PHP: 8.3.20

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База данных: `govzalla_t_25`
--

-- --------------------------------------------------------

--
-- Структура таблицы `area`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `area`;
CREATE TABLE `area` (
  `id_area` bigint(20) UNSIGNED NOT NULL,
  `title_area` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `cards`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `cards`;
CREATE TABLE `cards` (
  `id_card` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `school_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `card_from_project_teacher_mark2`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `card_from_project_teacher_mark2`;
CREATE TABLE `card_from_project_teacher_mark2` (
  `id_card` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` varchar(255) NOT NULL,
  `discipline_id` int(11) NOT NULL,
  `source_id` int(11) NOT NULL,
  `school_id` int(11) NOT NULL,
  `thema` varchar(500) DEFAULT NULL,
  `class_id` int(11) NOT NULL,
  `liter_class` varchar(20) NOT NULL,
  `k_1_1_1` int(11) DEFAULT NULL,
  `k_1_1_2` int(11) DEFAULT NULL,
  `k_1_1_3` int(11) DEFAULT NULL,
  `k_1_2_1` int(11) DEFAULT NULL,
  `k_2_1_1` int(11) NOT NULL,
  `k_2_1_2` int(11) NOT NULL,
  `k_2_1_3` int(11) NOT NULL,
  `k_2_1_4` int(11) NOT NULL,
  `k_2_2_1` int(11) NOT NULL,
  `k_2_2_2` int(11) NOT NULL,
  `k_2_2_3` int(11) NOT NULL,
  `k_2_2_4` int(11) NOT NULL,
  `k_2_2_5` int(11) NOT NULL,
  `k_2_2_6` int(11) NOT NULL,
  `k_2_2_7` int(11) NOT NULL,
  `k_2_2_8` int(11) NOT NULL,
  `k_2_2_9` int(11) NOT NULL,
  `k_2_2_10` int(11) NOT NULL,
  `k_2_3_1` int(11) NOT NULL,
  `k_2_3_2` int(11) NOT NULL,
  `k_2_3_3` int(11) NOT NULL,
  `k_2_3_4` int(11) NOT NULL,
  `k_2_3_5` int(11) NOT NULL,
  `k_2_3_6` int(11) NOT NULL,
  `k_2_3_7` int(11) NOT NULL,
  `k_2_4_1` int(11) NOT NULL,
  `k_2_4_2` int(11) NOT NULL,
  `k_2_4_3` int(11) NOT NULL,
  `k_2_4_4` int(11) NOT NULL,
  `k_2_4_5` int(11) NOT NULL,
  `k_2_4_6` int(11) NOT NULL,
  `k_2_4_7` int(11) NOT NULL,
  `k_2_5_1` int(11) NOT NULL,
  `k_2_5_2` int(11) NOT NULL,
  `k_3_1_1` int(11) DEFAULT NULL,
  `k_3_2_1` int(11) DEFAULT NULL,
  `k_4_1` int(11) DEFAULT NULL,
  `k_4_2` int(11) DEFAULT NULL,
  `k_4_3` int(11) DEFAULT NULL,
  `create_mark_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `card_type` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `card_from_project_teacher_mark3`
--
-- Создание: Фев 02 2025 г., 22:43
-- Последнее обновление: Июн 29 2026 г., 06:43
--

DROP TABLE IF EXISTS `card_from_project_teacher_mark3`;
CREATE TABLE `card_from_project_teacher_mark3` (
  `id_card` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` varchar(255) NOT NULL,
  `discipline_id` int(11) NOT NULL,
  `source_id` int(11) NOT NULL,
  `school_id` int(11) NOT NULL,
  `thema` varchar(500) NOT NULL,
  `class_id` int(11) NOT NULL,
  `liter_class` varchar(20) NOT NULL,
  `k_1_1` int(11) DEFAULT NULL,
  `k_1_2` int(11) DEFAULT NULL,
  `k_1_3` int(11) DEFAULT NULL,
  `k_1_4` int(11) DEFAULT NULL,
  `k_1_5` int(11) DEFAULT NULL,
  `k_1_6` int(11) DEFAULT NULL,
  `k_1_7` int(11) DEFAULT NULL,
  `k_2_1` int(11) NOT NULL,
  `k_2_2` int(11) NOT NULL,
  `k_2_3` int(11) NOT NULL,
  `k_2_4` int(11) NOT NULL,
  `k_2_5` int(11) NOT NULL,
  `k_2_6` int(11) NOT NULL,
  `k_2_7` int(11) NOT NULL,
  `k_2_8` int(11) NOT NULL,
  `k_2_9` int(11) NOT NULL,
  `k_2_10` int(11) DEFAULT NULL,
  `k_2_11` int(11) DEFAULT NULL,
  `k_2_12` int(11) NOT NULL,
  `k_2_13` int(11) NOT NULL,
  `k_2_14` int(11) NOT NULL,
  `k_2_15` int(11) NOT NULL,
  `k_2_16` int(11) NOT NULL,
  `k_2_17` int(11) NOT NULL,
  `k_2_18` int(11) NOT NULL,
  `k_2_19` int(11) DEFAULT NULL,
  `k_2_20` int(11) DEFAULT NULL,
  `k_2_21` int(11) NOT NULL,
  `k_2_22` int(11) NOT NULL,
  `k_3_1` int(11) DEFAULT NULL,
  `k_3_2` int(11) DEFAULT NULL,
  `k_3_3` int(11) DEFAULT NULL,
  `k_4_1` int(11) DEFAULT NULL,
  `k_4_2` int(11) DEFAULT NULL,
  `k_4_3` int(11) DEFAULT NULL,
  `create_mark_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `card_type` int(11) NOT NULL,
  `methodist_id` varchar(300) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `category`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `category`;
CREATE TABLE `category` (
  `id_category` bigint(20) UNSIGNED NOT NULL,
  `title_category` varchar(50) COLLATE utf8_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `conclusion_recommendation`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `conclusion_recommendation`;
CREATE TABLE `conclusion_recommendation` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `min_val` int(11) NOT NULL,
  `max_val` int(11) NOT NULL,
  `content` text NOT NULL,
  `block_number` int(11) NOT NULL,
  `level_num` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `discipline_middleware`
--
-- Создание: Фев 02 2025 г., 22:43
-- Последнее обновление: Июн 26 2026 г., 08:59
--

DROP TABLE IF EXISTS `discipline_middleware`;
CREATE TABLE `discipline_middleware` (
  `id_discipline` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discipline_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `discipline_title`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `discipline_title`;
CREATE TABLE `discipline_title` (
  `id_discipline` bigint(20) UNSIGNED NOT NULL,
  `title_discipline` varchar(100) COLLATE utf8_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `edu_level`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `edu_level`;
CREATE TABLE `edu_level` (
  `id_edu_level` bigint(20) UNSIGNED NOT NULL,
  `title_edu_level` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `gender`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `gender`;
CREATE TABLE `gender` (
  `id_gender` bigint(20) UNSIGNED NOT NULL,
  `gender_title` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `methodists`
--
-- Создание: Мар 02 2025 г., 21:20
--

DROP TABLE IF EXISTS `methodists`;
CREATE TABLE `methodists` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `id_user` varchar(100) NOT NULL,
  `email` varchar(200) NOT NULL,
  `password` varchar(200) NOT NULL,
  `password_val` varchar(200) DEFAULT NULL,
  `role` varchar(100) NOT NULL DEFAULT 'methodist',
  `firstname` varchar(100) NOT NULL,
  `surname` varchar(100) NOT NULL,
  `patronymic` varchar(100) NOT NULL,
  `phone` varchar(100) NOT NULL,
  `position` varchar(300) DEFAULT NULL,
  `position_id` int(11) DEFAULT NULL COMMENT 'поизция нужна для фильтрации учителей по предмету для методиста',
  `area_id` int(11) NOT NULL,
  `birthday` date DEFAULT NULL,
  `service` int(11) NOT NULL DEFAULT '1' COMMENT 'служебное поле, где 1-это рабочие аккаунты, 2 - является служебными аккаунатми и не учитываются в статистике\r\n',
  `status` enum('on','off') NOT NULL DEFAULT 'on',
  `department` varchar(500) DEFAULT NULL COMMENT 'место работы'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `methodist_discipline_middleware`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `methodist_discipline_middleware`;
CREATE TABLE `methodist_discipline_middleware` (
  `id_discipline` bigint(20) UNSIGNED NOT NULL,
  `methodist_id` varchar(300) NOT NULL,
  `discipline_id` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `methodist_position`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `methodist_position`;
CREATE TABLE `methodist_position` (
  `id_position` bigint(20) UNSIGNED NOT NULL,
  `title_position` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `methodist_static`
--
-- Создание: Мар 04 2025 г., 20:30
--

DROP TABLE IF EXISTS `methodist_static`;
CREATE TABLE `methodist_static` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `methodist_id` varchar(150) NOT NULL,
  `teacher_id` varchar(150) NOT NULL,
  `card_type` int(10) NOT NULL,
  `discipline_id` int(10) NOT NULL,
  `card_id` int(10) NOT NULL,
  `area_id` int(10) NOT NULL,
  `created_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `middleware_project_school`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `middleware_project_school`;
CREATE TABLE `middleware_project_school` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `school_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `middleware_project_teachers`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `middleware_project_teachers`;
CREATE TABLE `middleware_project_teachers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` varchar(100) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `project_status` int(11) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `middleware_project_without_any_project`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `middleware_project_without_any_project`;
CREATE TABLE `middleware_project_without_any_project` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` varchar(150) NOT NULL,
  `in_project_status` int(11) NOT NULL DEFAULT '1',
  `project_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `middleware_teachers_project_name_mark`
--
-- Создание: Фев 02 2025 г., 22:43
-- Последнее обновление: Июн 26 2026 г., 08:57
--

DROP TABLE IF EXISTS `middleware_teachers_project_name_mark`;
CREATE TABLE `middleware_teachers_project_name_mark` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` varchar(100) NOT NULL,
  `in_project_status` int(11) NOT NULL DEFAULT '1',
  `project_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `middleware_teachers_project_name_test`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `middleware_teachers_project_name_test`;
CREATE TABLE `middleware_teachers_project_name_test` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` varchar(100) NOT NULL,
  `in_project_status` int(11) NOT NULL DEFAULT '1',
  `project_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `outside_card`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `outside_card`;
CREATE TABLE `outside_card` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `card_id` int(11) NOT NULL,
  `source_fio` varchar(255) NOT NULL,
  `position_name` varchar(255) NOT NULL,
  `source_workplace` varchar(255) NOT NULL,
  `source_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `outside_card2`
--
-- Создание: Фев 02 2025 г., 22:43
-- Последнее обновление: Июн 29 2026 г., 06:43
--

DROP TABLE IF EXISTS `outside_card2`;
CREATE TABLE `outside_card2` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `card_id` int(11) NOT NULL,
  `source_fio` varchar(255) NOT NULL,
  `position_name` varchar(255) NOT NULL,
  `source_workplace` varchar(255) NOT NULL,
  `source_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `position`
--
-- Создание: Дек 30 2025 г., 13:22
--

DROP TABLE IF EXISTS `position`;
CREATE TABLE `position` (
  `id_position` int(20) UNSIGNED NOT NULL,
  `title_position` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `projects`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `projects`;
CREATE TABLE `projects` (
  `id_project` bigint(20) UNSIGNED NOT NULL,
  `name_project` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `picture` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `projects_description`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `projects_description`;
CREATE TABLE `projects_description` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `project_id` int(11) NOT NULL,
  `title_project` varchar(250) NOT NULL,
  `content_project` text NOT NULL,
  `picture_project` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `project_middleware_names`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `project_middleware_names`;
CREATE TABLE `project_middleware_names` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `project_id` int(11) NOT NULL,
  `tbl_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `recommendation`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `recommendation`;
CREATE TABLE `recommendation` (
  `id_r` bigint(20) UNSIGNED NOT NULL,
  `category` varchar(150) NOT NULL,
  `title` varchar(150) NOT NULL,
  `k_id` varchar(20) NOT NULL,
  `val` int(11) NOT NULL,
  `content` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `recommendation2`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `recommendation2`;
CREATE TABLE `recommendation2` (
  `id_r` bigint(20) UNSIGNED NOT NULL,
  `category` varchar(500) NOT NULL,
  `title` varchar(500) NOT NULL,
  `k_id` varchar(10) NOT NULL,
  `val` int(11) NOT NULL,
  `content` mediumtext NOT NULL,
  `sub_title` varchar(400) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `recommendation2023`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `recommendation2023`;
CREATE TABLE `recommendation2023` (
  `id_r` bigint(20) UNSIGNED NOT NULL,
  `category` varchar(500) NOT NULL,
  `title` varchar(500) NOT NULL,
  `k_id` varchar(20) NOT NULL,
  `val` int(11) NOT NULL,
  `content` mediumtext NOT NULL,
  `sub_title` varchar(400) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `schools`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `schools`;
CREATE TABLE `schools` (
  `id_school` bigint(20) UNSIGNED NOT NULL,
  `area_id` int(11) NOT NULL,
  `school_name` varchar(255) NOT NULL,
  `type_id` int(11) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `sessions`
--
-- Создание: Фев 02 2025 г., 22:43
-- Последнее обновление: Июл 01 2026 г., 20:19
--

DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(10) UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `source_tbl`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `source_tbl`;
CREATE TABLE `source_tbl` (
  `id_source` bigint(20) UNSIGNED NOT NULL,
  `name_source` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `support_tbl_message`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `support_tbl_message`;
CREATE TABLE `support_tbl_message` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `type_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `phone` varchar(100) DEFAULT NULL,
  `email` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `support_type_middleware`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `support_type_middleware`;
CREATE TABLE `support_type_middleware` (
  `id_type` bigint(20) UNSIGNED NOT NULL,
  `thema` varchar(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `teachers`
--
-- Создание: Фев 02 2025 г., 22:43
-- Последнее обновление: Июн 26 2026 г., 08:59
--

DROP TABLE IF EXISTS `teachers`;
CREATE TABLE `teachers` (
  `id_tbl` bigint(20) UNSIGNED NOT NULL,
  `id_teacher` varchar(150) NOT NULL,
  `surname` varchar(100) NOT NULL,
  `firstname` varchar(100) NOT NULL,
  `patronymic` varchar(100) DEFAULT NULL,
  `birthday` date NOT NULL,
  `snils` bigint(20) DEFAULT NULL,
  `gender_id` int(11) NOT NULL,
  `specialty` varchar(100) DEFAULT NULL,
  `level_of_education_id` int(11) NOT NULL,
  `diploma` varchar(60) DEFAULT NULL,
  `position` int(11) DEFAULT NULL,
  `total_experience` int(11) DEFAULT NULL,
  `teaching_experience` int(11) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `phone` varchar(60) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `avatar` varchar(100) NOT NULL DEFAULT 'profile.svg',
  `school_id` int(11) NOT NULL,
  `time_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Структура таблицы `teachers_old`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `teachers_old`;
CREATE TABLE `teachers_old` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `id_teacher` varchar(100) CHARACTER SET utf8 NOT NULL,
  `surname` varchar(60) CHARACTER SET utf8 NOT NULL,
  `firstname` varchar(60) CHARACTER SET utf8 NOT NULL,
  `patronymic` varchar(250) COLLATE utf8_unicode_ci DEFAULT NULL,
  `birthday` date NOT NULL,
  `snils` varchar(200) COLLATE utf8_unicode_ci DEFAULT NULL,
  `gender_id` int(11) NOT NULL,
  `specialty` varchar(150) CHARACTER SET utf8 DEFAULT NULL,
  `level_of_education_id` int(11) DEFAULT NULL,
  `diploma` varchar(60) CHARACTER SET utf8 DEFAULT NULL,
  `position` int(11) DEFAULT NULL,
  `total_experience` int(11) DEFAULT NULL,
  `teaching_experience` int(11) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8_unicode_ci DEFAULT NULL,
  `email` varchar(60) CHARACTER SET utf8 DEFAULT NULL,
  `avatar` varchar(100) COLLATE utf8_unicode_ci NOT NULL DEFAULT 'profile.svg',
  `school_id` int(11) NOT NULL,
  `time_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `test`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `test`;
CREATE TABLE `test` (
  `id_project` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `training_kpk`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `training_kpk`;
CREATE TABLE `training_kpk` (
  `id_training` bigint(20) UNSIGNED NOT NULL,
  `year_training` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `place_training` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `teacher_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `type_school`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `type_school`;
CREATE TABLE `type_school` (
  `id_type` bigint(20) UNSIGNED NOT NULL,
  `title_type` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `users`
--
-- Создание: Фев 02 2025 г., 22:43
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `id_user` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('on','off','') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'on',
  `school_id` int(11) NOT NULL,
  `role` enum('school_admin','admin','moder','') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'school_admin'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Индексы сохранённых таблиц
--

--
-- Индексы таблицы `area`
--
ALTER TABLE `area`
  ADD UNIQUE KEY `id_area` (`id_area`);

--
-- Индексы таблицы `cards`
--
ALTER TABLE `cards`
  ADD UNIQUE KEY `id_card` (`id_card`);

--
-- Индексы таблицы `card_from_project_teacher_mark2`
--
ALTER TABLE `card_from_project_teacher_mark2`
  ADD UNIQUE KEY `id_card` (`id_card`);

--
-- Индексы таблицы `card_from_project_teacher_mark3`
--
ALTER TABLE `card_from_project_teacher_mark3`
  ADD UNIQUE KEY `id` (`id_card`);

--
-- Индексы таблицы `category`
--
ALTER TABLE `category`
  ADD UNIQUE KEY `id_category` (`id_category`);

--
-- Индексы таблицы `conclusion_recommendation`
--
ALTER TABLE `conclusion_recommendation`
  ADD UNIQUE KEY `id` (`id`);

--
-- Индексы таблицы `discipline_middleware`
--
ALTER TABLE `discipline_middleware`
  ADD UNIQUE KEY `id_discipline` (`id_discipline`);

--
-- Индексы таблицы `discipline_title`
--
ALTER TABLE `discipline_title`
  ADD UNIQUE KEY `id_discipline` (`id_discipline`);

--
-- Индексы таблицы `edu_level`
--
ALTER TABLE `edu_level`
  ADD UNIQUE KEY `id_edu_level` (`id_edu_level`);

--
-- Индексы таблицы `gender`
--
ALTER TABLE `gender`
  ADD UNIQUE KEY `id_gender` (`id_gender`);

--
-- Индексы таблицы `methodists`
--
ALTER TABLE `methodists`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Индексы таблицы `methodist_discipline_middleware`
--
ALTER TABLE `methodist_discipline_middleware`
  ADD PRIMARY KEY (`id_discipline`);

--
-- Индексы таблицы `methodist_position`
--
ALTER TABLE `methodist_position`
  ADD PRIMARY KEY (`id_position`);

--
-- Индексы таблицы `methodist_static`
--
ALTER TABLE `methodist_static`
  ADD UNIQUE KEY `id` (`id`);

--
-- Индексы таблицы `middleware_project_school`
--
ALTER TABLE `middleware_project_school`
  ADD UNIQUE KEY `id` (`id`);

--
-- Индексы таблицы `middleware_project_teachers`
--
ALTER TABLE `middleware_project_teachers`
  ADD UNIQUE KEY `id` (`id`);

--
-- Индексы таблицы `middleware_project_without_any_project`
--
ALTER TABLE `middleware_project_without_any_project`
  ADD UNIQUE KEY `id` (`id`),
  ADD KEY `teacher_id` (`teacher_id`),
  ADD KEY `project_id` (`project_id`);

--
-- Индексы таблицы `middleware_teachers_project_name_mark`
--
ALTER TABLE `middleware_teachers_project_name_mark`
  ADD UNIQUE KEY `id` (`id`),
  ADD UNIQUE KEY `teacher_id` (`teacher_id`),
  ADD KEY `project_id` (`project_id`);

--
-- Индексы таблицы `middleware_teachers_project_name_test`
--
ALTER TABLE `middleware_teachers_project_name_test`
  ADD UNIQUE KEY `id` (`id`),
  ADD UNIQUE KEY `teacher_id` (`teacher_id`),
  ADD KEY `project_id` (`project_id`);

--
-- Индексы таблицы `outside_card`
--
ALTER TABLE `outside_card`
  ADD UNIQUE KEY `id` (`id`);

--
-- Индексы таблицы `outside_card2`
--
ALTER TABLE `outside_card2`
  ADD UNIQUE KEY `id` (`id`);

--
-- Индексы таблицы `position`
--
ALTER TABLE `position`
  ADD UNIQUE KEY `id_position` (`id_position`);

--
-- Индексы таблицы `projects`
--
ALTER TABLE `projects`
  ADD UNIQUE KEY `id_project` (`id_project`);

--
-- Индексы таблицы `projects_description`
--
ALTER TABLE `projects_description`
  ADD UNIQUE KEY `id` (`id`),
  ADD KEY `project_id` (`project_id`);

--
-- Индексы таблицы `project_middleware_names`
--
ALTER TABLE `project_middleware_names`
  ADD UNIQUE KEY `id` (`id`);

--
-- Индексы таблицы `recommendation`
--
ALTER TABLE `recommendation`
  ADD UNIQUE KEY `id_r` (`id_r`),
  ADD KEY `k_id` (`k_id`);

--
-- Индексы таблицы `recommendation2`
--
ALTER TABLE `recommendation2`
  ADD UNIQUE KEY `id_r` (`id_r`);

--
-- Индексы таблицы `recommendation2023`
--
ALTER TABLE `recommendation2023`
  ADD UNIQUE KEY `id_r` (`id_r`);

--
-- Индексы таблицы `schools`
--
ALTER TABLE `schools`
  ADD UNIQUE KEY `id` (`id_school`);

--
-- Индексы таблицы `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`);

--
-- Индексы таблицы `source_tbl`
--
ALTER TABLE `source_tbl`
  ADD UNIQUE KEY `id_source` (`id_source`);

--
-- Индексы таблицы `support_tbl_message`
--
ALTER TABLE `support_tbl_message`
  ADD UNIQUE KEY `id` (`id`),
  ADD KEY `type_id` (`type_id`);

--
-- Индексы таблицы `support_type_middleware`
--
ALTER TABLE `support_type_middleware`
  ADD UNIQUE KEY `id_sup` (`id_type`);

--
-- Индексы таблицы `teachers`
--
ALTER TABLE `teachers`
  ADD UNIQUE KEY `id_tbl` (`id_tbl`),
  ADD KEY `school_id` (`school_id`);

--
-- Индексы таблицы `teachers_old`
--
ALTER TABLE `teachers_old`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id` (`id`),
  ADD KEY `school_id` (`school_id`);

--
-- Индексы таблицы `test`
--
ALTER TABLE `test`
  ADD UNIQUE KEY `id_project` (`id_project`);

--
-- Индексы таблицы `training_kpk`
--
ALTER TABLE `training_kpk`
  ADD UNIQUE KEY `id_training` (`id_training`);

--
-- Индексы таблицы `type_school`
--
ALTER TABLE `type_school`
  ADD UNIQUE KEY `id_type` (`id_type`);

--
-- Индексы таблицы `users`
--
ALTER TABLE `users`
  ADD UNIQUE KEY `id` (`id`),
  ADD UNIQUE KEY `school_id` (`school_id`);

--
-- AUTO_INCREMENT для сохранённых таблиц
--

--
-- AUTO_INCREMENT для таблицы `area`
--
ALTER TABLE `area`
  MODIFY `id_area` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `cards`
--
ALTER TABLE `cards`
  MODIFY `id_card` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `card_from_project_teacher_mark2`
--
ALTER TABLE `card_from_project_teacher_mark2`
  MODIFY `id_card` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `card_from_project_teacher_mark3`
--
ALTER TABLE `card_from_project_teacher_mark3`
  MODIFY `id_card` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `category`
--
ALTER TABLE `category`
  MODIFY `id_category` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `conclusion_recommendation`
--
ALTER TABLE `conclusion_recommendation`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `discipline_middleware`
--
ALTER TABLE `discipline_middleware`
  MODIFY `id_discipline` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `discipline_title`
--
ALTER TABLE `discipline_title`
  MODIFY `id_discipline` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `edu_level`
--
ALTER TABLE `edu_level`
  MODIFY `id_edu_level` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `gender`
--
ALTER TABLE `gender`
  MODIFY `id_gender` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `methodists`
--
ALTER TABLE `methodists`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `methodist_discipline_middleware`
--
ALTER TABLE `methodist_discipline_middleware`
  MODIFY `id_discipline` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `methodist_position`
--
ALTER TABLE `methodist_position`
  MODIFY `id_position` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `methodist_static`
--
ALTER TABLE `methodist_static`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `middleware_project_school`
--
ALTER TABLE `middleware_project_school`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `middleware_project_teachers`
--
ALTER TABLE `middleware_project_teachers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `middleware_project_without_any_project`
--
ALTER TABLE `middleware_project_without_any_project`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `middleware_teachers_project_name_mark`
--
ALTER TABLE `middleware_teachers_project_name_mark`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `middleware_teachers_project_name_test`
--
ALTER TABLE `middleware_teachers_project_name_test`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `outside_card`
--
ALTER TABLE `outside_card`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `outside_card2`
--
ALTER TABLE `outside_card2`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `position`
--
ALTER TABLE `position`
  MODIFY `id_position` int(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `projects`
--
ALTER TABLE `projects`
  MODIFY `id_project` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `projects_description`
--
ALTER TABLE `projects_description`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `project_middleware_names`
--
ALTER TABLE `project_middleware_names`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `recommendation`
--
ALTER TABLE `recommendation`
  MODIFY `id_r` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `recommendation2`
--
ALTER TABLE `recommendation2`
  MODIFY `id_r` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `recommendation2023`
--
ALTER TABLE `recommendation2023`
  MODIFY `id_r` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `schools`
--
ALTER TABLE `schools`
  MODIFY `id_school` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `source_tbl`
--
ALTER TABLE `source_tbl`
  MODIFY `id_source` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `support_tbl_message`
--
ALTER TABLE `support_tbl_message`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `support_type_middleware`
--
ALTER TABLE `support_type_middleware`
  MODIFY `id_type` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `teachers`
--
ALTER TABLE `teachers`
  MODIFY `id_tbl` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `teachers_old`
--
ALTER TABLE `teachers_old`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `test`
--
ALTER TABLE `test`
  MODIFY `id_project` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `training_kpk`
--
ALTER TABLE `training_kpk`
  MODIFY `id_training` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `type_school`
--
ALTER TABLE `type_school`
  MODIFY `id_type` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
