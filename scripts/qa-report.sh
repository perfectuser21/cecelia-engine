#!/usr/bin/env bash
# ============================================================================
# QA Report Generator v2
# ============================================================================
#
# 生成 QA 审计报告 JSON，供 Dashboard 使用
#
# 用法:
#   bash scripts/qa-report.sh              # 完整检查（包括运行测试）
#   bash scripts/qa-report.sh --fast       # 快速检查（跳过 npm run qa）
#   bash scripts/qa-report.sh --output     # 输出到 .qa-report.json
#   bash scripts/qa-report.sh --post URL   # POST 到指定 URL
#
# 检查内容 (v2):
#   - Meta:  Feature → RCI 覆盖率 + P0 触发规则
#   - Unit:  真实运行 npm run qa（typecheck + test + build）
#   - E2E:   Golden Paths 结构完整性 + RCI 可解析
#
# ============================================================================

set -euo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
RC_FILE="$PROJECT_ROOT/regression-contract.yaml"
FEATURES_FILE="$PROJECT_ROOT/FEATURES.md"
PACKAGE_FILE="$PROJECT_ROOT/package.json"

# 全局变量
FAST_MODE=false

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# ============================================================================
# 辅助函数
# ============================================================================

get_repo_name() {
    basename "$PROJECT_ROOT"
}

get_version() {
    if [[ -f "$PACKAGE_FILE" ]]; then
        grep '"version"' "$PACKAGE_FILE" | head -1 | sed 's/.*"version".*"\([^"]*\)".*/\1/'
    else
        echo "unknown"
    fi
}

get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# ============================================================================
# Features 提取
# ============================================================================

