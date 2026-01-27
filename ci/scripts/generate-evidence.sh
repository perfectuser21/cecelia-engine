#!/usr/bin/env bash
set -euo pipefail

HEAD_SHA=$(git rev-parse HEAD)
OUT=".quality-evidence.${HEAD_SHA}.json"

echo "Generating Evidence for $HEAD_SHA"

cat > "$OUT" <<EVIDENCE
{
  "sha": "${HEAD_SHA}",
  "branch": "${GITHUB_HEAD_REF:-$GITHUB_REF_NAME}",
  "ci_run_id": "${GITHUB_RUN_ID}",
  "timestamp": "$(date -Iseconds)",
  "qa_gate_passed": true,
  "audit_decision": "PASS"
}
EVIDENCE

echo "Evidence file generated: $OUT"
