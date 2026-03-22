#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

warn_count=0
fail_count=0

info() {
  printf 'INFO: %s\n' "$1"
}

warn() {
  warn_count=$((warn_count + 1))
  printf 'WARN: %s\n' "$1"
}

fail() {
  fail_count=$((fail_count + 1))
  printf 'FAIL: %s\n' "$1"
}

count_files() {
  find "$1" -type f 2>/dev/null | wc -l | tr -d ' '
}

find_python() {
  for cmd in python3 python py; do
    if command -v "$cmd" >/dev/null 2>&1; then
      printf '%s' "$cmd"
      return 0
    fi
  done
  return 1
}

info "Running studio check in $ROOT"

src_count=0
design_count=0

if [ -d "src" ]; then
  src_count="$(count_files src)"
fi

if [ -d "design/gdd" ]; then
  design_count="$(find design/gdd -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
fi

if [ ! -f "AGENTS.md" ]; then
  fail "Missing root AGENTS.md"
fi

if [ ! -f "production/studio-status.md" ]; then
  warn "Missing production/studio-status.md"
fi

if [ "$src_count" -gt 10 ] && [ "$design_count" -lt 2 ]; then
  warn "Source files are growing, but design docs are still sparse"
fi

if [ -f "production/studio-status.md" ]; then
  if ! grep -q "^## 当前阶段" "production/studio-status.md"; then
    warn "production/studio-status.md is missing the '当前阶段' section"
  fi
  if ! grep -q "^## 当前最高优先级" "production/studio-status.md"; then
    warn "production/studio-status.md is missing the '当前最高优先级' section"
  fi
fi

if [ -d "design/gdd" ]; then
  while IFS= read -r doc; do
    [ -n "$doc" ] || continue
    if ! grep -q "^## 1\\. " "$doc"; then
      warn "Design doc may not follow the template structure: $doc"
    fi
    if ! grep -q "验收标准" "$doc"; then
      warn "Design doc is missing acceptance criteria: $doc"
    fi
  done < <(find design/gdd -type f -name '*.md' 2>/dev/null)
fi

if [ -d "assets/data" ]; then
  if py_cmd="$(find_python)"; then
    while IFS= read -r json_file; do
      [ -n "$json_file" ] || continue
      if ! "$py_cmd" -m json.tool "$json_file" >/dev/null 2>&1; then
        fail "Invalid JSON: $json_file"
      fi
    done < <(find assets/data -type f -name '*.json' 2>/dev/null)
  else
    warn "No Python interpreter found, skipping JSON validation"
  fi
fi

if [ -d "production/sprints" ]; then
  sprint_count="$(find production/sprints -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$src_count" -gt 20 ] && [ "$sprint_count" -eq 0 ]; then
    warn "Code exists, but no sprint documents were found"
  fi
fi

printf '\nSummary: %s warning(s), %s failure(s)\n' "$warn_count" "$fail_count"

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi

exit 0
