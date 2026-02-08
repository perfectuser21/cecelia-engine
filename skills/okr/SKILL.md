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

### Stage 2: Generate Features

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
