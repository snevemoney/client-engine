#!/usr/bin/env bash
# Safe deploy: full preflight, build, restart, DB sync, health check.
# Run on VPS from repo root: ./scripts/deploy-safe.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3200}"
MIN_FREE_GB=2

echo "==> Preflight checks..."
free_gb=$(df -k / | awk 'NR==2 {print $4}' | xargs -I{} echo $(({} / 1024 / 1024)) 2>/dev/null || echo 0)
if [[ "$free_gb" -lt "$MIN_FREE_GB" ]]; then
  echo "WARN: Low disk (~${free_gb}GB free). Need ${MIN_FREE_GB}GB."
  echo "      Run: ./scripts/check-space.sh"
  echo "      Set SKIP_DISK_CHECK=1 to override"
  [[ "${SKIP_DISK_CHECK:-}" != "1" ]] && exit 1
fi

docker info >/dev/null 2>&1 || { echo "FAIL: Docker not available"; exit 1; }
[[ -f .env ]] || { echo "FAIL: .env not found"; exit 1; }
npx prisma validate 2>/dev/null || { echo "FAIL: Prisma schema invalid"; exit 1; }
echo "  OK   Preflight passed"
echo ""

echo "==> Building..."
docker compose build app worker

echo "==> Restarting..."
docker compose up -d

echo "==> DB sync..."
docker compose run --rm --user root app npx prisma db push --accept-data-loss
docker compose run --rm --user root app node prisma/seed.mjs
docker compose run --rm --user root app node prisma/seed-projects.mjs

echo "==> Health check..."
sleep 5
if curl -sfS "${HEALTH_URL}/api/health" >/dev/null; then
  echo "PASS"
  docker compose ps
  exit 0
fi
echo "FAIL: Health check failed"
bash "$SCRIPT_DIR/rollback-help.sh"
exit 1
