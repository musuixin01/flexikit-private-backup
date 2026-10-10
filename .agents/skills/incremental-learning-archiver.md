# Skill: Incremental Learning & Chat History Compressor

## Description
在长任务或跨会话交接时，可建议生成**项目进度摘要**，提炼决策、代码定位、验证和剩余问题。摘要仅是普通文档/回复内容；不能擅自删除对话消息、更改模型记忆、强制重启会话或宣称节省了确定百分比的 Token。

## Core Execution Rules
1. **提取记忆快照（Generate Memory Snapshot）：**
   - 自动将前几轮讨论出的核心结论、代码定稿、或用户学到的知识点提炼为极其紧凑的 JSON 格式或几行 KV 键值对。
2. **可审计的交接摘要：**
   - 保存任务状态、权威文档路径、Git 工作区和未提交改动、已运行测试以及后续计划；摘要不能替代实际代码/文档复核，不能声称已清除历史对话或降低固定比例的上下文成本。

## Output Template Example
> **供用户查阅的项目交接摘要样例（不执行隐藏历史清理）：**
> 
> **🧠 当前项目记忆快照：**
> - **当前任务**：正在为 FlexiKit 编写 Redis 缓存控制层
> - **技术规范**：NestJS 10 (TTL使用毫秒纯数字), 键名带 `flexikit:` 前缀
> - **已完成代码**：`tools.service.ts` 的基础查询已加缓存
> 
> 我们可以基于这个进度继续聊，请问接下来要加上缓存主动失效（Eviction）功能吗？”