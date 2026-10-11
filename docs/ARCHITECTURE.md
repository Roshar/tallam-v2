# Архитектура Tallam v2

Документ нужен, чтобы поднять платформу на новом сервере, если текущий VPS удалят. Код живёт в GitHub. База, `.env` и журнал паролей школ в git не входят и должны копироваться отдельно.

Репозиторий: `git@github.com:Roshar/tallam-v2.git`

## Как устроено сейчас

На VPS `185.207.0.41` работает одна версия сайта — v2. Старая версия закрыта 11 октября 2026.

```text
Браузер
  │
  ├─ https://tallam.ru          nginx
  │     ├─ статика              /home/tallam-v2/frontend/dist
  │     └─ /api/                127.0.0.1:4001   PM2 процесс tallam-v2
  │                                 └─ MariaDB 127.0.0.1:3306, база tallam_v2
  │
  └─ https://old.tallam.ru      nginx → 301 на https://tallam.ru
```

| Что | Где |
|---|---|
| Код v2 | `/home/tallam-v2` (клон GitHub) |
| API v2 | Node 20, `backend/dist/index.js`, порт **4001** |
| Фронт v2 | собранный Vite в `frontend/dist`, отдаёт nginx |
| БД v2 | MariaDB **на этом же VPS**, только localhost |
| Сессии v2 | таблица `sessions` в `tallam_v2` |
| Сертификаты | Let's Encrypt: `tallam.ru` и `old.tallam.ru` (второй нужен для перенаправления) |
| Процессы | PM2, список сохраняется в `/root/.pm2/dump.pm2` |
| Логи PM2 | ротация модулем `pm2-logrotate`: ежедневно, хранятся 30 дней |
| Журнал systemd | лимит 300 МБ и срок 30 дней (`/etc/systemd/journald.conf.d/99-tallam.conf`) |
| Swap | `/swapfile`, 1 ГБ, `vm.swappiness=10` — подушка на пики |

### Старая версия (v1) — закрыта

Замеры перед закрытием: за сутки 126 запросов, из них 120 — один сканер, остальные — пробы `/.env`; **POST-запросов ноль**, то есть ни одного входа и ни одного сохранения. Живых пользователей не было.

Как закрывали: процесс остановлен, запись удалена из PM2 и снята с автозапуска (`pm2 delete index && pm2 save` — теперь в `/root/.pm2/dump.pm2` только `tallam-v2`), конфиг `old.tallam.ru` заменён на перенаправление. Код `/home/app` (171 МБ) и база Beget `govzalla_t_25` **не тронуты**.

Вернуть при необходимости:

```bash
pm2 start /home/app/index.js --name index    # прежняя версия снова слушает :4000
pm2 save
# затем в /etc/nginx/sites-available/tallam вернуть блок old.tallam.ru
# с proxy_pass http://127.0.0.1:4000 из бэкапа /root/tallam-nginx-<штамп>.bak
nginx -t && systemctl reload nginx
```

Если не оплатить VPS и его сотрут через 7 дней, пропадут: MariaDB `tallam_v2`, файл `/home/tallam-v2/.env`, журнал `backend/data/school-passwords.log`, сертификаты и сам сервер. GitHub останется.

## Стек приложения

Монорепозиторий npm workspaces.

- `frontend`: React 19 + Vite + TypeScript. В разработке проксирует `/api` на `http://localhost:4000` — это локальный API, у прода порт **4001**.
- `backend`: Express + TypeScript. Компилируется в `backend/dist`.
- Локальная БД: Docker MySQL 8, порт хоста **3307**, база `govzalla_t_25`, пользователь `tallam`.
- Прод БД v2: MariaDB 11 на VPS, база `tallam_v2`.

Общая схема таблиц унаследована от v1. Новые таблицы v2 поднимаются при старте API (`ensure*Schema`) и лежат в `database/init/`.

## Что хранится в секретах

Файл `/home/tallam-v2/.env` (локально корневой `.env`). В git только `.env.example`.

| Переменная | Зачем |
|---|---|
| `DATABASE`, `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DB_PORT` | доступ к MariaDB/MySQL |
| `APP_PORT` | прод: `4001`, локально: `4000` |
| `FRONTEND_URL` | прод: `https://tallam.ru` |
| `NODE_ENV` | на проде `production` |
| `SESSION_NAME` | cookie `smad` |
| `SESSION_SECRET` | подпись сессий |
| `SUBSCRIPTION_DATA_ENCRYPTION_KEY` | AES-256-GCM для паспортных данных заявок на продление |
| `SMTP_*` | письма, если настроены |
| `PASSWORD_RESET_EXPIRES_MINUTES` | срок ссылки смены пароля |

Без `SUBSCRIPTION_DATA_ENCRYPTION_KEY` расшифровать заявки на продление нельзя. Этот ключ обязательно копировать вместе с дампом базы.

## Как собирается и запускается

### Локально

```bash
docker compose up -d
cp .env.example .env    # если файла ещё нет
npm install
npm run dev             # API :4000 и Vite :5173
```

Импорт дампа в локальный Docker:

```bash
npm run db:import -- backups/offsite/tallam_v2.sql
```

### Продакшен (уже существующий VPS)

Код не деплоится сам. Схема: коммит в GitHub, сборка **на ноутбуке**, доставка готовых артефактов на сервер.

