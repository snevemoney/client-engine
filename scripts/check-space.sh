#!/usr/bin/env bash
# Disk report. No auto-prune.

echo "==> df -h /"
df -h /
echo ""
echo "==> docker system df"
docker system df 2>/dev/null || true
echo ""
echo "==> Largest images"
docker images --format '{{.Size}}\t{{.Repository}}:{{.Tag}}' 2>/dev/null | sort -hr 2>/dev/null | head -10 || true
echo ""
echo "Recommended: docker builder prune -a -f  OR  bash scripts/vps-disk-cleanup.sh"
