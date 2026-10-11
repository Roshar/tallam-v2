#!/usr/bin/env bash
# Deploy v2 from the laptop: build here, ship the built artifacts, restart PM2.
#
# Why not build on the server: the VPS has ~1 GB of RAM and no headroom. A build
# spike pushes it to the limit, and the kernel OOM killer does not care that the
# build is disposable — it picks the largest consumer, which is MariaDB. Shipping
# a locally built dist keeps the server out of it entirely.
#
# Usage: npm run deploy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${TALLAM_VPS:-root@185.207.0.41}"
REMOTE_DIR="/home/tallam-v2"
BACKUP_DIR="/var/backups/tallam/dist"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)

cd "$ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash before deploying:" >&2
  git status --short >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
LOCAL_HEAD="$(git rev-parse HEAD)"
SERVER_HEAD="$(ssh "${SSH_OPTS[@]}" "$HOST" "cd $REMOTE_DIR && git rev-parse HEAD")"

echo "→ local HEAD:  $LOCAL_HEAD"
echo "→ server HEAD: $SERVER_HEAD"

echo "→ Building locally"
npm run build

echo "→ Pulling sources on the server"
ssh "${SSH_OPTS[@]}" "$HOST" "cd $REMOTE_DIR && git pull --ff-only origin $BRANCH | tail -3"

if git diff --name-only "$SERVER_HEAD" "$LOCAL_HEAD" 2>/dev/null | grep -q '^package-lock\.json$'; then
  echo "→ Dependencies changed, running npm ci on the server"
  ssh "${SSH_OPTS[@]}" "$HOST" "cd $REMOTE_DIR && npm ci --no-audit --no-fund | tail -3"
else
  echo "→ Dependencies unchanged, skipping npm ci"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
echo "→ Backing up the build currently on the server"
ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p $BACKUP_DIR \
  && cp -r $REMOTE_DIR/backend/dist $BACKUP_DIR/backend-$STAMP \
  && cp -r $REMOTE_DIR/frontend/dist $BACKUP_DIR/frontend-$STAMP \
  && echo '  $BACKUP_DIR/*-$STAMP'"

echo "→ Shipping artifacts"
# Везём в dist.new и только потом подменяем: если передача оборвётся, на сервере
# останется прежняя рабочая сборка. tar тут не годится — он сначала стирает цель,
# и оборванный поток оставил бы сайт без фронта. Заодно нет возни с macOS-xattr.
ship_tree() {
  local name="$1"
  ssh "${SSH_OPTS[@]}" "$HOST" "rm -rf $REMOTE_DIR/$name/dist.new"
  scp -q -r "${SSH_OPTS[@]}" "$name/dist" "$HOST:$REMOTE_DIR/$name/dist.new"
  ssh "${SSH_OPTS[@]}" "$HOST" "rm -rf $REMOTE_DIR/$name/dist && mv $REMOTE_DIR/$name/dist.new $REMOTE_DIR/$name/dist"
}
ship_tree backend
ship_tree frontend

echo "→ Restarting the API (old.tallam.ru process is not touched)"
ssh "${SSH_OPTS[@]}" "$HOST" "pm2 restart tallam-v2 --update-env >/dev/null && sleep 2 && pm2 list --no-color | grep -E 'tallam-v2|index '"

echo "→ Health check"
curl -fsS -m 20 https://tallam.ru/api/health
echo
echo "→ Assets now served:"
curl -fsS -m 20 https://tallam.ru/ | grep -oE '/assets/[A-Za-z0-9._-]+' | sort -u

echo
echo "DEPLOY_OK $STAMP"
echo "Rollback: restore $BACKUP_DIR/{backend,frontend}-$STAMP and pm2 restart tallam-v2"