```bash
npm run deploy          # scripts/deploy.sh: сборка локально, git pull и tar на сервере, pm2 restart
```

Так сделано потому, что у VPS ~1 ГБ памяти: сборка на нём упирается в предел, а ядро при нехватке памяти убивает не сборку, а MariaDB. На сервере при этом включён swap на 2 ГБ как подушка.

- nginx продолжает отдавать `frontend/dist`, перезапуск nginx после деплоя не нужен.
- PM2 запускает уже собранный `backend/dist/index.js`.
- Старый сайт не трогаем: процесс `index` на 4000.
- Предыдущая сборка складывается в `/var/backups/tallam/dist/` — оттуда откат.

Аварийный путь без ноутбука (с прижатым heap, чтобы сборка упала явно):

```bash
cd /home/tallam-v2
git pull --ff-only origin main
NODE_OPTIONS=--max-old-space-size=384 npm run build
pm2 restart tallam-v2 --update-env
```

Первый запуск API на новом сервере:

```bash
cd /home/tallam-v2
npm ci
npm run build
cd /home/tallam-v2 && pm2 start backend/dist/index.js --name tallam-v2
pm2 save
```

## Защита от удаления VPS

Нужны **три независимые копии**, не лежащие только на этом сервере.

1. **GitHub** (`origin/main`) — код, скрипты, эта схема. Дампы БД и `.env` сюда не кладём: там персональные данные школ.
2. **Ежедневный архив на VPS** `/var/backups/tallam/` — спасает от ошибки в SQL, не спасает от удаления сервера.
3. **Копия на ноутбуке** `backups/offsite/` — то, что переживает удаление VPS. Каталог в `.gitignore`.

В архив входят:

- gzip-дамп `tallam_v2`
- копия `.env`
- `backend/data/school-passwords.log`, если файл есть

На VPS cron каждый день в 03:00 (серверное время):

```cron
0 3 * * * /home/tallam-v2/scripts/backup-database.sh >> /var/log/tallam-backup.log 2>&1
```

Хранятся последние 7 архивов, диск у VPS небольшой.

С ноутбука забрать свежий архив:

```bash
npm run backup:fetch
```

Это запускает дамп на сервере и копирует последний файл в `backups/offsite/`. Делайте так хотя бы раз в неделю, лучше после важных изменений (новые школы, оплаты, массовые правки).

## Как восстановить v2 на новом сервере

1. Новый Ubuntu VPS, Node 20, nginx, MariaDB, PM2, git.
2. `git clone git@github.com:Roshar/tallam-v2.git /home/tallam-v2`
3. Распаковать архив `tallam-offsite-YYYYMMDD-HHMMSS.tar.gz`.
4. Создать базу и пользователя, как в `production.env` из архива. Положить этот файл в `/home/tallam-v2/.env`, права `600`. При необходимости выставить `DATABASE_HOST=127.0.0.1`.
5. Залить дамп:

```bash
mkdir -p /tmp/tallam-restore
tar -xzf backups/offsite/tallam-offsite-YYYYMMDD-HHMMSS.tar.gz -C /tmp/tallam-restore
gunzip -c /tmp/tallam-restore/database.sql.gz \
  | mysql -h127.0.0.1 -u"$DATABASE_USER" -p "$DATABASE"
cp /tmp/tallam-restore/production.env /home/tallam-v2/.env
chmod 600 /home/tallam-v2/.env
```

6. `cd /home/tallam-v2 && npm ci && npm run build`
7. Если в архиве есть `school-passwords.log`, положить его в `/home/tallam-v2/backend/data/school-passwords.log`, права `600`.
8. `pm2 start backend/dist/index.js --name tallam-v2 && pm2 save`
9. nginx: корень сайта `/home/tallam-v2/frontend/dist`, `/api/` на `http://127.0.0.1:4001`, затем Certbot для `tallam.ru`.
10. Проверка: `curl https://tallam.ru/api/health` и вход в админку.

Старая версия `old.tallam.ru` закрыта 11 октября 2026 и лишь перенаправляет на текущий сайт, поэтому на новом сервере достаточно v2. Код `/home/app` и база Beget `govzalla_t_25` остаются как исторический источник данных — их не удаляем, но и не используем в продакшене.

## Полезные пути

| Назначение | Путь |
|---|---|
| Приложение v2 | `/home/tallam-v2` |
| Сборка фронта | `/home/tallam-v2/frontend/dist` |
| Сборка API | `/home/tallam-v2/backend/dist/index.js` |
| Секреты | `/home/tallam-v2/.env` |
| Журнал паролей школ | `/home/tallam-v2/backend/data/school-passwords.log` |
| Дампы на сервере | `/var/backups/tallam/` |
| nginx | `/etc/nginx/sites-enabled/tallam` |
| Логи API | `/root/.pm2/logs/tallam-v2-out.log` |

## Чего не делать

- Не коммитить `.env`, SQL-дампы, `school-passwords.log`.
- Не направлять локальную разработку записью в Beget-базу v1: она остаётся историческим источником, а не рабочей базой.
- Не считать дамп на самом VPS достаточным бэкапом: вместе с сервером он исчезнет.
- Не менять `SUBSCRIPTION_DATA_ENCRYPTION_KEY` на живой базе: старые заявки перестанут читаться.
