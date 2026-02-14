---
name: okr
description: OKR 拆解工具。从 KR 拆解到 Feature 和 Task。完全自动化，带防作弊验证循环。
---

# OKR Decomposition with Quality Validation

## Workflow

### Stage 1: Analyze Key Result

1. Read and analyze the Key Result
2. Extract: Objective, metrics, targets, deadline
3. Proceed to Stage 2

---

## 🔑 开工前必问（CRITICAL - Capability 绑定）

**在生成 initiatives 之前，必须先确定 capability 归属。**

### 三问

1. **这个 KR 是推进已有能力，还是创建新能力？**
   - 推进已有（90%）→ 选择现有 capability_id
   - 创建新能力（10%）→ 输出 capability_proposal

2. **如果推进已有，是哪个 capability？**
   - 调用 `GET /api/brain/capabilities` 查看 23 个已有能力
   - 选择最匹配的 capability_id

3. **从哪个 stage 推进到哪个 stage？**
   - 查看该 capability 的 current_stage
   - 设定 from_stage（当前）和 to_stage（目标）
   - 必须满足：from_stage < to_stage

### Capability 选择流程

```
KR 拆解开始
    ↓
调用 GET /api/brain/capabilities
    ↓
分析 KR 与 23 个能力的匹配度
    ↓
    ├─ 匹配到已有能力（90%）
    │     ↓
    │  设定 capability_id, from_stage, to_stage
    │     ↓
    │  生成 initiatives
    │
    └─ 无法匹配（10%）
          ↓
       生成 capability_proposal
          ↓
       等待人工审批
          ↓
       审批后调用 POST /api/brain/capabilities
          ↓
       再生成 initiatives
```

### Capability Proposal 格式

如果无法匹配到已有 capability，输出：

```json
{
  "capability_proposal": {
    "id": "suggested-slug",
    "name": "建议的能力名称",
    "description": "为什么需要这个新能力",
    "current_stage": 1,
    "related_repos": ["/home/xx/perfect21/..."],
    "related_skills": ["skill-name"],
    "rationale": "为什么现有 23 个能力都不适用"
  }
}
```

**审批流程**：用户审查 proposal → 人工调用 `POST /api/brain/capabilities` → 返回 /okr 重新拆解

---

## Output Format (Choose One)

**两种格式可选**：

### 格式 A: 三层拆解（推荐，新项目）

```
Initiative（战略层）→ PR Plans（工程规划层）→ Tasks（执行层）
```

**适用场景**：
- 大型 KR，需要多个 PR 才能完成
- 需要明确 PR 之间的依赖关系
- 需要工程层面的规划（DoD、文件列表、复杂度评估）

**output.json 格式**：
```json
{
  "objective": "...",
  "kr_id": "...",
  "initiative": {
    "title": "实现任务智能调度系统",
    "description": "...",
    "repository": "cecelia-core"
  },
  "pr_plans": [
    {
      "title": "添加任务优先级算法",
      "description": "...",
      "dod": ["优先级算法实现完成", "单元测试覆盖率 > 80%"],
      "files": ["brain/src/priority-algo.js", "brain/src/__tests__/priority-algo.test.js"],
      "sequence": 1,
      "depends_on": [],
      "complexity": "medium",
      "estimated_hours": 8,
      "tasks": [
        {"title": "写 priority-algo.js", "type": "dev", "description": "..."},
        {"title": "写单元测试", "type": "dev", "description": "..."}
      ]
    },
    {
      "title": "实现资源监控模块",
      "description": "...",
      "dod": ["实时监控 CPU/内存", "数据存储到 brain_config"],
      "files": ["brain/src/resource-monitor.js"],
      "sequence": 2,
      "depends_on": [],
      "complexity": "low",
      "estimated_hours": 4,
      "tasks": [...]
    },
    {
      "title": "集成前端调度界面",
      "description": "...",
      "dod": ["展示任务队列", "显示优先级分数"],
      "files": ["workspace/src/components/TaskScheduler.tsx"],
      "sequence": 3,
      "depends_on": [1],
      "complexity": "high",
      "estimated_hours": 12,
      "tasks": [...]
    }
  ]
}
```

### 格式 B: 二层拆解（向后兼容，简单任务）

```
Features（功能层）→ Tasks（执行层）
```

**适用场景**：
- 简单 KR，单个 PR 即可完成
- 不需要复杂的依赖管理

**output.json 格式**：
```json
{
  "objective": "...",
  "key_results": [
    {
      "title": "...",
      "features": [
        {
          "title": "...",
          "description": "...",
          "repository": "cecelia-core"
        }
      ]
    }
  ]
}
```

