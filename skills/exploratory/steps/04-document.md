# Step 4: 生成 PRD/DOD

> 基于跑通的代码，生成正式 PRD 和 DOD

---

## 核心理念

**PRD/DOD 不是凭空想象的，而是基于真实踩坑生成的**。

---

## 信息收集

从 `.exploratory-mode` 和代码修改中收集信息：

```bash
# 读取任务描述
TASK_DESC=$(grep "^task:" .exploratory-mode | cut -d' ' -f2-)

# 读取修改的文件
MODIFIED_FILES=$(git diff --name-only develop)

# 读取踩坑记录
PITFALLS=$(sed -n '/## 踩坑记录/,/## /p' .exploratory-mode)

# 读取验证方式
VALIDATION=$(sed -n '/## 验证记录/,/## /p' .exploratory-mode)
```

---

## 生成 PRD

```bash
# 生成任务 ID（基于时间戳）
TASK_ID=$(date +%m%d%H%M)

# 生成 PRD 文件
cat > .prd-exp-$TASK_ID.md << INNER_EOF
# PRD - $TASK_DESC

## 需求来源
Exploratory 验证：已确认功能可行

## 功能描述
$TASK_DESC

## 涉及文件
基于 Exploratory 实现，需要修改/创建以下文件：

$MODIFIED_FILES

## 技术方案
基于 Exploratory 验证的可行方案：

[AI 根据代码修改总结技术方案]

## 依赖关系
$PITFALLS

## 成功标准
$VALIDATION

## 非目标
- 不做过度设计
- 只实现核心功能
- 保持简单

## 优先级
P1 - 已通过 Exploratory 验证
INNER_EOF

echo "✅ PRD 已生成: .prd-exp-$TASK_ID.md"
```

---

## 生成 DOD

```bash
# 生成 DOD 文件
cat > .dod-exp-$TASK_ID.md << INNER_EOF
# DoD - $TASK_DESC

## 验收标准

### 功能验收
- [ ] 主要功能实现
      Test: tests/... | manual:验证方式
- [ ] 功能通过验证
      Test: $VALIDATION

### 测试验收
- [ ] npm run qa 通过
      Test: contract:C2-001

## 证据文件
基于 Exploratory 验证的证据：
- 验证时间：[从 .exploratory-mode 提取]
- 验证方式：[从 .exploratory-mode 提取]
- 验证结果：pass
INNER_EOF

echo "✅ DOD 已生成: .dod-exp-$TASK_ID.md"
```

---

## 复制 PRD/DOD 到主仓库

```bash
# 获取主仓库路径
MAIN_REPO=$(git worktree list | head -1 | awk '{print $1}')

# 复制 PRD/DOD
cp .prd-exp-$TASK_ID.md "$MAIN_REPO/"
cp .dod-exp-$TASK_ID.md "$MAIN_REPO/"

echo "✅ PRD/DOD 已复制到主仓库"
echo "   位置: $MAIN_REPO/.prd-exp-$TASK_ID.md"
echo "   位置: $MAIN_REPO/.dod-exp-$TASK_ID.md"
```

---

## 清理 Worktree

```bash
echo "🧹 清理 Exploratory Worktree..."

# 返回主仓库
cd "$MAIN_REPO"

# 读取 worktree 路径
WORKTREE_PATH=$(grep "^worktree:" .exploratory-mode | awk '{print $2}')
BRANCH_NAME=$(grep "^branch:" .exploratory-mode | awk '{print $2}')

# 删除 worktree
git worktree remove "$WORKTREE_PATH" --force

# 删除临时分支
git branch -D "$BRANCH_NAME"

echo "✅ Worktree 已清理"
echo "✅ 临时分支已删除"
```

---

## 输出结果

```bash
echo ""
echo "🎉 Exploratory 完成！"
echo ""
echo "📄 生成的文档："
echo "   PRD: .prd-exp-$TASK_ID.md"
echo "   DOD: .dod-exp-$TASK_ID.md"
echo ""
echo "💡 下一步："
echo "   使用 /dev 基于 PRD/DOD 重新实现"
echo "   cd $MAIN_REPO && /dev"
```

**标记步骤完成**：
```bash
sed -i 's/^step_4_document: pending/step_4_document: done/' .exploratory-mode
echo "✅ Step 4 完成标记已写入 .exploratory-mode"
```

**Exploratory 流程结束**