extract_features() {
    if [[ ! -f "$FEATURES_FILE" ]]; then
        echo "[]"
        return
    fi

    # 提取 Committed features（简化实现）
    local features=()

    # H1, H2
    if grep -q "H1.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"H1","name":"branch-protect","status":"Committed","scope":"hook"}')
    fi
    if grep -q "H2.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"H2","name":"pr-gate-v2","status":"Committed","scope":"hook"}')
    fi

    # W1, W3, W4
    if grep -q "W1.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"W1","name":"/dev 流程","status":"Committed","scope":"workflow"}')
    fi
    if grep -q "W3.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"W3","name":"循环回退","status":"Committed","scope":"workflow"}')
    fi
    if grep -q "W4.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"W4","name":"测试任务模式","status":"Committed","scope":"workflow"}')
    fi

    # C1-C4
    if grep -q "C1.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"C1","name":"version-check","status":"Committed","scope":"ci"}')
    fi
    if grep -q "C2.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"C2","name":"test job","status":"Committed","scope":"ci"}')
    fi
    if grep -q "C3.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"C3","name":"shell syntax check","status":"Committed","scope":"ci"}')
    fi
    if grep -q "C4.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"C4","name":"notify-failure","status":"Committed","scope":"ci"}')
    fi

    # B1
    if grep -q "B1.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"B1","name":"calculator","status":"Committed","scope":"business"}')
    fi

    # E1 (QA Reporting)
    if grep -q "E1.*Committed" "$FEATURES_FILE"; then
        features+=('{"id":"E1","name":"QA Reporting","status":"Committed","scope":"export"}')
    fi

    # 输出 JSON 数组
    if [[ ${#features[@]} -eq 0 ]]; then
        echo "[]"
    else
        local IFS=','
        echo "[${features[*]}]"
    fi
}

# ============================================================================
# RCIs 提取
# ============================================================================

extract_rcis() {
    if [[ ! -f "$RC_FILE" ]]; then
        echo '{"total":0,"by_priority":{"P0":[],"P1":[],"P2":[]},"details":[]}'
        return
    fi

    # 统计
    local total=$(grep -c "^\s*- id:" "$RC_FILE" 2>/dev/null || echo 0)
    local p0=$(grep -c "priority: P0" "$RC_FILE" 2>/dev/null || echo 0)
    local p1=$(grep -c "priority: P1" "$RC_FILE" 2>/dev/null || echo 0)
    local p2=$(grep -c "priority: P2" "$RC_FILE" 2>/dev/null || echo 0)

    # 提取 P0 IDs
    local p0_ids=$(grep -B1 "priority: P0" "$RC_FILE" | grep "id:" | sed 's/.*id: //' | tr -d '"' | tr '\n' ',' | sed 's/,$//')
    local p1_ids=$(grep -B1 "priority: P1" "$RC_FILE" | grep "id:" | sed 's/.*id: //' | tr -d '"' | tr '\n' ',' | sed 's/,$//')
    local p2_ids=$(grep -B1 "priority: P2" "$RC_FILE" | grep "id:" | sed 's/.*id: //' | tr -d '"' | tr '\n' ',' | sed 's/,$//')

    # 格式化为 JSON 数组
    format_ids() {
        local ids="$1"
        if [[ -z "$ids" ]]; then
            echo "[]"
        else
            echo "[\"$(echo "$ids" | sed 's/,/","/g')\"]"
        fi
    }

    cat <<EOF
{
    "total": $total,
    "by_priority": {
      "P0": $(format_ids "$p0_ids"),
      "P1": $(format_ids "$p1_ids"),
      "P2": $(format_ids "$p2_ids")
    },
    "counts": {
      "P0": $p0,
      "P1": $p1,
      "P2": $p2
    }
  }
EOF
}

# ============================================================================
# Golden Paths 提取
# ============================================================================

extract_golden_paths() {
    if [[ ! -f "$RC_FILE" ]]; then
        echo '[]'
        return
    fi

    # 检查是否有 golden_paths 部分
    if ! grep -q "^golden_paths:" "$RC_FILE"; then
        echo '[]'
        return
    fi

    # 简化提取：只获取 GP IDs 和名称
    local gps=()

    # GP-001
    if grep -q "GP-001" "$RC_FILE"; then
        local name=$(grep -A1 "id: GP-001" "$RC_FILE" | grep "name:" | sed 's/.*name: "//' | sed 's/".*//')
        gps+=("{\"id\":\"GP-001\",\"name\":\"$name\"}")
    fi

    # GP-002
    if grep -q "GP-002" "$RC_FILE"; then
        local name=$(grep -A1 "id: GP-002" "$RC_FILE" | grep "name:" | sed 's/.*name: "//' | sed 's/".*//')
        gps+=("{\"id\":\"GP-002\",\"name\":\"$name\"}")
    fi

    # GP-003
    if grep -q "GP-003" "$RC_FILE"; then
        local name=$(grep -A1 "id: GP-003" "$RC_FILE" | grep "name:" | sed 's/.*name: "//' | sed 's/".*//')
        gps+=("{\"id\":\"GP-003\",\"name\":\"$name\"}")
    fi

    # GP-004
    if grep -q "GP-004" "$RC_FILE"; then
        local name=$(grep -A1 "id: GP-004" "$RC_FILE" | grep "name:" | sed 's/.*name: "//' | sed 's/".*//')
        gps+=("{\"id\":\"GP-004\",\"name\":\"$name\"}")
    fi

    if [[ ${#gps[@]} -eq 0 ]]; then
        echo "[]"
    else
        local IFS=','
        echo "[${gps[*]}]"
    fi
}

# ============================================================================
# Gates 提取
# ============================================================================

extract_gates() {
    if [[ ! -f "$RC_FILE" ]]; then
        echo '{}'
        return
    fi

    # PR Gate: trigger 包含 PR 的 RCIs
    local pr_count=$(grep -E "trigger:.*PR" "$RC_FILE" | wc -l || echo 0)

    # Release Gate: trigger 包含 Release 的 RCIs
    local release_count=$(grep -E "trigger:.*Release" "$RC_FILE" | wc -l || echo 0)

    # Nightly: 全部
    local total=$(grep -c "^\s*- id:" "$RC_FILE" 2>/dev/null || echo 0)
    # 减去 golden_paths 部分
    local gp_count=$(grep -c "id: GP-" "$RC_FILE" 2>/dev/null || echo 0)
    total=$((total - gp_count))

    cat <<EOF
{
    "pr": {
      "name": "PR Gate",
      "description": "跑 trigger 包含 PR 的 RCIs",
      "count": $pr_count
    },
    "release": {
      "name": "Release Gate",
      "description": "跑 trigger 包含 Release 的 RCIs",
      "count": $release_count
    },
    "nightly": {
      "name": "Nightly",
      "description": "跑全部 RCIs",
      "count": $total
    }
  }
EOF
}

# ============================================================================
# Summary 计算 (v2: 真实检查)
# ============================================================================

# Meta: Feature → RCI 覆盖率
calculate_meta() {
    python3 << 'PYTHON'
import yaml
import re
import json

# 读取文件
try:
    with open('FEATURES.md', 'r') as f:
        features_content = f.read()
    with open('regression-contract.yaml', 'r') as f:
        rc_data = yaml.safe_load(f)
except Exception as e:
    print(json.dumps({"score": 0, "total_features": 0, "covered_features": 0, "gaps": [], "p0_violations": []}))
    exit(0)

# 提取 Committed Features
committed = set()
for match in re.finditer(r'\|\s*([A-Z]\d+)\s*\|.*\*\*Committed\*\*', features_content):
    committed.add(match.group(1))

# 提取 RC 中的 Features 和 P0 规则
rc_features = set()
p0_violations = []

for section in ['hooks', 'workflow', 'ci', 'business', 'export']:
    if section in rc_data and rc_data[section]:
        for rci in rc_data[section]:
            feature = rci.get('feature', '')
            rc_features.add(feature)
            # 检查 P0 必须在 PR 触发
            if rci.get('priority') == 'P0':
                trigger = rci.get('trigger', [])
                if 'PR' not in trigger:
                    p0_violations.append(rci.get('id', ''))

# 计算
gaps = list(committed - rc_features)
covered = len(committed) - len(gaps)
total = len(committed)
score = int(covered * 100 / total) if total > 0 else 0

print(json.dumps({
    "score": score,
    "total_features": total,
    "covered_features": covered,
    "gaps": gaps,
    "p0_violations": p0_violations
}))
PYTHON
}

# Unit: 真实运行 npm run qa
calculate_unit() {
    # Fast mode: 跳过实际运行
    if [[ "$FAST_MODE" == "true" ]]; then
        cat <<EOF
{
    "score": -1,
    "passed": null,
    "test_count": 0,
    "duration": "skipped",
    "error_summary": null,
    "note": "Fast mode: skipped npm run qa"
  }
EOF
        return
    fi

    local start_time=$(date +%s)
    local output
    local exit_code

    # 真实运行
    output=$(npm run qa 2>&1) || true
    exit_code=$?

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # 提取测试数量（匹配 "99 passed" 格式，取最大的数字）
    local test_count=$(echo "$output" | grep -oE "Tests\s+[0-9]+ passed" | grep -oE "[0-9]+" || echo "$output" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" | sort -rn | head -1 || echo "0")

    # 判断是否通过
    local passed="false"
    local score=0
    local error_summary="null"

    if [[ $exit_code -eq 0 ]]; then
        passed="true"
        score=100
    else
        # 提取错误摘要（最后 10 行）
        error_summary=$(echo "$output" | tail -10 | jq -Rs .)
    fi

    cat <<EOF
{
    "score": $score,
    "passed": $passed,
    "test_count": $test_count,
    "duration": "${duration}s",
    "error_summary": $error_summary
  }
EOF
}

# E2E: GP 结构完整性
calculate_e2e() {
    python3 << 'PYTHON'
import yaml
import json

try:
    with open('regression-contract.yaml', 'r') as f:
        rc_data = yaml.safe_load(f)
except:
    print(json.dumps({"score": 0, "gp_count": 0, "gp_coverage": [], "uncovered_features": []}))
    exit(0)

# 检查 golden_paths 存在
gps = rc_data.get('golden_paths', [])
if not gps:
    print(json.dumps({"score": 0, "gp_count": 0, "gp_coverage": [], "uncovered_features": []}))
    exit(0)

# 收集所有 RCI IDs
all_rci_ids = set()
rci_to_feature = {}
for section in ['hooks', 'workflow', 'ci', 'business', 'export']:
    if section in rc_data and rc_data[section]:
        for rci in rc_data[section]:
            rci_id = rci.get('id', '')
            all_rci_ids.add(rci_id)
            rci_to_feature[rci_id] = rci.get('feature', '')

# 检查 GP 结构和覆盖
gp_count = len(gps)
gp_coverage_features = set()
valid_gps = 0
unresolved_rcis = []

for gp in gps:
    has_id = 'id' in gp
    has_name = 'name' in gp
    has_rcis = 'rcis' in gp and len(gp.get('rcis', [])) > 0

    if has_id and has_name and has_rcis:
        valid_gps += 1
        for rci_id in gp.get('rcis', []):
            if rci_id in all_rci_ids:
                gp_coverage_features.add(rci_to_feature.get(rci_id, ''))
            else:
                unresolved_rcis.append(rci_id)

# 收集所有 Features
all_features = set(rci_to_feature.values())
uncovered = list(all_features - gp_coverage_features)

# 计算分数
score = int(valid_gps * 100 / gp_count) if gp_count > 0 else 0

print(json.dumps({
    "score": score,
    "gp_count": gp_count,
    "gp_coverage": list(gp_coverage_features),
    "uncovered_features": uncovered,
    "unresolved_rcis": unresolved_rcis
}))
PYTHON
}

calculate_summary() {
    local meta_result=$(calculate_meta)
    local unit_result=$(calculate_unit)
    local e2e_result=$(calculate_e2e)

    local meta_score=$(echo "$meta_result" | jq -r '.score')
    local unit_score=$(echo "$unit_result" | jq -r '.score')
    local e2e_score=$(echo "$e2e_result" | jq -r '.score')

    # Fast mode: unit_score = -1，只用 meta 和 e2e 计算
    local overall
    if [[ "$unit_score" == "-1" ]]; then
        overall=$(( (meta_score + e2e_score) / 2 ))
    else
        overall=$(( (meta_score + unit_score + e2e_score) / 3 ))
    fi

    cat <<EOF
{
    "meta": $meta_result,
    "unit": $unit_result,
    "e2e": $e2e_result,
    "overall": $overall
  }
EOF
}

# ============================================================================
# 主函数
# ============================================================================

generate_report() {
    local repo=$(get_repo_name)
    local version=$(get_version)
    local timestamp=$(get_timestamp)
    local summary=$(calculate_summary)
    local features=$(extract_features)
    local rcis=$(extract_rcis)
    local golden_paths=$(extract_golden_paths)
    local gates=$(extract_gates)

    cat <<EOF
{
  "repo": "$repo",
  "version": "$version",
  "timestamp": "$timestamp",
  "summary": $summary,
  "features": $features,
  "rcis": $rcis,
  "golden_paths": $golden_paths,
  "gates": $gates
}
EOF
}

# ============================================================================
# 入口
# ============================================================================

main() {
    local mode="stdout"
    local url=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --fast|-f)
                FAST_MODE=true
                shift
                ;;
            --output|-o)
                mode="file"
                shift
                ;;
            --post|-p)
                mode="post"
                url="$2"
                shift 2
                ;;
            --help|-h)
                echo "用法: $0 [--fast] [--output] [--post URL]"
                echo ""
                echo "选项:"
                echo "  --fast, -f      快速模式（跳过 npm run qa）"
                echo "  --output, -o    输出到 .qa-report.json"
                echo "  --post, -p URL  POST 到指定 URL"
                echo "  --help, -h      显示帮助"
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    local report=$(generate_report)

    case $mode in
        stdout)
            echo "$report"
            ;;
        file)
            echo "$report" > "$PROJECT_ROOT/.qa-report.json"
            echo -e "${GREEN}✅ 报告已保存到 .qa-report.json${NC}"
            ;;
        post)
            if [[ -z "$url" ]]; then
                echo -e "${RED}错误: 缺少 URL${NC}"
                exit 1
            fi
            echo "$report" | curl -s -X POST "$url" \
                -H "Content-Type: application/json" \
                -d @-
            echo -e "${GREEN}✅ 报告已 POST 到 $url${NC}"
            ;;
    esac
}

main "$@"
