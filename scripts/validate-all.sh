#!/usr/bin/env bash
# Validates every generated design in the repo, checks the skills are
# well-formed, and confirms the validator still rejects known defects.
set -uo pipefail
cd "$(dirname "$0")/.."

VALIDATOR=skills/stackreason/references/validate.js
status=0
fail() { echo "FAIL  $*"; status=1; }
ok()   { echo "ok    $*"; }

echo "== designs =="
for f in skills/stackreason/references/html-template.html examples/*.html; do
  if node "$VALIDATOR" "$f" >/dev/null 2>&1; then
    ok "$(basename "$f")"
  else
    fail "$(basename "$f")"
    node "$VALIDATOR" "$f" 2>&1 | grep FAIL | sed 's/^/      /'
  fi
done

echo
echo "== skill frontmatter =="
for d in skills/*/; do
  name=$(basename "$d")
  f="$d/SKILL.md"
  [ -f "$f" ] || { fail "$name: no SKILL.md"; continue; }
  head -1 "$f" | grep -q -- '---' || { fail "$name: no frontmatter"; continue; }
  fm_name=$(sed -n '2,10p' "$f" | grep '^name:' | sed 's/^name: *//')
  grep -q '^description:' "$f" || fail "$name: no description"
  if [ "$fm_name" != "$name" ]; then
    fail "$name: frontmatter name is '$fm_name', should match directory"
  else
    ok "$name"
  fi
done

echo
echo "== self-contained =="
if grep -rlE '(src|href)="https?://' examples/*.html skills/stackreason/references/html-template.html 2>/dev/null; then
  fail "external reference in a generated page"
else
  ok "no external references"
fi

echo
echo "== validator still bites =="
src=examples/small-booking-app-design.html
check() {
  if node "$VALIDATOR" "$1" >/dev/null 2>&1; then fail "validator accepted $2"; else ok "caught $2"; fi
  rm -f "$1"
}
sed 's/cost: 20,/cost: 999,/'          "$src" > /tmp/sr1.html; check /tmp/sr1.html "broken cost arithmetic"
sed 's/  stack: \[/  stack_off: [/'    "$src" > /tmp/sr2.html; check /tmp/sr2.html "missing stack decision"
sed 's/  verdict: `/  verdict_off: `/' "$src" > /tmp/sr3.html; check /tmp/sr3.html "missing verdict"
sed 's/patterns: \[/patterns_off: [/'  "$src" > /tmp/sr4.html; check /tmp/sr4.html "missing access patterns"

echo
[ $status -eq 0 ] && echo "ALL CHECKS PASS" || echo "FAILURES ABOVE"
exit $status
