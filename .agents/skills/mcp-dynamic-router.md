# Skill: Hierarchical Skill Router (Token-Saver Engine)

## Description
用于识别任务类别并指导按需读取适用的项目技能。技能路由是**文档检索策略**，不是修改系统提示、隐藏加载插件或清除会话上下文的运行时能力。先遵循根目录 `CLAUDE.md` 的技能扫描规则，UI 相关同时遵守 `apple-design-system.md` 与 `apple-motion-interaction.md` 的优先级。

## Core Routing Logic
1. **语义分类（Semantic Gateway）：**
   - 检查用户请求的路径或关键词。
   - 前端代码实际位于 `apps/web/`，UI 任务读取 Vue 守卫以及 Apple 视觉与交互技能；可能涉及 API 时同时读取前端 API 层技能。
   - 后端代码实际位于 `backend/`，根据 NestJS、缓存、pgvector、数据库迁移等触发条件加载相关技能。
2. **上下文管理：**
   - 可以把已阅读的文档整理成简明索引或检查摘要；**不能**自行卸载系统/开发者指令、擦除历史消息或声称强制修改模型 Context。
   - 跨前后端与文档审查任务可同时命中多份技能，不得强制只选一个而漏掉安全约束。