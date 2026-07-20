#!/usr/bin/env bash
# Reports how old the verified prices are. Prices drift; a figure with a
# date is only trustworthy near that date.
set -uo pipefail
cd "$(dirname "$0")/.."

CATALOG=skills/stackreason/references/service-catalog.md
date_line=$(grep -oE "prices-verified: [0-9]{4}-[0-9]{2}-[0-9]{2}" "$CATALOG" | head -1 | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}")

if [ -z "$date_line" ]; then
  echo "No check date found in $CATALOG"
  exit 1
fi

if date -j >/dev/null 2>&1; then          # BSD date (macOS)
  checked=$(date -j -f "%Y-%m-%d" "$date_line" +%s)
else                                       # GNU date
  checked=$(date -d "$date_line" +%s)
fi
now=$(date +%s)
days=$(( (now - checked) / 86400 ))

echo "Prices last verified: $date_line  ($days days ago)"
echo "Verified figures:     $(grep -c '\[v\]' "$CATALOG")"
echo

if   [ "$days" -gt 180 ]; then echo "STALE — over 6 months. Re-verify before relying on any figure."; exit 1
elif [ "$days" -gt 90 ];  then echo "AGEING — over 3 months. Worth a refresh pass."; exit 0
else                           echo "Fresh enough. Still verify anything reaching a real budget."; exit 0
fi
