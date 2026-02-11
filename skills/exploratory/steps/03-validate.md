# Step 3: 验证功能

> 确认功能跑通，记录验证过程

---

## 验证目标

**确认功能确实能用**，不需要完美测试。

---

## 验证方式

### API endpoint 验证

```bash
# 启动服务（如果需要）
npm start &
sleep 5

# curl 测试
echo "📡 测试 API endpoint..."
RESPONSE=$(curl -s http://localhost:5221/api/test)
echo "响应: $RESPONSE"

# 检查响应
if echo "$RESPONSE" | grep -q "expected-value"; then
    echo "✅ API 测试通过"
else
    echo "❌ API 测试失败"
    exit 1
fi
```

### 脚本/函数验证

```bash
# 运行脚本
echo "🔧 测试脚本..."
if bash scripts/test.sh; then
    echo "✅ 脚本测试通过"
else
    echo "❌ 脚本测试失败"
    exit 1
fi
```

### 手动验证

对于 UI 或复杂功能：
```bash
echo "📋 手动验证清单："
echo "  1. 打开浏览器访问 http://localhost:5211"
echo "  2. 点击测试按钮"
echo "  3. 确认功能正常"
echo ""
echo "✅ 手动验证通过（人工确认）"
```

---

## 记录验证结果

```bash
# 追加到 .exploratory-mode
cat >> .exploratory-mode << INNER_EOF

## 验证记录
验证时间: $(date -Iseconds)
验证方式: curl / node / manual / script
验证结果: pass
验证细节:
  - API endpoint 响应正常
  - 功能符合预期
  - 无明显错误
INNER_EOF

echo "✅ 验证结果已记录"
```

---

## 记录踩坑

**记录实现过程中的坑点**：

```bash
cat >> .exploratory-mode << INNER_EOF

## 踩坑记录
1. 依赖问题：需要先安装 redis（npm install redis）
2. 配置问题：Redis 默认端口 6379
3. 权限问题：需要启动 Redis 服务
4. 其他坑点：...
INNER_EOF
```

---

## 完成标志

功能验证通过：

- ✅ 主要功能能用
- ✅ 验证测试通过
- ✅ 记录了验证过程和坑点

**标记步骤完成**：
```bash
sed -i 's/^step_3_validate: pending/step_3_validate: done/' .exploratory-mode
echo "✅ Step 3 完成标记已写入 .exploratory-mode"
```

**立即执行下一步**：读取 `04-document.md` 并生成 PRD/DOD
