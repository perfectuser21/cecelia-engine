#!/bin/bash
# generate-gate-file.sh - 生成带签名的 gate 通过文件
#
# 用法: bash scripts/gate/generate-gate-file.sh <gate_type>
#   gate_type: prd | dod | test | audit
#
# 输出: .gate-<type>-passed 文件

set -e

GATE_TYPE="${1:-}"
SECRET_FILE="$HOME/.claude/.gate-secret"
GATE_FILE=".gate-${GATE_TYPE}-passed"

# 验证参数
if [[ -z "$GATE_TYPE" ]]; then
    echo "❌ 用法: bash scripts/gate/generate-gate-file.sh <gate_type>" >&2
    echo "   gate_type: prd | dod | test | audit" >&2
    exit 1
fi

if [[ ! "$GATE_TYPE" =~ ^(prd|dod|test|audit)$ ]]; then
    echo "❌ 无效的 gate 类型: $GATE_TYPE" >&2
    echo "   有效类型: prd | dod | test | audit" >&2
    exit 1
fi

# 确保 secret 存在
ensure_secret() {
    local secret_dir="$HOME/.claude"

    if [[ ! -d "$secret_dir" ]]; then
        mkdir -p "$secret_dir"
    fi

    if [[ ! -f "$SECRET_FILE" ]]; then
        echo "ℹ️ 首次运行，生成 gate secret..." >&2
        openssl rand -hex 32 > "$SECRET_FILE"
        chmod 600 "$SECRET_FILE"
        echo "✅ Secret 已生成: $SECRET_FILE" >&2
    fi
}

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

    # 签名算法: sha256("{gate}:{decision}:{timestamp}:{branch}:{secret}")
    echo -n "${gate}:${decision}:${timestamp}:${branch}:${secret}" | sha256sum | cut -d' ' -f1
}

# 主逻辑
main() {
    ensure_secret

    local secret
    secret=$(cat "$SECRET_FILE" | tr -d '\n\r')

    local branch
    branch=$(get_current_branch)

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local decision="PASS"

    local signature
    signature=$(generate_signature "$GATE_TYPE" "$decision" "$timestamp" "$branch" "$secret")

    # 生成 JSON 文件（使用 jq 防止特殊字符破坏 JSON）
    jq -n \
        --arg gate "$GATE_TYPE" \
        --arg decision "$decision" \
        --arg timestamp "$timestamp" \
        --arg branch "$branch" \
        --arg signature "$signature" \
        '{gate: $gate, decision: $decision, timestamp: $timestamp, branch: $branch, signature: $signature}' \
        > "$GATE_FILE"

    echo "✅ Gate 文件已生成: $GATE_FILE" >&2
    echo "   gate: $GATE_TYPE" >&2
    echo "   branch: $branch" >&2
    echo "   timestamp: $timestamp" >&2
}

main