---

### Stage 2: Generate Decomposition

**根据 KR 复杂度选择格式**：

#### Stage 2A: 三层拆解（推荐）

1. **分析 KR**：判断是否需要多个 PR
2. **创建 Initiative**（战略层）：
   - `title`: KR 的总体目标（以动词开头）
   - `description`: 详细说明（至少 50 字）
   - `repository`: 主要代码仓库

3. **拆解为 PR Plans**（工程规划层）：
   - 每个 PR Plan 对应一个待发的 PR
   - 2-5 个 PR Plans（不要太多）
   - 为每个 PR Plan 定义：
     - `title`: PR 标题（以动词开头，描述具体改动）
     - `description`: PR 描述（做什么、为什么）
     - `dod`: 验收标准数组（至少 2 条）
     - `files`: 涉及的文件路径数组（至少 1 个）
     - `sequence`: 执行顺序（1, 2, 3...）
     - `depends_on`: 依赖的其他 PR Plan 的 sequence（数组，可为空）
     - `complexity`: 复杂度（low/medium/high）
     - `estimated_hours`: 预估工时（数字）
     - `tasks`: 任务数组（见下一步）

4. **为每个 PR Plan 创建 Tasks**（执行层）：
   - 每个 PR Plan 下 2-5 个 Tasks
   - 每个 Task 定义：
     - `title`: 任务标题（具体可执行）
     - `type`: 任务类型（dev/review/qa/audit）
     - `description`: 任务描述

5. **保存到 output.json**

#### Stage 2B: 二层拆解（简单任务）

1. Decompose KR into 2-5 Features
2. For each Feature, define:
   - `title`: Actionable, specific (以动词开头)
   - `description`: Detailed (at least 50 characters)
   - `repository`: From SSOT (cecelia-workspace, cecelia-core, etc.)

3. Save to `output.json`

4. **Run validation script** (MUST DO):
   ```bash
   python3 ~/.claude/skills/okr/scripts/validate-okr.py output.json
   ```
   
   This generates `validation-report.json` with:
   - `form_score` (0-40): Automatically calculated
   - `content_hash`: SHA256 hash of output.json
   - `content_score` (0-60): You need to fill this

5. **Self-Assessment** (Content Quality):
   
   Read the validation report and assess content quality honestly:
   
   - **Title Quality** (0-15 per Feature):
     - 15: 以动词开头 + 具体技术词 + 10-50字
     - 10: 基本符合但不够具体
     - 5: 缺少动词或太模糊
     - 0: 完全看不懂
   
   - **Description Quality** (0-15 per Feature):
     - 15: 详细（>50字）+ 包含做什么/为什么/怎么做
     - 10: 基本清楚但缺少细节
     - 5: 太简单
     - 0: 模糊或缺失
   
   - **KR-Feature Mapping** (0-15):
     - 15: 每个 Feature 直接支持 KR
     - 10: 大部分相关
     - 5: 关联模糊
     - 0: 对不上
   
   - **Completeness** (0-15):
     - 15: 没有遗漏，考虑了边界情况
     - 10: 基本完整
     - 5: 有明显遗漏
     - 0: 不完整

6. **Update validation-report.json**:
   ```json
   {
     "form_score": 40,
     "content_score": 52,
     "content_breakdown": {
       "title_quality": 14,
       "description_quality": 13,
       "kr_feature_mapping": 14,
       "completeness": 11
     },
     "total": 92,
     "passed": true,
     "content_hash": "a9659c0ac93e157f",
     "timestamp": "2026-02-08T10:30:00"
   }
   ```

7. **Validation Loop** (Auto-fix until pass):
   
   ```
   WHILE total < 90:
       - Identify issues from validation report
       - Improve output.json (better descriptions, clearer titles, etc.)
       - Re-run: python3 validate-okr.py output.json
       - Re-assess content quality
       - Update validation-report.json
   END WHILE
   ```
   
   **IMPORTANT**: 
   - Always re-run the validation script after improving content
   - Never manually change scores without improving content
   - Hash verification will catch any cheating

8. When `total >= 90` and `passed = true`, proceed to Stage 3

---

### Stage 3: Generate Tasks

1. For each Feature, create 2-5 Tasks
2. Each Task must be:
   - Atomic (single responsibility)
   - Concrete (具体可执行)
   - Testable (有明确完成标准)

3. Save to `output.json`

4. **Re-run validation**:
   ```bash
   python3 ~/.claude/skills/okr/scripts/validate-okr.py output.json
   ```

