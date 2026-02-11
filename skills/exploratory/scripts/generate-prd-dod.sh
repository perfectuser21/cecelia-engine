#!/bin/bash
# generate-prd-dod.sh - 生成 PRD 和 DOD

set -e

echo "📝 生成 PRD 和 DOD..."

# 检查 .exploratory-mode 文件
if [[ ! -f ".exploratory-mode" ]]; then
    echo "❌ 找不到 .exploratory-mode 文件"
    exit 1
fi

# 读取信息
TASK_DESC=$(grep "^task:" .exploratory-mode | cut -d' ' -f2-)
TASK_ID=$(date +%m%d%H%M)

# 生成 PRD
cat > ".prd-exp-$TASK_ID.md" << INNER_EOF
# PRD - $TASK_DESC

## 需求来源
Exploratory 验证：已确认功能可行

## 功能描述
$TASK_DESC

## 涉及文件
$(git diff --name-only develop)

## 成功标准
基于 Exploratory 验证

## 优先级
P1 - 已通过 Exploratory 验证
INNER_EOF

# 生成 DOD
cat > ".dod-exp-$TASK_ID.md" << INNER_EOF
# DoD - $TASK_DESC

## 验收标准

### 功能验收
- [ ] 主要功能实现
      Test: manual:Exploratory 验证通过

### 测试验收
- [ ] npm run qa 通过
      Test: contract:C2-001
INNER_EOF

echo "✅ PRD 已生成: .prd-exp-$TASK_ID.md"
echo "✅ DOD 已生成: .dod-exp-$TASK_ID.md"

# 输出文件路径供调用者使用
echo "$TASK_ID"
