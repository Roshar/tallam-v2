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

cat > "$WORK/README.txt" <<EOF
Tallam v2 offsite backup
created: $STAMP
database: $DB_NAME
host: $(hostname)
See docs/ARCHITECTURE.md in the git repo for restore steps.
EOF

ARCHIVE="$BACKUP_DIR/tallam-offsite-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK" \
  database.sql.gz \
  production.env \
  README.txt \
  $( [[ -f "$WORK/school-passwords.log" ]] && echo school-passwords.log )

chmod 600 "$ARCHIVE"
find "$BACKUP_DIR" -name 'tallam-offsite-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "BACKUP_OK $ARCHIVE"
ls -lh "$ARCHIVE"
