# FlexiKit 开发核心指令 (CLAUDE.md)

## 1. 代理元认知协议 (Meta-Cognitive Protocol)
- **主线执行文档**：每次接手 FlexiKit、恢复中断任务或完成临时任务后，必须读取 `docs/MASTER_PLAN.md` 的“当前执行指针”，并从当前阶段下一项未完成任务继续。除非用户明确改变路线，不得擅自跳阶段。
- **文档闭环（强制）**：每个任务完成后必须同步更新与该任务相关的项目文档，并记录验证结果；只改代码而未更新对应文档时，该任务视为未完成。具体映射以 `docs/MASTER_PLAN.md` 的执行规则为准。
- **约束优先级 (Highest)**：自定义技能 (.agents/skills/*.md) > 全局规范 (CLAUDE.md) > 通用框架建议。
- **模式切换触发器**：
  - `#cmd-constraint` (业务模式)：强制执行所有自定义技能约束。
  - `#cmd-expert` (架构模式)：发挥原生框架 (Vue3/NestJS) 深度能力，优先性能与解耦。
- **响应策略**：默认执行 **“原子化 Diff 模式”**，严禁输出全量冗余代码，必须使用 `// ...` 省略号。

## 2. 技术架构栈 (Source of Truth)
- **Frontend**: Vue 3.4 (Composition API) + Pinia + Tailwind CSS (Apple-Design-System)。
- **Backend**: NestJS 10 + TypeORM + PostgreSQL 16 (pgvector) + Redis 7。
- **Coding Standard**: 严格 TypeScript 类型安全，禁止 `any` 类型。所有函数需满足单一职责原则 (SRP)。

# Agent Skill Enforcement Protocol
每次任务启动时，AI 必须严格执行以下预检步骤：
1. **技能扫描**：遍历 `.agents/skills/` 目录中的所有 `.md` 文件。
2. **意图匹配**：若当前任务触发词（如“配色”、“布局”、“CSS”、“组件”）与 `.md` 中的 `Trigger` 匹配，必须立即加载该文件。
3. **约束生效**：加载后，将该技能文件中的规范作为本次任务的“最高指令”。
4. **状态确认**：在回复的第一句，必须以 `[Status: Skill Name Loaded]` 格式反馈已启用的技能。

## Skill Loading Priority (Hierarchy)
当规则发生冲突时，Codex 必须按照以下优先级执行，高优先级覆盖低优先级：
1. **[Design]** apple-design-system.md (最高优先级，严禁覆盖 Apple Blue 和 CSS 变量)
2. **[Backend]** nestjs-cache-strategy.md
3. **[Fallback]** (仅当组件未在 Apple 系统中定义时，才允许使用 Tailwind 默认语义)

## 3. 设计语言基准 (Apple-Style UI Protocol)
- **核心逻辑**：所有 UI 必须符合 `apple-design-system.md` 和 `apple-motion-interaction.md`。
- **色彩语义**：
  - Primary: `indigo-500`
  - Accent: `pink-500`
  - Background: `bg-white/70 backdrop-blur-2xl` (亮) / `bg-slate-900/70 backdrop-blur-2xl` (暗)
  - Transitions: `cubic-bezier(0.25, 0.1, 0.25, 1.0)` (固定曲线)

## 4. 防御性工程准则 (Safety Guardrails)
- **插入安全机制**：禁止使用简单的正则替换。向现有文件插入代码时，必须先读取文件内容，利用行号锚点或结构性识别符进行插入，并进行校验。
- **错误记录**：若任何任务导致 `unexpected status` 或代码运行失败，必须先记录于 `errors-log.md`，并分析根本原因后重试。
- **故障知识库（新增）**：可复用的 Bug、测试、环境及工具故障须按 [docs/ERROR_KNOWLEDGE_BASE.md](docs/ERROR_KNOWLEDGE_BASE.md) 建立/更新唯一案例索引，使用 `.agents/skills/incident-knowledge-workflow.md` 规范；保留原始 errors-log，记录复现、确证根因、修复和测试边界，未完成验收不得标为彻底解决。
- **Token 优化**：禁止输出任何非代码的礼貌性废话。若用户未要求解释，仅输出变更后的代码片段。

## 5. 快速调用映射 (Shortcuts)
- `#cmd-frontend`: 加载 UI 守卫、apple 协议，开启 Diff 模式。
- `#cmd-backend`: 加载响应封装、数据库守卫，开启 DI 模式。
- `#cmd-optimize`: 执行性能审查，优先处理内存泄漏、响应式性能瓶颈。