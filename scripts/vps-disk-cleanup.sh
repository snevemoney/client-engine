#!/usr/bin/env bash
# Run on the VPS to free disk: Docker prune + optional container log truncate.
# From your Mac: ./scripts/run-vps-cleanup.sh (SSH runs this on the server).
# On the server: bash scripts/vps-disk-cleanup.sh
set -euo pipefail

echo "==> Disk usage (before)"
df -h /
echo ""
echo "==> Docker disk usage"
docker system df 2>/dev/null || true

echo ""
echo "==> Pruning build cache first (safe, no containers/volumes touched)..."
docker builder prune -a -f

echo ""
echo "==> Pruning unused images and stopped containers (volumes and running containers kept)..."
docker system prune -a -f

echo ""
echo "==> Truncating container log files only (keeps containers and data)..."
find /var/lib/docker/containers -name "*.log" -type f -exec truncate -s 0 {} \; 2>/dev/null || true

echo ""
echo "==> Disk usage (after)"
df -h /
echo "==> Done. Re-run deploy (e.g. ./scripts/sync-and-deploy.sh) if needed."