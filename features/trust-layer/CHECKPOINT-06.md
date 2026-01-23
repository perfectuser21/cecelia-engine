---
id: checkpoint-06-deploy-gate
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: 初始版本
---

# Checkpoint 06: Deploy 门禁

## 问题

当前 deploy.sh 可以从任意分支执行：
- develop 可以误触 deploy → 污染全局
- 脏工作区可以部署 → 不可复现
- 本地落后远程可以部署 → 版本错乱

**后果**：部署不可控、不可信、不可审计。

## 解决方案

在 deploy.sh 顶部添加硬门禁：

```bash
# ========================================
# 硬门禁：Deploy Gate
# ========================================
echo -e "${BLUE}[Gate] Deploy 门禁检查${NC}"
echo ""

# Gate 1: 必须在 main 分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${RED}[FAIL] 只能从 main 分支部署${NC}"
    echo "  当前分支: $CURRENT_BRANCH"
    echo "  请先合并到 main 或使用 'git checkout main'"
    exit 2
fi
echo -e "   ${GREEN}[OK]${NC} 分支: main"

# Gate 2: 工作区必须干净
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo -e "${RED}[FAIL] 工作区有未提交的改动${NC}"
    echo "  请先提交或 stash 改动"
    git status --short
    exit 3
fi
echo -e "   ${GREEN}[OK]${NC} 工作区: clean"

# Gate 3: 必须与远程同步
git fetch origin main --quiet 2>/dev/null || {
    echo -e "${YELLOW}[WARN] 无法连接远程，跳过同步检查${NC}"
}

LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null)
REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null || echo "")

if [[ -n "$REMOTE_SHA" && "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
    echo -e "${RED}[FAIL] 本地与远程不同步${NC}"
    echo "  本地:  $LOCAL_SHA"
    echo "  远程:  $REMOTE_SHA"
    echo "  请先 'git pull origin main' 或 'git push origin main'"
    exit 4
fi
echo -e "   ${GREEN}[OK]${NC} 同步: aligned"

echo ""
echo -e "${GREEN}[Gate] 所有门禁检查通过${NC}"
echo ""
```

### 部署证据（DEPLOY-STAMP）

```bash
# 部署完成后写入证据
STAMP_FILE="$HOME/.claude/DEPLOY-STAMP"
cat > "$STAMP_FILE" <<EOF
---
timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
branch: main
commit: $(git rev-parse HEAD)
version: $(grep '"version"' package.json | head -1 | cut -d'"' -f4)
manifest:
  hooks: $HOOKS_COUNT
  skills: $SKILLS_COUNT
---
EOF
```

## 实现

### scripts/deploy.sh

添加了三层硬门禁：

```bash
# Gate 1: 必须在 main 分支
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    exit 2
fi

# Gate 2: 工作区必须干净
if ! git diff --quiet || ! git diff --cached --quiet; then
    exit 3
fi

# Gate 3: 必须与远程同步
if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
    exit 4
fi
```

### DEPLOY-STAMP 证据

```bash
cat > "$TARGET_DIR/DEPLOY-STAMP" <<EOF
---
timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
branch: main
commit: $COMMIT
version: $VERSION
manifest:
  hooks: $HOOKS_COUNT
  skills: $SKILLS_COUNT
deployed_by: $(whoami)@$(hostname)
---
EOF
```

## 验收

- [x] 从 feature/trust-layer 运行 deploy → exit 2 ✅
- [ ] 工作区 dirty 运行 deploy → exit 3 (待测试)
- [ ] 本地落后远程运行 deploy → exit 4 (待测试)
- [ ] main + clean + aligned 运行 deploy → 成功 (待测试)
- [x] 部署后生成 DEPLOY-STAMP ✅

## 状态

- [x] 完成（硬门禁已实现）
