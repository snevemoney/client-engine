#!/usr/bin/env bash
# Run VPS disk cleanup from your Mac (SSH + execute vps-disk-cleanup on server).
# Usage: ./scripts/run-vps-cleanup.sh
set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@69.62.66.78}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Running disk cleanup on $SERVER..."
ssh -o ConnectTimeout=15 "$SERVER" 'bash -s' < "$ROOT/scripts/vps-disk-cleanup.sh"
echo "==> Cleanup done. Run ./scripts/sync-and-deploy.sh to deploy."
