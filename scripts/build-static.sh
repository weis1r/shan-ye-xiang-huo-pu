#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

rm -rf "$DIST"
mkdir -p "$DIST/src/gameplay" "$DIST/assets/data"

cp "$ROOT/index.html" "$DIST/index.html"
cp "$ROOT/src/gameplay/main.js" "$DIST/src/gameplay/main.js"
cp "$ROOT/src/gameplay/style.css" "$DIST/src/gameplay/style.css"
cp "$ROOT/assets/data/festival-content.json" "$DIST/assets/data/festival-content.json"

printf 'Built static bundle at %s\n' "$DIST"
