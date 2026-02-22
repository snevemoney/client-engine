#!/usr/bin/env bash
# Fast deploy: rebuild app+worker, restart, optional DB sync, health check.
# Run on VPS from repo root: ./scripts/deploy-fast.sh [--schema]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3200}"
DO_SCHEMA=""
for arg in "$@"; do
  [[ "$arg" == "--schema" ]] && DO_SCHEMA=1
done

on_fail() {
  echo ""
  echo "==> Deploy failed. Last 50 lines (app + worker):"
  docker compose logs --tail=50 app worker 2>/dev/null || true
  exit 1
}
trap on_fail ERR

echo "==> [1/4] Building app + worker..."
docker compose build app worker

echo "==> [2/4] Restarting services..."
docker compose up -d app worker

if [[ -n "$DO_SCHEMA" ]]; then
  echo "==> [2b/4] DB sync (--schema)..."
  docker compose run --rm --user root app npx prisma db push --accept-data-loss
  docker compose run --rm --user root app node prisma/seed.mjs
  docker compose run --rm --user root app node prisma/seed-projects.mjs
else
  echo "==> [2b/4] Skipping DB sync (use --schema if Prisma changed)"
fi

echo "==> [3/4] Waiting for app..."
sleep 5

echo "==> [4/4] Health check..."
if curl -sfS "${HEALTH_URL}/api/health" >/dev/null; then
  echo "PASS: Health check OK"
  docker compose ps
  exit 0
fi
on_fail
