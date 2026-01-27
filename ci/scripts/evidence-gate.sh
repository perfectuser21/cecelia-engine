#!/usr/bin/env bash
set -euo pipefail

HEAD_SHA=$(git rev-parse HEAD)
FILE=".quality-evidence.${HEAD_SHA}.json"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Evidence not found: $FILE"
  exit 1
fi

# 校验 JSON 格式
if ! jq empty "$FILE" 2>/dev/null; then
  echo "❌ Evidence invalid JSON"
  exit 1
fi

# 校验 SHA
E_SHA=$(jq -r '.sha' "$FILE")
if [[ "$E_SHA" != "$HEAD_SHA" ]]; then
  echo "❌ Evidence SHA mismatch: expected $HEAD_SHA, got $E_SHA"
  exit 1
fi

# 校验字段
for key in sha ci_run_id timestamp qa_gate_passed audit_decision; do
  if ! jq -e ".$key" "$FILE" >/dev/null 2>&1; then
    echo "❌ Missing field: $key"
    exit 1
  fi
done

echo "✅ Evidence Gate Passed"
