#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Preflight: require at least 2GB free. If low, try Docker prune and re-check (self-heal).
MIN_FREE_GB=2
check_disk() {
  local free_kb
  free_kb=$(df -k / | awk 'NR==2 {print $4}')
  echo $((free_kb / 1024 / 1024))
}
FREE_GB=$(check_disk)
if [[ "$FREE_GB" -lt "$MIN_FREE_GB" ]]; then
  echo "==> Low disk (~${FREE_GB}GB free). Pruning build cache first..."
  docker builder prune -a -f
  FREE_GB=$(check_disk)
  if [[ "$FREE_GB" -lt "$MIN_FREE_GB" ]]; then
    echo "==> Still low. Pruning unused images/containers (keeps running containers and volumes)..."
    docker system prune -a -f
    FREE_GB=$(check_disk)
  fi
  if [[ "$FREE_GB" -lt "$MIN_FREE_GB" ]]; then
    echo "==> ERROR: Still only ~${FREE_GB}GB free. Need ${MIN_FREE_GB}GB. Free space manually or run: ./scripts/run-vps-cleanup.sh"
    exit 1
  fi
  echo "==> Freed enough space (~${FREE_GB}GB free). Continuing."
fi
echo "==> Disk OK (~${FREE_GB}GB free)"

echo "==> Building containers..."
docker compose build app worker

echo "==> Starting services..."
docker compose up -d

echo "==> Running database sync..."
docker compose run --rm --user root app npx prisma@6.19.2 db push --accept-data-loss

echo "==> Seeding admin user (if needed)..."
docker compose run --rm --user root app node prisma/seed.mjs

echo "==> Syncing portfolio projects (screenshots, etc.)..."
docker compose run --rm --user root app node prisma/seed-projects.mjs

echo "==> Done. Services:"
docker compose ps
