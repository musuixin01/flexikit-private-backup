# FlexiKit Master Plan

> 本文档是 FlexiKit 的**唯一主线执行文档（Single Source of Truth）**。
>
> 以后无论中间插入 Bug、临时功能、测试、文档或其他任务，处理完后都必须回到本文档的“当前执行指针”继续。
>
> - `ROADMAP.md`：只描述产品方向，不决定下一步做什么
> - `IMPLEMENTATION_PLAN.md`：保留历史 Sprint / 技术计划
> - `STABLE_CHECKLIST.md`：记录具体回归测试是否通过
> - `CHANGELOG.md`：记录已经完成的变化
> - **`MASTER_PLAN.md`：决定当前阶段、下一项任务和阶段完成门槛**

---

## 0. 执行规则

每次开始 FlexiKit 开发前：

1. 先读本文档的“当前执行指针”
2. 只执行当前阶段的下一项未完成任务
3. 中途如果插入 Bug / 临时任务：
   - 先处理临时任务
   - 验证
   - 更新相关文档
   - 然后回到原来的执行指针
4. 不因为临时任务擅自跳到后续阶段
5. 每完成一项任务，必须同时完成“代码 / 验证 / 文档”闭环，否则任务不算完成：
   - 勾选本文档并更新“当前执行指针”
   - 更新该任务对应的专项文档
   - 用户可见功能或行为变化：更新 `CHANGELOG.md`
   - 稳定性 / 回归结果：更新 `STABLE_CHECKLIST.md`
   - 架构、限制或遗留问题变化：更新 `TECH_DEBT.md`
   - Desktop Canvas 相关变化：同步 `DESKTOP_CANVAS.md`
   - 商业化变化：同步 `MONETIZATION.md`
   - 出现意外失败：按规则更新 `.agents/skills/errors-log.md`
   - 执行构建或实机验证，并把验证结果写回对应文档
6. 阶段门槛没有全部满足，不进入下一阶段
7. 不为了赶进度删除、回退或重做已经稳定的功能
8. 已有用户布局、配置和数据优先保持兼容

状态：

- [x] 已完成并验证
- [ ] 未完成
- [~] 已实现，仍需实机 / 完整回归
- [!] 阻塞或存在已知问题

---

# 当前执行指针

**当前阶段：Stage 6 — v0.5 公测与产品打磨**

**当前任务：Stage 6 — 真实用户测试计划**

Stage 1 已于 2026-09-23 完成。S2.1 核心应用回归也已完成：认证、用户资料、工具 CRUD / 搜索 / 分类 / 收藏、Discover 页面、本地工具真实启动以及主窗口 ↔ 桌宠 ↔ Canvas 联动均通过。

S2.2 已完成。S2.3 的 release、MSI/NSIS、隔离安装/卸载、0.1.0 → 0.1.1 覆盖升级、用户数据保留、自动更新架构、诊断日志和版本策略均已完成。真实干净 VM / 新机器安装路径验证按用户要求暂缓，仍保留为正式发布前门禁，Stage 2 不标记为最终发布闭环。

2026-09-26：Stage 5 / S5.1 已完成 Provider 抽象、OpenAI、Gemini、Claude / Anthropic、BYOK 与模型能力标签。模型元数据现统一区分 native（厂商原生能力）和 adapter（FlexiKit 当前适配器已实现能力），覆盖 textGeneration、vision、streaming、toolCalling、structuredOutput、reasoningControl、temperature、maxOutputTokens 八项能力；native 支持 supported / conditional / unsupported / unknown，推理控制单独描述 effort / thinking-level / manual-budget。GPT-6 Astra/Sol/Luna、Gemini 3.8/3.5 Flash/Flash-Lite、Claude Sonnet 5/Opus 5/Fable 5/Haiku 4.5 均按 2026-09-26 官方文档基线标注；自定义/快照模型原生能力保守标 unknown。Registry 强校验能力表并深拷贝 nested metadata，BYOK catalog 复用同一模型定义，防止能力漂移。Backend build、model-capabilities、Provider、OpenAI、Gemini、Anthropic、BYOK regressions 与 type-audit 全通过。当前执行指针进入 S5.1“成本 / Token 统计”。
2026-09-27：Admin Console V1 已补齐高风险账号删除和 AI Usage & Cost 实数统计闭环。账号删除继续保持禁止自删/直接删除管理员、用户名二次确认、事务清理与 user.account.deleted 审计；AI Usage 页面现消费 Provider-reported Token usage，按平台 Key / BYOK 分账，展示 Provider/模型拆分、已定价/未定价请求和版本化官方单价成本估算。密码哈希、Token/Hash、BYOK Key、Prompt、Response、剪贴板与本地文件仍不进入 Admin API/usage ledger。
2026-09-27：S5.1 已全部完成。AiService 统一加入真实 AbortController 取消、单次/总执行预算、瞬时错误有限重试、Retry-After、指数退避 + jitter，以及仅限“隐式平台路由”的 deterministic cross-provider fallback。显式 Provider/Model 与 BYOK 永不静默跨 Provider；认证/参数/非法响应/上游拒绝等非瞬时错误立即 fail-closed。OpenAI 额度/消费上限类 429 通过结构化 error code/type 单独识别为不可重试，避免无意义重试或切换供应商。重试和 fallback 期间失败尝试不写 usage ledger，仅最终成功结果记一次 Provider-reported usage。当前执行指针进入 S5.2“原生桌面 AI 助手”。
2026-09-27：S5.2“原生桌面 AI 助手”已完成最小生产纵切片。Desktop 新增 /assistant 与侧边栏入口，支持平台自动路由/显式 Provider/Model 和 OpenAI/Gemini/Anthropic BYOK；BYOK Key 仅在发送瞬间从 Windows DPAPI Vault（浏览器为运行期内存）读取并作为单次请求临时传递，服务端不持久化/回显 Key。POST /v1/ai/assistant/generate 受 JWT 保护，复用 S5.1 Provider、usage accounting、retry/fallback，并只记录 Provider-reported usage，不保存 Prompt/Response。当前页面消息只存在 Vue 内存，刷新即清空；当前工具/文件/Clipboard 上下文和 Prompt 历史仍未接入。Backend/Web build、S5.2 前后端回归、BYOK/resilience/type-audit 均通过。当前执行指针进入“当前工具上下文”。
2026-09-27：S5.2“当前工具上下文”已完成。当前工具定义为“本次 FlexiKit 运行期间，用户明确成功打开的最近一个 FlexiKit Tool”，由中央 openDesktopTool 成功路径更新，ToolCard/Pet 本地工具入口也已收敛到同一事实源；状态仅存在 Vue/module 内存，不写 localStorage/sessionStorage/IndexedDB。Assistant 明确展示当前工具并允许用户在发送前关闭；发送白名单仅含 id/name/category/web|local/hostname，本地路径从客户端类型、Backend DTO 和 system metadata 中均被排除。Backend 将上下文字段标记为 untrusted descriptive data，不能作为指令处理；Prompt/Response/context 仍不落 usage ledger 或数据库。Backend/Web build、S5.2 前后端 assistant regressions、BYOK/resilience/type-audit 全通过。当前执行指针进入“当前文件上下文（用户授权）”。
2026-09-27：S5.2“当前文件上下文（用户授权）”已完成。Windows Desktop 新增原生 IFileOpenDialog 桥接，只有用户在 Assistant 内主动点击“选择文件”后才读取单个本地文件；允许 UTF-8 文本扩展名白名单，严格限制 32 KiB UTF-8 字节，拒绝 binary/NUL/非法控制字符以及 env/pem/key/exe/pdf 等类型。Tauri 仅返回 basename/extension/content，绝对路径不跨越 Desktop 边界；页面仅内存保存，可更换/移除并可关闭“随本次问题发送”。Backend 嵌套 DTO + Service 双重校验文件名/扩展名/UTF-8 字节限制，文件正文保持 user-role，system 只声明其为 user-authorized untrusted data，防止文件内容提升为高优先级指令；Prompt/Response/file/context 仍不入数据库、usage ledger 或日志。Backend/Web build、前后端 assistant regressions、type-audit、Rust cargo fmt --check 与文件选择器 3/3 单测均通过；BYOK/resilience 兼容回归本任务中亦通过。当前执行指针进入“Clipboard 按需上下文”。
2026-09-27：S5.2“Clipboard 按需上下文”已完成。复用既有 Windows CF_UNICODETEXT 按调用读取桥接，但 AI Assistant 不在 mount/focus/send 时读取，也不轮询/订阅；只有用户点击“读取剪贴板”才访问。Web 对内容执行 16 KiB UTF-8 字节上限、空文本与非法控制字符校验，仅保存在页面内存，可重新读取/移除并独立关闭“随本次问题发送”。Backend currentClipboard DTO + Service 再执行同样的 16 KiB UTF-8 字节与控制字符边界，正文保持 user-role，system 仅声明 Clipboard 为 user-authorized untrusted user data，防止剪贴板文本提升为高优先级指令。Clipboard/Prompt/Response/context 均不写 localStorage/sessionStorage/IndexedDB/PostgreSQL/log/usage ledger。Backend/Web build、前后端 assistant regressions、type-audit、BYOK/resilience 兼容回归全通过。当前执行指针进入“Prompt 历史隐私策略”。
2026-09-27：S5.2“Prompt 历史隐私策略”已完成。正式策略固定为 session-only：AI 对话仅存在当前 AiAssistant Vue 组件内存，刷新/关闭页面即清空；客户端持久化与服务端持久化均明确 disabled，工具/文件/Clipboard 上下文不进入历史，本地加密备份也明确排除 AI Prompt 历史。Assistant 页面与数据管理页均显示“仅本次会话”，并提供“清空本次对话”；预留 flexikit-ai-prompt-history-v1 仅用于防御性清理旧/未来数据，隐私设置、活动清理和本地数据清理均会删除它，而备份 allowlist 明确不包含它。任何未来本机 Prompt 历史都必须先新增独立显式授权开关，不能静默改变默认策略。专项 history privacy、Web build、Assistant、privacy-settings、data-lifecycle regressions 全通过。当前执行指针进入 S5.2“快捷操作”。
2026-09-27：S5.2“快捷操作”已完成。Assistant 新增四个本地静态快捷模板：总结上下文、排查问题、拆解任务、优化表达；前两项只有在用户已经可见且启用的工具/文件/Clipboard 上下文存在时才可用，后两项随时可用。点击快捷操作只把模板写入/合并到输入框并聚焦，绝不自动发送，也不触发文件选择、Clipboard 读取、隐藏上下文采集、Prompt 历史持久化或额外请求；最终仍需用户显式点击发送/Enter，继续复用既有 BYOK/Provider/resilience/usage 路径。Web build、Assistant regression、Prompt history privacy regression 全通过。S5.2 已全部完成，当前执行指针进入 S5.3“用户行为事件”。
2026-09-27：S5.3“用户行为事件”已完成本地隐私最小化底座。复用既有 usagePersonalization，不新增或扩大云端授权；事件完全停留当前设备，不上传 Backend。统一 taxonomy 仅含 tool_open / favorite_add / favorite_remove，载荷只保存正整数 toolId + event type + occurredAt，不保存搜索词、工具名、URL/路径、Prompt、文件/Clipboard 或 API Key。事件最多 400 条，读/写时淘汰超过 90 天数据；usagePersonalization 关闭或“清除已记录活动/本地用户数据”时立即删除。细粒度事件明确排除出加密本地备份。Tool 打开和收藏增删已接入；Web build、recommendation-behavior、privacy、data-lifecycle、local-backup regressions 全通过。当前执行指针进入“标签匹配”。
2026-09-27：S5.3“标签匹配”已完成。新增纯本地 deterministic tag/category matcher：tool_open=+1、favorite_add=+4、favorite_remove=-4；Tag 权重 ×2、Category ×1，单特征 affinity 限制在 -24…24，NFKC/trim/case-fold/空白归一化并忽略 malformed/未分类。Discover 从既有推荐接口取最多 18 个候选，在本地按标签分数重排后展示 6 个；同分保持原顺序，接口失败时对本地 Tool catalog 使用相同规则，移除随机 fallback。matcher 不读取 hot_score/view/click/recency/random，“热门排行”保持原样。关闭 usagePersonalization 后事件为空，候选顺序不改变。tag-matching/behavior regressions 与 Web build 全通过。当前执行指针进入“热度排序”。
2026-09-28：S5.3“热度排序”已完成。新增统一 Discovery heat 公式：公开 engagement 占 55 分（upvotes + comments×4，经 5000 scale 饱和），freshness 占 45 分并使用 14 天半衰期；分数始终限制在 0…100。findAll(sort=hot)、recommendations、rankings 均在 PostgreSQL 查询阶段使用同一动态公式排序，并在响应阶段用同一 TypeScript 公式回填 hot_score；不再依赖数据库静态 hot_score 排序。爬虫 ingest 对 upvotes/comments 做非负整数清洗并忽略上游静态 hot_score，保存时统一重算。热度层只使用公开服务端聚合数据，不读取 device-local 行为事件，保持与标签匹配层解耦。Backend build、discovery-heat regression、type-audit 全通过；真实 PostgreSQL 只读 smoke 因当前 Runner 连接本机数据库被 EACCES 拒绝而未执行 SQL，已记录为环境限制。当前执行指针进入“Embedding Pipeline”。
2026-09-28：S5.3“Embedding Pipeline”已完成。正式 Tool catalog 复用既有 tools.embedding vector(1536)，采用 OpenAI text-embedding-3-small + /v1/embeddings；只扫描 user_id IS NULL 的公共 Tool，不自动把用户自建/私有工具元数据发送给外部 Provider。规范化输入只含 name/description/tags/category/web|local/hostname，明确排除 local_path、URL path/query、Prompt、文件、Clipboard、API Key 与用户行为；8,000 UTF-8 bytes 上限、32 条批量、30s 默认超时。新增 provider/model/dimensions/source-version/source-hash/updated-at provenance 与一致性 CHECK，旧不可验证向量迁移时清空；Pipeline 通过 source hash 判断 stale，写入前使用 pessimistic lock 重算 hash，内容并发变化时跳过陈旧向量。Provider 返回 model id、item/index、1536 维有限数值和 usage 均严格校验；成功批次的 prompt_tokens 进入既有 AI Usage/成本账本，text-embedding-3-small 使用 2026-09-28 官方 $0.02/1M input token 基线。同步只通过显式 npm run embedding:sync 触发，不在启动/浏览器/User Tool CRUD 中隐式产生外部调用和费用。Backend build、Embedding Pipeline regression、AI usage regression、type-audit 全通过；当前 Runner 连接 localhost:5433 被 EACCES/ECONNREFUSED 拒绝，因此本轮 migration:show/run 未执行 SQL，迁移需在数据库可连接运行时应用后才能执行真实 embedding:sync。当前执行指针进入“pgvector”。
2026-09-28：S5.3“pgvector”已完成精确 cosine 检索基线。新增 ToolVectorSearchService，所有距离/相似度均在 PostgreSQL 使用 embedding <=> CAST(:queryVector AS vector) 计算，TypeScript 不做向量循环；输入严格要求 1536 个有限且有界分量，vector/exclude ids 全部参数化，limit 默认 12、硬上限 50，排除 id 最多 100。候选严格限制 public Tool、embedding 非空、provider/model/dimensions/source-version 与当前 Embedding Pipeline 一致、source hash/updated-at 非空，且 embedding_updated_at >= updated_at，防止内容更新后陈旧向量继续参与检索；相同距离以 Tool id 稳定排序。当前刻意不新增 HNSW/IVFFlat：Runner 无法连接数据库做可信 EXPLAIN/EXPLAIN ANALYZE，且当前公共 Tool 规模尚无证据需要 ANN；后续只有在真实数据库/代表性语料证明 exact search 延迟不可接受时才优先评估 HNSW vector_cosine_ops。Backend build、pgvector regression、Embedding compatibility regression、type-audit 全通过；未重复执行已知会被 localhost:5433 环境限制阻断的 live DB 检查。当前执行指针进入“相似工具推荐”。
2026-09-30：S5.3“相似工具推荐”已完成端到端接入。服务端以最近公开收藏为语义 seeds，pgvector 候选 deterministic merge/de-dup，并对全部收藏做最终排除；向量缺失/陈旧/检索失败时按公开热门安全补齐。Discover 的“智能推荐”在登录且全部来源时消费 /recommendations，并继续在设备端执行已有 tag affinity 重排；匿名/来源筛选保留原 Discovery recommendation 路径。服务端不接收 device-local 行为，响应也不包含 similarity、embedding 或 provenance。联调同时恢复热度 UI fail-safe，后端热度不可用时只显示明确的本地占位顺序，不伪造数值。8 项最终门禁全部通过，当前执行指针进入“推荐解释”。
2026-10-03：S5.3“推荐解释”已完成，Stage 5 全部任务闭环。Backend 新增 /recommendations/explained，在不改变原 /recommendations Tool[] 兼容接口的前提下，仅返回可审计解释 kind=similar_favorite/popular 与可选公开收藏种子名称；不返回 cosine/similarity 数字、embedding/provenance、seed/candidate rank 或置信度。Discover 登录+全部来源消费 explained endpoint，并在设备端把已有 tag/category affinity 转为“本机偏好匹配”原因；本地行为仍不上云。ToolCard 只在 Discovery 推荐卡片显示一行低干扰解释，公开热门 fallback 明确显示为“基于公开热度补充推荐”，不伪造热度/置信度。Web/Backend build、Web explanation、tag matching、heat UI、Backend similar recommendations、pgvector、type-audit 全通过。当前执行指针进入 Stage 6“真实用户测试计划”。

