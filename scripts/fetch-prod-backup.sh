#!/usr/bin/env bash
# Run from the laptop. Makes a fresh dump on the VPS and copies it here.
# Usage: npm run backup:fetch
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${TALLAM_VPS:-root@185.207.0.41}"
REMOTE_DIR="/var/backups/tallam"
LOCAL_DIR="$ROOT/backups/offsite"
REMOTE_SCRIPT="/home/tallam-v2/scripts/backup-database.sh"

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR" 2>/dev/null || true

ssh_cmd() {
  if command -v sshpass >/dev/null && [[ -n "${SSHPASS:-}" ]]; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new \
      -o PreferredAuthentications=password \
      -o PubkeyAuthentication=no \
      "$@"
  else
    ssh -o StrictHostKeyChecking=accept-new "$@"
  fi
}

scp_cmd() {
  if command -v sshpass >/dev/null && [[ -n "${SSHPASS:-}" ]]; then
    sshpass -e scp -o StrictHostKeyChecking=accept-new \
      -o PreferredAuthentications=password \
      -o PubkeyAuthentication=no \
      "$@"
  else
    scp -o StrictHostKeyChecking=accept-new "$@"
  fi
}

echo "→ Creating dump on $HOST"
ssh_cmd "$HOST" "bash $REMOTE_SCRIPT"

LATEST="$(ssh_cmd "$HOST" "ls -1t $REMOTE_DIR/tallam-offsite-*.tar.gz | head -n 1")"
if [[ -z "$LATEST" ]]; then
  echo "No backup archive found on the server" >&2
  exit 1
fi

NAME="$(basename "$LATEST")"
echo "→ Copying $NAME"
scp_cmd "$HOST:$LATEST" "$LOCAL_DIR/$NAME"
chmod 600 "$LOCAL_DIR/$NAME"

echo "OFFSITE_OK $LOCAL_DIR/$NAME"
ls -lh "$LOCAL_DIR/$NAME"
echo "Keep this file outside the VPS. Do not commit it."