5. **Validation Loop** (same as Stage 2)

6. When passed, proceed to Stage 4

---

### Stage 4: Final Output

1. Ensure `validation-report.json` shows:
   - `total >= 90`
   - `passed = true`
   - `content_hash` matches output.json

2. Save output.json to final location

3. Report completion

4. **Stop Hook will automatically verify**:
   - Hash integrity (no score tampering)
   - Script integrity (no validation.py tampering)
   - Calculation correctness
   - Passing threshold met

---

### Stage 4.5: Store to Database (Optional但推荐)

**目的**：将 OKR 拆解结果存储到 Brain 数据库，供 Cecelia 自动调度使用。

**前提条件**：
- validation-report.json 显示 `passed = true`
- Brain 服务运行中（localhost:5221）

**步骤**：

1. **调用存储脚本**：
   ```bash
   bash ~/.claude/skills/okr/scripts/store-to-database.sh output.json
   ```

2. **脚本自动执行**：
   - 读取 output.json 的 Features 和 Tasks
   - 查询 repository → project_id 映射
   - 调用 Brain API 创建 Goal (如果需要)
   - 调用 Brain API 创建 Feature SubProjects
   - 调用 Brain API 创建 Tasks (关联到 Feature 和 Goal)
   - 验证所有记录创建成功

3. **成功输出示例**：
   ```
   🔄 Storing OKR to database...

   ✅ Goal created: 550e8400-e29b-41d4-a716-446655440000
   ✅ Feature 1 "实现 Validation Loop" → Project: 660e8400-...
   ✅ Task 1.1 "创建 validate-prd.py" → Task ID: 770e8400-...
   ✅ Task 1.2 "集成到 /dev" → Task ID: 880e8400-...

   🎉 All tasks stored to database

   Query tasks:
   curl localhost:5212/api/tasks/tasks?goal_id=550e8400-...
   ```

4. **验证存储**（可选）：
   ```bash
   # 查看创建的任务
   curl -s localhost:5212/api/tasks/tasks | jq '.[] | select(.metadata.from_okr == true) | {id, title, status}'

   # 查看 Brain 能否看到
   curl -s localhost:5221/api/brain/tasks | jq '.[] | select(.metadata.from_okr == true)'
   ```

**错误处理**：

如果 API 调用失败（例如 Brain 服务未运行）：
- 脚本会重试 3 次
- 重试失败后，保存错误日志到 `okr-storage-errors.log`
- OKR Skill **仍然视为成功**（优雅降级）
- 提示信息：
  ```
  ⚠️  Database storage failed (Brain service unavailable)

  Tasks saved to: pending-tasks.json

  To retry later:
  bash ~/.claude/skills/okr/scripts/store-to-database.sh pending-tasks.json

  Or manually create tasks via Brain API
  ```

**跳过此步骤**：

如果不需要自动调度，可以跳过 Stage 4.5：
- output.json 仍然可用
- 手动创建任务到 Brain
- 或直接使用 output.json 启动 /dev

---

## Anti-patterns to Avoid

### ❌ Anti-pattern 1: Changing Scores Without Improving Content

**Bad Example:**
```python
# AI tries to cheat by directly editing validation-report.json
report['content_score'] = 60  # Changed from 52 to 60
report['total'] = 100          # Changed total
# But output.json content is still the same!
```

**Why it's wrong:**
- Validation report hash won't match output.json
- Stop Hook will detect the mismatch
- Exit code 2 → Session continues → Forced to fix

**Good Example:**
```python
# 1. Improve output.json (add better descriptions)
# 2. Re-run validation script
python3 validate-okr.py output.json
# 3. Script automatically updates hash
# 4. Then re-assess content quality
```

---

### ❌ Anti-pattern 2: Tampering with Validation Script

**Bad Example:**
```python
# AI tries to lower standards in validate-okr.py
# OLD: if len(description) >= 50: score += 2
# NEW: if len(description) >= 10: score += 2  # ← Lowered standard
```

**Why it's wrong:**
- Stop Hook checks `git diff scripts/validate-okr.py`
- Any modification is detected
- Exit code 2 → Session continues → Must revert

**Good Example:**
```
Don't modify validate-okr.py
Improve your output.json content instead
```

---

### ❌ Anti-pattern 3: Skipping Validation

**Bad Example:**
```markdown
1. Generate output.json
2. (Skip validation script)
3. Manually create validation-report.json with high scores
```

**Why it's wrong:**
- Missing content_hash field
- Stop Hook checks for hash
- Exit code 2 → Must run validation script

