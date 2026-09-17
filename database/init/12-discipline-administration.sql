INSERT INTO `discipline_title` (`title_discipline`)
SELECT 'Администрация'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM `discipline_title`
  WHERE `title_discipline` = 'Администрация'
);
