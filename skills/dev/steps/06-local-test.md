# Step 6: 本地测试

> 必须全绿才能继续

**前置条件**：step >= 5
**完成后设置状态**：
```bash
git config branch."$BRANCH_NAME".step 6
```

---

## 6.1 扫描实际改动

代码写完后，扫描实际改动确认质检层级。

```bash
# 扫描已暂存的改动
bash "$ZENITHJOY_ENGINE/skills/dev/scripts/scan-change-level.sh" --staged

# 或扫描所有改动
bash "$ZENITHJOY_ENGINE/skills/dev/scripts/scan-change-level.sh"
```

**输出示例**：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  改动扫描结果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  改动文件: 5 个
  建议层级: L3

  判断依据:
    - API/服务: src/api/users.ts
    - 代码文件: src/utils/helper.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**对比 DoD 预估**：如果实际层级 > 预估层级，需要补测试。

---

## 6.2 运行测试

```bash
npm test
```

---

## 结果处理

| 结果 | 动作 |
|------|------|
| ✅ 全绿 | 继续下一步 |
| ❌ 有红 | 修复后重跑，不能跳过 |

---

## 常见问题

**Q: 测试太慢怎么办？**
A: 可以先跑相关测试 `npm test -- --grep "login"`

**Q: 测试环境问题导致失败？**
A: 先修环境，不要跳过测试。

**Q: 发现之前的测试也挂了？**
A: 先修之前的测试，保证 baseline 是绿的。

---

## Hook 强制

PR 创建前会自动跑 `npm test`，不过不能提交。

所以本地先跑一遍，避免被 Hook 拦截。
