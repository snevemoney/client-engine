#!/usr/bin/env bash
# Production smoke test: homepage, login, dashboard, /api/health, /api/ops/command.
# Usage: ./scripts/smoke-test.sh [BASE_URL]
# Example: ./scripts/smoke-test.sh
#          ./scripts/smoke-test.sh https://evenslouis.ca

set -euo pipefail

BASE_URL="${1:-https://evenslouis.ca}"
BASE_URL="${BASE_URL%/}"
FAIL=0

echo "==> Smoke test: $BASE_URL"
echo ""

check() {
  local path="$1"
  local expected="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path" 2>/dev/null || echo "000")
  if [[ " $expected " == *" $code "* ]]; then
    echo "  OK   GET $path -> $code"
  else
    echo "  FAIL GET $path -> $code (expected one of: $expected)"
    FAIL=1
  fi
}

check "/" "200"
check "/login" "200 302 307"
check "/dashboard" "200 302 307"
check "/api/ops/command" "401 200"

# Health: must be 200 and body contains "ok":true
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
body=$(curl -s "$BASE_URL/api/health" 2>/dev/null || echo "")
if [ "$code" = "200" ] && echo "$body" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "  OK   GET /api/health -> 200, ok: true"
else
  echo "  FAIL GET /api/health -> code=$code or ok not true"
  FAIL=1
fi

# Optional: SSL cert present (if https)
if [[ "$BASE_URL" == https://* ]]; then
  host="${BASE_URL#https://}"
  host="${host%%/*}"
  if echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null; then
    echo "  OK   SSL $host"
  else
    echo "  SKIP SSL"
  fi
fi

echo ""
if [ $FAIL -eq 0 ]; then
  echo "==> Smoke test passed"
  exit 0
else
  echo "==> Smoke test failed"
  exit 1
fi
