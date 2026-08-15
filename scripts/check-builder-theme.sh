#!/bin/bash
# Diagnostic: Check site-builder themeColorsJson.
# Usage: ./scripts/check-builder-theme.sh [siteId]
# Get siteId from project.builderSiteId or preview URL (e.g. .../preview/cmm6tb1xv0001v5lk39rhgy0i)
set -e
DB="../site-builder/prisma/dev.db"
if [ ! -f "$DB" ]; then
  echo "Site-builder DB not found at $DB"
  exit 1
fi
if [ -n "$1" ]; then
  echo "Checking site: $1"
  sqlite3 "$DB" "SELECT id, clientName, industry, themeColorsJson FROM Site WHERE id='$1';"
  TC=$(sqlite3 "$DB" "SELECT themeColorsJson FROM Site WHERE id='$1';")
  if [ -z "$TC" ] || [ "$TC" = "" ]; then
    echo ""
    echo ">>> ROOT CAUSE: themeColorsJson is null — preview uses industry default (green)"
    echo ">>> Regenerate should persist brandColors; check site-builder generate route logs"
  fi
else
  echo "Sites in site-builder:"
  sqlite3 "$DB" "SELECT id, clientName, substr(themeColorsJson,1,50) as theme FROM Site LIMIT 5;"
  echo ""
  echo "Run with siteId: ./scripts/check-builder-theme.sh <siteId>"
fi
