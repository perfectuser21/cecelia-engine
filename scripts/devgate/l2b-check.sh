#!/usr/bin/env bash
set -euo pipefail

# L2B Evidence Check
# 支持两种模式：pr（L2B-min）和 release（L2B-full）

MODE="${1:-pr}"
EVIDENCE_FILE=".layer2-evidence.md"

echo "==> L2B Evidence Check (mode: $MODE)"

# 检查文件存在
if [[ ! -f "$EVIDENCE_FILE" ]]; then
  echo "❌ 缺少 $EVIDENCE_FILE"
  echo "提示: 创建该文件记录可复核证据（手动验证、自动化测试、截图等）"
  exit 1
fi

# 检查文件不为空
if [[ ! -s "$EVIDENCE_FILE" ]]; then
  echo "❌ $EVIDENCE_FILE 为空"
  exit 1
fi

# 检查必需字段
REQUIRED_SECTIONS=(
  "## 手动验证"
  "## 自动化测试"
)

for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -qF "$section" "$EVIDENCE_FILE"; then
    echo "❌ 缺少必需章节: $section"
    exit 1
  fi
done

# L2B-min: 至少 1 条可复核证据
if [[ "$MODE" == "pr" ]]; then
  # P1: 增强检查 - 真实性验证
  # 1. 必须有可复现命令或机器引用
  # 2. 如果有 commit SHA，验证是否匹配当前 HEAD
  # 3. 如果有 CI run ID，验证格式合理性

  HAS_COMMAND=false
  HAS_MACHINE_REF=false

  # 检查可复现命令（在代码块内或列表项中）
  # H2 FIX: 使用单词边界避免匹配 "rebash"
  if grep -qE '(\bnpm\s+run\b|\bbash\b|\bnode\b|\bgit\b|\bpytest\b|\bcargo\b|\bgo\s+test\b)' "$EVIDENCE_FILE"; then
    HAS_COMMAND=true
  fi

  # 检查机器引用（SHA、run ID、hash 等）
  # H3 FIX: 使用单词边界和更严格的模式
  if grep -qE '(\b[0-9a-f]{7,40}\b|run[_-]?id:\s*[0-9]+|#[0-9]+|\bsha256:[0-9a-f]+)' "$EVIDENCE_FILE"; then
    HAS_MACHINE_REF=true
  fi

  if [[ "$HAS_COMMAND" == "false" && "$HAS_MACHINE_REF" == "false" ]]; then
    echo "❌ L2B 需要可复现证据："
    echo "   - 可复现命令（如 npm run test, bash scripts/check.sh）"
    echo "   - 或机器引用（如 CI run ID, commit SHA, file hash）"
    exit 1
  fi

  # P1: 验证 commit SHA 真实性（如果存在）
  CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")
  CURRENT_HEAD_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "")

  # 提取证据中的 SHA (7-40 位)
  EVIDENCE_SHAS=$(grep -oE '\b[0-9a-f]{7,40}\b' "$EVIDENCE_FILE" || echo "")

  if [[ -n "$EVIDENCE_SHAS" && -n "$CURRENT_HEAD" ]]; then
    echo ""
    echo "  [验证 commit SHA]"
    SHA_VALID=false
    while IFS= read -r sha; do
      # C2 FIX: 双向前缀匹配，支持短SHA匹配长HEAD
      # 检查是否匹配当前 HEAD (完整或短格式，双向前缀)
      if [[ "$sha" == "$CURRENT_HEAD" ]] || \
         [[ "$sha" == "$CURRENT_HEAD_SHORT"* ]] || \
         [[ "$CURRENT_HEAD" == "$sha"* ]] || \
         [[ "$CURRENT_HEAD_SHORT" == "$sha"* ]]; then
        echo "  ✅ SHA $sha 匹配当前 HEAD"
        SHA_VALID=true
        break
      fi
      # 检查是否是历史提交（在当前分支）
      if git cat-file -e "$sha" 2>/dev/null && git merge-base --is-ancestor "$sha" HEAD 2>/dev/null; then
        echo "  ✅ SHA $sha 是当前分支的历史提交"
        SHA_VALID=true
        break
      fi
    done <<< "$EVIDENCE_SHAS"

    if [[ "$SHA_VALID" == "false" ]]; then
      echo "  ❌ 证据中的 SHA 不匹配当前 HEAD 或历史提交"
      echo "     这可能是复制粘贴的假证据"
      # L3 FIX: 显示所有 SHA，不只是第一个
      echo "     证据中的 SHA:"
      while IFS= read -r sha; do
        echo "       - $sha"
      done <<< "$EVIDENCE_SHAS"
      echo "     当前 HEAD: $CURRENT_HEAD_SHORT"
      # L5 FIX: 从警告改为阻断模式，防止伪造证据
      exit 1
    fi
  fi

  # 简单检查：至少有一个列表项或代码块
  if ! grep -qE '^- |^```' "$EVIDENCE_FILE"; then
    echo "❌ 至少需要 1 条可复核证据（列表项或代码块）"
    exit 1
  fi

  echo "✅ L2B-min 检查通过 (command=$HAS_COMMAND, machine_ref=$HAS_MACHINE_REF)"
fi

# L2B-full: 完整证据 + DoD 全勾
if [[ "$MODE" == "release" ]]; then
  # 检查 DoD 引用
  if ! grep -qF "## DoD 完成度" "$EVIDENCE_FILE"; then
    echo "❌ Release 模式需要 '## DoD 完成度' 章节"
    exit 1
  fi
  
  # 检查是否有未完成项（[ ]）
  # L2 FIX: 支持多空格的 checkbox（[\s*]）
  if grep -qE '^\- \[\s*\]' "$EVIDENCE_FILE"; then
    echo "❌ 存在未完成的 DoD 项"
    exit 1
  fi
  
  echo "✅ L2B-full 检查通过"
fi

exit 0