2026-10-05：Browser Companion v0.2.0 产品化基线已完成。扩展从全站常驻注入原型切换为工具栏 Popup：只有用户明确点击扩展时才通过 activeTab + scripting 临时读取当前页元数据；支持独立 extension 登录会话与自动 Refresh、API 主机显式授权、URL tracking 清理、服务端 URL 去重与创建冲突保护、标签推荐/分类建议、设置/连接检测/退出和正式图标。Backend 增加安全扩展 Origin CORS 策略，Web 设备管理同步识别 Browser Companion 会话；Chrome/Edge pack-extension 验证均通过。商店上架仍需正式扩展 ID、商店账号与审核资料，不改变当前 Stage 6“真实用户测试计划”主线。
2026-10-05：根据用户对空间占用的反馈，Browser Companion 安装入口再次收紧：移除工具网格上方全宽卡片，迁入 workspace 标题栏右侧，与工具数量并排；入口为 34px 紧凑胶囊，窄屏进一步收为纯图标，原安装弹窗与 Chrome/Edge 流程保持不变。Web build 283 modules、结构回归与 git diff --check 通过；Stage 6“真实用户测试计划”执行指针保持不变。
2026-10-05：根据用户提供的 /app 实际截图完成工作台整页 UI 优化插单。页面从“偏窄、偏蓝、卡片偏大”的工具墙调整为更成熟的桌面工作台：Home 全宽自适应，Navbar 压缩到 50px 并降低玻璃/阴影重量，Workspace Header 改成标题/空间标签 + 次级说明两层，工具网格使用 240px 最小列宽自适应提高每屏可见数量；ToolCard 压到约 158px 基线高度，统一中性玻璃，自定义颜色只作为局部弱光晕，标签/图标/收藏/操作按钮同步收紧。Web build 283 modules、结构回归、`git diff --check` 与运行页 HTTP 200 均通过；Stage 6“真实用户测试计划”执行指针保持不变。
2026-10-05：继续修正 /app 大屏右侧空白。根因是 Home 仍把 `ui.effectiveGridColumns` 写入 `--grid-columns`，全局 components.css 会按固定列数排布；现已移除 Home 的固定列数绑定，改为 auto-fit + 约 210px 最小列宽自动填满可用宽度，同时把工具卡从约 158px 高的大块玻璃卡压缩为约 108px 的紧凑工具单元。Web build 283 modules、结构回归与 `git diff --check` 通过；Stage 6 主线不变。
2026-10-05：最终定位 /app 右侧大空白根因：`#app` 是横向 flex，而 App.vue 包裹 router-view 的普通 div 没有 width/flex-grow，导致路由根节点被压到 1035.6px。现为该层增加 `app-window-content`，固定 `width:100%; min-width:0; flex:1 1 auto`。Chrome DevTools 实测 1761px viewport 下 wrapper/layout 1753px、main/nav 1433px、grid 1429px，工具网格由 3 列扩为 6 列；Web build 283 modules、`git diff --check` 通过；Stage 6 主线不变。
2026-10-05：根据最新实机截图继续微调 /app 工作台空间关系：侧栏与主内容原 `gap:0` 导致两块玻璃面板视觉上粘连；现改为桌面 `clamp(16px, 1.15vw, 20px)`、移动端 12px。Web build 283 modules、`git diff --check`、运行页 HTTP 200 通过；Stage 6 主线不变。
2026-10-05：补齐侧边栏收起后的分类可达性。`ui.sidebarCollapsed && !ui.isMobile` 时，Home 在 Workspace Header 标题与右侧操作之间渲染横向分类条，复用 `gtb-cat-order` 顺序、分类颜色点与数量，点击直接切换 `ui.activeCategory`；侧栏展开时不显示。Chrome 运行态验证：收起后出现 7 个分类标签、分类条宽约 869px，点击“本地硬核与系统辅助”后标题正确切换。Web build 283 modules、结构回归与 `git diff --check` 通过；Stage 6 主线不变。
2026-10-05：根据用户进一步明确的布局要求，将侧边栏收起后的分类从标题中间移为独立第二排。Workspace Header 第一排只保留标题/说明与右侧操作，第二排分类条全宽横向滚动。Chrome 运行态实测 primary bottom≈139.7px、category row y≈148.7px、宽≈1401px、7 个分类，确认与第一排分离；Stage 6 主线不变。

---

# Stage 1 — v0.1 Desktop Canvas 稳定基线

## 目标

把 Desktop Canvas 固化成后续开发不会轻易破坏的稳定桌面底座。

## 已完成

- [x] 独立 Tauri Desktop Canvas Window
- [x] Windows Progman / WorkerW 桌面层挂载
- [x] Windows 11 Progman fallback
- [x] Explorer 重启后的自动 reattach watchdog
- [x] 原生 HRGN 点击区域
- [x] Win11 Progman Z-order 命中修复：Canvas 交互区域位于 `SHELLDLL_DefView` 之上，空白区域继续由 HRGN 穿透
- [x] CSS 圆角同步到 `CreateRoundRectRgn`
- [x] Canvas 正常态透明 backdrop
- [x] 20px 栅格
- [x] Widget 拖动 / 八方向缩放代码基线
- [x] Widget Registry
- [x] Widget 布局持久化
- [x] 多选 / 组合 / 拆分 / 联动移动
- [x] 多显示器 / DPI 数据与布局底座
- [x] Appearance Inspector V2
- [x] Registry 配置 Schema
- [x] Clock / Search / Disk / Launcher Widget
- [x] Todo / Clipboard / Music / AI Prompt Widget
- [x] Desktop Organizer
- [x] Launcher → 快速启动中心 → Launchpad
- [x] Launcher 常用应用自定义 / 排序
- [x] Launcher 拖拽排序防原生抢占：在既有 Sortable fallback + launcherPinnedKeys key 持久化基础上，补齐 center grid native dragstart 阻断、shell/button/img draggable=false 与图标 -webkit-user-drag:none；Web / Desktop mode 均 283 modules 构建通过。
- [x] Desktop Organizer 自动分类桌面内容
- [x] Canvas 打开时隐藏 Explorer 桌面图标
- [x] Canvas 关闭 / 应用退出恢复桌面图标
- [x] 异常退出后下次启动主动恢复桌面图标
- [x] 默认紧凑两排布局
- [x] 旧 4 / 5 组件 starter 布局迁移
- [x] 历史重复 Launcher 布局去重迁移
- [x] Web strict build
- [x] Rust `cargo check --all-targets`
- [x] Windows 11 Canvas 实机打开 / 关闭
- [x] Windows 11 Complex HRGN 实机验证
- [x] Clock Inspector 实机打开
- [x] Launcher 快速启动 / 应用库实机打开关闭
- [x] 桌宠 → Desktop Canvas 实机联动
- [x] Canvas 动画 / 交互优化 V1：统一 300ms Apple 曲线、编辑网格渐入、Palette/Inspector 动画、整理/重置平滑归位、拖动/缩放期间自动关闭几何补间、`prefers-reduced-motion` 降级

## S1.8 — 真实鼠标 GUI 回归

> 2026-09-23：自动化先确认编辑态组件边界、8 向 resize 代码路径、20px 栅格计算、Organizer IPC 与原生命中；随后用户完成真实物理鼠标实机确认，全部正常。

- [x] 整块拖动
- [x] 左 / 右 / 上 / 下边缩放
- [x] 四角缩放
- [x] 20px 吸附
- [x] 拖右边不会误开设置
- [x] Desktop Organizer 双击文件夹
- [x] Desktop Organizer 双击普通文件
- [x] 测试完成后重置为默认布局

## S1.9 — Canvas 最终回归

- [x] 默认布局视觉确认（真实 Canvas `PrintWindow` 实拍：源码默认两排布局一致）
- [x] 圆角外无矩形框（真实窗口实拍 + Complex RoundRect HRGN）
- [x] Widget 内容在紧凑尺寸下无裁切异常（高分辨率实拍 + UIA offscreen 边界核对）
- [x] Launcher 滚动条无闪动（快速启动 / Launchpad 各 10 帧区域像素哈希唯一值 = 1）
- [x] Organizer 滚动条无闪动（10 帧区域像素哈希唯一值 = 1）
- [x] Canvas 打开 / 关闭连续 20 次（20 / 20，结束后 HRGN 仍为 Complex）
- [x] Explorer 重启恢复（真实重启 Explorer；Canvas HWND 重建后恢复到 Progman、可见、HRGN=3）
- [x] Widget 操作无 runtime warning（桌面端 stderr / Vite stderr 在本轮压测后均为空）
- [x] 重启应用后布局持久化（重置默认布局后重启进程，实拍布局/尺寸一致）
- [x] `npm run build`（动画/交互优化后再次通过，217 modules）
- [x] `cargo check --all-targets`（Explorer 恢复修复后再次通过）
- [x] `git diff --check`（全工作区通过；仅存在 line-ending 提示）

## Stage 1 完成门槛

必须同时满足：

- 所有 S1.8 / S1.9 项通过
- 无 P0 / P1 Canvas Bug
- 无新的 runtime warning
- 默认布局达到可直接给新用户使用的状态
- `STABLE_CHECKLIST.md` 对应 Canvas 核心项完成

**Stage 1 结论（2026-09-23）：已完成。** S1.8 / S1.9 全部通过，无已知 P0/P1 Canvas Bug；剩余双屏/混合 DPI、真实桌面右键菜单等扩展人工覆盖继续留在专项稳定清单，不阻塞 Stage 2。

---

# Stage 2 — v0.1 应用级稳定与可发布基线

## 目标

从“Canvas 稳定”推进到“整个 FlexiKit v0.1 可以稳定运行和打包”。

## S2.1 — 核心应用回归

- [x] 注册（真实 API：201 + JWT；测试账号已清理）
- [x] 登录（正确密码 200，错误密码 401，删除账号后 401）
- [x] Token 生命周期（7 天 Access Token；无/无效/已删除用户 Token 均 401；401 同步清空 Pinia + localStorage；网络/5xx 不再误删 Token）
- [x] 用户资料（GET / PUT 真实回归；敏感 `password_hash` 未暴露）
- [x] 工具创建（真实 PostgreSQL 集成回归）
- [x] 工具编辑（所有权校验路径 + 持久化回归）
- [x] 工具删除（删除后 `findOne` 确认不存在）
- [x] 工具搜索（名称/描述/tags 查询链路回归）
- [x] 工具分类（自定义分类创建/编辑/列表 + 工具 category 过滤）
- [x] 收藏（添加/列表/favorite 过滤/移除；修复不存在的 `tool.favorites` relation 查询）
- [x] Discover 页面（5 条 Backend API + Tauri 主窗口真实页面渲染；推荐/排行/最新/来源筛选均出现）
- [x] 本地工具启动（真实 UI 临时添加 Notepad → Tauri `open_local_path` → 进程启动 → 关闭 → 二次确认删除测试工具）
- [x] 主窗口 ↔ 桌宠 ↔ Canvas 联动（主窗口收起、桌宠双击恢复主窗口、主窗口打开/关闭 Canvas 全部验证）

## S2.2 — 数据与 Backend

- [x] Backend 启动验证（Nest 3001 正常监听）
- [x] PostgreSQL 连接（项目 pgvector PostgreSQL 容器 5433，Backend 实际连接成功）
- [x] Redis 架构确认（Redis 7 环境可用；Backend 当前无 Redis client / 运行时调用，v0.1 明确不作为必需依赖，待出现真实缓存需求时再接入）
- [x] TypeORM migration 验证（启动时 `migrationsRun` 正常读取 migration 表并创建/确认 vector 扩展）
- [x] 数据库迁移可重复执行（Backend 重启前后 migration 记录数均为 1；`migrationsRun` 二次启动无重复执行/Schema 错误）
- [x] Backend 端口统一（源码/Vite/README/API/start.bat/Dockerfile.dev/部署文档统一 3001；CORS 中 3000 仅保留为允许的前端 Origin）
- [x] API 错误格式统一检查（全局 Exception Filter 已注册；400 / 401 / 404 实测统一为 `{ statusCode, message, error }`；未知异常统一脱敏为 500）
- [x] 关键接口异常路径测试（非法 query / ID=400、缺失资源=404、未登录=401、跨用户工具/分类修改删除=403、私有工具越权收藏=403、缺失工具收藏=404、重复收藏幂等；测试账号/夹具全部清理）

## S2.3 — 安装 / 更新 / 发布工程

- [x] Tauri release build（optimized release 成功；Vite 关闭时 `target/release/flexikit-desktop.exe` 独立运行并完整渲染 44 个工具）
- [x] Windows 安装包（Tauri 0.1.0 x64 MSI + NSIS 均重新生成，产物时间戳 / SHA-256 已核对）
- [~] 全新机器安装路径验证（本机 `%TEMP%` 隔离安装 + Backend/Vite 均关闭的 release 冷启动已验证，约 5.2 秒真实截图完整显示 44 个工具；`scripts/windows-clean-install-smoke.ps1` 已固化自动验收。当前 Hyper-V 已启用但无 VM，Windows Sandbox Disabled、无本地 Windows ISO，真实干净 VM / 新机器仍待最终发布前回归）
- [x] 卸载验证（NSIS 静默卸载 exit 0；隔离安装目录和 Windows 卸载注册均完全清除）
- [x] 升级安装验证（独立 `com.flexikit.s2upgrade`：NSIS 0.1.0 → 0.1.1 同目录覆盖成功；exe SHA-256 变化，卸载项保持单条且 DisplayVersion 更新为 0.1.1；升级后应用正常启动）
- [x] 用户数据升级不丢失（0.1.0 写入 `S2 Upgrade Sentinel` 本地工具；0.1.1 覆盖后 UI 显示 Backend 44 个内置工具 + Sentinel = 45 个，确认 WebView/localStorage 用户数据保留；测试安装和专用数据目录随后完整清理）
- [x] 自动更新方案（`docs/RELEASE_STRATEGY.md`：Tauri v2 updater + HTTPS manifest + 签名更新 + Stable/Beta 通道 + 用户确认安装；v0.1 在正式端点/签名密钥/失败路径回归前不启用在线更新）
- [x] 崩溃日志 / 基础诊断日志（原生 Rust 本地日志：startup/setup/quit/shutdown/runtime error/panic；Windows `%LOCALAPPDATA%\\com.flexikit.desktop\\logs\\flexikit.log`；2 MB 轮转、3 个备份；release 实机写入已验证）
- [x] 版本号策略（Desktop SemVer + `docs/RELEASE_STRATEGY.md`；新增 `npm run release:check-version` 校验 package/lock/Tauri/Cargo 版本一致，当前 0.1.0 实测通过）

