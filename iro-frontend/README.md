# IRO frontend

```bash
npm install
npm run dev:iro
```

По умолчанию `/api/iro` проксируется на `http://localhost:4000`. Если порт занят TaskFlow, запустите API с `APP_PORT=4005`, а frontend так:

```bash
VITE_API_TARGET=http://localhost:4005 npm run dev:iro
```

Первый администратор создаётся после запуска API и создания таблицы:

```bash
npm run iro:user:create -- admin@example.ru 'your-strong-password' iro_admin Имя Фамилия Отчество
```

Скрипт сохраняет только bcrypt-хеш и не печатает пароль.