**Good Example:**
```bash
# Always run validation after generating content
python3 validate-okr.py output.json
```

---

### ❌ Anti-pattern 4: Inconsistent Breakdown

**Bad Example:**
```json
{
  "content_score": 60,
  "content_breakdown": {
    "title_quality": 10,
    "description_quality": 10,
    "kr_feature_mapping": 10,
    "completeness": 10
  }
}
```

**Why it's wrong:**
- Breakdown sum = 40
- But content_score = 60
- Stop Hook detects: 40 ≠ 60
- Exit code 2

**Good Example:**
```json
{
  "content_score": 52,
  "content_breakdown": {
    "title_quality": 14,
    "description_quality": 13,
    "kr_feature_mapping": 14,
    "completeness": 11
  }
}
```
Sum: 14+13+14+11 = 52 ✅

---

### ❌ Anti-pattern 5: Replacing with Old Reports

**Bad Example:**
```bash
# Copy an old passing report
cp old-validation-report.json validation-report.json
# But output.json is new/different content
```

**Why it's wrong:**
- Old report hash ≠ new content hash
- Stop Hook recalculates hash
- Hash mismatch detected
- Exit code 2

**Good Example:**
```bash
# Generate fresh report for current content
python3 validate-okr.py output.json
```

---

### ✅ Correct Workflow Summary

```
1. Generate/improve output.json
   ↓
2. Run: python3 validate-okr.py output.json
   ↓
3. Honestly assess content quality
   ↓
4. Update content_score in validation-report.json
   ↓
5. If total < 90:
   - Go back to step 1
   - Improve content
   - Never just change scores
   ↓
6. When total >= 90:
   - Stop Hook validates integrity
   - If cheating detected → exit 2 → back to step 1
   - If legitimate → exit 0 → task complete ✅
```

---

## Core Principles

1. **Never manually edit scores**
   - Always improve content and re-run validation
   
2. **Never modify validation script**
   - Git diff will catch any changes
   
3. **Never skip validation steps**
   - Hash verification requires running the script
   
4. **Be honest in self-assessment**
   - You're improving your own output quality
   - Strict self-evaluation leads to better results
   
5. **Trust the process**
   - Validation loop ensures quality
   - Stop Hook prevents shortcuts
   - Focus on making content actually better

---

## Examples

### Good Feature Example

```json
{
  "title": "实现任务解析 API",
  "description": "开发任务解析接口，支持从自然语言提取任务信息，包括标题、描述、优先级和依赖关系。使用 NLP 模型提高解析准确度，支持多语言输入，错误率控制在 5% 以内。",
  "repository": "cecelia-workspace"
}
```

**Why it's good:**
- Title: 以"实现"开头 ✅
- Title: 包含具体功能"任务解析 API" ✅
- Description: >50 字 ✅
- Description: 包含做什么、怎么做、质量标准 ✅
- Repository: 明确且存在于 SSOT ✅

**Self-assessment:**
- title_quality: 15/15
- description_quality: 15/15

---

### Bad Feature Example

```json
{
  "title": "任务相关功能",
  "description": "做任务的功能",
  "repository": "unknown"
}
```

**Why it's bad:**
- Title: 没有动词 ❌
- Title: "相关"太模糊 ❌
- Description: <20 字 ❌
- Description: 没有说清楚做什么 ❌
- Repository: 不存在 ❌

**Self-assessment:**
- title_quality: 0/15
- description_quality: 0/15

**How to fix:**
→ See "Good Feature Example" above

---

## Validation Report Schema

```json
{
  "form_score": 0-40,           // Auto-calculated by script
  "content_score": 0-60,        // AI self-assessment
  "content_breakdown": {
    "title_quality": 0-15,
    "description_quality": 0-15,
    "kr_feature_mapping": 0-15,
    "completeness": 0-15
  },
  "total": 0-100,               // form_score + content_score
  "passed": true/false,         // total >= 90
  "content_hash": "...",        // SHA256 of output.json
  "timestamp": "...",           // ISO format
  "issues": [],                 // Form validation issues
  "suggestions": []             // Improvement suggestions
}
```

---

## Remember

**质量循环的目的不是应付检查，而是真正提高输出质量。**

- Stop Hook 是防护网，不是敌人
- Validation Loop 是帮手，不是负担
- 诚实自评 → 发现不足 → 改进内容 → 真正进步 ✅

---

## 新增：迭代拆解模式（v12.14.0）

### 使用模式

#### 模式 A：单 Task（简单需求）

