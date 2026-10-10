# Skill: Incident Knowledge Workflow

## Trigger
故障 / BUG / 异常 / 编译失败 / 修复 / 复盘 / 验证失败 / 环境阻塞 / incident / regression / root cause

## Scope
在 FlexiKit 中长期记录、检索并复用故障修复过程，不取代 MASTER_PLAN 主线、TECH_DEBT 或原 errors-log。

## Rules
1. 先查 docs/ERROR_KNOWLEDGE_BASE.md、现有案例和专项报告，避免重复定位；相同问题延续原 ID。
2. 所有意外失败仍按 CLAUDE.md 记入 .agents/skills/errors-log.md；这个文件含混合 LF/CRLF，禁止全量重写、格式化或丢失旧日志。
3. 对有复用价值的 BUG/ENV/TEST/TOOL 新建 docs/incidents/TEMPLATE.md 格式的案例，并更新知识库索引；包含分类、稳定编号、P0–P3、状态、复现、根因证据、代码定位、验证范围和防复发。
4. 未明确验证不得标 VERIFIED；只通过 Mock/隔离，不得声称真实用户或生产发布验收。
5. 不写入任何密码、Token、私有路径、Prompt、未脱敏日志或用户数据。只能在审核后将记录提交到私有仓库；不自动承诺云备份。
6. 文档闭环仍同步 CHANGELOG/STABLE_CHECKLIST/TECH_DEBT，主线由 MASTER_PLAN 决定。运行 node scripts/check-incident-knowledge.mjs 校验基础文档契约。
