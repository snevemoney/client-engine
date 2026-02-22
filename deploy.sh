#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Preflight: require at least 2GB free on / to avoid ENOSPC during npm/prisma
MIN_FREE_GB=2
FREE_KB=$(df -k / | awk 'NR==2 {print $4}')
FREE_GB=$((FREE_KB / 1024 / 1024))
if [[ "$FREE_GB" -lt "$MIN_FREE_GB" ]]; then
  echo "==> ERROR: Low disk space. Need at least ${MIN_FREE_GB}GB free, have ~${FREE_GB}GB. Run: docker system prune -a -f; docker builder prune -a -f"
  exit 1
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
