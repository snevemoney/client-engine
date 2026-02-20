#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "==> Backing up database..."
docker compose exec -T postgres pg_dump -U engine client_engine | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

echo "==> Backup saved: $BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
ls -lh "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

# Keep last 10 backups
ls -t "$BACKUP_DIR"/db_*.sql.gz | tail -n +11 | xargs -r rm --
echo "==> Cleanup done. Backups:"
ls -lh "$BACKUP_DIR"/db_*.sql.gz
