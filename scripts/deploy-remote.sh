#!/usr/bin/env bash
# Deploy Client Engine to VPS from your Mac.
# Prereq: Server can pull from GitHub (see docs/DEPLOY_SSH_SETUP.md steps 2–6).
# Usage: ./scripts/deploy-remote.sh

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@69.62.66.78}"
REPO_DIR="${DEPLOY_REPO_DIR:-/root/client-engine}"

echo "==> Deploying to $SERVER (repo: $REPO_DIR)"
ssh -o ConnectTimeout=15 "$SERVER" "cd $REPO_DIR && git pull origin main && bash deploy.sh"
echo "==> Health check..."
curl -fsS https://evenslouis.ca/api/health
echo ""
echo "==> Deploy complete ✅"
