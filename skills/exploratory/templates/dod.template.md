# DoD - {{TASK_TITLE}}

## 验收标准

### 功能验收
- [ ] 主要功能实现
      Test: tests/... | manual:{{VALIDATION_METHOD}}
- [ ] 功能通过验证
      Test: {{VALIDATION_DETAILS}}

### 代码质量验收
- [ ] 代码符合项目规范
      Test: manual:Code Review
- [ ] 无明显安全漏洞
      Test: manual:Security Check

### 测试验收
- [ ] npm run qa 通过
      Test: contract:C2-001

## 证据文件
基于 Exploratory 验证的证据：
- 验证时间：{{VALIDATION_TIME}}
- 验证方式：{{VALIDATION_METHOD}}
- 验证结果：pass

## 踩坑记录
{{PITFALLS}}
