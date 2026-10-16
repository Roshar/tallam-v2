#!/usr/bin/env bash
# Daily production backup. Run on the VPS.
# Creates /var/backups/tallam/tallam-offsite-YYYYMMDD-HHMMSS.tar.gz
set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/tallam-v2}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tallam}"
KEEP_DAYS="${KEEP_DAYS:-7}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DUMP_BIN="$(command -v mariadb-dump || command -v mysqldump || true)"
if [[ -z "$DUMP_BIN" ]]; then
  echo "mariadb-dump/mysqldump not found" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d /tmp/tallam-backup.XXXXXX)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

DB_HOST="${DATABASE_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DATABASE:?DATABASE is not set}"
DB_USER="${DATABASE_USER:?DATABASE_USER is not set}"
DB_PASS="${DATABASE_PASSWORD:-}"

{
  printf '[client]\n'
  printf 'host=%s\n' "$DB_HOST"
  printf 'port=%s\n' "$DB_PORT"
  printf 'user=%s\n' "$DB_USER"
  printf 'password=%s\n' "$DB_PASS"
} > "$WORK/my.cnf"

"$DUMP_BIN" --defaults-extra-file="$WORK/my.cnf" \
  --single-transaction \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  "$DB_NAME" \
  | gzip -c > "$WORK/database.sql.gz"

cp "$ENV_FILE" "$WORK/production.env"
chmod 600 "$WORK/production.env"

PASSWORD_LOG="$APP_ROOT/backend/data/school-passwords.log"
if [[ -f "$PASSWORD_LOG" ]]; then
  cp "$PASSWORD_LOG" "$WORK/school-passwords.log"
  chmod 600 "$WORK/school-passwords.log"
fi

# --- TaskFlow: второй продукт на этом же сервере -------------------------
# Вложения TaskFlow лежат на диске, а не в базе, поэтому их нужно архивировать
# отдельно, иначе картинки не попадут в бэкап. Пароль в DATABASE_URL не должен
# содержать ':' или '@' - у нас он hex, для другого пароля потребуется правка.
TASKFLOW_ROOT="/home/taskflow"
TASKFLOW_ARTIFACTS=()
if [[ -f "$TASKFLOW_ROOT/.env" ]]; then
  TF_URL="$(grep -E '^DATABASE_URL=' "$TASKFLOW_ROOT/.env" | head -1 | cut -d= -f2-)"
  if [[ "$TF_URL" == mysql://* ]]; then
    TF_REST="${TF_URL#mysql://}"
    TF_CRED="${TF_REST%%@*}"
    TF_TAIL="${TF_REST#*@}"
    TF_USER="${TF_CRED%%:*}"
    TF_PASS="${TF_CRED#*:}"
    TF_HOST="${TF_TAIL%%:*}"
    TF_PORT_DB="${TF_TAIL#*:}"
    TF_PORT="${TF_PORT_DB%%/*}"
    TF_DB="${TF_PORT_DB#*/}"

    {
      printf '[client]\n'
      printf 'host=%s\n' "$TF_HOST"
      printf 'port=%s\n' "$TF_PORT"
      printf 'user=%s\n' "$TF_USER"
      printf 'password=%s\n' "$TF_PASS"
    } > "$WORK/my-taskflow.cnf"

    "$DUMP_BIN" --defaults-extra-file="$WORK/my-taskflow.cnf" \
      --single-transaction \
      --routines \
      --triggers \
      --default-character-set=utf8mb4 \
      "$TF_DB" \
      | gzip -c > "$WORK/taskflow.sql.gz"

    cp "$TASKFLOW_ROOT/.env" "$WORK/taskflow.env"
    chmod 600 "$WORK/taskflow.env"
    TASKFLOW_ARTIFACTS+=(taskflow.sql.gz taskflow.env)

    TF_UPLOADS="$TASKFLOW_ROOT/server/storage/uploads"
    if [[ -d "$TF_UPLOADS" ]] && [[ -n "$(ls -A "$TF_UPLOADS" 2>/dev/null)" ]]; then
      tar -czf "$WORK/taskflow-uploads.tar.gz" -C "$TASKFLOW_ROOT/server/storage" uploads
      TASKFLOW_ARTIFACTS+=(taskflow-uploads.tar.gz)
    fi
  fi
fi

cat > "$WORK/README.txt" <<EOF
Tallam v2 offsite backup
created: $STAMP
database: $DB_NAME
host: $(hostname)
See docs/ARCHITECTURE.md in the git repo for restore steps.
EOF

if [[ ${#TASKFLOW_ARTIFACTS[@]} -gt 0 ]]; then
  cat >> "$WORK/README.txt" <<EOF

Также в архиве TaskFlow (второй продукт на этом сервере):
  taskflow.sql.gz          - дамп базы $TF_DB
  taskflow.env             - переменные окружения TaskFlow
  taskflow-uploads.tar.gz  - вложения (если были)
EOF
fi

ARCHIVE="$BACKUP_DIR/tallam-offsite-$STAMP.tar.gz"
FILES=(database.sql.gz production.env README.txt)
if [[ -f "$WORK/school-passwords.log" ]]; then
  FILES+=(school-passwords.log)
fi
for artifact in "${TASKFLOW_ARTIFACTS[@]:-}"; do
  if [[ -n "$artifact" && -f "$WORK/$artifact" ]]; then
    FILES+=("$artifact")
  fi
done

tar -czf "$ARCHIVE" -C "$WORK" "${FILES[@]}"

chmod 600 "$ARCHIVE"
find "$BACKUP_DIR" -name 'tallam-offsite-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "BACKUP_OK $ARCHIVE"
ls -lh "$ARCHIVE"
