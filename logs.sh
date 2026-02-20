#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

SERVICE="${1:-app}"
LINES="${2:-100}"

echo "==> Logs for $SERVICE (last $LINES lines):"
docker compose logs "$SERVICE" --tail "$LINES" -f
