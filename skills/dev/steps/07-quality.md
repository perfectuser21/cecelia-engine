# Step 7: 质检

> 跑测试，确保代码质量

**前置条件**：step >= 6
**完成后设置状态**：
```bash
git config branch."$BRANCH_NAME".step 7
```

---

## 双模式质检

v8.0 引入双模式设计，减少日常 PR 阻力：

| 模式 | 检查内容 | 适用场景 |
|------|----------|----------|
| **pr** (默认) | 只 L1 | 日常 PR → develop |
| **release** | L1 + L2 + L3 | 发版 develop → main |

---

## PR 模式 (默认)

日常开发只需通过 L1 自动化测试：

```bash
npm run qa  # = typecheck + test + build
```

### 检查项

- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 通过
- [ ] `npm run build` 通过
- [ ] `.dod.md` 存在（不要求全勾）

**结果判定**：
- ✅ L1 全绿 → 继续 Step 8 (PR)
- ❌ L1 有红 → 返回 Step 5 修复

---

## Release 模式

发版时需要完整证据链：

```bash
PR_GATE_MODE=release gh pr create ...
```

### 完整检查项

**Layer 1 - 自动化测试**：
- [ ] `npm run qa` 通过

**Layer 2 - 效果验证**：
- [ ] `.layer2-evidence.md` 存在
- [ ] 截图 ID (S1, S2) 对应文件存在
- [ ] curl 输出包含 `HTTP_STATUS: xxx`

**Layer 3 - 需求验收**：
- [ ] `.dod.md` 存在
- [ ] 所有 checkbox 打勾 `[x]`
- [ ] 每项有 `Evidence: \`Sx\`` 或 `\`Cx\`` 引用
- [ ] 引用的 ID 在 `.layer2-evidence.md` 中存在

---

## 快速检查命令

```bash
# 本地快速质检
npm run qa

# 检查 shell 语法
find . -name "*.sh" -exec bash -n {} \;
```

---

## 结果处理

| 模式 | 结果 | 动作 |
|------|------|------|
| pr | ✅ L1 通过 | 继续 Step 8 (PR) |
| pr | ❌ L1 失败 | 返回 Step 5 修复 |
| release | ✅ 三层通过 | 继续 Step 8 (PR) |
| release | ❌ 任何失败 | 返回 Step 5 修复 |

---

## Hook 自动验证

提交 PR 时，`pr-gate-v2.sh` 会自动检查：

**PR 模式输出**：
```
PR GATE v2: 快速检查 (L1 only)

  [基础检查]
  项目检测... ✅ (L2)
  分支... ✅ (cp-xxx)

  [Layer 1: 自动化测试]
  typecheck... ✅
  test... ✅
  build... ✅

  [Layer 2: 效果验证] ⏭️  跳过 (pr 模式)

  [Layer 3: 需求验收] (简化)
  DoD 文件... ✅ (存在即可)

✅ 快速检查通过，允许提交 PR
```

**如果检查失败**：
- step 回退到 4
- 显示需要修复的内容
- 必须修复后再次提交 PR

---

## 质检原则

1. **分层检查** - PR 只 L1，Release 才 L2+L3
2. **快速反馈** - 本地 `npm run qa` 与 CI 结论一致
3. **证据驱动** - Release 时用截图/curl 证明效果
4. **CI 兜底** - 最终 CI 是唯一强制检查
