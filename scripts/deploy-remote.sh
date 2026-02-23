#!/usr/bin/env bash
# Deploy from your Mac. One command: git pull on server + deploy. No manual SSH.
# Usage: ./scripts/deploy-remote.sh [--full]
#   --full  = full deploy with DB sync (use when Prisma changed)

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@69.62.66.78}"
REPO_DIR="${DEPLOY_REPO_DIR:-/root/client-engine}"
DEPLOY_SCRIPT="deploy-fast.sh"
[[ "${1:-}" == "--full" ]] && DEPLOY_SCRIPT="deploy-safe.sh"

echo "==> Deploying ($DEPLOY_SCRIPT)..."
if ! ssh -o ConnectTimeout=15 "$SERVER" "cd $REPO_DIR && git pull origin main && bash scripts/$DEPLOY_SCRIPT"; then
  echo ""
  echo "==> If git pull failed, use: ./scripts/sync-and-deploy.sh"
  exit 1
fi
echo "==> Health check..."
curl -fsS https://evenslouis.ca/api/health
echo ""
echo "==> Deploy complete ✅"
