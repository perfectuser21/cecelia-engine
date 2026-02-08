#!/usr/bin/env bash
# DoD Anti-Cheat - 10-layer verification (reused from OKR stop-okr.sh architecture)
#
# Prevents bypassing validation via:
# - Manual score editing
# - Report deletion
# - Environment variable bypass
# - SHA256 hash mismatch
#
# Exit codes:
#   0 - All checks pass
#   2 - Any check fails (blocks workflow, maintains Stop Hook loop)

set -euo pipefail

DOD_FILE="${1:-.dod-*.md}"
REPORT_FILE=".dod-validation-report.json"

# Resolve glob pattern
DOD_FILE=$(ls $DOD_FILE 2>/dev/null | head -1 || echo "")

if [[ -z "$DOD_FILE" ]]; then
    echo "❌ Layer 1 FAIL: DoD file not found (pattern: .dod-*.md)" >&2
    exit 2
fi

echo "🔒 DoD Anti-Cheat: 10-layer verification"
echo ""

# ===== Layer 1: File Exists =====
echo "Layer 1: DoD file exists"
if [[ ! -f "$DOD_FILE" ]]; then
    echo "❌ FAIL: $DOD_FILE not found" >&2
    exit 2
fi
echo "✅ PASS"

# ===== Layer 2: Not Empty =====
echo "Layer 2: DoD not empty"
if [[ ! -s "$DOD_FILE" ]]; then
    echo "❌ FAIL: $DOD_FILE is empty" >&2
    exit 2
fi
echo "✅ PASS"

# ===== Layer 3: Has Frontmatter =====
echo "Layer 3: Has frontmatter"
if ! head -1 "$DOD_FILE" | grep -q '^---$'; then
    echo "❌ FAIL: Missing YAML frontmatter" >&2
    exit 2
fi
echo "✅ PASS"

# ===== Layer 4: Report Exists =====
echo "Layer 4: Validation report exists"
if [[ ! -f "$REPORT_FILE" ]]; then
    echo "❌ FAIL: $REPORT_FILE not found" >&2
    echo "   Run: python skills/dev/scripts/validate-dod.py \"$DOD_FILE\"" >&2
    exit 2
fi
echo "✅ PASS"

# ===== Layer 5: Report Not Empty =====
echo "Layer 5: Report not empty"
if [[ ! -s "$REPORT_FILE" ]]; then
    echo "❌ FAIL: $REPORT_FILE is empty" >&2
    exit 2
fi
echo "✅ PASS"

# ===== Layer 6: Report Valid JSON =====
echo "Layer 6: Report valid JSON"
if ! jq empty "$REPORT_FILE" 2>/dev/null; then
    echo "❌ FAIL: $REPORT_FILE is not valid JSON" >&2
    exit 2
fi
echo "✅ PASS"

# ===== Layer 7: Has Score Fields =====
echo "Layer 7: Report has score fields"
FORM_SCORE=$(jq -r '.form_score // "null"' "$REPORT_FILE")
CONTENT_SCORE=$(jq -r '.content_score // "null"' "$REPORT_FILE")
TOTAL_SCORE=$(jq -r '.total_score // "null"' "$REPORT_FILE")

if [[ "$FORM_SCORE" == "null" ]] || [[ "$CONTENT_SCORE" == "null" ]] || [[ "$TOTAL_SCORE" == "null" ]]; then
    echo "❌ FAIL: Missing score fields in report" >&2
    echo "   form_score: $FORM_SCORE" >&2
    echo "   content_score: $CONTENT_SCORE" >&2
    echo "   total_score: $TOTAL_SCORE" >&2
    exit 2
fi
echo "✅ PASS (form: $FORM_SCORE, content: $CONTENT_SCORE, total: $TOTAL_SCORE)"

# ===== Layer 8: SHA256 Match =====
echo "Layer 8: SHA256 hash match"
REPORT_SHA=$(jq -r '.content_sha256 // "null"' "$REPORT_FILE")
ACTUAL_SHA=$(sha256sum "$DOD_FILE" | awk '{print $1}')

if [[ "$REPORT_SHA" != "$ACTUAL_SHA" ]]; then
    echo "❌ FAIL: SHA256 mismatch (content modified after validation)" >&2
    echo "   Report SHA: $REPORT_SHA" >&2
    echo "   Actual SHA: $ACTUAL_SHA" >&2
    echo "   Re-run: python skills/dev/scripts/validate-dod.py \"$DOD_FILE\"" >&2
    exit 2
fi
echo "✅ PASS"

# ===== Layer 9: Score >= 90 =====
echo "Layer 9: Total score >= 90"
if (( TOTAL_SCORE < 90 )); then
    echo "❌ FAIL: Score $TOTAL_SCORE < 90" >&2
    echo "   Read validation report for issues to fix" >&2
    exit 2
fi
echo "✅ PASS"

# ===== Layer 10: No Bypass Env =====
echo "Layer 10: No bypass environment variables"
if [[ "${SKIP_VALIDATION:-false}" == "true" ]]; then
    echo "❌ FAIL: SKIP_VALIDATION=true detected (bypass not allowed)" >&2
    exit 2
fi
echo "✅ PASS"

echo ""
echo "🎉 All 10 layers passed - DoD quality verified"
exit 0
