#!/usr/bin/env bash
# Every Phosphor class used in the site must have a rule in midnight.css.
# The stylesheet ships a subset of @phosphor-icons/web, so an undeclared class
# renders as nothing at all. Run this after adding or renaming an icon.
set -uo pipefail
cd "$(dirname "$0")/.."

used=$(grep -rhoE '\bph(-fill)? ph-[a-z0-9-]+' \
         --include='*.html' --include='*.js' --include='*.css' \
         . 2>/dev/null \
       | grep -v '^\.' | sort -u)

missing=0
while read -r cls; do
  [ -z "$cls" ] && continue
  weight=${cls%% *}          # ph | ph-fill
  name=${cls##* }            # ph-foo
  if ! grep -q "\.${weight}\.${name}:before" midnight.css; then
    echo "missing: $weight $name"
    missing=$((missing + 1))
  fi
done <<< "$used"

total=$(echo "$used" | grep -c .)
if [ "$missing" -gt 0 ]; then
  echo "$missing of $total icon classes are not declared in midnight.css"
  exit 1
fi
echo "all $total icon classes declared"
