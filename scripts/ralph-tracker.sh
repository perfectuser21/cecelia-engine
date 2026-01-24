#!/usr/bin/env bash
# ============================================================================
# Ralph Loop 追踪工具
# ============================================================================
# 用于追踪 /ralph-loop 插件的迭代次数和失败原因
#
# 命令:
#   init    - 初始化追踪文件
#   record  - 记录一次迭代
#   report  - 生成完整报告
#   history - 显示简短历史（用于 Stop Hook 输出）
# ============================================================================

set -euo pipefail

# 检查依赖
if ! command -v jq &>/dev/null; then
    echo "❌ 错误: 需要安装 jq 命令" >&2
    echo "   Ubuntu/Debian: sudo apt install jq" >&2
    echo "   macOS: brew install jq" >&2
    exit 1
fi

TRACKING_FILE=".ralph-loop-tracking.json"

# ===== 初始化追踪文件 =====
function init() {
    cat > "$TRACKING_FILE" <<EOF
{
  "project": "$(basename "$(pwd)")",
  "branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")",
  "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "iterations": [],
  "total_iterations": 0,
  "final_status": "in_progress"
}
EOF
    echo "✅ 追踪文件已初始化: $TRACKING_FILE" >&2
}

# ===== 记录一次迭代 =====
function record() {
    # 参数: --iteration N --phase p0 --result blocked --blocked-at "Step 7.2" --reason "..."

    # 解析参数
    local iteration="" phase="" result="" blocked_at="" reason="" message=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            --iteration) iteration="$2"; shift 2 ;;
            --phase) phase="$2"; shift 2 ;;
            --result) result="$2"; shift 2 ;;
            --blocked-at) blocked_at="$2"; shift 2 ;;
            --reason) reason="$2"; shift 2 ;;
            --message) message="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    # 验证必需参数
    if [[ -z "$iteration" || -z "$result" ]]; then
        echo "❌ 错误: record 命令需要 --iteration 和 --result 参数" >&2
        exit 1
    fi

    # 如果文件不存在，初始化
    [[ ! -f "$TRACKING_FILE" ]] && init

    # 构建 JSON 片段
    local record_json=""
    if [[ "$result" == "blocked" ]]; then
        record_json=$(jq -n \
            --arg iter "$iteration" \
            --arg phase "$phase" \
            --arg result "$result" \
            --arg blocked "$blocked_at" \
            --arg reason "$reason" \
            --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            '{
                iteration: ($iter | tonumber),
                timestamp: $ts,
                phase: $phase,
                result: $result,
                blocked_at: $blocked,
                reason: $reason
            }')
    else
        # success 或其他状态
        record_json=$(jq -n \
            --arg iter "$iteration" \
            --arg phase "$phase" \
            --arg result "$result" \
            --arg msg "$message" \
            --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            '{
                iteration: ($iter | tonumber),
                timestamp: $ts,
                phase: $phase,
                result: $result,
                message: $msg
            }')
    fi

    # 追加到文件
    jq --argjson new_record "$record_json" \
       '.iterations += [$new_record] | .total_iterations = (.iterations | length)' \
       "$TRACKING_FILE" > "${TRACKING_FILE}.tmp" && mv "${TRACKING_FILE}.tmp" "$TRACKING_FILE"
}

# ===== 生成完整报告 =====
function report() {
    if [[ ! -f "$TRACKING_FILE" ]]; then
        echo "  无追踪数据" >&2
        return
    fi

    # 读取基本信息
    local total=$(jq '.total_iterations' "$TRACKING_FILE")
    local project=$(jq -r '.project' "$TRACKING_FILE")
    local branch=$(jq -r '.branch' "$TRACKING_FILE")
    local start_time=$(jq -r '.start_time' "$TRACKING_FILE")
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # 计算时长（如果有 date 命令）
    local duration=""
    if command -v date &>/dev/null; then
        local start_epoch=$(date -d "$start_time" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_time" +%s 2>/dev/null || echo "0")
        local end_epoch=$(date -d "$end_time" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$end_time" +%s 2>/dev/null || echo "0")
        if [[ "$start_epoch" != "0" && "$end_epoch" != "0" ]]; then
            local diff=$((end_epoch - start_epoch))
            local minutes=$((diff / 60))
            duration="${minutes} 分钟"
        fi
    fi

    echo ""
    echo "任务: $project"
    echo "分支: $branch"
    echo "总迭代: $total 次"
    [[ -n "$duration" ]] && echo "总耗时: $duration"
    echo ""
    echo "迭代历史:"

    # 显示每次迭代
    jq -r '.iterations[] |
        "  Iteration \(.iteration) (\(.timestamp | split("T")[1] | split(".")[0] | split("Z")[0])): " +
        (if .result == "blocked" then
            "❌ 阻止在 \(.blocked_at)\n    → 原因: \(.reason)"
         else if .result == "success" then
            "✅ 成功\n    → \(.message)"
         else
            "\(.result)\n    → \(.message // .reason // "无详情")"
         end end)' \
        "$TRACKING_FILE"

    echo ""

    # 统计成功率
    local success_count=$(jq '[.iterations[] | select(.result == "success")] | length' "$TRACKING_FILE")
    local blocked_count=$(jq '[.iterations[] | select(.result == "blocked")] | length' "$TRACKING_FILE")

    if [[ $total -gt 0 ]]; then
        local success_rate=$((success_count * 100 / total))
        echo "成功率: $success_count/$total ($success_rate%)"
        if [[ $blocked_count -gt 0 ]]; then
            echo "失败循环: $blocked_count 次"
        fi
    fi

    echo ""
}

# ===== 显示简短历史（用于 Stop Hook） =====
function history() {
    if [[ ! -f "$TRACKING_FILE" ]]; then
        return
    fi

    local total=$(jq '.total_iterations' "$TRACKING_FILE")
    if [[ $total -eq 0 ]]; then
        return
    fi

    echo ""
    echo "  之前迭代历史:"

    # 只显示最近3次
    jq -r '.iterations[-3:] | .[] |
        "    Iteration \(.iteration): " +
        (if .result == "blocked" then
            "阻止在 \(.blocked_at) (\(.reason))"
         else
            "\(.result) - \(.message // "完成")"
         end)' \
        "$TRACKING_FILE"
}

# ===== 归档追踪文件 =====
function archive() {
    if [[ ! -f "$TRACKING_FILE" ]]; then
        echo "⚠️  无追踪文件可归档" >&2
        return
    fi

    # 创建归档目录
    mkdir -p .archive/ralph-loops/

    # 生成归档文件名
    local branch=$(jq -r '.branch' "$TRACKING_FILE" 2>/dev/null || echo "unknown")
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local archive_file=".archive/ralph-loops/${branch}-${timestamp}.json"

    # 复制文件
    cp "$TRACKING_FILE" "$archive_file"

    echo "✅ 追踪文件已归档: $archive_file" >&2
}

# ===== 主命令分发 =====
case "${1:-}" in
    init)
        init
        ;;
    record)
        shift
        record "$@"
        ;;
    report)
        report
        ;;
    history)
        history
        ;;
    archive)
        archive
        ;;
    *)
        echo "Usage: ralph-tracker.sh {init|record|report|history|archive}" >&2
        echo "" >&2
        echo "Commands:" >&2
        echo "  init                           - 初始化追踪文件" >&2
        echo "  record --iteration N ...       - 记录一次迭代" >&2
        echo "  report                         - 生成完整报告" >&2
        echo "  history                        - 显示简短历史" >&2
        echo "  archive                        - 归档追踪文件" >&2
        exit 1
        ;;
esac
