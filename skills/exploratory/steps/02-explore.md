# Step 2: Exploratory 实现

> 快速实现功能，允许 hack，能跑就行

---

## 核心原则

**Exploratory 模式的自由度**：

- ✅ **hack 代码**：复制粘贴、hardcode、快速试错
- ✅ **跳过规范**：不需要符合代码规范
- ✅ **跳过测试**：不需要写测试
- ✅ **跳过错误处理**：先让功能跑通
- ✅ **快速验证**：手动测试、curl 测试即可

**唯一目标**：**证明功能可行**

---

## 实现流程

### 1. 理解任务

从 `.exploratory-mode` 读取任务描述：
```bash
TASK_DESC=$(grep "^task:" .exploratory-mode | cut -d' ' -f2-)
echo "📋 任务: $TASK_DESC"
```

### 2. 快速实现

根据任务描述，快速写代码：

- 不要过度设计
- 能用简单方案就用简单方案
- 代码可以很乱，没关系
- 可以 hardcode 配置

### 3. 记录过程

在实现过程中，记录：
- 修改了哪些文件
- 遇到了什么坑
- 依赖了什么库/服务
- 有什么前置条件

这些信息会用于生成 PRD/DOD。

---

## 验证方式

### 快速验证

**不需要完整测试，能跑通就行**：

```bash
# API endpoint 验证
curl http://localhost:5221/api/test

# 函数验证
node -e "const fn = require('./src/test.js'); console.log(fn())"

# 脚本验证
bash scripts/test.sh
```

### 记录验证结果

```bash
# 在 .exploratory-mode 中追加验证记录
echo "验证时间: $(date -Iseconds)" >> .exploratory-mode
echo "验证方式: curl / node / manual" >> .exploratory-mode
echo "验证结果: pass / fail" >> .exploratory-mode
```

---

## 常见场景

### 场景 1：新增 API endpoint

```javascript
// hack 实现（不需要干净）
router.get('/api/test', (req, res) => {
  // hardcode 返回
  res.json({ message: 'hello' });
});
```

### 场景 2：集成第三方库

```bash
# 直接安装测试
npm install redis
```

```javascript
// hack 连接（hardcode 配置）
const redis = require('redis');
const client = redis.createClient({ host: 'localhost', port: 6379 });
client.set('test', 'value');
```

### 场景 3：修改现有逻辑

```javascript
// 直接改核心文件（worktree 隔离，不怕）
function oldLogic() {
  // 注释掉旧逻辑
  // return complexCalculation();
  
  // hack 新逻辑
  return 42;
}
```

---

## 完成标志

功能能跑通即可，不需要完美：

- ✅ 主要功能能用
- ✅ 手动测试通过
- ✅ 记录了修改和坑点

**标记步骤完成**：
```bash
sed -i 's/^step_2_explore: pending/step_2_explore: done/' .exploratory-mode
echo "✅ Step 2 完成标记已写入 .exploratory-mode"
```

**立即执行下一步**：读取 `03-validate.md` 并验证
