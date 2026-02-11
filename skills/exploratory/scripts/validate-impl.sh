#!/bin/bash
# validate-impl.sh - 验证 Exploratory 实现

set -e

echo "🔍 验证功能实现..."

# 检查 .exploratory-mode 文件
if [[ ! -f ".exploratory-mode" ]]; then
    echo "❌ 找不到 .exploratory-mode 文件"
    exit 1
fi

# 读取任务描述
TASK_DESC=$(grep "^task:" .exploratory-mode | cut -d' ' -f2-)
echo "📋 任务: $TASK_DESC"

# 检查是否有代码修改
if ! git diff --quiet develop; then
    echo "✅ 检测到代码修改"
    git diff --name-only develop
else
    echo "⚠️  没有检测到代码修改"
fi

echo "✅ 验证完成"
