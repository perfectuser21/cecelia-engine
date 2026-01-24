---
id: pro-solution
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: GitHub Pro 用户解决方案
---

# GitHub Pro 用户解决方案

## 核心问题

**当前状态**：
- 仓库在免费组织 → 私有仓库无 Branch Protection → F (0%)
- 个人是 GitHub Pro → 个人账户支持私有仓库 Branch Protection

## 功能对比

| 功能 | 个人 Pro | 免费组织 | Team 组织 |
|------|---------|---------|----------|
| 私有仓库 | ✅ 无限 | ✅ 无限 | ✅ 无限 |
| Branch Protection (Private) | ✅ **支持** | ❌ 不支持 | ✅ 支持 |
| Push Restrictions | ❌ 不支持 | ❌ 不支持 | ✅ 支持 |
| Rulesets | ❌ 不支持 | ❌ 不支持 | ✅ 支持 |
| **保护等级** | **A- (95%)** | **F (0%)** | **A+ (100%)** |

---

## 方案 1: 转回个人 Pro 账户（推荐）

### 优点
- ✅ **免费**（已有 Pro）
- ✅ 私有仓库支持 Branch Protection
- ✅ 保护等级：A- (95%)
- ✅ 比现状好得多（F → A-）

### 缺点
- ❌ 无法启用 Push Restrictions（需要组织 Team）
- ❌ 无法达到 A+ (100%)
- ❌ 缺少最后 5%（Merge Bot 独占写入）

### 操作步骤

#### 1. 将仓库转回个人账户

**Engine**:
```
1. https://github.com/ZenithJoycloud/zenithjoy-engine/settings
2. Danger Zone → Transfer ownership
3. New owner: perfectuser21
4. Confirm
```

**Autopilot**:
```
1. https://github.com/ZenithJoycloud/zenithjoy-autopilot/settings
2. Danger Zone → Transfer ownership
3. New owner: perfectuser21
4. Confirm
```

**Core**（可选）:
- 选项 A: 转回个人账户（私有）
- 选项 B: 留在组织并设为 PUBLIC（免费用 Branch Protection）

#### 2. 更新本地远程 URL

```bash
# Engine
cd /home/xx/dev/zenithjoy-engine
git remote set-url origin https://github.com/perfectuser21/zenithjoy-engine.git
git fetch origin

# Autopilot (if applicable)
cd /home/xx/dev/zenithjoy-autopilot
git remote set-url origin https://github.com/perfectuser21/zenithjoy-autopilot.git
git fetch origin
```

#### 3. 重新启用 Branch Protection

转回后，立即配置 Branch Protection（个人 Pro 账户支持）：

```bash
# 为 main 分支启用保护
gh api -X PUT repos/perfectuser21/zenithjoy-engine/branches/main/protection \
  --input branch-protection-main.json

# 为 develop 分支启用保护
gh api -X PUT repos/perfectuser21/zenithjoy-engine/branches/develop/protection \
  --input branch-protection-develop.json
```

**配置文件（同之前的 A- 配置）**:
```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

#### 4. 运行 Trust Proof Suite v1

```bash
bash scripts/trust-proof-suite.sh
```

**期望输出**：
```
Passed: 10/10
Failed: 0/10
Status: A- (95%) - Personal Pro account protection
```

---

## 方案 2: 混合架构

**私有仓库（Engine, Autopilot）** → 个人 Pro 账户（A- 保护）
**公开仓库（Core）** → 组织（免费 Branch Protection）

### 优点
- ✅ 所有仓库都有 Branch Protection
- ✅ 免费
- ✅ Core 可以展示给外部（如果需要）

### 缺点
- ❌ 架构不统一
- ❌ Core 必须公开
- ❌ 仍无法达到 A+

---

## 方案 3: 升级组织到 Team（最佳但需付费）

**费用**: $4/用户/月

**优点**:
- ✅ 所有仓库统一在组织
- ✅ 私有仓库 Branch Protection
- ✅ Push Restrictions
- ✅ 完整 Rulesets
- ✅ **A+ (100%)**

---

## 推荐选择

### 短期：方案 1（转回个人 Pro）
- 立即恢复 A- 保护
- 零成本
- 比现状好得多

### 长期：方案 3（升级 Team）
- 如果业务发展需要团队协作
- 需要 A+ 级别的安全保障
- 值得投资 $4/月

---

## 对比总结

| 方案 | 成本 | 保护等级 | Private | 架构 | 推荐度 |
|------|------|---------|---------|------|--------|
| 当前（免费组织） | 免费 | F (0%) | ✅ | 统一 | ❌ 不推荐 |
| 转回个人 Pro | 免费 | A- (95%) | ✅ | 统一 | ⭐⭐⭐ 推荐 |
| 混合架构 | 免费 | A-/A- | Core 公开 | 分散 | ⭐⭐ 可选 |
| 升级 Team | $4/月 | A+ (100%) | ✅ | 统一 | ⭐⭐⭐⭐ 最佳 |

---

## 下一步行动

### 如果选择方案 1（转回个人 Pro）

**我会自动执行**：
1. 等待你手动转移仓库（GitHub UI）
2. 更新本地远程 URL
3. 重新配置 Branch Protection
4. 运行 Trust Proof Suite v1
5. 验证 A- 达成

**你需要做**：
1. 转移 Engine: https://github.com/ZenithJoycloud/zenithjoy-engine/settings
2. 转移 Autopilot: https://github.com/ZenithJoycloud/zenithjoy-autopilot/settings
3. （可选）转移 Core 或设为 PUBLIC

### 如果选择方案 3（升级 Team）

访问：https://github.com/organizations/ZenithJoycloud/billing/plans

---

## 技术细节

### 为什么个人 Pro 支持但免费组织不支持？

**GitHub 的定价策略**：
- 个人 Pro：$4/月 → 解锁私有仓库 Branch Protection
- 组织 Free：$0 → 只有公开仓库可用 Branch Protection
- 组织 Team：$4/用户/月 → 解锁私有仓库 Branch Protection + Push Restrictions

**参考**：https://docs.github.com/en/get-started/learning-about-github/githubs-plans

### 为什么 A- 已经很接近 A+？

**A- (95%) 已经实现**：
- ✅ 必须 PR
- ✅ 必须 CI 通过
- ✅ 管理员也受限（enforce_admins）
- ✅ 禁止强推
- ✅ 禁止删除分支

**A+ (100%) 额外提供**：
- ✅ Push Restrictions（只有 Merge Bot 能写入）
- ✅ Rulesets（更灵活的规则引擎）

**差距分析**：
- A- 已经能阻止 99% 的误操作
- A+ 是 100% 防御（连 owner 都无法直推）
- 对于个人/小团队，A- 已经足够强
- 对于企业/严格合规，A+ 是必须

---

## 我的建议

**立即行动：转回个人 Pro（方案 1）**
- 恢复到 A- 保护（从 F 0% 提升到 95%）
- 零成本
- 10 分钟完成

**未来评估：升级 Team（方案 3）**
- 如果团队规模扩大
- 如果需要严格合规
- 每月 $4 可接受时

---

你想选择哪个方案？我立即帮你执行。
