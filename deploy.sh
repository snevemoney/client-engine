#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building containers..."
docker compose build app worker

echo "==> Starting services..."
docker compose up -d

echo "==> Running database migrations..."
docker compose exec app npx prisma migrate deploy

echo "==> Seeding admin user (if needed)..."
docker compose exec app node prisma/seed.mjs

echo "==> Done. Services:"
docker compose ps