## Stage 2 完成门槛

- v0.1 release bundle 可以生成
- 新安装 → 启动 → 使用 → 退出完整链路正常
- 核心数据不丢失
- 核心流程没有 P0 / P1 Bug
- 可以交给少量真实用户测试

---

# Stage 3 — Desktop 产品化

## 目标

让 FlexiKit 从“有桌面组件”变成真正高频使用的桌面效率入口。

## S3.1 — 全局搜索

- [x] 全局快捷键（Windows `Ctrl+Shift+Space` 原生 RegisterHotKey；真实运行日志确认注册与触发）
- [x] 本地应用搜索（Start Menu + Desktop 应用入口）
- [x] FlexiKit 工具搜索（名称 / 标签 / 分类 / 描述 + 使用偏好加权）
- [x] 文件 / 文件夹搜索（Desktop / Documents / Downloads，含可用 OneDrive 根）
- [x] 最近使用（工具历史 + 系统搜索打开历史）
- [x] 搜索结果排序（精确 / 前缀 / 包含匹配 + 类型与个人使用权重）
- [x] 键盘全流程操作（↑ / ↓ / Enter / Esc）
- [x] 搜索性能与缓存（90ms 前端防抖 + 原生索引启动预热 + 120 秒内存缓存；最多 24,000 条）

**S3.1 结论（2026-09-24）：已完成。** Web `vue-tsc && vite build` 通过（220 modules）；Windows x64 VS Build Tools 环境下 `cargo check --all-targets` 与 debug build 通过；真实 Desktop 运行日志确认全局快捷键完成注册并收到 `Ctrl+Shift+Space` 触发事件。

## S3.2 — 本地应用管理

- [x] 自动发现已安装软件（HKCU/HKLM × 32/64 位 Uninstall Registry + Start Menu + Microsoft Store/MSIX PackageManager；过滤系统组件/更新/资源包/Framework，按名称去重；5 分钟本地缓存并支持强制刷新；实机发现 537 条）
- [x] 软件图标读取（Registry `DisplayIcon` + Start Menu Shell 图标 + Store/MSIX Package Logo；按需读取、64×64 PNG/Data URL、本地内存缓存；真实已安装软件图标提取测试通过）
- [x] 软件路径解析（Start Menu `.lnk` 通过 `IShellLinkW` 解析真实目标与参数，`.exe/.url` 直接解析；Store/MSIX 通过 AppListEntry 获取 AUMID；Registry 仅在 `DisplayIcon` 明确指向现存 EXE 时保守兜底；陈旧快捷方式目标自动拒绝）
- [x] Launcher 自动推荐常用软件（仅推荐已解析可启动目标；综合 Start Menu / Store 来源可靠性、FlexiKit 本地启动频次与最近时间、全局搜索最近应用；最多 12 项，按需图标加载；用户手动整理后尊重固定顺序）
- [x] 手动添加 / 删除（Launchpad 统一展示已发现且可启动的本地软件 + FlexiKit 工具；支持全部/本地应用/FlexiKit 工具/工具分类筛选、统一搜索、`+ / ✓` 添加移除、常用区 `−` 删除和拖拽排序；数量不限并随 Canvas Widget 配置持久化）
- [x] 软件失效路径检测（Launcher 挂载/重新打开时强制或周期刷新软件目录；已固定但失效/卸载的软件保留“已失效”占位并禁用启动，可在整理模式手动移除；应用库只展示当前可启动项；启动失败后立即强制刷新目录）

**S3.2 / 自动发现已安装软件结论（2026-09-24）：已完成。** 新增 Windows 原生软件目录与前端类型桥；Web strict build 通过（220 modules），`cargo fmt -- --check`、`cargo check --all-targets`、debug build 均通过；真实 Desktop 启动日志确认三类发现源合并后得到 537 条本地软件记录。软件图标与最终可执行路径解析仍按任务拆分留给后续项。

**S3.2 / 软件图标读取结论（2026-09-24）：已完成。** 图标读取保持与启动路径解析解耦：Registry 使用 `DisplayIcon`，Start Menu 入口交由 Windows Shell 提取，Store/MSIX 使用 Package Logo 资源；图片文件直接读取，EXE/DLL/ICO/快捷方式通过 Shell/HICON 转 64×64 PNG，前端按软件名惰性请求并以内存缓存。Web strict build 通过（220 modules），`cargo fmt -- --check`、`cargo check --all-targets`、`cargo test --all-targets`（2/2）与 debug build 全部通过，其中真实已安装软件图标提取测试通过。

**S3.2 / 软件路径解析结论（2026-09-24）：已完成。** 软件目录现同时返回 `launchKind / launchTarget / launchArgs`：Start Menu 快捷方式通过 Windows ShellLink COM 解析，Store/MSIX 使用 AppListEntry AUMID，Registry 只在 `DisplayIcon` 可确认现存 EXE 时作为低优先级兜底；Start Menu 解析结果优先级最高。真实目录测试首次发现 AdobeGenP 陈旧快捷方式指向已删除 EXE，随后加入目标存在性校验，坏快捷方式保持“未解析”而不下发错误启动路径。Web strict build 通过（220 modules），`cargo fmt -- --check`、`cargo check --all-targets`、`cargo test --all-targets`（3/3）与 debug build 全部通过。

**S3.2 / Launcher 自动推荐常用软件结论（2026-09-24）：已完成。** Launcher 默认常用区从“工具列表前 12 项”升级为本地学习型推荐：只纳入 `launchKind + launchTarget` 均有效的软件，基础分优先 Start Menu / Store 用户可见入口，多来源软件额外加权；再叠加 FlexiKit 内本地启动频次、最近启动时间与全局搜索最近应用，Runtime / SDK / Updater 等噪声仅在没有真实使用信号时降权。推荐最多 12 项，仅为当前展示项按需读取图标；一旦用户拖拽/整理产生 `launcherPinnedKeys`，自动推荐不再覆盖其固定顺序。新增 `launch_installed_app` 原生命令，前端只提交已发现的软件名，原生端重新从缓存目录解析目标后启动，不能伪造任意路径/AUMID。Web strict build 通过（222 modules），`cargo fmt -- --check`、`cargo check --all-targets`、`cargo test --all-targets`（4/4）与 debug build 全部通过；真实 Desktop 启动正常并再次发现 537 条软件记录。

**S3.2 / 手动添加 / 删除结论（2026-09-24）：已完成。** Launcher 应用库从“仅 FlexiKit 工具”升级为统一应用库，纳入所有已发现且具有有效启动目标的本地软件；支持“全部 / 本地应用 / FlexiKit 工具 / 原工具分类”筛选和统一搜索。本地软件与工具都可通过 `+ / ✓` 加入或移出常用区，整理模式继续支持 `−` 删除和拖拽排序；不设固定数量上限。第一次手动操作会把当前推荐序列固化到 `launcherPinnedKeys`，后续顺序和增删随 Canvas Widget 配置持久化，重启后恢复。图标仍按当前展示项惰性读取。本任务不卸载软件，也不开放任意 EXE/AUMID 登记。Web strict build 通过（222 modules），Rust `cargo fmt -- --check`、`cargo check --all-targets`、`cargo test --all-targets`（4/4）和 debug build 全部通过；真实 Desktop 启动正常并再次发现 537 条软件记录。

**S3.2 / 软件失效路径检测结论（2026-09-24）：已完成，S3.2 整体闭环。** Launcher 挂载时强制刷新已安装软件目录，后续每次打开快速启动/应用库若距离上次刷新超过 60 秒则重新扫描；已固定软件若卸载、快捷方式失效或不再得到有效 `launchTarget`，不会静默消失，而是保留为“已失效”占位，禁用启动并允许用户在整理模式移除。失效记录不会重新出现在应用库，也不会进入自动推荐。若软件在缓存有效期内刚好失效导致启动命令失败，前端会捕获失败并立即强制刷新目录，把对应项转换为失效状态。Web strict build 通过（222 modules），Rust `cargo fmt -- --check`、`cargo check --all-targets`、`cargo test --all-targets`（4/4）与 debug build 全部通过；真实 Desktop 启动正常并再次发现 537 条软件记录。

## S3.3 — Desktop Organizer V2

- [x] Windows Known Folder API 替代环境变量猜测（Desktop Organizer 使用 `FOLDERID_Desktop` + `FOLDERID_PublicDesktop` 获取真实用户/公共桌面，读取与路径安全校验共用同一根目录来源；不再拼接 USERPROFILE / OneDrive / PUBLIC 环境变量）
- [x] 真实文件 / 应用图标（桌面文件、文件夹、快捷方式、EXE 等通过 Windows Shell 获取真实图标，HICON 转 64×64 PNG/Data URL；前端按完整桌面路径缓存，失败仅回退到类别字符图标；取图标前仍执行 Known Folder 安全路径校验）
- [x] 分类规则可配置（默认保留文件夹/应用与快捷方式/文档/图片/影音/压缩包/代码/其他；可改分类名与扩展名、添加/删除自定义分类、恢复默认；同一扩展名编辑时自动从其他分类移除，避免优先级规则；配置写入当前 Organizer Widget，不移动真实文件）
- [x] 常用文件置顶（桌面项目提供 `☆ / ★` 轻量星标；置顶后立即进入最上方“常用”分组并从原分类移除，取消后自动回归原分类；最近置顶优先，最多 80 项，路径写入当前 Organizer Widget 配置，不移动真实文件）
- [x] 最近文件（定义为当前 Known Folder 桌面中最近修改的文件，不读取 Windows 全局 MRU/UserAssist/RecentDocs；原生返回文件修改时间，前端展示最多 6 个未置顶文件并显示相对时间，常用/最近/普通分类之间不重复）
- [x] 文件夹快速展开（文件夹双击进入一级预览；原生 `get_desktop_folder_preview` 复用 Known Folder 安全边界，最多返回 30 项，不修改真实文件）
- [x] 搜索桌面内容（Organizer 内置桌面范围搜索；文件名精确/前缀/包含 + 扩展名匹配，180ms 前端防抖；原生仅遍历 Desktop/PublicDesktop Known Folder，最大深度 4、扫描≤5000、结果≤60，结果可直接打开或继续快速展开文件夹；不做文件内容全文索引）
- [x] 保持“不自动移动用户文件”的安全原则（机器审计确认 `desktop_system_windows.rs` 不包含 `fs::rename/remove_file/remove_dir/remove_dir_all/copy`；Organizer 前端仅调用读取桌面、搜索、图标读取、文件夹预览、受控打开 5 个命令；全项目命中的 rename/remove 仅为 FlexiKit 诊断日志轮转，与用户桌面无关）

**S3.3 / Windows Known Folder API 结论（2026-09-24）：已完成。** Desktop Organizer 的桌面根目录已从 `USERPROFILE / OneDrive / OneDriveConsumer / PUBLIC + Desktop` 猜测切换到 Windows Shell `SHGetKnownFolderPath`，分别解析当前用户 `FOLDERID_Desktop` 与 `FOLDERID_PublicDesktop`。这可正确跟随 OneDrive Known Folder Move、组策略/用户自定义桌面位置以及非默认系统目录。`desktop_items()` 与 `resolve_desktop_item()` 继续复用同一个 `desktop_roots()`，因此展示范围和可打开路径的安全边界保持一致。原生 `cargo fmt -- --check`、`cargo check --all-targets`、`cargo test --all-targets`（5/5）与 debug build 全部通过；新增真实 Windows Known Folder 测试确认当前用户桌面存在并被管理根目录包含，Desktop 实机启动正常。

