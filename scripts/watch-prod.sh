#!/usr/bin/env bash
# Tail logs. Usage: ./scripts/watch-prod.sh [--since 10m]

SINCE=""
[[ "${1:-}" == "--since" ]] && SINCE="${2:-10m}"
if [[ -n "$SINCE" ]]; then
  docker compose logs -f --since "$SINCE" app worker
else
  docker compose logs -f app worker
fi
