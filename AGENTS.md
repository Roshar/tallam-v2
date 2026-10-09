# Tallam v2 — инструкции для агентов

Образовательная платформа **Tallam** (анализ урока). Монорепозиторий: `frontend` (React + Vite + TS), `backend` (Express + TS), MySQL 8.

## Прочитай перед работой

| Документ | Зачем |
|---|---|
| [`PROJECT.md`](PROJECT.md) | Что за проект, что уже сделано, как запустить |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Реестр фич: где живёт нужная фича и как её проверить |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Правила работы — **обязательны к соблюдению** |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Прод, сервер, бэкапы, восстановление |

## Два главных правила

1. **Каждая новая фича документируется.** Фича не считается сделанной, пока не добавлена запись в `docs/FEATURES.md` по шаблону из начала файла. Если изменилась общая картина — обновляется и `PROJECT.md`. Подробности и Definition of Done — в [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).
2. **Минимальное вмешательство.** Новые фичи — новыми файлами. Существующие файлы трогаем только в точках регистрации: `frontend/src/App.tsx`, `frontend/src/components/SchoolCabinetLayout.tsx`, `frontend/src/components/AdminCabinetShell.tsx`, `frontend/src/api/client.ts`, `backend/src/index.ts`, `*.routes.ts`. Никаких попутных рефакторингов. Существующие эндпоинты меняются только аддитивно.

## Быстрый старт

```bash
docker compose up -d      # MySQL :3307, Mailpit :8025
npm run dev               # API :4000, web :5173
npm run build             # проверка сборки перед коммитом
```

Локальный вход: `test@test.ru` / `123456` (школа 483).

## Чего не делать

- Не коммитить `.env`, SQL-дампы, `school-passwords.log`.
- Не менять схему существующих таблиц — она общая с прод-базой. Новые таблицы только аддитивно.
- Не писать в прод-базу `tallam_v2` и в Beget-базу v1 при разработке.
- Не трогать v1 (`/home/app`, процесс `index` на :4000) — он обслуживает `old.tallam.ru`.
- Не менять `SUBSCRIPTION_DATA_ENCRYPTION_KEY` на живой базе.

## Коммиты и деплой

- Сообщение — по-английски, тело объясняет **почему**. Трейлер инструмента: `Co-authored-by: DeepSeek Harness` или `Co-authored-by: Cursor`.
- Деплой только по согласованию с владельцем, шаги — в [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).