**S3.3 / 真实文件 / 应用图标结论（2026-09-24）：已完成。** Desktop Organizer 的项目卡片从类别字符占位升级为 Windows Shell 真实图标：新增受控 `get_desktop_item_icon` 命令，前端只提交桌面项目路径，原生端先通过 `resolve_desktop_item()` 验证路径仍属于 Known Folder 管理范围，再进入共享的 Shell/HICON → 64×64 PNG 管线；前端按完整路径缓存已成功/失败的图标，6 秒目录刷新不会重复提取。实测首次暴露 canonical Windows `\\?\` 扩展路径会导致 Shell 取图标失败，现保留 canonical 路径做安全校验，但调用 Shell 前转换回普通 Win32/UNC 路径，并在直接真实路径查询失败时使用 `SHGFI_USEFILEATTRIBUTES` 获取类型/文件夹图标兜底。Web strict build 通过（222 modules），Rust `cargo fmt -- --check`、`cargo check --all-targets`、`cargo test --all-targets`（6/6）和 debug build 全部通过；新增真实 Desktop 路径图标测试通过，Desktop 实机启动正常。

**S3.3 / 分类规则可配置结论（2026-09-24）：已完成。** Desktop Organizer 新增内置“分类”设置页，保持轻量而非规则引擎：用户可直接修改分类名称与扩展名，新增/删除自定义扩展名分类，或一键恢复默认。文件夹和“其他”作为基础兜底保留；扩展名输入支持逗号、空格和中英文分隔符，统一规范为小写，单分类最多 80 个扩展名，整个规则集最多 20 个分类。同一扩展名被输入到新分类时会从其他分类自动移除，因此无需正则、条件优先级或冲突排序。规则保存在当前 `DesktopWidget.config.organizerCategories`，继续复用 Canvas Store 的本地持久化；规则只影响 Organizer 分组显示，绝不移动、重命名或修改用户桌面文件。Web `vue-tsc && vite build` 通过（222 modules），原生回归 `cargo check/test` 6/6 通过，最终 debug build 与 Desktop 启动烟测通过。

**S3.3 / 常用文件置顶结论（2026-09-24）：已完成。** Desktop Organizer 的每个桌面项目新增轻量 `☆ / ★` 星标操作。置顶后项目立即从原分类移到列表最上方“常用”分组，不重复展示；取消置顶后根据当前分类规则自动回到原分组。新置顶项目排在常用分组最前，`organizerPinnedPaths` 最多保存 80 个唯一完整路径并继续复用 Canvas Widget 配置持久化；当前不额外建立数据库。桌面项目暂时消失或被删除时不会阻塞 Organizer 渲染，只是不显示对应常用项；路径若重新出现可恢复匹配。该能力仅改变显示顺序，不移动、重命名或修改真实文件。Web strict build 通过（222 modules），Rust `cargo check --all-targets`、`cargo test --all-targets`（6/6）与 debug build 全部通过；最终 Desktop 启动烟测正常并再次发现 537 条软件记录。

**S3.3 / 最近文件结论（2026-09-24）：已完成。** 为避免把“最近”误做成系统级隐私采集，本项明确采用当前 Desktop Known Folder 的文件元数据：`DesktopItemSnapshot` 新增 `modifiedAt`（UNIX 秒），只对桌面文件排序，不包含文件夹，也不读取 Windows UserAssist、RecentDocs、Jump List 或其他全局打开历史。Organizer 在“常用”之后展示最多 6 个“最近修改”文件，按修改时间降序显示“刚刚 / N 分钟前 / N 小时前 / N 天前 / 月日”；已置顶文件优先留在“常用”，最近项从普通分类中过滤，三层之间不重复。新增真实 Desktop modification-time 测试，Rust `cargo test --all-targets` 提升至 7/7 通过；Web strict build 222 modules、`cargo fmt/check/build` 与 Desktop 启动烟测全部通过。

**S3.3 / 文件夹快速展开结论（2026-09-24）：已完成。** Desktop Organizer 的桌面文件夹新增显式 `›` 快速展开入口，双击文件夹也可进入；预览在 Organizer 内部完成，不打开独立文件管理器。支持继续进入子目录、返回上一层、关闭与 `Esc` 退出，子项复用真实 Shell 图标并可双击打开文件。原生 `get_desktop_folder_preview` 先通过 `resolve_desktop_item()` 校验路径仍位于 `FOLDERID_Desktop / FOLDERID_PublicDesktop` 管理根目录内，canonical 后再次验证每个返回项，隐藏/系统项被过滤；单次最多扫描 512 个目录项、返回 30 项，不递归预扫整棵目录树。最终 Web strict build 222 modules、Rust `cargo fmt/check/test/build` 全通过，真实 Desktop 预览范围测试通过，原生测试提升至 9/9，有界 Desktop 启动烟测通过。

**S3.3 / 搜索桌面内容结论（2026-09-24）：已完成。** Organizer 头部新增轻量搜索入口与 180ms 防抖输入。搜索由原生 `search_desktop_items` 完成，只遍历 `FOLDERID_Desktop / FOLDERID_PublicDesktop` 管理范围，canonical 后继续验证每个候选路径并过滤隐藏/系统项；最大递归深度 4、单次最多扫描 5000 项、返回 60 条。排序规则为文件名精确匹配 → 前缀匹配 → 文件名包含 → 扩展名兜底，再按目录/修改时间/名称稳定排序。结果复用 Windows Shell 真实图标，文件可双击打开，目录可继续进入 Organizer 快速展开；搜索不读取文件正文、不访问其他盘符、不读取 RecentDocs/UserAssist 等系统行为历史。Web `vue-tsc && vite build` 通过（222 modules），Rust `cargo fmt/check/test/build` 全通过，新增 ranking + 真实 Desktop 范围搜索测试后共 11/11 tests，通过有界 Desktop 启动烟测。

**S3.3 / “不自动移动用户文件”安全原则结论（2026-09-24）：已完成，S3.3 正式闭环。** 对 Desktop Organizer 前端与 Windows 原生模块执行了机器审计：`desktop_system_windows.rs` 中不存在 `fs::rename / remove_file / remove_dir / remove_dir_all / copy`；`DesktopOrganizerWidget.vue` 实际只调用 `get_desktop_items / search_desktop_items / get_desktop_item_icon / get_desktop_folder_preview / open_desktop_item` 五个受控命令，其中所有路径型命令均受 Desktop Known Folder 边界约束。全项目扫描到的 `fs::rename/remove_file` 仅位于 `diagnostics.rs` 日志轮转，作用对象是 FlexiKit 自身诊断日志，不涉及用户桌面。机器安全审计命令退出码 0；结合此前 Web 222 modules、Rust 11/11 tests、debug build 与有界 Desktop smoke，S3.3 Desktop Organizer V2 全部完成。

## S3.4 — Widget 生态

- [x] Calendar（纯本地月历；今天高亮、日期选择、上/下月与回到今天；支持周一/周日起始和是否显示相邻月份日期两项 Registry 配置，不联网、不接系统账户、不建立事件数据库）
- [x] Folder（把 Desktop/PublicDesktop 中的真实文件夹固定为独立 Widget；首次从桌面文件夹列表选择，根路径随 Widget config 持久化；支持子目录进入、返回、刷新、真实 Shell 图标、文件双击打开；路径失效时保留配置并提示重新选择，不开放任意盘符、不修改文件）
- [x] System Monitor（Windows 原生只读采样：`GetSystemTimes` CPU 累计时间、`GlobalMemoryStatusEx` 物理内存、现有系统盘容量与 `GetTickCount64` 开机时长；前端差分计算 CPU 使用率并保留 18 点轻量历史；默认 2 秒刷新，可配置 5/10 秒及隐藏系统盘，不引入 `sysinfo` 或后台采样线程）
- [x] Notes（极简纯文本桌面便签；每个实例独立保存 `noteTitle / noteContent / noteUpdatedAt`，标题≤40、正文≤12000；编辑态约 450ms 防抖自动保存，完成/失焦/卸载前强制 flush；显示最近编辑时间，清空需 3 秒内二次确认；不联网、不调用原生命令、不做 Markdown/富文本/云同步）
- [x] Weather（手动城市后才联网，不读取系统/GPS/IP 定位；Open-Meteo Geocoding + Forecast，当前温度/体感/湿度/风速 + 4 日预报；摄氏/华氏和预报显示可配置；30 分钟刷新、聚焦时 5 分钟 freshness gate、10 秒请求超时，同一城市运行期缓存坐标；免费端点仅用于开发/非商业阶段，商业发布前必须换商业授权端点或自托管）
- [x] Widget 插件扩展规范（Host API V1；Plugin Manifest 包含稳定 ID/SemVer/API 版本/source/单多实例策略/权限/网络 Origin/Native Command；注册时 Fail Fast 校验并拒绝重复 type；14 个内置 Widget 已迁移权限元数据；V1 仅允许随应用构建的可信本地组件，不执行远程动态 JS）
- [x] Widget 配置 Schema 扩展（在既有 boolean/select/range/text 上新增 number、color、section/group 与 `visibleWhen` 条件显示；Inspector 自动渲染；number/range 统一 clamp+step，text 执行 maxLength，color 限定 #RRGGBB；注册时严格校验 Schema key、select、数值边界、颜色、条件引用与类型，条件只能引用前序值字段避免循环）

**S3.4 / Calendar 结论（2026-09-24）：已完成。** 新增 `CalendarWidget.vue` 并注册到 Widget Registry，默认尺寸 320×340。组件使用本地 `Date + Intl.DateTimeFormat` 生成固定 6×7 月历，支持今天高亮、任意日期选择、上月/下月、回到今天；点击可见的相邻月份日期会自动切换对应月份。Registry 复用现有 `select + boolean` Schema 提供“周一/周日作为一周开始”和“显示相邻月份日期”两个设置，设置继续由 Canvas Inspector 自动生成并随 Widget config 持久化。Calendar 不联网、不请求系统日历权限、不读取用户账户或日程数据，也不新建事件数据库。Web `vue-tsc && vite build` 通过，构建模块数由 222 增至 225；Rust `cargo fmt/check/test/build` 回归 11/11 通过，最终 Tauri debug build 与有界 Desktop 启动烟测通过。

**S3.4 / Folder 结论（2026-09-24）：已完成。** 新增 `FolderWidget.vue` 并注册到 Widget Registry，默认尺寸 340×320。Folder V1 定义为“把桌面中的一个常用文件夹固定成独立工作区”：首次添加时读取 `get_desktop_items` 并只列出 Desktop/PublicDesktop 顶层文件夹供选择，选择后的 `folderWidgetRootPath / folderWidgetRootName` 随当前 Widget config 持久化。已绑定文件夹通过 `get_desktop_folder_preview` 按需读取，支持继续进入子目录、返回上一层、手动刷新以及窗口聚焦/10 秒轻量刷新；文件复用 `open_desktop_item` 双击打开，所有可见项目复用 Windows Shell 真实图标。根路径被删除/重命名时不自动清除用户选择，只显示“不可用”并允许重新选择。Folder 不提供任意路径输入、任意盘符浏览、移动/复制/重命名/删除能力；机器审计确认前端只调用 `get_desktop_items / get_desktop_folder_preview / get_desktop_item_icon / open_desktop_item` 四个既有受控命令。Web strict build 通过（228 modules），Rust `cargo fmt/check/test/build` 回归 11/11 通过，debug build、有界 Desktop 启动烟测和 Folder 命令面安全审计均通过。

**S3.4 / System Monitor 结论（2026-09-24）：已完成。** 新增 `system_monitor_windows.rs`、`get_system_monitor_snapshot` 与 `SystemMonitorWidget.vue`，并注册到 Widget Registry，默认尺寸 320×250。原生端直接调用 Windows `GetSystemTimes`、`GlobalMemoryStatusEx`、`GetTickCount64`，并复用既有 `system_disk_info()` 返回 CPU 累计 idle/total 毫秒、物理内存总量/可用量、开机时长和系统盘容量；没有引入 `sysinfo`、WMI 查询或后台常驻采样线程。前端基于连续 CPU 累计时间做差分得到机器整体 CPU 使用率，保留最近 18 个轻量历史柱；同时展示内存使用、系统盘使用与开机时长。Registry 提供 2/5/10 秒刷新频率（默认 2 秒）和“显示系统盘”开关，切换刷新频率会重建定时器且不会叠加轮询。新增 FILETIME 转换测试与真实 Windows 系统快照测试后 Rust tests 提升至 13/13；Web strict build 231 modules、`cargo fmt/check/build`、Tauri debug build 与有界 Desktop 启动烟测全部通过。

**S3.4 / Notes 结论（2026-09-24）：已完成。** 新增 `NotesWidget.vue` 并注册到 Widget Registry，默认尺寸 320×280。Notes V1 定义为“极简桌面便签”：支持独立标题、纯文本正文、查看/编辑模式、双击正文进入编辑、最近编辑时间与清空；清空采用 3 秒内二次确认避免误触。每个实例把 `noteTitle / noteContent / noteUpdatedAt` 保存到自身 Widget config，因此多个 Notes 天然相互独立，并继续由 Canvas Store 的深度监听 + `flexikit-desktop-canvas-v2` localStorage 持久化；组件输入端额外使用约 450ms 防抖，只在停止输入后更新 config，点击完成、输入失焦或组件卸载前会立即 flush。标题限制 40 字符，正文限制 12000 字符，避免单个便签无界占用 Canvas localStorage。Notes 不调用任何 Tauri 原生命令，也没有 fetch/axios/WebSocket 等网络访问，不做 Markdown、富文本、附件、云同步或账号数据。机器审计确认 native/network calls=0 且持久化绑定当前 `widget.id`；Web strict build 234 modules、Rust `cargo fmt/check/test/build` 回归 13/13、Tauri debug build 与有界 Desktop 启动烟测全部通过。

**S3.4 / Weather 结论（2026-09-24）：已完成。** 新增 `WeatherWidget.vue` 并注册到 Widget Registry，默认尺寸 340×280。Weather V1 不申请系统定位权限，也不做 IP/GeoIP 自动定位；首次必须由用户手动输入城市，`weatherLocation` 随当前 Widget config 本地持久化，解析出的经纬度只保存在运行内存。联网源固定为 `geocoding-api.open-meteo.com` 与 `api.open-meteo.com`：Geocoding 取一个城市匹配，Forecast 请求当前温度、体感温度、相对湿度、天气代码、10m 风速，以及 4 日天气代码/最高最低温/最大降水概率；`timezone=auto`。Registry 提供城市、摄氏/华氏和“显示 4 日预报”配置。正常周期 30 分钟，窗口聚焦仅在上次成功数据超过 5 分钟时更新；HTTP 请求 10 秒超时，同一城市在本次运行期间缓存经纬度，后续刷新只请求 forecast。UI 明示 `天气数据 · Open-Meteo` attribution。真实南京 Geocoding + Forecast API 烟测、两个域名对 `Origin: http://tauri.localhost` 的 CORS 验证、自动定位/固定网络域机器审计均通过；Web strict build 237 modules、Rust 回归 13/13、最终 Tauri debug rebuild 与有界 Desktop 启动烟测通过。**发布门禁：Open-Meteo 免费端点仅允许非商业使用；FlexiKit 一旦收费/含广告/商业发行，必须在发布前切换到其商业授权 customer API（凭据不得硬编码到前端）或自托管兼容服务。**

**S3.4 / Widget 插件扩展规范结论（2026-09-24）：已完成。** 新增 `widgetPlugin.ts` 与 `docs/WIDGET_PLUGIN_SPEC.md`，定义 `WIDGET_PLUGIN_API_VERSION = 1`、统一生命周期契约、`WidgetPluginManifest`、敏感权限枚举、网络 Origin 与 Native Command 显式声明，以及 `single / multiple` 实例策略。`WidgetDefinition` 现在必须携带 plugin manifest；Registry 由静默覆盖改为 `registerWidgetPlugin()` Fail Fast 注册：拒绝重复 type、非法 type/ID/SemVer/API 版本、重复 config key、未知/重复权限、非 HTTPS 精确 Origin，以及 network/native 声明与白名单不一致。14 个现有内置 Widget 已通过 `BUILTIN_PLUGIN_OPTIONS` 迁移到统一权限元数据，Desktop Organizer 被正式标记为 single instance，Canvas 添加流程已执行该策略。V1 权限是可审计契约而不是 JS Sandbox：当前只允许随 FlexiKit 构建并经过审查的本地组件，不支持远程 JS、运行时 npm 安装或第三方目录自动执行；真正开放插件市场前必须另建权限执行层/签名/沙箱。Web `vue-tsc && vite build` 通过（238 modules），Rust `cargo fmt/check/test/build` 回归 13/13 通过。

**S3.4 / Widget 配置 Schema 扩展结论（2026-09-24）：已完成，Stage 3 主线闭环。** `Widget Registry` 的配置契约从 boolean/select/range/text 扩展为 boolean/select/range/**number/color/section**/text，并新增统一 `visibleWhen: { key, equals }` 条件显示。Section 只承担 Inspector 分组标题，不进入持久化 defaults；条件字段必须引用自身之前已声明的值字段，因此不会形成循环依赖。注册时 Schema 校验升级为 Fail Fast：配置 key 必须是稳定 camel-style 标识、label 必填、select 选项/默认值必须一致且不可重复、range/number 的 default/min/max/step 必须有限且边界合法、text `maxLength` 限制为 1–4096、color 必须是 `#RRGGBB`，条件值类型必须与控制字段一致。运行时 `resolveWidgetConfigValue()` 同时承担防御性归一化：number/range clamp+step、text 截断、color/select 非法值回退默认。Canvas Inspector 已自动渲染 Section、数字输入和系统颜色选择器，并按当前 config 动态隐藏/显示条件项。Weather 已用 Section + Number + visibleWhen 实现 1–4 天预报配置；Notes 已用 Section + Color 实现每实例强调色，验证新类型不是空接口。Web strict build 238 modules、Rust `cargo fmt/check/test/build` 13/13、Tauri debug build 与有界 Desktop 启动烟测全部通过。

## Stage 3 完成门槛

- 用户可以主要通过桌宠 / Canvas / 全局搜索完成日常启动和查找
- Desktop 不再只是 Web 工具站的附属入口
- 高频桌面操作有明显效率提升

---

# Stage 4 — 架构治理与账号基础

## 目标

让项目具备长期维护、多端扩展和后续收费的工程基础。

## S4.1 — API / Backend

