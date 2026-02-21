#!/usr/bin/env bash
# Deploy Client Engine to VPS from your Mac (when server has GitHub deploy key).
# Prereq: Server can git pull (see docs/DEPLOY_SSH_SETUP.md). If pull fails, use ./scripts/sync-and-deploy.sh instead.
# Usage: ./scripts/deploy-remote.sh

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@69.62.66.78}"
REPO_DIR="${DEPLOY_REPO_DIR:-/root/client-engine}"

echo "==> Deploying to $SERVER (repo: $REPO_DIR)"
if ! ssh -o ConnectTimeout=15 "$SERVER" "cd $REPO_DIR && git pull origin main && bash deploy.sh"; then
  echo ""
  echo "==> If git pull failed (e.g. permission denied), sync and deploy with: ./scripts/sync-and-deploy.sh"
  exit 1
fi
echo "==> Health check..."
curl -fsS https://evenslouis.ca/api/health
echo ""
echo "==> Deploy complete ✅"
