# Архитектура Tallam v2

Документ нужен, чтобы поднять платформу на новом сервере, если текущий VPS удалят. Код живёт в GitHub. База, `.env` и журнал паролей школ в git не входят и должны копироваться отдельно.

Репозиторий: `git@github.com:Roshar/tallam-v2.git`

## Как устроено сейчас

На одном VPS `185.207.0.41` крутятся две версии сайта.

```text
Браузер
  │
  ├─ https://tallam.ru          nginx
  │     ├─ статика              /home/tallam-v2/frontend/dist
  │     └─ /api/                127.0.0.1:4001   PM2 процесс tallam-v2
  │                                 └─ MariaDB 127.0.0.1:3306, база tallam_v2
  │
  └─ https://old.tallam.ru      nginx
        └─ весь трафик          127.0.0.1:4000   PM2 процесс index
                                    └─ MySQL Beget govzalla.beget.tech, база govzalla_t_25
```

| Что | Где |
|---|---|
| Код v2 | `/home/tallam-v2` (клон GitHub) |
| Код v1 | `/home/app` (старый Handlebars) |
| API v2 | Node 20, `backend/dist/index.js`, порт **4001** |
| API v1 | Node, `/home/app/index.js`, порт **4000** |
| Фронт v2 | собранный Vite в `frontend/dist`, отдаёт nginx |
| БД v2 | MariaDB **на этом же VPS**, только localhost |
| БД v1 | удалённая база Beget, при удалении VPS она останется |
| Сессии v2 | таблица `sessions` в `tallam_v2` |
| Сертификаты | Let's Encrypt: `tallam.ru` и `old.tallam.ru` |
| Процессы | PM2, список сохраняется в `/root/.pm2/dump.pm2` |

Если не оплатить VPS и его сотрут через 7 дней, пропадут: MariaDB `tallam_v2`, файл `/home/tallam-v2/.env`, журнал `backend/data/school-passwords.log`, сертификаты и сам сервер. GitHub и база v1 на Beget останутся.

## Стек приложения

Монорепозиторий npm workspaces.

- `frontend`: React 19 + Vite + TypeScript. В разработке проксирует `/api` на `http://localhost:4000`.
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

Код не деплоится сам. Схема такая: коммит в GitHub, на сервере pull и сборка.

```bash
cd /home/tallam-v2
git pull origin main
npm ci                  # только если менялись зависимости
npm run build           # backend tsc, затем frontend vite build
pm2 restart tallam-v2 --update-env
```

- nginx продолжает отдавать `frontend/dist`, перезапуск nginx после обычной сборки не нужен.
- PM2 запускает уже собранный `backend/dist/index.js`.
- Старый сайт не трогаем: процесс `index` на 4000.

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

Старый сайт `old.tallam.ru` поднимается отдельно из `/home/app` и по-прежнему ходит в Beget. Если v1 на новом VPS не нужен, достаточно v2.

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
- Не направлять локальную разработку записью в Beget-базу v1.
- Не считать дамп на самом VPS достаточным бэкапом: вместе с сервером он исчезнет.
- Не менять `SUBSCRIPTION_DATA_ENCRYPTION_KEY` на живой базе: старые заявки перестанут читаться.