- [x] 统一错误处理（全局 `GlobalHttpExceptionFilter` + `ApiErrorResponse`：保留 statusCode/message/error 并新增稳定 `code`、可选 `details[]`；ValidationPipe 统一为 `VALIDATION_ERROR`，嵌套 class-validator 信息递归去重；HttpException 按状态映射机器错误码，合法业务 code 可透传；未知异常固定脱敏 500/INTERNAL_ERROR，服务端仅内部记录 stack；favicon 缺参 400 已纳入统一 Filter，资源缺失空 404 作为二进制探测特例保留）
- [x] 统一响应格式（全局 `ApiResponseInterceptor` 将普通 JSON 成功值包装为 `{ code: 0, message: 'success', data }`，undefined 归一为 null；`@RawResponse()` 为二进制/流式端点显式逃生口，当前仅 favicon 使用；Web 唯一 Axios Client 精确识别并自动解包 success envelope，因此业务 API/页面继续消费原 `response.data` 形状；错误响应保持独立错误契约）
- [x] 清理 Controller / Service 宽泛类型（统一 `AuthenticatedRequest / OptionalUserRequest`；Categories/Favorites/Users/Orders/Stats/Recommendations/Tools 不再使用未类型化 `@Request()`；Discovery 整体 Query 改为 `DiscoveryQueryDto`；10 个 Crawler Service 的 RSS/V2EX 外部输入改为 `RssFeedItem` 或 `unknown + type guard`；Favorites TypeORM select 去除 `as any`；HttpService 默认泛型由 any 改 unknown；新增 `test:type-audit` 门禁，Controller/Service explicit_any=0、untyped_request=0、untyped_whole_query=0）
- [x] 请求日志与错误日志（全局 `RequestLoggingMiddleware`：安全 `X-Request-Id` 生成/透传、响应头回传、method/path/status/duration/outcome/userId?/脱敏 IP/截断 UA 结构化日志；path 不含 query，禁止记录 body/query/Authorization/Cookie；`GlobalHttpExceptionFilter` 输出同 requestId 的 `http_error`，4xx warn 无 stack、5xx error 仅服务端 stack；CORS 允许/暴露 X-Request-Id；新增 `test:logging-regression` 与真实 3013 HTTP 日志烟测）
- [x] API versioning 方案（Nest URI Versioning；正式 V1 为 Backend `/v1/*`、Web `/api/v1/*`；默认版本同时注册 `VERSION_NEUTRAL + 1` 保留旧无版本兼容别名；Web/Desktop Runtime 默认迁到 V1，favicon 等 `resolveApiUrl()` 直连资源同步版本化；V1 只做兼容性演进，破坏性变更必须开 V2；当前 `/v2/*` 明确 404；新增 `test:versioning-regression` 与独立 3014 兼容烟测）

**S4.1 / 统一错误处理结论（2026-09-24）：已完成。** 新增 `backend/src/common/errors/api-error.ts`、`validation-error.ts` 与 `docs/API_ERROR_CONTRACT.md`。错误 JSON 保持旧客户端兼容字段 `statusCode / message / error`，新增稳定机器码 `code` 与可选 `details[]`。400/401/403/404/405/409/413/415/422/429/500/502/503/504 均有稳定内置 code，其余 HTTP 状态回退 `HTTP_ERROR`；合法大写业务 code 可由 HttpException payload 显式提供，非法 code 自动回退。全局 ValidationPipe 通过统一 exceptionFactory 输出 `VALIDATION_ERROR`，递归收集并去重嵌套 DTO 的 class-validator 文案。未知非 HttpException 只向客户端返回固定 `INTERNAL_ERROR`，原始异常 stack 仅进入服务器日志。Web `ApiErrorResponse` 已识别 `code/details`，显示 helper 优先使用 validation details，同时保持旧 `message: string|string[]` 兼容。`GET /tools/favicon` 缺少 url 的 400 已改走 Filter；favicon 找不到资源时的空 404 仍作为图片探测协议特例。新增 `npm run test:error-regression`，覆盖 400/401/403/404、嵌套 Validation、非法自定义 code 和 500 脱敏；Backend build、错误回归和 Web strict build（238 modules）全部通过。

**S4.1 / 统一响应格式结论（2026-09-24）：已完成。** 新增 `ApiSuccessResponse<T>`、`ApiResponseInterceptor`、`@RawResponse()` 与 `docs/API_RESPONSE_CONTRACT.md`。Nest 通过 `APP_INTERCEPTOR` 全局包装普通 Controller 成功结果为 `{ code: 0, message: 'success', data }`，Controller 无返回值时显式给 `data: null`；Controller/Service 不需要手写 envelope。`GET /tools/favicon` 因成功结果是图片字节且无图标时需空 404，被标记为 RawResponse，跳过成功包装但其抛出的异常仍进入统一错误 Filter。Web `client.ts` 在唯一 Axios response interceptor 中只对精确 `code===0 && message==='success' && data` envelope 解包，因此现有 API 模块和页面的 `response.data` 语义不变。新增 `test:response-regression` 覆盖 object/array/string/null 包装，并复跑 `test:error-regression`；Backend build、Web strict build（238 modules）均通过。最终真实 HTTP 有界烟测在独立 3011 端口验证：`GET /` 实际返回 0/success/Hello FlexiKit，空登录请求返回 400/VALIDATION_ERROR（3 条 details），favicon 缺参返回 400/BAD_REQUEST，测试进程已主动停止。

**S4.1 / Controller / Service 类型治理结论（2026-09-24）：已完成。** 新增共享 `AuthenticatedRequest / OptionalUserRequest`，替换 Tools 内部临时 UserRequest，并迁移 Categories、Favorites、Users、Orders、Stats、Recommendations 的未类型化 Request；JWT guard 后的路由使用必有 `user` 的 AuthenticatedRequest，OptionalJwt 路由使用可选 user，消除 `req.user!`。Discovery `@Query()` 改为 `DiscoveryQueryDto`，对 limit/offset 做既有语义所需的数值转换与整数校验，同时保留未知 sort 值进入 Service 默认 hot 分支的旧行为。Crawler 新增共享 `RssFeedItem`，9 个 RSS Service 不再使用 `any[]/any`；V2EX JSON 先落到 `unknown`，再通过字段级 type guard 过滤有效 topic。CrawlerService → DiscoveryService 的 `tool as any` 已删除，Favorites TypeORM select 使用对象式强类型选择，HttpService `getJson` 默认泛型由 `any` 改为 `unknown`。新增 `npm run test:type-audit` 扫描所有 `*.controller.ts / *.service.ts`，当前结果 explicit_any=0、untyped_request=0、untyped_whole_query=0。Backend build、error/response regression、Web strict build（238 modules）通过；独立 3012 真实 HTTP 烟测确认 Discovery `limit=2`、legacy sort fallback 与匿名 Categories 行为保持正常。

**S4.1 / 请求日志与错误日志结论（2026-09-24）：已完成。** 新增 `common/logging/http-log-context.ts`、`request-logging.middleware.ts`、`docs/API_LOGGING_CONTRACT.md` 与 `test:logging-regression`。每个请求接收安全格式的客户端 `X-Request-Id` 或由服务端生成 UUID，并通过响应头返回；CORS 已允许并暴露该头。Request Middleware 使用单调高精度计时，在响应 finish/异常 close 时输出结构化 `http_request`：requestId/method/path/statusCode/durationMs/outcome，可选 userId、脱敏 clientIp、清洗并截断到 160 字符的 userAgent。日志只使用 `request.path`，不记录 query/body/Authorization/Cookie。全局 Exception Filter 使用同一 requestId 输出 `http_error`：4xx 为 warn 且无 stack，5xx/未知异常为 error，stack 仅服务器内部日志；HTTP 错误响应契约未改变。Backend build、logging/error/response/type 四组回归全部通过。最终独立 3013 真实 HTTP 烟测验证成功/400 错误 requestId 关联、VALIDATION_ERROR、query path 脱敏、body/query 敏感 marker 不进入结构化 HTTP 日志、client IP 为 `127.0.0.x`，以及浏览器 CORS 可读取 `X-Request-Id`；测试进程已主动停止。

**S4.1 / API Versioning 结论（2026-09-24）：已完成，S4.1 全部闭环。** 新增 `common/versioning/api-versioning.ts`、`docs/API_VERSIONING.md` 与 `test:versioning-regression`。Backend 启用 Nest URI Versioning，未显式版本的现有 Controller 默认同时注册 `VERSION_NEUTRAL` 与 V1，因此旧 `/tools` 等路径继续作为兼容别名，正式 Backend API 为 `/v1/*`。Web/Desktop `runtime.ts` 定义 `API_VERSION='v1'`：浏览器开发/生产默认 Axios base 为 `/api/v1`，Desktop 默认 `http://127.0.0.1:3001/v1`，自定义 `VITE_API_URL` 自动补 V1 且已有 `/v1` 时不重复；`resolveApiUrl('/api/...')` 也自动升级到 V1，因此 favicon 等非 Axios URL 不遗漏。现有 Vite/Nginx `/api/*` strip proxy 可直接把 `/api/v1/*` 转给 Backend `/v1/*`。Backend build、versioning/error/response/logging/type 全部回归及 Web strict build（238 modules）通过，生产 Web bundle 已审计包含 V1 路由。最终独立 3014 HTTP 烟测验证 legacy root/V1 root 同数据、legacy tools/V1 tools 均 200、V1 Validation 仍为 400/VALIDATION_ERROR、未实现 `/v2` 为 404/NOT_FOUND、V1 requestId 响应头与 `/v1/tools` 结构化日志正常。

## S4.2 — Authentication

- [x] Access Token 生命周期（默认 `ACCESS_TOKEN_TTL=30m`，支持 60 秒–30 天且非法配置 Fail Fast；旧 `JWT_EXPIRES_IN` 仅作迁移兜底；登录/注册返回 `access_token/token_type/expires_in/expires_at`，新 JWT 标记 `token_use=access`；Access Strategy 拒绝显式非 access token，同时暂时兼容旧无 token_use JWT；Web 在初始化、请求前、定时器与窗口 focus 主动判断过期，401 仍为服务器兜底）
- [x] Refresh Token（opaque `sessionId.secret`，数据库只存 SHA-256；默认 `REFRESH_TOKEN_TTL=30d`、1–180 天 Fail Fast；`refresh_sessions` 独立表 + 用户删除级联；`POST /auth/refresh` 事务行锁单次轮换且保持绝对过期时间；旧 Token 重放会撤销整个 Session；Web Refresh Token 仅放 sessionStorage，Axios 单飞续期并只重试原请求一次）
- [x] Desktop Token 安全存储（Windows DPAPI Current User + Tauri 固定 `access/refresh` IPC 槽位；`app_local_data_dir/auth-vault/*.dpapi` 仅落 DPAPI 密文，临时文件 + `MoveFileExW(REPLACE_EXISTING|WRITE_THROUGH)`；Desktop Access/Refresh 不再持久化到 Web Storage，首次 hydrate 自动迁移旧明文副本后删除；真实 DPAPI round-trip 验证磁盘不含明文 Token）
- [x] Web / Desktop / Mobile 多端登录策略（每次登录创建独立 Refresh Session，不隐式踢其他端；Session 增加 `client_type/client_instance_id/client_name`，旧客户端兼容为 `unknown/null`；响应显式返回 `session_id`；Web/Desktop 发送稳定随机 UUID 实例 ID，Refresh 保持原 Session/客户端归属且只轮换当前行；`mobile` 契约预留给未来原生客户端）
- [x] 设备管理（新 Access JWT 绑定 `sid=session_id`，服务端可靠识别当前 Session；`GET /auth/sessions` 仅返回当前用户未撤销/未过期 Session 的安全元数据并标记 current；`DELETE /auth/sessions/:id` 只能撤销其他 Session，阻止误撤当前/旧无 sid Token；Profile 账户页新增登录设备面板，支持刷新、当前设备标识和确认移除；不采集 IP/UA/硬件指纹）
- [x] 登出 / 吊销（新增 `POST /auth/logout`；新 Access JWT 的 `sid` 在每次受保护请求中校验 Session 存在/未撤销/未过期；logout、设备撤销、Refresh replay 一旦写 `revoked_at`，同 Session 已签发 Access/Refresh 均立即 401；旧 sid-less Access 可用当前 Refresh Token 作为服务端 logout 迁移兜底；Web/Desktop 正常退出先请求服务端吊销，再在 finally 清本地凭据）

**S4.2 / Access Token 生命周期结论（2026-09-25）：已完成。** 新增 `auth/access-session-lifecycle.ts`、Web `auth/accessToken.ts`、`docs/ACCESS_SESSION_LIFECYCLE.md`、`test:access-token-regression` 与有界 `test:access-token-live`。JwtModule 不再携带全局 expiresIn，AuthService 显式解析并签发 Access Token：优先 `ACCESS_TOKEN_TTL`、其次兼容旧 `JWT_EXPIRES_IN`、缺省 30m；允许整数秒或 s/m/h/d 格式，范围 60 秒–30 天，非法值启动时 Fail Fast。登录/注册成功数据新增 Bearer token_type、expires_in 与来自 JWT exp 的 expires_at；新 JWT 带 `token_use=access`。JwtStrategy 继续由 passport-jwt 强制 exp，并拒绝显式 refresh token_use；升级前无 token_use 的旧 JWT 暂时兼容。Web 保留既有 token key，但集中到 Access Token storage helper，并额外持久化 expires_at；旧 Token 可只解码 JWT exp 用于本地过期判断（不作为权限依据）。Pinia 在初始化、登录/注册后定时器、窗口 focus 和 Axios 请求前主动检查过期，过期与 401 共用 auth-invalidated 清理链。Backend build、Access Token 回归、S4.1 全部回归、Web strict build（239 modules）通过。真实 3015 生命周期烟测以 `ACCESS_TOKEN_TTL=2m` 创建随机测试账号，验证 register=201、Bearer/expires_in=120、JWT token_use=access、exp-iat=120、expires_at==exp、受保护 profile=200，删除测试账号后旧 Token 返回 401/UNAUTHORIZED，测试账号已清理。

**S4.2 / Refresh Token 结论（2026-09-25）：已完成。** 新增 `refresh_sessions` Entity 与迁移 `1790298000000-AddRefreshSessions.ts`、`refresh-session-lifecycle.ts`、`RefreshTokenDto`、`POST /auth/refresh`、Web `auth/refreshToken.ts`、`docs/REFRESH_SESSION_LIFECYCLE.md` 以及 refresh unit/live regressions。Refresh Token 采用 opaque `sessionId.secret`，secret 为 32-byte random base64url，PostgreSQL 仅保存 SHA-256 hash；默认 `REFRESH_TOKEN_TTL=30d`，范围 1–180 天并 Fail Fast。登录创建独立 Refresh Session，注册的 User + Refresh Session 在同一 TypeORM transaction；刷新时只对目标 session 行加 `pessimistic_write`，常量时间比较 secret hash 后原 sessionId 轮换新 secret，绝对 `refresh_expires_at` 不延长。成功轮换后的旧 Token 若重放，会因 hash mismatch 将整条 Session 置 revoked，随后最新 Refresh Token 也被拒绝。Web 将 Refresh Token 限制在 sessionStorage，Access Token 过期不再直接退出；Axios 在请求前/受保护接口 401 时执行单飞刷新，成功覆盖 Access/Refresh pair 并只重试一次，失败才触发统一 auth-invalidated。DataManagement 等旧 Access-presence 判断已改为会话状态。Backend build、Access/Refresh + S4.1 全部回归和 Web strict build（240 modules）通过。真实 PostgreSQL 3016 烟测验证：明文 Refresh Token 不落库、同 session rotation、旧 Token replay=401 并 revoke、最新 Refresh 在 reuse 后同样 401、rotated Access 仍可访问 profile、账号删除级联清理 session；测试账号已删除。`migration:run` 复跑返回 `No migrations are pending`。

