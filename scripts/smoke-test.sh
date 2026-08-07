#!/usr/bin/env bash
# Production smoke test: public site + operator /pro app.
# Usage: ./scripts/smoke-test.sh [PUBLIC_URL] [PRO_URL]
# Example: ./scripts/smoke-test.sh
#          ./scripts/smoke-test.sh https://evenslouis.ca https://evenslouis.ca/pro
#
# Public site (root :3200): homepage, site lead form, /api/health
# Operator OS (/pro :3204): /pro/login, /pro/dashboard, /pro/api/health

set -euo pipefail

PUBLIC_URL="${1:-https://evenslouis.ca}"
PRO_URL="${2:-https://evenslouis.ca/pro}"
PUBLIC_URL="${PUBLIC_URL%/}"
PRO_URL="${PRO_URL%/}"
FAIL=0

echo "==> Smoke test"
echo "    public: $PUBLIC_URL"
echo "    pro:    $PRO_URL"
echo ""

check() {
  local base="$1"
  local path="$2"
  local expected="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$base$path" 2>/dev/null || echo "000")
  if [[ " $expected " == *" $code "* ]]; then
    echo "  OK   GET $base$path -> $code"
  else
    echo "  FAIL GET $base$path -> $code (expected one of: $expected)"
    FAIL=1
  fi
}

check_health() {
  local base="$1"
  local path="${2:-/api/health}"
  local code body
  code=$(curl -s -o /dev/null -w "%{http_code}" "$base$path" 2>/dev/null || echo "000")
  body=$(curl -s "$base$path" 2>/dev/null || echo "")
  if [ "$code" = "200" ] && echo "$body" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
    echo "  OK   GET $base$path -> 200, ok: true"
  else
    echo "  FAIL GET $base$path -> code=$code or ok not true"
    FAIL=1
  fi
}

echo "-- public site (root) --"
check "$PUBLIC_URL" "/" "200"
check_health "$PUBLIC_URL" "/api/health"

# Site leads form (public root only)
code=$(curl -s -o /tmp/site-leads.json -w "%{http_code}" -X POST "$PUBLIC_URL/api/site/leads" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke\",\"email\":\"smoke-$(date +%s)@example.com\",\"message\":\"Smoke test\"}" 2>/dev/null || echo "000")
if [ "$code" = "200" ] && grep -q '"ok"[[:space:]]*:[[:space:]]*true' /tmp/site-leads.json 2>/dev/null; then
  echo "  OK   POST $PUBLIC_URL/api/site/leads -> 200, ok: true"
else
  echo "  FAIL POST $PUBLIC_URL/api/site/leads -> code=$code"
  FAIL=1
fi

echo ""
echo "-- operator OS (/pro) --"
check "$PRO_URL" "/login" "200 302 307"
check "$PRO_URL" "/dashboard" "200 302 307"
check "$PRO_URL" "/api/ops/command" "401 200"
check_health "$PRO_URL" "/api/health"

# Optional: SSL cert present (if https)
if [[ "$PUBLIC_URL" == https://* ]]; then
  host="${PUBLIC_URL#https://}"
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
