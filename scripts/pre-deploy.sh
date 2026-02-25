#!/usr/bin/env bash
# Pre-deploy validation: lint, build, tests, env check.
# Run before every production deploy. Exit 1 if any step fails.
# Usage: ./scripts/pre-deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0

echo "==> Pre-deploy validation"
echo ""

# 1. Lint
echo "[1/5] Lint..."
if npm run lint 2>/dev/null; then
  echo "  OK   lint"
else
  echo "  FAIL lint"
  FAIL=1
fi

# 2. TypeScript
echo "[2/5] TypeScript..."
if npx tsc --noEmit 2>/dev/null; then
  echo "  OK   tsc --noEmit"
else
  echo "  FAIL tsc --noEmit"
  FAIL=1
fi

# 3. Prisma
echo "[3/5] Prisma schema..."
if npx prisma validate 2>/dev/null; then
  echo "  OK   prisma validate"
else
  echo "  FAIL prisma validate"
  FAIL=1
fi

# 4. Build
echo "[4/5] Build..."
if npm run build 2>/dev/null; then
  echo "  OK   build"
else
  echo "  FAIL build"
  FAIL=1
fi

# 5. Unit tests
echo "[5/5] Unit tests..."
if npm run test 2>/dev/null; then
  echo "  OK   test"
else
  echo "  FAIL test"
  FAIL=1
fi

echo ""
if [ $FAIL -eq 0 ]; then
  echo "==> Pre-deploy validation passed"
  echo ""
  echo "Next: start server and run E2E (optional):"
  echo "  npm run dev &"
  echo "  USE_EXISTING_SERVER=1 npm run test:e2e"
  exit 0
else
  echo "==> Pre-deploy validation failed"
  exit 1
fi
