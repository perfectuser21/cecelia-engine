#!/bin/bash
# verify-gate-signature.sh - 验证 gate 文件签名
#
# 用法: bash scripts/gate/verify-gate-signature.sh <gate_file>
#
# 返回码:
#   0 - 签名有效
#   1 - 文件不存在或格式错误
#   2 - 签名无效
#   3 - 分支不匹配

set -e

GATE_FILE="${1:-}"
SECRET_FILE="$HOME/.claude/.gate-secret"

# 验证参数
if [[ -z "$GATE_FILE" ]]; then
    echo "❌ 用法: bash scripts/gate/verify-gate-signature.sh <gate_file>" >&2
    exit 1
fi

if [[ ! -f "$GATE_FILE" ]]; then
    echo "❌ Gate 文件不存在: $GATE_FILE" >&2
    exit 1
fi

if [[ ! -f "$SECRET_FILE" ]]; then
    echo "❌ Secret 文件不存在: $SECRET_FILE" >&2
    echo "   请先运行 generate-gate-file.sh 生成 secret" >&2
    exit 1
fi

# 获取当前分支
get_current_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# 生成签名
generate_signature() {
    local gate="$1"
    local decision="$2"
    local timestamp="$3"
    local branch="$4"
    local secret="$5"

    echo -n "${gate}:${decision}:${timestamp}:${branch}:${secret}" | sha256sum | cut -d' ' -f1
}

# 主逻辑
main() {
    local secret
    secret=$(cat "$SECRET_FILE" | tr -d '\n\r')

    local current_branch
    current_branch=$(get_current_branch)

    # 解析 JSON 文件
    local gate decision timestamp branch signature
    gate=$(jq -r '.gate' "$GATE_FILE" 2>/dev/null)
    decision=$(jq -r '.decision' "$GATE_FILE" 2>/dev/null)
    timestamp=$(jq -r '.timestamp' "$GATE_FILE" 2>/dev/null)
    branch=$(jq -r '.branch' "$GATE_FILE" 2>/dev/null)
    signature=$(jq -r '.signature' "$GATE_FILE" 2>/dev/null)

    # 检查字段有效性（jq 对不存在的字段返回 "null" 字符串）
    if [[ -z "$gate" || "$gate" == "null" || \
          -z "$decision" || "$decision" == "null" || \
          -z "$timestamp" || "$timestamp" == "null" || \
          -z "$branch" || "$branch" == "null" || \
          -z "$signature" || "$signature" == "null" ]]; then
        echo "❌ Gate 文件格式错误: $GATE_FILE" >&2
        exit 1
    fi

    # 检查分支匹配
    if [[ "$branch" != "$current_branch" ]]; then
        echo "❌ gate 文件分支不匹配（file: $branch, current: $current_branch）" >&2
        exit 3
    fi

    # 验证签名
    local expected_signature
    expected_signature=$(generate_signature "$gate" "$decision" "$timestamp" "$branch" "$secret")

    if [[ "$signature" != "$expected_signature" ]]; then
        echo "❌ gate 文件签名无效（expected: ${expected_signature:0:16}..., got: ${signature:0:16}...）" >&2
        exit 2
    fi

    echo "✅ Gate 文件验证通过: $GATE_FILE" >&2
    echo "   gate: $gate" >&2
    echo "   branch: $branch" >&2
    echo "   timestamp: $timestamp" >&2
    exit 0
}

main
