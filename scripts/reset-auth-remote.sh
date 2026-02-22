#!/usr/bin/env bash
# Run reset-auth on the production server (evenslouis.ca).
# Uses the same env as the app (server .env). Ensure ADMIN_EMAIL and ADMIN_PASSWORD
# are set on the server so the created user matches what you use to log in.
# Usage: ./scripts/reset-auth-remote.sh

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@69.62.66.78}"
REMOTE_DIR="${DEPLOY_REPO_DIR:-/root/client-engine}"

echo "==> Running reset-auth on production ($SERVER)..."
ssh -o ConnectTimeout=15 "$SERVER" "cd $REMOTE_DIR && docker compose run --rm --user root app node prisma/reset-auth.mjs"
echo ""
echo "==> Done. Log in at https://evenslouis.ca/login with ADMIN_EMAIL and ADMIN_PASSWORD from the server's .env."
