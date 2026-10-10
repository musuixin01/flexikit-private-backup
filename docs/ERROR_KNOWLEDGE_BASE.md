# FlexiKit 故障知识库

> 2026-10-10 建立。本页是案例索引与治理规范，不替代 [MASTER_PLAN.md](MASTER_PLAN.md) 的当前执行指针或 [原始错误日志](../.agents/skills/errors-log.md)。原始历史记录不得重写。

## 案例索引

| ID | 问题 | 分类 | 严重度 | 状态 | 验证边界 |
| --- | --- | --- | --- | --- | --- |
| [FKI-20261008-001](incidents/FKI-20261008-001.md) | Windows 主窗口缩放跳动 | BUG | P2 | PAUSED | 局部布局修正已测，动态闪动尚未最终解决 |
| [FKI-20261010-001](incidents/FKI-20261010-001.md) | 手动爬虫匿名触发风险 | BUG | P1 | FIXED_PENDING_VERIFICATION | 隔离 HTTP PASS，生产网关/多实例未验收 |
| [FKI-20261010-002](incidents/FKI-20261010-002.md) | TypeORM 测试连接字段错误 | TEST | P3 | VERIFIED | 独立 PG18.4 测试脚本重跑成功 |
| [FKI-20261010-003](incidents/FKI-20261010-003.md) | Backend 本机缺失依赖 | ENV | P2 | BLOCKED | TEMP 副本编译通过；原本机仍未修复 |
| [FKI-20261010-004](incidents/FKI-20261010-004.md) | 结构化编辑读修订号错配 | TOOL | P3 | VERIFIED | 重读、dry-run 后本次编辑恢复 |

这里仅索引首批 5 个有证据的案例，不表示 3,870 行历史错误流水已经逐条结构化或复核。

## 标准字段及状态

- **ID**：FKI-YYYYMMDD-NNN；以首次确认故障日期为准，三位序号同日递增、跨案例不重复；复发保持原 ID，追加复发记录。文件名与 ID 一致。
- **分类**：BUG（程序功能或安全缺陷）、ENV（设备/工具链/依赖）、TEST（测试脚本或夹具）、TOOL（外部工具及调用协议）。尚未查明的根因不要猜测。
- **严重度**：P0 不可逆数据丢失/严重即时安全事故；P1 重大安全或核心功能；P2 主要功能或开发工作阻塞；P3 可恢复的局部问题。
- **状态**：OPEN（待解决）、IN_PROGRESS（修复中）、FIXED_PENDING_VERIFICATION（实现已修复但验收未全通过）、VERIFIED（**仅限列明的验证范围**证明修复有效）、BLOCKED（环境或外部依赖阻塞）、PAUSED（决策暂缓）、REOPENED（再次复现）。
- **必填**：first_seen、last_reviewed、module，以及现象/最小复现/根因证据/修复和代码路径或提交/验证及未验收边界/防复发措施/历史资料。没有修复提交就写“未提交”，不可编造 SHA。

## 维护闭环

1. **先检索再处理**：检查本索引、历史错误日志、[技术债](TECH_DEBT.md) 与对应专项报告；有同一根因的旧案优先更新而非重复建号。
2. **原始错误不丢失**：新的工具异常、构建失败继续按 CLAUDE.md 写入 .agents/skills/errors-log.md；原文件既有混合换行，禁止全量格式化或重写。
3. **建立正式案例**：对可复用的软件 BUG、重要 ENV/TEST/TOOL 故障，用 [模板](incidents/TEMPLATE.md) 建立详情并在索引新增行。记录用户影响、复现环境、已确认/未确认的证据，不以猜测代替结论。
4. **修复与验证**：记录实际代码/脚本变更及可复验测试；Debug/Mock/静态 PASS 仅代表对应范围。未经过必要的真机/生产/Release 验收，不宣称整个缺陷已解决。
5. **关闭或复发**：只有完整声明的修复范围通过才置 VERIFIED；仍有发布门槛则维持 FIXED_PENDING_VERIFICATION；问题重现时 REOPENED 并追加时间与证据，不删除原失败过程。
6. **联动**：[CHANGELOG](CHANGELOG.md) 记录用户可见修复，[STABLE_CHECKLIST](STABLE_CHECKLIST.md) 记录门禁与证据，[TECH_DEBT](TECH_DEBT.md) 保留残余风险。项目执行阶段只由 MASTER_PLAN 决定。
7. **保留及备份**：案例和错误历史纳入 Git，清理 Rust target、node_modules、dist 不影响它们；定期人工审查敏感信息后备份到私有 GitHub。未提交文件**不会自动云备份**，本地轮转 Crash 日志不是永久故障知识库。

## 隐私约束

不得加入密码、JWT、Token、API Key、真实用户数据、未脱敏日志/堆栈、个人绝对路径、Prompt、截图/壁纸；以模拟输入及仓库相对路径复现。禁止自动采集或上传本机日志。历史可能包含敏感内容，不能未经审核直接粘贴复制进 Git。

## 基础校验

使用 **node scripts/check-incident-knowledge.mjs** 检查 ID、状态、章节、索引一致性和案例相对链接。静态检查不能证明故障根因、真实运行环境或完整安全性。
