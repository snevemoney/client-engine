#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

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
