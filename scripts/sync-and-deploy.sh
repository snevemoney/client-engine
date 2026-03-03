#!/usr/bin/env bash
# Sync dev (local + GitHub main) with prod (VPS) and deploy.
# Use this when the server cannot git pull (no deploy key). Pushes to main, rsyncs to server, runs deploy.sh.
# Usage: ./scripts/sync-and-deploy.sh [--full]
#   --full = run deploy-safe (DB sync, seeds) instead of deploy-fast

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

# 3) Run deploy on server (detached so SSH timeout can't kill the build)
DEPLOY_SCRIPT="deploy-fast.sh"
[[ "${1:-}" == "--full" ]] && DEPLOY_SCRIPT="deploy-safe.sh"
echo "==> Running $DEPLOY_SCRIPT on server (detached)..."
ssh -o ConnectTimeout=15 "$SERVER" \
  "cd $REMOTE_DIR && nohup bash scripts/$DEPLOY_SCRIPT > /tmp/deploy.log 2>&1 &
   DEPLOY_PID=\$!
   echo \"Deploy started (PID \$DEPLOY_PID). Tailing log...\"
   # Follow the log but exit cleanly if SSH drops — build continues on server
   tail -f /tmp/deploy.log --pid=\$DEPLOY_PID 2>/dev/null || true
   wait \$DEPLOY_PID 2>/dev/null
   exit \$?"

# 4) Health check (retry a few times — container may still be starting)
echo "==> Health check..."
for i in 1 2 3 4 5; do
  if curl -fsS https://evenslouis.ca/api/health >/dev/null 2>&1; then
    echo "PASS: Health check OK"
    echo "==> Dev and prod synced ✅"
    exit 0
  fi
  echo "  Waiting... ($i)"
  sleep 5
done
echo "WARN: Health check didn't pass yet. Build may still be running on VPS."
echo "  Check: ssh $SERVER 'tail -f /tmp/deploy.log'"
echo "  Or:    curl https://evenslouis.ca/api/health"
