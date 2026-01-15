# DoD: [Checkpoint 名称]

> Definition of Done - 机器可判定的完成标准
>
> 与 PRD 配合使用，确保 AI Agent 和人工验收使用一致的标准

## 完成标准

### 必须通过

- [ ] CI 全绿（所有自动化检查通过）
- [ ] 构建成功（无编译错误）
- [ ] 测试通过（单元测试 + 集成测试）
- [ ] 代码规范（Lint + Format）
- [ ] 类型检查通过（TypeScript / 类型系统）

### 验证命令

```bash
# 构建验证
npm run build
# 或: pnpm build / yarn build / make build

# 测试验证
npm run test
# 或: npm run test:unit && npm run test:integration

# 代码规范检查
npm run lint
npm run format:check

# 类型检查
npm run type-check
# 或: tsc --noEmit
```

### 功能验证

- [ ] 核心功能正常运行
- [ ] 边界条件处理正确
- [ ] 错误处理完善
- [ ] 性能符合预期

### 验证步骤

```bash
# 1. 启动服务
npm run dev

# 2. 执行功能测试
# [具体测试步骤]

# 3. 验证输出
# [预期结果描述]
```

## 范围限制

### 允许修改

- 本次 Checkpoint 涉及的模块/文件
- 相关的测试文件
- 必要的类型定义文件
- 相关的配置文件（如需要）

### 禁止修改

- 不相关的业务逻辑
- 其他模块的核心代码
- 全局配置（除非明确要求）
- 已弃用的代码（不要删除或重构）

### 代码质量要求

- [ ] 无 console.log（除非是正式日志）
- [ ] 无注释代码（已删除）
- [ ] 无未使用的 import
- [ ] 无临时文件（*New.tsx, *Old.tsx, *Backup.*）
- [ ] 单文件不超过 500 行（否则拆分）
- [ ] 重复代码已提取为函数/组件

## 文档要求

- [ ] 代码注释清晰（复杂逻辑必须注释）
- [ ] API 文档更新（如有接口变更）
- [ ] README 更新（如有使用方式变更）

## 依赖检查

- [ ] package.json 版本正确
- [ ] 无冲突的依赖版本
- [ ] lockfile 已提交

## Git 规范

- [ ] Commit 信息清晰
- [ ] 分支命名符合规范（{产品线}/{功能}/{任务}）
- [ ] 无敏感信息（.env, credentials 等）

## 备注

<!-- 补充说明、特殊情况、技术债务等 -->