**S4.2 / Desktop Token 安全存储结论（2026-09-25）：已完成 Windows 基线。** 新增 `auth_vault_windows.rs` 与 Tauri `store/load/clear_secure_auth_token` 固定槽位 IPC，复用现有 `windows 0.61.3` 并启用 Win32 Foundation/Cryptography feature，不引入第三方 keyring。Access/Refresh 记录在 `app_local_data_dir/auth-vault` 下分别保存为 DPAPI Current User 密文；输入限制 token ≤32 KiB、expiry ≤128 bytes、拒绝 CR/LF，读取密文 ≤64 KiB；DPAPI 使用 `CRYPTPROTECT_UI_FORBIDDEN`，输出缓冲区通过 `LocalFree` 释放，写入采用 temp + `sync_all` + `MoveFileExW(REPLACE_EXISTING|WRITE_THROUGH)`。Web auth storage API 改为异步 runtime 分流：浏览器保持 localStorage/sessionStorage 兼容路径，Desktop 使用 DPAPI Vault + 内存缓存；首次 hydrate 会将历史 Web Storage Token 迁入 DPAPI 并删除明文副本，之后 persist/clear 也防御性清理旧副本。Axios/Pinia 全链路等待安全存储完成；`tools.ts` 原先依赖 raw Access Token 的并发检查改为登录状态 + userId，会话轮换不再误判。Rust `fmt/check/test/build` 全通过，17/17 tests，其中真实 DPAPI 文件测试验证密文不含明文 Token、解密 round-trip 与 clear；Web strict build 240 modules、Access/Refresh regressions 通过，全项目审计无残余直接 `localStorage.getItem/setItem/removeItem('token')` 或 `user.token` 旁路。Desktop 有界启动达到 `setup_complete`，测试 PID 已确认停止。该方案保护静态 Token，不宣称抵御同用户进程、运行时内存或 WebView XSS；跨平台 Keychain/Secret Service 仍需在未来对应平台实现。

**S4.2 / 多端登录策略结论（2026-09-25）：已完成。** 新增 `1790299800000-AddRefreshSessionClientContext.ts`，为 Refresh Session 增加 client type / UUID instance id / client name 与 user+instance 索引；旧 Session 通过 `unknown/null` 无损兼容。Login/Register DTO 对 client type（web/desktop/mobile）、UUID v4 与 1–80 字符显示名做显式校验；AuthService 每次登录仍创建独立 Session，不按设备隐式替换或吊销，Auth 响应新增 `session_id/client_type/client_instance_id/client_name`。Refresh 请求不接受客户端元数据，只在原 Session 行内轮换 secret/hash，并保留原 Session ID、客户端归属和绝对过期时间。Web shared client 新增 `auth/clientContext.ts`：Tauri 标记 desktop、浏览器标记 web，随机非敏感 UUID v4 持久化为 client instance id；mobile 仅预留给未来原生客户端。客户端元数据仅用于展示/归类，不是认证因子，不采集 IP/UA/硬件指纹。Backend build、multi-client regression、Access/Refresh + S4.1 全套回归、Web strict build（241 modules）通过；真实 PostgreSQL 3017 烟测验证 Desktop/Web/Legacy 3 Session 并存、跨端登录不 revoke、Desktop refresh 不改变 Web/Legacy token hash、Web refresh 独立、旧客户端 unknown/null、删账号级联全部 Session；3015/3016 既有 Access/Refresh live smoke 继续通过。migration 首次成功执行，复跑为 `No migrations are pending`。详见 `docs/MULTI_CLIENT_AUTH.md`。

**S4.2 / 设备管理结论（2026-09-25）：已完成。** 新 Access JWT 增加可选 `sid`，值为当前 Refresh Session UUID；JwtStrategy 将其映射到 `req.user.sessionId`，旧 JWT 仍以 `sessionId=null` 兼容普通 API。新增受 JwtAuthGuard 保护的 `GET /auth/sessions` 与 `DELETE /auth/sessions/:sessionId`：列表只查询当前用户 `revoked_at IS NULL && expires_at > now` 的 Session，投影 client metadata / created / last_used / expires / is_current，绝不返回 Token 或 token hash；撤销接口要求 UUID v4、校验 Session 归属，并由服务端禁止撤销当前 Session 或由无 sid 的旧 Access Token执行设备撤销。Profile 账户视图新增独立 `DeviceSessionsPanel.vue`，提供加载/重试/刷新、当前设备标识、其他 Session 二次确认移除与安全说明，不解析 Refresh Token。Backend build、type audit、device-management regression、Access/Refresh/Multi-client/S4.1 regressions 与 3015/3016/3017 既有 live smoke 全部通过；新增真实 PostgreSQL 3018 device smoke 验证 JWT sid、当前/其他列表、无 Token/Hash 泄露、当前撤销 400、其他撤销 200、被撤 Refresh 401、当前 Refresh 200、active list 收敛为 1、账号删除级联清理。Web strict build 为 244 modules。后续“登出 / 吊销”已补齐 Session-aware Access 校验：设备撤销后，该 Session 已签发的 sid-bound Access Token 现在会立即 401。详见 `docs/DEVICE_MANAGEMENT.md` 与 `docs/LOGOUT_REVOCATION.md`。

**S4.2 / 登出与吊销结论（2026-09-25）：已完成，S4.2 Authentication 全部闭环。** 新增 `LogoutDto` 与受 JwtAuthGuard 保护的 `POST /auth/logout`；新 Session-bound Access Token 直接以 JWT `sid` 定位当前 Session，旧 sid-less Access 可用当前 Refresh Token 作为迁移兜底。AuthService 事务行锁写 `revoked_at`；JwtStrategy 对 sid-bound Access 每次校验 Session active，因此 logout、设备撤销、Refresh replay/reuse detection 后，同 Session Access/Refresh 均立即 401。Web User Store 采用服务端先吊销、finally 清本地凭据；账号删除只做本地清理。Backend build、S4.1/S4.2 regressions 及 3015–3019 live smoke 全部通过，Web strict build 244 modules。详见 `docs/LOGOUT_REVOCATION.md`。

## S4.3 — 数据安全

- [x] 本地敏感数据分类（建立 L0 偏好 / L1 个人元数据 / L2 敏感内容与行为 / L3 Secret 四级基线；扫描 Web local/sessionStorage、Desktop DPAPI vault/诊断日志与本地文件写入；确认无 IndexedDB、本地 SQLite、密码缓存；识别 Canvas Notes/Todo/Folder Path、Global Search Recents、Installed App/Tool Usage、Profile Cache 等实际隐私数据，并记录“清除本地数据”覆盖不完整与 account/device scope 风险）
**S4.3 / 本地敏感数据分类结论（2026-09-25）：已完成。** 新增 `docs/LOCAL_DATA_SECURITY_CLASSIFICATION.md` 作为剩余 S4.3 的数据安全 SSOT。分类阶段曾发现 Browser Access Token=localStorage、Refresh Token=sessionStorage（L3，JavaScript-readable）；该缺口已由后续 Secret / Token 任务收敛为 Browser Access memory-only + Refresh HttpOnly Cookie。Desktop Access/Refresh 继续由 DPAPI Current User vault 保护。`flexikit-desktop-canvas-v2` 实际混合保存 Notes/Todo 用户文本、Folder 完整路径、Weather 城市与 monitor topology，因此整体按 L2 管理；Global Search Recent 保存 full path/name/detail/time，Installed App Usage 保存 launch target + count/time，Tool Usage 可能包含 URL/localPath + count/time，均为 L2 行为/路径数据；`flexikit-profiles` 含 email/displayName/avatar，为 L1。Desktop diagnostics 为明文轮转日志，常规事件低敏但 panic/runtime error 可能携带路径/错误上下文。当前未发现 IndexedDB 或 Desktop local SQLite。现有 DataManagement“清除本地数据”仅删主题/布局/Cookie，同名功能并未覆盖 profile、Canvas、search/app/tool usage 等；账号删除也仍保留部分 device-global 数据。该分类结果随后作为 Secret / Token、备份、隐私设置与数据删除任务的安全基线。

- [x] Secret / Token 加密存储（Windows Desktop 保持 DPAPI Current User vault；Browser Access Token 改为 memory-only，不再正常持久化 Web Storage；Browser Refresh Token 改为 HttpOnly + SameSite=Strict + Path=/ Cookie，生产 Secure；Cookie 模式用 X-FlexiKit-Auth-Mode 显式启用且 JSON 不返回 refresh_token；旧 Browser localStorage Access / sessionStorage Refresh 支持一次性迁移后删除；同标签 single-flight + Web Locks 串行化跨标签 Refresh rotation；logout/account delete 服务端清 Cookie；旧 body-token API/Desktop 契约保持兼容）
**S4.3 / Secret / Token 加密存储结论（2026-09-25）：已完成。** 新增 `docs/BROWSER_AUTH_STORAGE.md`、Backend `browser-refresh-cookie.ts` 与 Browser `browserCookieAuth.ts`。Browser Access Token 仅存在运行时内存；旧 `localStorage token` 首次 hydrate 后删除。Browser Refresh Token 由服务端写入 `flexikit_refresh_session` HttpOnly Cookie，`SameSite=Strict`、`Path=/`、生产环境 `Secure`，cookie mode 下 JSON 不再返回 `refresh_token`；localStorage 只保存非秘密的 Refresh Session expiry marker。Cookie 模式必须显式携带 `X-FlexiKit-Auth-Mode: browser-cookie`，Cookie 单独出现不会替代旧 body-token 协议；Axios 使用同标签 single-flight + Web Locks 串行化跨标签 rotation。Windows Desktop 继续使用 DPAPI Current User vault，旧 API/Desktop body Refresh 契约保持兼容。Backend/Web build 通过，Web strict build 245 modules；专用 regression 与 3020 PostgreSQL live smoke 验证 JSON 无 Refresh Secret、Cookie 安全属性、无 mode Cookie refresh=401、rotation 同 Session 换 secret、DB 无明文、logout/account delete 清 Cookie、logout 后旧 Access=401；3016 旧 body-token live smoke 继续通过。静态审计确认 Browser auth 代码没有 Access/Refresh Secret Web Storage 写入路径。

- [x] 数据备份（新增版本化 V1 本地加密备份：AES-GCM-256 + PBKDF2-SHA-256/250000 次；严格白名单覆盖主题/布局、工具缓存、Canvas、搜索最近项与使用历史等 L0–L2 数据；明确排除 Access/Refresh Secret、Refresh Session 元数据、DPAPI Vault、client instance、Cookie 同意与诊断日志；备份绑定稳定 user id，跨账号恢复拒绝；恢复前完整校验，白名单快照覆盖并在写失败时 best-effort 回滚；DataManagement 区分“服务器数据导出”与“本地加密备份”，旧 Home 工具导出改名避免冒充完整备份）
**S4.3 / 数据备份结论（2026-09-25）：已完成。** 新增 `apps/web/src/utils/localDataBackup.ts`、`apps/web/scripts/s4-local-backup-regression.mjs` 与 `docs/LOCAL_DATA_BACKUP.md`。V1 外层 envelope 与解密 payload 均显式带版本；本地 L0–L2 采用固定 allowlist，用户密码通过 PBKDF2-SHA-256 250,000 次派生 AES-GCM-256 密钥，随机 16-byte salt + 12-byte IV，密码只在运行时使用、不上传不保存。备份账号绑定稳定 user id，跨账号/未登录恢复被拒绝；恢复只操作 allowlist，当前认证/服务器数据不变，写失败执行 best-effort 回滚并拒绝伪成功。DataManagement 已新增创建/恢复 UI，并将原接口明确标注为“导出服务器数据”；Home 原 `flexikit_backup_*` 工具文件重命名为 `flexikit_tools_export_*`。回归验证覆盖加密 round-trip、错误密码、账号隔离、完整快照恢复和 L3/client identity/consent 排除；Web strict build 通过 246 modules。下一项进入“数据迁移版本管理”。

- [x] 数据迁移版本管理（新增 `flexikit-local-data-schema-version` 与集中迁移注册表；当前 schema v1，历史无 marker 视为 v0；启动前执行 v0→v1，将 Canvas v1 数组迁移为带 version/widgets/monitors 的 Canvas v2，合法 v2 优先且清除 stale v1；迁移幂等、未来版本拒绝、写失败 best-effort 回滚；备份 payload 增加 localDataSchemaVersion，旧 V1 备份缺字段按 v0 迁移后再恢复；Home 工具导入无版本 legacy→1.0，未来未知版本拒绝）
**S4.3 / 数据迁移版本管理结论（2026-09-25）：已完成。** 新增 `apps/web/src/migrations/localDataMigrations.ts`、`toolExportMigrations.ts`、`apps/web/scripts/s4-local-data-migration-regression.mjs` 与 `docs/LOCAL_DATA_MIGRATIONS.md`。应用在 Vue/Pinia/Store 创建前先执行本地 schema 迁移；当前 marker 为 `flexikit-local-data-schema-version=1`，历史无 marker 数据视为 v0。首个迁移把 `flexikit-desktop-canvas-v1` 收敛到严格 Canvas v2，合法 v2 永远优先于 stale v1，损坏 legacy/current 数据不会被猜测覆盖；未来 schema 高于当前版本会停止启动，避免旧版本应用破坏新数据。备份 V1 现在独立携带 `localDataSchemaVersion`，旧备份缺字段按 v0 经相同纯迁移器升级后再恢复；工具导入无版本历史文件兼容到 1.0，而未来未知版本明确拒绝。迁移与备份 regressions 全通过，覆盖幂等、未来版本保护、损坏数据保留、写失败回滚、旧备份和旧工具文件兼容；Web strict build 通过 247 modules。下一项进入“隐私设置”。

- [x] 隐私设置（新增设备级 `flexikit-privacy-preferences-v1`：搜索最近项、工具/应用使用历史个性化、资料本地缓存三项真实开关；默认保持既有行为，关闭后立即删除对应 L1/L2 数据并阻止后续读写；提供“清除已记录活动”但不改开关；隐私偏好不上传、不绑定账户、不进入加密备份；Canvas 用户主动保存内容不伪装成 tracking 开关；Browser Cookie 提示去除无实际效果的功能/分析 Cookie 选项并明确当前只使用必要 HttpOnly Refresh Cookie）
**S4.3 / 隐私设置结论（2026-09-26）：已完成。** 新增 `apps/web/src/privacy/privacyPreferences.ts`、`apps/web/scripts/s4-privacy-settings-regression.mjs` 与 `docs/PRIVACY_SETTINGS.md`。DataManagement 现提供“保留搜索最近项 / 使用历史个性化 / 缓存账户资料到本机”三项设备级设置；关闭搜索最近项会立即清除 Global Search recents，关闭使用历史会清除 Tool/Installed App usage 并使相关排序读取为空，关闭资料缓存会清除 `flexikit-profiles` 并阻止后续持久化。另提供独立“清除已记录活动”用于只删除搜索/工具/应用活动而不关闭未来记录。`flexikit-privacy-preferences-v1` 明确不上传服务器、不进入本地加密备份，避免恢复旧备份覆盖目标设备隐私选择。Canvas Notes/Todo/Folder 等属于用户主动保存内容，完整生命周期留给下一项。Web Cookie 提示已移除并不存在的功能/分析 Cookie 开关，隐私政策同步为当前必要 HttpOnly Refresh Cookie + localStorage 实际边界。privacy regression、local-backup regression 全通过，Web strict build 249 modules。下一项进入“数据导出 / 删除”。

- [x] 数据导出 / 删除（服务器导出采用 versioned 安全字段白名单；删除接口要求精确 DELETE 确认并以事务 + 用户行锁清理业务数据/Refresh Sessions、维护 surviving Tool 收藏计数；当前设备按 allowlist 清除自定义工具/Canvas/search/app/tool usage/profile/pet 数据并保留主题/布局/隐私偏好/client instance；Canvas 跨窗口 storage 事件阻止旧内容回写；其他设备本地副本需在对应设备单独清理）
**S4.3 / 数据导出 / 删除结论（2026-09-26）：已完成，Stage 4 全部闭环。** 新增 docs/DATA_EXPORT_DELETE.md、前后端 data-lifecycle regressions 与 3021 PostgreSQL/HTTP live smoke。真实链路验证安全导出、错误确认 400、精确 DELETE 200、User/Refresh Sessions 删除、旧 Access 401；Browser Cookie live smoke 继续验证删号清 Cookie。Web strict build 通过 250 modules，本地 backup/privacy/migration regressions 全绿。

