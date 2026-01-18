# Step 2: 检测项目环境

> 读取项目信息，确定测试能力和构建方式

**完成后设置状态**：
```bash
git config branch."$BRANCH_NAME".step 2
```

---

## 读取 .project-info.json

项目信息由 `project-detect.sh` (PostToolUse) 自动检测并缓存到 `.project-info.json`。

**Step 2 只读取，不重复扫描**：

```bash
echo "📋 读取项目信息..."

if [[ -f ".project-info.json" ]]; then
    PROJECT_TYPE=$(jq -r '.project.type' .project-info.json)
    IS_MONOREPO=$(jq -r '.project.is_monorepo' .project-info.json)
    MAX_LEVEL=$(jq -r '.test_levels.max_level' .project-info.json)

    echo "  项目类型: $PROJECT_TYPE"
    [[ "$IS_MONOREPO" == "true" ]] && echo "  Monorepo: $(jq -r '.project.packages | length' .project-info.json) 个包"
    echo "  测试能力: L$MAX_LEVEL"
else
    echo "  ⚠️ 未检测到 .project-info.json"
    echo "  执行任意 Bash 命令触发自动检测"
fi
```

---

## 显示项目环境

```bash
echo ""
echo "🔍 项目环境："
echo ""

# 项目类型
PROJECT_TYPE=$(jq -r '.project.type' .project-info.json)
echo "  类型: $PROJECT_TYPE"

# Monorepo 信息
IS_MONOREPO=$(jq -r '.project.is_monorepo' .project-info.json)
if [[ "$IS_MONOREPO" == "true" ]]; then
    PACKAGES=$(jq -r '.project.packages | length' .project-info.json)
    echo "  结构: Monorepo ($PACKAGES 个包)"
    echo "  包列表:"
    jq -r '.project.packages[] | "    - \(.)"' .project-info.json
else
    echo "  结构: 单包项目"
fi

# 测试能力
MAX_LEVEL=$(jq -r '.test_levels.max_level' .project-info.json)
echo ""
echo "  测试能力: L$MAX_LEVEL"
echo ""
echo "  支持的测试层级:"
jq -r '.test_levels.available_levels[] | "    [\(.level)] \(.name) - \(.tools)"' .project-info.json

# 构建工具
echo ""
echo "  构建工具:"
HAS_VITE=$(jq -r '.project.has_vite' .project-info.json)
HAS_WEBPACK=$(jq -r '.project.has_webpack' .project-info.json)
HAS_TSC=$(jq -r '.project.has_tsc' .project-info.json)

[[ "$HAS_VITE" == "true" ]] && echo "    - Vite"
[[ "$HAS_WEBPACK" == "true" ]] && echo "    - Webpack"
[[ "$HAS_TSC" == "true" ]] && echo "    - TypeScript Compiler"

# 包管理器
PACKAGE_MANAGER=$(jq -r '.project.package_manager // "npm"' .project-info.json)
echo ""
echo "  包管理器: $PACKAGE_MANAGER"
```

---

## 自动检测触发

**不需要手动触发**，`project-detect.sh` 在每次 Bash 命令后自动运行：

- 基于文件哈希判断是否需要重新扫描（避免重复）
- 检测结果缓存到 `.project-info.json`
- 第一次运行时会扫描整个项目结构

---

## 检测内容

| 内容 | 说明 |
|------|------|
| 项目类型 | node/python/go/rust |
| Monorepo | 是否多包结构 |
| 包列表 | packages/apps 下的包 |
| 依赖图 | 包之间的依赖关系 |
| 测试能力 | L1-L6 层级 |
| 构建工具 | Vite/Webpack/TSC |
| 包管理器 | npm/yarn/pnpm |

---

## 确定后续策略

根据项目信息确定：

```bash
# 确定测试策略
if [[ "$MAX_LEVEL" -ge 6 ]]; then
    echo "✅ 完整测试能力 (L1-L6)"
    echo "   → Step 6: 写完整测试"
    echo "   → Step 7: 运行三层质检"
elif [[ "$MAX_LEVEL" -ge 3 ]]; then
    echo "⚠️ 中等测试能力 (L1-L3)"
    echo "   → Step 6: 写基础测试"
    echo "   → Step 7: 运行基础质检"
else
    echo "⚠️ 无自动测试能力 (L0)"
    echo "   → Step 6: 跳过"
    echo "   → Step 7: 手动验证"
fi

# 确定构建策略
if [[ "$HAS_VITE" == "true" ]]; then
    echo ""
    echo "✅ Vite 项目"
    echo "   → 使用 vite build 构建"
elif [[ "$HAS_TSC" == "true" ]]; then
    echo ""
    echo "✅ TypeScript 项目"
    echo "   → 使用 tsc 编译"
fi
```

---

## 完成后

```bash
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
git config branch."$BRANCH_NAME".step 2
echo "✅ Step 2 完成 (项目环境检测)"
```
