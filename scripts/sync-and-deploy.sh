#!/usr/bin/env bash
# Sync dev (local + GitHub main) with prod (VPS) and deploy.
# Use this when the server cannot git pull (no deploy key). Pushes to main, rsyncs to server, runs deploy.sh.
# Usage: ./scripts/sync-and-deploy.sh

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@69.62.66.78}"
REMOTE_DIR="${DEPLOY_REPO_DIR:-/root/client-engine}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

# 1) Push to main so GitHub has latest (prod will get it via rsync; main stays source of truth)
if [[ -n "$(git status --porcelain)" ]]; then
  echo "==> Uncommitted changes. Commit and push first, or run this after pushing."
  echo "    git add -A && git commit -m '...' && git push origin main"
  exit 1
fi
if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
  echo "==> Not on main. Checkout main and push, then run this script."
  exit 1
fi
echo "==> Pushing to origin main..."
git push origin main

# 2) Rsync code to server (exclude secrets and build artifacts)
echo "==> Rsyncing to $SERVER:$REMOTE_DIR ..."
rsync -avz --delete \
  --exclude=.env \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=test-results \
  --exclude=.cursor \
  "$ROOT/" "$SERVER:$REMOTE_DIR/"

# 3) Run deploy on server
echo "==> Running deploy.sh on server..."
ssh -o ConnectTimeout=15 "$SERVER" "cd $REMOTE_DIR && bash deploy.sh"

# 4) Health check
echo "==> Health check..."
curl -fsS https://evenslouis.ca/api/health
echo ""
echo "==> Dev and prod synced ✅"