## Stage 4 完成门槛

- 账号和本地数据生命周期明确
- Desktop 可长期升级
- 多端扩展不会推翻当前架构

---

# Stage 5 — AI 与智能化

## 目标

在稳定桌面底座上加入真正有价值的 AI，而不是堆聊天入口。

## S5.1 — AI Provider / Model Router

- [x] Provider 抽象
**S5.1 / Provider 抽象结论（2026-09-26）：已完成。** 新增 docs/AI_PROVIDER_ARCHITECTURE.md 与 backend/src/ai Provider-neutral 模块。Provider Registry 校验 provider/model 定义并拒绝重复注册；Model Router 提供确定性默认/显式路由和 NO_PROVIDER_AVAILABLE / PROVIDER_NOT_FOUND / MODEL_NOT_FOUND typed domain errors；AiService 统一 generateText 调度；GET /v1/ai/providers 受 JWT 保护。当前 Provider catalog 为空是有意行为，不冒充已经接入真实模型。Backend build、s5-ai-provider-regression、S4.1 type-audit 与 3022 HTTP mount smoke 全通过。下一项进入 OpenAI。
- [x] OpenAI
**S5.1 / OpenAI Provider 结论（2026-09-26）：已完成。** 新增 backend/src/ai/providers/openai.provider.ts 与注册器；采用 Responses API、store=false、GPT-6 Astra/Sol/Luna 模型目录和可配置默认模型。没有服务端 OPENAI_API_KEY 时 Provider 不注册，catalog 不冒充可用；配置存在时自动注册。上游错误不回传原始 body/message，HTTP-200 failed response 同样失败关闭。temperature 暂不映射到当前 GPT-6 Provider；模型能力标签现已明确区分 native 支持与 adapter 实现，超时、重试和 fallback 仍按 S5.1 后续任务处理。Backend build、OpenAI/Provider regression、type-audit 全绿；未执行真实外网 live，因为本轮没有用户凭据。
- [x] Gemini
**S5.1 / Gemini Provider 结论（2026-09-26）：已完成。** 新增 backend/src/ai/providers/gemini.provider.ts 与注册器；采用 v1beta models.generateContent REST、x-goog-api-key、store=false。默认 gemini-3.8-flash，同时暴露 gemini-3.5-flash / gemini-3.5-flash-lite；GEMINI_MODEL 可覆盖并自动纳入模型目录。system 消息映射 systemInstruction，assistant 历史映射 model role，temperature/maxOutputTokens 映射 generationConfig。promptFeedback blockReason 与 candidate SAFETY/PROHIBITED_CONTENT/BLOCKLIST/IMAGE_SAFETY 统一映射 content_filter；认证/限流/超时/5xx/非法响应均 typed + 脱敏。Backend build、Gemini/OpenAI/Provider regressions、type-audit 全绿；未执行真实外网 live，因为本轮没有用户凭据。
- [x] Claude / 其他 Provider
**S5.1 / Claude / Anthropic Provider 结论（2026-09-26）：已完成。** 新增 backend/src/ai/providers/anthropic.provider.ts 与注册器；使用官方 Claude Messages API、x-api-key 与 anthropic-version 2023-06-01。默认 claude-sonnet-5，目录同时包含 claude-opus-5 / claude-fable-5 / claude-haiku-4-5-20251001，ANTHROPIC_MODEL 可覆盖并自动纳入模型目录。system 消息提升为顶层 system，user/assistant 历史保留；maxOutputTokens → max_tokens，缺省为 4096。temperature 暂按 Provider 基线明确 UNSUPPORTED_PARAMETER，模型能力标签现已记录各 Claude 模型的 native sampling / thinking 差异；最终 assistant prefill 也在本地失败关闭；text block 聚合支持忽略 thinking 等非文本 block，end_turn/stop_sequence → stop、max_tokens/model_context_window_exceeded → length、refusal → content_filter。Backend build、Anthropic/OpenAI/Gemini/Provider regressions、type-audit 全绿；未执行真实外网 live，因为本轮没有用户凭据。
- [x] BYOK
**S5.1 / BYOK 结论（2026-09-26）：已完成。** OpenAI / Gemini / Anthropic 共用统一 BYOK 安全链路。Desktop Key 进入独立 Windows DPAPI Current User Vault，固定 Provider 槽位且密文原子落盘；Browser 只保存在页面运行期内存，刷新/关闭即失效。个人中心账户页可新增、覆盖和删除 Key，只展示已配置状态，不重新加载或回显原文。Backend AiByokProviderFactory 按请求创建临时 Provider，不修改全局 Registry，不写数据库，不把 Key 放进 catalog/结果；GET /v1/ai/byok/providers 仅暴露安全模型元数据。Windows DPAPI 4/4、Backend/Web build、BYOK backend/storage、OpenAI/Gemini/Anthropic/Provider regressions、type-audit、cargo fmt、cargo check --all-targets 均通过。S5.2 再把本地 Key 接入实际 AI 助手请求入口；商业 BYOK Entitlement 仍按 Stage 7 处理。
- [x] 模型能力标签
**S5.1 / 模型能力标签结论（2026-09-26）：已完成。** AiModelDefinition 新增完整 capability profile，并严格区分厂商 native 能力与 FlexiKit adapter 当前实现能力，避免把“模型支持”误展示成“当前产品已支持”。统一能力键为 textGeneration / vision / streaming / toolCalling / structuredOutput / reasoningControl / temperature / maxOutputTokens；native 使用 supported / conditional / unsupported / unknown，推理控制支持 effort / thinking-level / manual-budget。当前三家内置模型按官方资料建模；OPENAI_MODEL / GEMINI_MODEL / ANTHROPIC_MODEL 指向未内置模型时，native 全部 fail-safe 为 unknown。Registry 对缺失/非法能力、adapter=true 但 native=unsupported、重复推理控制等情况 typed fail-closed；普通 catalog 与 BYOK catalog 都深拷贝 nested capability metadata。Backend build、model-capabilities、Provider、OpenAI、Gemini、Anthropic、BYOK regressions、type-audit 全绿。
- [x] 成本 / Token 统计
**S5.1 / 成本 / Token 统计结论（2026-09-27）：已完成。** OpenAI Responses、Gemini generateContent、Anthropic Messages 已统一归一化 Provider-reported usage，不从 Prompt 文本推测 Token；ai_usage_events 仅落 Provider/模型、平台/BYOK billing mode、Token 明细和定价审计元数据，不保存 Prompt/Response/API Key。成本使用 2026-09-27 版本化官方价格目录和整数 pico-USD 精确计算，支持 OpenAI >272K 长上下文倍率、Gemini 3.8 Flash 促销价有效期、Anthropic cache-read 与 5m/1h cache-write；未知/自定义模型和过期价格 fail-closed 为 unpriced。BYOK 记录用户自付估算但不计入平台估算成本。Admin AI Usage & Cost 已切换为真实聚合。AddAiUsageAccounting + ExtendAiUsageAccountingAuditFields + AddAiUsageUserForeignKey 三个增量迁移均已落库（usage.user_id 在账号删除时 ON DELETE SET NULL），真实 PostgreSQL 事务写入/聚合/ROLLBACK 验证通过；Backend/Web build、三家 Provider、Provider/BYOK/能力标签、AI usage、Admin regressions 与 type-audit 全绿。下一执行项为“超时 / 重试 / fallback”。
- [x] 超时 / 重试 / fallback
**S5.1 / 超时 / 重试 / fallback 结论（2026-09-27）：已完成。** 新增 AiResiliencePolicy，默认单次 60s、总预算 90s、每 Provider 最多 3 次，500ms 起步指数退避（上限 4s）并加入 jitter；Retry-After 优先于本地退避。Provider contract 新增 AbortSignal，OpenAI/Gemini/Anthropic fetch 全部真实接收取消信号，超时统一归一化为 UPSTREAM_TIMEOUT。仅 RATE_LIMITED / UPSTREAM_TIMEOUT / UPSTREAM_UNAVAILABLE 可重试；认证失败、无效请求、不支持参数、无效响应、上游明确拒绝均立即失败。无显式 Provider/Model 的平台调用在当前 Provider 重试耗尽后才按 Registry 顺序 fallback；显式 Provider/Model 与 BYOK 永不跨供应商。OpenAI credit/spend/usage-limit 类 429 单独 fail-closed 为 UPSTREAM_REJECTED，不参与 retry/fallback。usage accounting 仅写最终成功结果一次。Backend build、OpenAI、resilience、Provider/Gemini/Anthropic/BYOK/model-capabilities/AI-usage/Admin 兼容回归均通过。

## S5.2 — AI 助手

- [x] 原生桌面 AI 助手
**S5.2 / 原生桌面 AI 助手结论（2026-09-27）：已完成。** Backend 新增 JWT 保护的 POST /v1/ai/assistant/generate 与严格 DTO，AiAssistantService 将单条用户消息交给既有 AiService，平台调用继续使用 S5.1 自动路由/重试/fallback/usage accounting，BYOK 必须显式 Provider 且 Key 仅作为请求级临时凭据。Desktop 新增 /assistant 页面、侧边栏入口、Provider/模型选择、平台/BYOK 切换和内存态消息 UI；不使用 localStorage/sessionStorage/IndexedDB 保存 Prompt/Response，也不从页面直接访问 Key。当前版本刻意不发送历史消息，因此刷新即清空且每次提问独立；下一项为“当前工具上下文”。Backend/Web build、S5.2 Backend/Web regressions、BYOK/resilience/type-audit 全通过。
- [x] 当前工具上下文
**S5.2 / 当前工具上下文结论（2026-09-27）：已完成。** 新增 runtime-only currentToolContext，只有 FlexiKit 成功打开 Tool 后才更新；统一覆盖中央 openDesktopTool、ToolCard 本地工具和 Pet 本地工具成功路径。上下文在 Assistant 页面可见且默认可手动关闭，不在本地持久化；对模型仅发送可验证白名单 id/name/category/kind/hostname，本地路径永不进入请求 DTO。Backend 使用嵌套 DTO 强校验并将 metadata 明确标记为 untrusted descriptive data，再与当前单条 user message 一起交给 AiService；不新增会话表、日志或 usage 内容字段。下一项为“当前文件上下文（用户授权）”。
- [x] 当前文件上下文（用户授权）
**S5.2 / 当前文件上下文结论（2026-09-27）：已完成。** Assistant 通过 Windows 原生 IFileOpenDialog 显式选择单个文件；Desktop 端在读取前执行文本扩展名白名单、文件类型、UTF-8、控制字符和 32 KiB 字节上限校验，仅向 WebView 返回 basename/extension/content，绝对路径不出 Tauri。Web 页面仅运行期内存持有内容，支持选择/更换/移除和逐次发送开关。Backend currentFile DTO 与 Service 再次白名单校验，文件正文作为 user-role 上下文，system guard 明确其为 untrusted user data；不持久化文件正文、路径、Prompt/Response。下一项为“Clipboard 按需上下文”。
- [x] Clipboard 按需上下文
**S5.2 / Clipboard 按需上下文结论（2026-09-27）：已完成。** Assistant 仅在用户点击“读取剪贴板”后调用现有 get_clipboard_text；不在 onMounted、focus、发送时自动读取，不做定时器或事件监听。读取结果仅保存在 Vue 运行期内存，16 KiB UTF-8 字节上限，可重新读取、移除和逐次关闭发送。Backend currentClipboard DTO/Service 双重限制内容与控制字符，Clipboard 正文保持 user-role，并以 system guard 标记为 untrusted user data；不持久化、不进入 usage ledger。下一项为“Prompt 历史隐私策略”。
- [x] Prompt 历史隐私策略
**S5.2 / Prompt 历史隐私策略结论（2026-09-27）：已完成。** 新增 ASSISTANT_HISTORY_POLICY，固定 mode=session-only、client/server persistence=disabled、retention=until-page-reload、attachmentRetention/backup=excluded，并明确 futureLocalPersistenceRequiresExplicitOptIn=true。Assistant 显示“仅本次会话”与手动清空按钮；DataManagement 同步披露当前策略。保留 flexikit-ai-prompt-history-v1 作为防御性清理键，privacy/activity/local-data lifecycle 会删除，local encrypted backup 明确排除。当前没有服务端 conversation/history 表，也没有 Prompt/Response 持久化。下一项为“快捷操作”。
- [x] 快捷操作
**S5.2 / 快捷操作结论（2026-09-27）：已完成。** 新增 ASSISTANT_QUICK_ACTIONS 本地静态模板；“总结上下文/排查问题”仅在已有且启用的用户授权上下文时可用，“拆解任务/优化表达”可直接使用。点击仅写入 composer 并聚焦，不调用 sendMessage、不读取新文件/Clipboard、不请求后端、不持久化或记录分析；用户仍需显式 Send。Web build、assistant regression、history privacy regression 全通过。S5.2 全部完成，下一执行项为 S5.3“用户行为事件”。

## S5.3 — 智能推荐

