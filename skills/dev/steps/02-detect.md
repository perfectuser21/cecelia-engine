# Step 2: 确认项目环境

> 快速确认项目类型，准备进入开发

**完成后设置状态**：
```bash
git config branch."$BRANCH_NAME".step 2
```

---

## 检测方式

直接从项目文件判断，不需要额外扫描：

| 文件 | 项目类型 |
|------|----------|
| package.json | Node.js |
| pyproject.toml / requirements.txt | Python |
| go.mod | Go |
| Cargo.toml | Rust |

---

## 确认内容

```bash
echo "📋 项目环境："

# 项目名称
PROJECT_NAME=$(basename "$(pwd)")
echo "  名称: $PROJECT_NAME"

# 项目类型
if [[ -f "package.json" ]]; then
    echo "  类型: Node.js"
    VERSION=$(jq -r '.version // "未定义"' package.json)
    echo "  版本: $VERSION"
elif [[ -f "pyproject.toml" ]]; then
    echo "  类型: Python"
elif [[ -f "go.mod" ]]; then
    echo "  类型: Go"
elif [[ -f "Cargo.toml" ]]; then
    echo "  类型: Rust"
else
    echo "  类型: 未知"
fi

# 测试命令
if [[ -f "package.json" ]]; then
    if grep -q '"qa"' package.json 2>/dev/null; then
        echo "  测试: npm run qa"
    elif grep -q '"test"' package.json 2>/dev/null; then
        echo "  测试: npm test"
    fi
fi
```

---

## 完成后

```bash
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
git config branch."$BRANCH_NAME".step 2
echo "✅ Step 2 完成 (项目环境确认)"
```

继续 → Step 3 创建分支
