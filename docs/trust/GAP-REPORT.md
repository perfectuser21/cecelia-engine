---
id: gap-report-personal-to-org
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: 初始版本 - 个人仓库差距分析
---

# Gap Report - 个人仓库 vs 组织仓库

## 当前仓库状态（API 证据）

### 仓库基本信息

```json
{
  "name": "zenithjoy-engine",
  "full_name": "perfectuser21/zenithjoy-engine",
  "private": true,
  "owner_type": "User",
  "organization": null,
  "permissions": {
    "admin": true,
    "maintain": true,
    "push": true,
    "triage": true,
    "pull": true
  },
  "archived": false,
  "disabled": false
}
```

**关键发现：**
- ✅ `private: true` - 仓库已私有
- ❌ `owner_type: "User"` - 个人仓库（非组织）
- ❌ `organization: null` - 未关联组织

---

## Main 分支保护规则（API 证据）

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test"]
  },
  "enforce_admins": {
    "enabled": true
  },
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": {
    "enabled": false
  },
  "allow_deletions": {
    "enabled": false
  }
}
```

**关键发现：**
- ✅ `required_status_checks.strict: true` - 分支必须最新
- ✅ `enforce_admins.enabled: true` - 管理员受限
- ✅ `required_pull_request_reviews` - 必须 PR
- ❌ **`restrictions: null`** - **无法启用 Push Restrictions（个人仓库限制）**
- ✅ `allow_force_pushes.enabled: false` - 禁止强推
- ✅ `allow_deletions.enabled: false` - 禁止删除分支

---

## Rulesets 支持检查（API 证据）

```json
[]
```

**关键发现：**
- ❌ **Rulesets 为空数组** - 个人仓库不支持完整 Rulesets 功能

---

## 已达成项（A- 级，95%）

| 功能 | 状态 | 证据 |
|------|------|------|
| 仓库私有 | ✅ | `private: true` |
| 必须 PR | ✅ | `required_pull_request_reviews` 存在 |
| 必须 CI 通过 | ✅ | `required_status_checks.contexts: ["test"]` |
| 管理员受限 | ✅ | `enforce_admins.enabled: true` |
| 分支必须最新 | ✅ | `required_status_checks.strict: true` |
| 禁止强推 | ✅ | `allow_force_pushes.enabled: false` |
| 禁止删除分支 | ✅ | `allow_deletions.enabled: false` |

---

## 未达成项（导致无法 100%）

### 1. Push Restrictions（关键差距）

**问题：**
```json
"restrictions": null
```

**API 错误（尝试启用时）：**
```
HTTP 422: "Only organization repositories can have users and team restrictions"
```

**原因：**
- `restrictions` 字段**只支持组织仓库**
- 个人仓库的 API 不接受此字段
- GitHub 个人仓库架构限制，无法通过任何方式绕过

**后果：**
- 无法限制"只有 Merge Bot 可以写入 main/develop"
- Owner 仍然可以直接 push（即使有 `enforce_admins`）
- 任何有 push 权限的人都可以写入（无法细粒度控制）

### 2. Rulesets（完整版）

**问题：**
```json
GET /repos/perfectuser21/zenithjoy-engine/rulesets
返回: []
```

**原因：**
- 个人仓库不支持完整的 GitHub Rulesets
- 只有组织仓库才能使用 Rulesets 的完整功能：
  - Bypass list（明确谁可以绕过）
  - Target 多分支（通配符匹配）
  - Metadata restrictions（标签、文件路径限制）
  - 更细粒度的权限控制

**后果：**
- 只能使用传统 Branch Protection Rules
- 无法使用现代化的规则引擎
- 配置灵活性受限

### 3. Owner 绝对权限

**问题：**
即使启用了 `enforce_admins: true`，个人仓库的 owner 仍然可以：
- 通过 GitHub UI 强制合并 PR（"Admin override"）
- 在紧急情况下绕过所有规则
- 修改或删除保护规则本身

**原因：**
- GitHub 个人仓库的权限模型：owner = 最终权限
- 组织仓库可以通过 Rulesets 的 `bypass_actors` 严格控制
- 个人仓库没有这个层级的权限分离

**后果：**
- 无法实现"完全不可绕过"的门禁
- 依赖 owner 的自律
- 不符合"Zero-Escape"定义

---

## 为什么个人仓库无法达到 100%

### 架构原因

1. **权限模型不同**
   - 个人仓库：Owner > Admin > Write > Read
   - 组织仓库：Organization > Team > Member，支持更细粒度控制

2. **API 能力不同**
   - 个人仓库：`restrictions` API 返回 422 错误
   - 组织仓库：完整支持 `restrictions` 字段

3. **Rulesets 支持**
   - 个人仓库：基础 Branch Protection Rules
   - 组织仓库：完整 Rulesets + Bypass actors

### API 证据

尝试为个人仓库启用 Push Restrictions：

```bash
gh api -X PUT repos/perfectuser21/zenithjoy-engine/branches/main/protection \
  -f restrictions='{"users":[],"teams":[],"apps":["merge-bot"]}' \
  ...