- [x] 用户行为事件
**S5.3 / 用户行为事件结论（2026-09-27）：已完成。** 新增 flexikit-recommendation-behavior-v1 本地事件账本；taxonomy=tool_open/favorite_add/favorite_remove；仅 toolId/type/timestamp；400 条上限 + 90 天读写淘汰；沿用 usagePersonalization，本地 only，不上传、不进服务器数据导出、不进加密备份；关闭个性化/清除活动/清除本地用户数据均删除。下一项“标签匹配”。
- [x] 标签匹配
**S5.3 / 标签匹配结论（2026-09-27）：已完成。** 本地 matcher 从 device-local behavior events + 当前 Tool catalog 构建 Tag/Category affinity，显式 event 权重与 feature clamp，稳定同分顺序；Discover 仅重排“为你推荐”候选，不触碰“热门排行”，也不上传行为或引入 recency/heat/random。下一项“热度排序”。
- [x] 热度排序
**S5.3 / 热度排序结论（2026-09-28）：已完成。** 新增 discovery-heat 统一公式：engagement 55 分（upvotes + comments×4，scale=5000）+ freshness 45 分（14 天半衰期），结果 clamp 0…100；TypeScript 计算与 PostgreSQL SQL 表达式共享同一常量语义。findAll(sort=hot)、recommendations、rankings 均动态排序，响应 hot_score 同步按当前时间重算；ingest 清洗负数/非法 upvotes/comments 并拒绝信任上游静态 hot_score。该信号仅使用公开服务端聚合数据，不读取本地个性化行为。Backend build、heat regression、type-audit 全通过；本地 PostgreSQL live smoke 因 Runner EACCES 未能建立连接，未执行 SQL、无数据库写入。下一项“Embedding Pipeline”。
- [x] Embedding Pipeline
**S5.3 / Embedding Pipeline 结论（2026-09-28）：已完成。** 公共 Tool catalog 使用 OpenAI text-embedding-3-small 1536 维真实 Embeddings；canonical source 做 NFKC/空白/Tag 稳定化并仅保留 web hostname，最大 8,000 UTF-8 bytes，用户私有 Tool、local_path、URL path/query、Prompt/文件/Clipboard/Key/本地行为均不进入外部请求。新增完整 provenance + source SHA-256 + timestamptz，旧不可验证 embedding 清空；stale 扫描只处理 user_id IS NULL，并正确显式选择 select:false 的 entity property provenance。批量最大 32、默认单次同步 100/硬上限 500，写入前 pessimistic lock + 重算 source hash 防止网络请求期间内容变化导致陈旧向量落库。Provider 响应严格验证 model、item count/index、1536 维有限值和 usage；Provider-reported embedding token 进入既有平台 AI usage/cost 账本。仅显式 embedding:sync 触发，不做隐藏启动同步。Backend build、embedding regression、AI usage regression、type-audit 全通过；Runner 无法连接 localhost:5433，本轮 migration:show/run 未执行。下一项“pgvector”。
- [x] pgvector
**S5.3 / pgvector 结论（2026-09-28）：已完成。** 新增 ToolVectorSearchService 作为纯底层检索原语：PostgreSQL 使用 <=> 做 cosine distance，SQL 同时计算 1-distance similarity；query vector 1536 维/有限值/幅值、limit 与 exclude ids 均先验证并参数化。候选只允许 user_id IS NULL + embedding 非空 + 当前 provider/model/dimensions/source-version provenance + source hash/updated-at 非空，并要求 embedding_updated_at >= updated_at 排除 stale vector；embedding/provenance 继续 select:false，不把候选向量带回应用层。当前采用 exact search，不加未经真实 EXPLAIN 验证的 HNSW/IVFFlat；后续若代表性语料和 DB latency 证明有需要，再评估 HNSW vector_cosine_ops。Backend build、pgvector regression、Embedding regression、type-audit 全通过。下一项“相似工具推荐”。
- [x] 相似工具推荐
**S5.3 / 相似工具推荐结论（2026-09-30）：已完成。** RecommendationsService 将用户最近最多 3 个公开收藏 Tool 作为语义种子，复用 ToolVectorSearchService 的 PostgreSQL pgvector exact cosine 检索；候选按最高 similarity、seed rank、candidate rank、Tool id 稳定合并去重，并排除全部当前收藏。单个 seed 向量不可用或语义结果不足时安全降级到 public popular Tool，同时继续排除收藏与已选结果；匿名/无收藏用户保持原公开热门 fallback。Discover 在“已登录 + 全部来源”时真正消费 /recommendations，再用 device-local 标签匹配做本地确定性重排；匿名或来源筛选继续使用原 Discovery 推荐，设备行为不上云。接口仍返回安全 Tool[]，不暴露 embedding/provenance/cosine internals。集成时同时恢复已完成的热度 UI fail-safe：接口失败仅显示明确的本地占位顺序，不再伪造 heat 数字。Backend/Web build、similar recommendations、pgvector、tag-matching、discovery-heat UI regressions 与 type-audit 全通过；未重复执行已知受 Runner localhost:5433 限制的 live DB 检查。下一项“推荐解释”。
- [x] 推荐解释
**S5.3 / 推荐解释结论（2026-10-03）：已完成。** RecommendationsService 复用同一候选生成路径并新增 explained 视图：semantic 结果只暴露 similar_favorite + seedToolName，公开 fallback 只暴露 popular；原始 similarity/cosine、embedding/provenance、内部 seed/candidate rank 均不进入 API。Discover 登录且来源=全部时使用 /recommendations/explained，再在本机将现有 tag/category matcher 的 strongest positive feature 转为“本机偏好匹配”文案并与服务端原因合并；设备行为事件仍完全留在客户端。ToolCard 仅在 discovery mode 显示单行解释，使用现有设计变量与省略样式，不制造数值置信度或伪热度。Web/Backend build、Web explanation、tag-matching、heat UI、Backend similar recommendation、pgvector、type-audit 门禁全通过。Stage 5 全部完成，下一项为 Stage 6“真实用户测试计划”。

## Stage 5 完成门槛

- AI 能实际降低用户操作成本
- Provider 可替换
- 成本可统计
- 隐私和授权边界明确

---

# Stage 6 — v0.5 公测与产品打磨

## 目标

用真实用户反馈验证产品价值和长期留存，而不是继续无限加功能。

## 任务

- [ ] 真实用户测试计划
- [ ] Crash / Error 收集
- [ ] 性能指标
- [ ] 启动时间
- [ ] 内存占用
- [ ] CPU 空闲占用
- [ ] Canvas 稳定性
- [ ] 关键操作耗时
- [ ] 新手引导
- [ ] 默认布局 A/B 调整
- [ ] 设置中心
- [ ] 反馈入口
- [ ] 自动更新稳定性
- [ ] 无障碍与键盘操作
- [ ] 高 DPI / 双屏 / 多屏覆盖

**临时产品打磨记录（2026-10-04）：Landing V2 已完成。** 首页从传统功能堆叠调整为“工具 + AI + Desktop Canvas 统一工作入口”的产品叙事，新增可交互 Workspace Preview、能力证明带与隐私边界表达，统一 Apple 风格玻璃层级/微交互/响应式，并清理已删除统计/技术栈区遗留样式。Web strict build 通过；此临时任务不改变 Stage 6 执行顺序，当前仍回到“真实用户测试计划”。

**临时桌面体验打磨记录（2026-10-04）：Canvas 拖动/缩放链路已优化并完成自动化回归。** Widget 指针移动改为像素级跟手 + `requestAnimationFrame` 合帧，20px 栅格仅在释放时吸附；交互期间暂停布局持久化调度，结束后统一保存，并移除拖动时几何放大以减少锚点漂移。后续继续补上 3px 拖动激活阈值，使纯点击只选中不触发吸附；拖动事件按 pointerId 隔离并处理 lostpointercapture，避免异常捕获/额外指针干扰；锁定态与选中缩放角点的视觉提示也已收敛。Web strict/desktop build、交互结构断言均通过，前序 Rust fmt/check/debug build、24/24 原生测试、本地数据/隐私/BYOK/AI Assistant 回归与 Debug 启动诊断保持通过。真实右键/框选、混合 DPI/双屏以及“桌宠→添加桌面组件”的完整鼠标链路仍按既有门禁保留人工实机回归。本临时任务不改变 Stage 6 执行顺序，当前仍回到“真实用户测试计划”。

**临时工作台响应式打磨记录（2026-10-05）：窄窗口 Navbar 覆盖问题已修复。** 根因是 Navbar 在 `<=860px` 已切换为多排布局，但 Home 页更高优先级的样式仍固定 `height: 50px`，导致第二排搜索/设置/登录溢出玻璃容器并压住 ToolCard。现为 Workspace 窄宽度明确设置两排自适应 Navbar：第一排 Logo/页面导航，第二排搜索/快捷操作/账号；Chromium 约 760px viewport 实测 Navbar height=96px，左右两排均完全落在 bottom=108px 的容器内，Workspace Header 从 y=128px 开始，首卡 y≈200.7px。Web build、结构回归、`git diff --check` 与 HTTP 200 全通过；Stage 6“真实用户测试计划”主线不变。

**临时工作台响应式打磨补充（2026-10-05）：窄窗口 Workspace Header 竖排挤压已修复。** 在约 620px 宽度时，Header 第一排的 flex 仍让标题与右侧操作竞争宽度，导致标题/说明被压成逐字换行。现 `<=860px` 将 Header Primary 切为单列 grid，标题/说明先占满可用宽度，Browser Companion 与工具数量独立下一行；`<=640px` 操作区两端分布。622px Chromium 实测 heading=584px、“全部工具”82.5×23.3px、说明 584×16.7px，操作区位于说明下方，首卡从 Header 结束后开始；Stage 6 主线不变。

**临时工作台响应式打磨补充（2026-10-05）：手机端已从“桌面压缩版”切换为独立工作区。** Home 在 `ui.isMobile` 时不再渲染 Sidebar；Navbar 隐藏桌面页签、主题和收藏冗余操作，保留品牌、搜索、设置、账号；移动 Workspace 自己提供标题/数量、横向分类、全部/网页/本地筛选和添加/整理/收藏快捷操作，Browser Companion 不进入手机首屏。`<=640px` 工具卡强制单列，`<=480px` 再收掉说明文案。Chromium phone probe 实测 500×748 CSS viewport 下无 Sidebar/浮动按钮/桌面 Header/扩展入口，分类条与筛选/快捷操作均完整，卡片 468×104px 单列且分类切换正常。Web build 283 modules、`git diff --check` 与运行态断言通过；Stage 6“真实用户测试计划”主线不变。

**临时工作台响应式打磨补充（2026-10-05）：手机端完成第二轮密度优化，桌面宠物明确保持不动。** 移除 `MY TOOLS` 与重复说明，分类在移动端映射为短标签并加横滑渐隐；类型筛选和快捷操作合并到同一行，Navbar 搜索/Logo/账号控件继续收薄，ToolCard 目标高度压到 96px。Chromium 实测 500×748 viewport 下 Navbar=78px、Mobile Header=119px、filter/actions 同高 34px 且同一行、ToolCard=468×96px、卡间距=8px；Git diff 仅涉及 Home/文档/错误日志，无 Pet 文件。Stage 6 主线不变。

**临时工作台响应式打磨补充（2026-10-05）：手机 Navbar 已改为单排。** `<=640px` 下不再让 nav-left/nav-right 各占整行，而是 `Logo | Search | Settings | Account` 同排：Logo 固定宽度，Search `minmax(72px,1fr)` 自适应，设置/账号固定右侧。Chromium 542px CSS viewport 实测 Navbar 高 48px、Search 宽 298.3px，四个区域均在同一行且未溢出。Stage 6 主线不变。
**临时工作台交互修复记录（2026-10-06）：工具卡拖拽排序链路已修复。** 根因是工具卡以 `<a>` 渲染时，浏览器原生链接/图片拖拽会抢占交互，最近移动端紧凑化后更容易表现为“拖不动/顺序不变”。现 ToolGrid 使用 Sortable fallback，并在父级统一禁用 `.tool-card` 原生 draggable/dragstart；ToolCard 同步禁用 WebKit user-drag 并阻止 native dragstart。排序结果从 `data-tool-name` 改为 `data-tool-key`，用 `tools.getToolKey()` 精确匹配，避免同名工具或筛选视图下顺序回跳。Web build、`git diff --check` 和结构回归通过；Chromium headless 可验证 Sortable start，但 end/swap 仍需真实鼠标实机确认。Stage 6 主线不变。

**临时桌面运行修复记录（2026-10-06）：点击工具卡后主窗口空白已定位并修复。** 真正根因不是 WebView2/DWM 首帧，而是 ToolCard 的 scoped CSS：`:global(html.tool-sort-active) .site-preview-popup` 在当前 Vue 编译结果中退化为 `html.tool-sort-active { display:none!important; }`。Sortable 一旦因点击抖动进入 start，整个 `<html>` 被隐藏；CDP 实测移除该 class 后 Body 立即从 0×0 恢复到 1432×1316。现完整 descendant selector 放入 `:global(...)`，Desktop ToolCard 不再渲染 `<a href target>`，fallbackTolerance=6px，并用 pointerup/pointercancel/blur 强制清理 sort state；之前临时加入的 Windows 1px surface refresh 已删除。真实 Tauri trusted click 回归通过。Stage 6 主线不变。

**临时桌面交互精修记录（2026-10-06）：工具卡拖拽已改为真正跟手。** 根因是 fallback clone 挂到 body 后一方面继续继承 ToolCard 正常态 280–300ms transform transition，导致每帧 transform 都被缓动，产生明显拖尾；另一方面脱离 workspace-grid 后丢失紧凑桌面样式，108px 卡片会变成 120px。现拖拽态关闭 transform transition/animation，并在 onStart 将 source 的实际 width/height、grid columns/rows、padding 与关键子元素计算样式同步到 body fallback；仍保留 fallbackOnBody=true 以保证坐标跟随。真实 Tauri trusted drag 实测 pointer error=0×0px、size error=0×0px、释放残留=0。Stage 6 主线不变。

**临时桌面视觉修复记录（2026-10-06）：Pet 在白色桌面背景下暴露矩形阴影框已修复。** Tauri pet window 本身已是 transparent=true/shadow=false，矩形感来自 aquarium 的外部 box-shadow 被透明 WebView 边界裁切。现移除 aquarium 外投影，对 Pet 根层显式关闭 box-shadow/outline，仅保留水舱 inset 高光与宠物轮廓 drop-shadow；构建产物确认 aquarium 只有 inset shadows，不再包含旧的 `0 12px 30px` 外投影。Stage 6 主线不变。

**临时桌面交互精修记录（2026-10-06）：Pet 仅优化原生拖动跟手，不增加吸附。** 原 native pointer loop 固定每 60ms 更新一次窗口位置，实际仅约 16.7 FPS，拖到屏幕顶部时尤其容易感到一格一格顿挫。现改为自适应轮询：dragging=8ms、按键/hover=16ms、expanded idle=24ms、普通 idle=40ms；同时用 `last_drag_target` 去重相同 `set_position`，anchor 只在位置写入成功后同步。结构回归明确无 snap/magnet 逻辑。Stage 6 主线不变。

## Stage 6 完成门槛

- 有真实用户连续使用数据
- 主要问题来自体验优化，而不是基础崩溃
- 核心功能方向得到验证

---

# Stage 7 — v0.8 商业化基础

## 目标

开始小规模收费测试，但不破坏 Free 核心体验。

详细策略以 `MONETIZATION.md` 为准。

## 任务

- [ ] Account / Subscription / License 数据模型
- [ ] Entitlement Service
- [ ] Feature Flags / Capability Keys
- [ ] Desktop 离线权益缓存
- [ ] 宽限期
- [ ] 设备管理
- [ ] 恢复购买
- [ ] Founder Pro
- [ ] 支付订单服务端校验
- [ ] 退款 / 撤销授权
- [ ] AI Credits
- [ ] AI 成本治理
- [ ] 小规模付费测试

## Stage 7 完成门槛

- 授权不会因为断网导致用户无法正常使用已购买本地功能
- 支付与权益状态可审计
- Free / Pro / AI Pro 边界稳定
- AI 成本可控

---

# Stage 8 — v1.0 正式发布

## 目标

达到可以长期公开销售和维护的正式产品状态。

## 发布门槛

- [ ] Windows 正式安装包
- [ ] 自动更新
- [ ] 完整回归
- [ ] 账号 / 授权 / 支付稳定
- [ ] 数据迁移稳定
- [ ] 隐私政策
- [ ] 用户协议
- [ ] 第三方许可证审查
- [ ] Crash / 日志体系
- [ ] 备份 / 恢复
- [ ] 官网 / 下载页
- [ ] 版本发布说明
- [ ] 客服 / 反馈流程
- [ ] v1.0 收费门槛检查

---

# 暂不进入主线的功能

以下内容可以记录想法，但当前阶段未到之前不主动开发：

- 团队空间
- 企业管理
- Mobile 深度功能
- macOS 正式版
- 高级自动化 Agent
- 大规模插件市场
- 云端文件管理
- 复杂协作系统

这些功能只有在前面阶段稳定后再重新评估。

---

# 阶段切换记录

| 日期 | 从 | 到 | 原因 |
| --- | --- | --- | --- |
| 2026-09-23 | 历史分散 Sprint | Stage 1 | 建立 MASTER_PLAN，统一后续执行主线 |
| 2026-09-23 | Stage 1 | Stage 2 | S1.8 / S1.9 全部通过，Desktop Canvas 稳定基线完成 |

---

# 每次继续项目时的标准入口

以后新的 ChatGPT / Codex / AI 会话接手 FlexiKit 时，第一步必须：

1. 阅读 `docs/MASTER_PLAN.md`
2. 阅读“当前执行指针”
3. 阅读当前阶段对应专项文档
4. 查看 Git 工作区，绝不清理已有未提交修改
5. 从“当前任务”的第一项未完成任务继续

**除非用户明确改变路线，否则不得跳过当前阶段。**
