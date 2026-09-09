#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="${1:-}"

if [[ -z "$DUMP" ]]; then
  echo "Usage: npm run db:import -- path/to/dump.sql"
  exit 1
fi

if [[ ! -f "$DUMP" ]]; then
  echo "Dump file not found: $DUMP"
  exit 1
fi

echo "→ Stopping MySQL and clearing old data..."
cd "$ROOT"
docker compose down -v

echo "→ Starting empty MySQL..."
docker compose up -d mysql

echo "→ Waiting for MySQL..."
for i in {1..30}; do
  if docker exec tallam-v2-mysql mysqladmin ping -utallam -ptallam_local --silent 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "→ Importing dump (this may take a minute)..."
docker exec -i tallam-v2-mysql mysql -utallam -ptallam_local govzalla_t_25 < "$DUMP"

echo "→ Applying v2 migrations (password reset table)..."
if [[ -f "$ROOT/database/init/03-password-reset-tokens.sql" ]]; then
  docker exec -i tallam-v2-mysql mysql -utallam -ptallam_local govzalla_t_25 \
    < "$ROOT/database/init/03-password-reset-tokens.sql"
fi

echo "✓ Done. Local DB is ready at 127.0.0.1:3307"
echo "  Restart backend: npm run dev"