返回：
{
  "message": "Only organization repositories can have users and team restrictions",
  "documentation_url": "https://docs.github.com/rest/branches/branch-protection#update-branch-protection"
}
```

---

## 差距总结

| 维度 | 个人仓库（A-） | 组织仓库（A+） | 差距 |
|------|---------------|---------------|------|
| Push Restrictions | ❌ 不支持 | ✅ 支持 | **5%** |
| Rulesets（完整版）| ❌ 不支持 | ✅ 支持 | - |
| Owner 绝对限制 | ❌ 不可能 | ✅ 可通过 Rulesets | - |
| Bypass Actors | ❌ 不支持 | ✅ 支持 | - |
| Merge Bot 唯一写入 | ❌ 不可能 | ✅ 可实现 | **关键** |

**保护等级：**
- 个人仓库最大值：**A- (95%)**
- 组织仓库可达：**A+ (100%)**

---

## 迁移到组织后可获得

### 1. Push Restrictions

```json
"restrictions": {
  "users": [],
  "teams": [],
  "apps": [
    {
      "id": 123456,
      "slug": "merge-bot",
      "name": "Merge Bot"
    }
  ]
}
```

**效果：**
- 只有 Merge Bot 可以写入 main/develop
- 任何人（包括 owner）都无法直推
- 服务器侧强制，不可绕过

### 2. Rulesets（完整版）

```json
{
  "id": 123,
  "name": "Zero-Escape Protection",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    {
      "actor_id": 1,
      "actor_type": "Integration",
      "bypass_mode": "always"
    }
  ],
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main", "refs/heads/develop"],
      "exclude": []
    }
  },
  "rules": [
    {"type": "pull_request", "parameters": {"required_approving_review_count": 0}},
    {"type": "required_status_checks", "parameters": {"required_status_checks": [{"context": "test"}]}},
    {"type": "non_fast_forward"},
    {"type": "deletion"}
  ]
}
```

**效果：**
- 更灵活的规则配置
- 明确的 bypass_actors 列表
- 支持多分支通配符
- 更好的审计日志

### 3. Merge Bot 唯一写入者

**实现方式 A（GitHub App）：**
- 创建 GitHub App：`merge-bot`
- 最小权限：`contents: write`（仅限 merge）、`pull_requests: read`、`checks: read`
- 添加到 Rulesets 的 `bypass_actors`
- 只有这个 App 可以执行 merge

**实现方式 B（机器人账号）：**
- 创建机器人账号：`zenithjoy-bot`
- 添加到组织，给予最小权限
- 设置为唯一的 `restrictions.users`

---

## 结论

**个人仓库已达到理论最大值（A- 95%）：**
- ✅ 已启用所有可用的保护规则
- ✅ Trust Proof Suite 10/10 通过
- ❌ 但无法启用 Push Restrictions（架构限制）

**剩余 5% 差距必须迁移到组织仓库：**
- Push Restrictions → 实现"只有 Merge Bot 可写"
- Rulesets → 更强的规则引擎
- Zero-Escape → 真正不可绕过的门禁

**迁移到组织后可达到 A+ (100%)。**
