#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "==> Backing up database..."
OUTPUT="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
docker compose exec -T postgres pg_dump -U engine client_engine | gzip > "$OUTPUT"

if ! test -s "$OUTPUT"; then
  echo "FAIL: Backup file empty or missing"
  exit 1
fi
if ! gunzip -t "$OUTPUT" 2>/dev/null; then
  echo "FAIL: Backup file corrupted (gunzip -t failed)"
  exit 1
fi

echo "==> Backup saved: $OUTPUT"
ls -lh "$OUTPUT"

# Keep last 10 backups
ls -t "$BACKUP_DIR"/db_*.sql.gz | tail -n +11 | xargs -r rm --
echo "==> Cleanup done. Backups:"
ls -lh "$BACKUP_DIR"/db_*.sql.gz