**适用场景**：
- 修复类："修复 XXX bug"
- 优化类："优化 XXX 性能"
- 小功能："添加 XXX 按钮"

**使用方法**：
```bash
# 初始拆解
bash skills/okr/scripts/decompose-feature.sh "修复登录 bug"

输出：
{
  "feature": { "complexity": "single", ... },
  "tasks": [
    { "id": "task-001", "prd_status": "detailed", ... }
  ]
}

# 直接执行（只有一个 Task）
/dev --task-id=task-001
# 完成
```

#### 模式 B：多 Task 迭代（复杂需求）

**适用场景**：
- 系统类："实现 XXX 系统"
- 功能集："完整的 XXX 功能"
- 多步骤："XXX + YYY + ZZZ"

**使用方法**：
```bash
# 第一步：初始拆解
bash skills/okr/scripts/decompose-feature.sh "实现用户认证系统"

输出：
{
  "feature": {
    "title": "实现用户认证系统",
    "description": "大 PRD（总体规划）",
    "complexity": "multiple"
  },
  "tasks": [
    {
      "id": "task-001",
      "title": "第一步：基础实现",
      "prd_status": "detailed",  ← 详细 PRD
      "prd_content": "完整的实现方案...",
      "order": 1
    },
    {
      "id": "task-002",
      "title": "第二步：功能完善",
      "prd_status": "draft",  ← 草稿
      "prd_content": "草稿：简短描述",
      "order": 2
    },
    {
      "id": "task-003",
      "title": "第三步：集成测试",
      "prd_status": "draft",
      "prd_content": "草稿：简短描述",
      "order": 3
    }
  ]
}

# 第二步：执行 Task 1
/dev --task-id=task-001
# Task 1 完成，生成反馈报告：.dev-runs/task-001-report.json

# 第三步：基于反馈继续拆解
bash skills/okr/scripts/continue-feature.sh feature-001 .dev-runs/task-001-report.json

输出：
{
  "feedback_read": true,
  "plan_adjusted": true,  ← 计划已调整（可能插入新 Task）
  "tasks_inserted": 1,    ← 插入了 1 个新 Task
  "next_task": {
    "id": "task-002",
    "title": "根据反馈调整：实现 token 刷新",
    "prd_status": "detailed",  ← 草稿已细化为详细 PRD
    "prd_content": "基于 Task 1 反馈的详细实现方案..."
  },
  "feature_completed": false
}

# 第四步：执行 Task 2
/dev --task-id=task-002
# Task 2 完成

# 第五步：继续迭代...
bash skills/okr/scripts/continue-feature.sh feature-001 .dev-runs/task-002-report.json
# ...

# 直到 Feature 完成：
{
  "feedback_read": true,
  "feature_completed": true,
  "completion_reason": "最后一个 Task 已完成，且反馈确认成功"
}
```

### 核心机制

#### 策略 C：混合规划

**初始规划**：
- 生成 3-5 个 Tasks 的草稿
- 只详细写 Task 1 的 PRD
- 其他 Tasks 保持草稿状态

**迭代细化**：
- Task N 完成 → 生成反馈报告
- 秋米读取反馈 → 分析 → 调整计划
- 细化 Task N+1 的 PRD（草稿 → 详细）
- 可能插入新 Task、删除不需要的 Task

#### 反馈报告格式

**生成位置**：`.dev-runs/<task-id>-report.json`

**包含字段**：
```json
{
  "task_id": "task-001",
  "feature_id": "feature-001",
  "feedback": {
    "summary": "登录 API 实现完成，支持 JWT 认证",
    "issues_found": [
      "发现需要处理 token 刷新机制"
    ],
    "next_steps_suggested": [
      "实现 token 刷新机制",
      "统一错误处理中间件"
    ],
    "technical_notes": [
      "使用 JWT，有效期 24h",
      "密钥存储在环境变量"
    ]
  },
  "code_changes": {
    "files_added": ["src/auth.ts"],
    "files_modified": ["src/routes.ts"],
    "lines_changed": 245
  },
  "quality": {
    "tests_passed": true,
    "coverage": "85%",
    "ci_status": "success"
  }
}
```

### 与原有流程的兼容性

**向后兼容**：
- 原有的 OKR 拆解流程（Stage 1-4）保持不变
- 新的迭代模式是可选的，不影响现有功能
- 可以选择使用新模式或继续使用原有模式

**集成点**：
- Stage 4.5（Store to Database）之后可以选择使用迭代模式
- Brain 调度时可以检测 Feature 类型，决定是否启用迭代循环
