# 更新日志

本文档记录 FlexiKit 所有重要版本的变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 安全修复
- 🔒 修复前端明文存储用户密码的严重安全问题
- 🔒 修复 `openTool` 和 `getLocalIcon` 方法的命令注入风险
- 🔒 增加 SSRF 防护，禁止 fetch 和爬虫访问内网 IP
- 🔒 移除登录页遗留的本地明文密码重置逻辑，未接入服务端重置流程前明确禁用自助重置
- 🔒 bcrypt salt rounds 从 10 提升到 12
- 🔒 增加文件路径白名单校验
- 🔒 移除公开 `POST /tools/:id/open` 后端程序启动接口，将本地工具启动迁移到 Tauri IPC；规范化路径并限制为 `.exe/.lnk/.url/.msi`

### 产品优化
- Windows gnullvm Desktop 调试版启动修复：对 EXE 导入表中的 `libunwind.whl` 缺失导致的系统错误 `0xC0000135` 做了根因定位，新增 `scripts/windows-gnullvm-build.ps1`，构建后自动把正确的 unwind 动态库别名拷贝至 EXE 同目录并 SHA-256 校验，同时检查 WebView2Loader.dll。测试版已恢复可启动，保留旧版快捷方式不被覆盖；当前主窗口采用 `transparent:false / shadow:false` 做缩放 A/B，动态黑白闪块终验尚未完成。
- Stage 6 本地诊断：增加隐私保护的 Desktop 错误分类计数，Rust panic 只记录源文件名/行列、OS 错误原文不再落盘，JS/Promise/Vue 错误只登记固定类别并有限流；设置页新增用户主动触发的“复制诊断摘要”，内容仅含版本、平台和事件次数，不上传原始日志或敏感信息。升级前历史日志不被擅自删除，摘要始终不输出旧日志详情。
- Desktop 主窗口缩放重绘稳定性：修复拖动窗口边框时 WebView2 更新慢于原生窗口造成右侧黑白露底的风险。主窗口 native/WebView2 背景与用户主题色保持一致；连续缩放暂时降低大面积 blur、毛玻璃与阴影合成成本，160ms 空闲自动恢复原设计；Pet 和 Desktop Canvas 的透明窗口完全不参与。已重编启动新 EXE，连续手动拖拽的视觉终验仍保留。
- Desktop 工作台新增“添加本地工具”专用流程：不再把“向全部工具列表拖文件”作为入口；工作台明确区分“添加本地工具 / 添加网页工具”。本地入口打开独立原生风格弹窗，可把 `.exe/.lnk/.url/.msi` 拖到指定区域，或通过 Windows 文件选择器选择启动程序；自动读取规范化路径、文件名和 Shell 程序图标，支持修改名称/分类、重复检测，以及多文件逐个确认。首轮拖放无反应已定位为 Tauri `event.listen` 权限缺失；现仅为 `main` 窗口开放 `core:event:default`，改用 `Window.onDragDropEvent`，并按窗口 `scaleFactor()` 处理 Windows DPI 坐标后只允许 drop zone 接收。用户已实机确认拖放与添加成功。继续修复本地工具图标持久化/渲染：真实 Shell 图标优先于固定本地占位图，后端重载后也保留自定义图标；导入时自动生成可编辑描述和标签，多文件拖入会在 drop zone 内显示最多 8 个程序图标与名称及额外数量。通用“添加工具”新增模式中的“本地应用”页签也已统一跳转到专用本地导入器，Home/Discover 不再保留另一套新增本地工具体验。Web 端不启用本地文件拖放，现有工具排序交互不受影响。
- 新增网页工具改为极简智能导入：工作台、Sidebar 与移动端新增入口不再先要求填写名称/描述/标签/分类，而是只需粘贴网址；自动补全协议、读取网站预览、生成 favicon/名称/描述/分类/标签并显示确认卡，网络不可用时使用域名与本地关键词规则继续生成。高级字段统一放入默认折叠的“自定义名称、描述、标签等”，同时保留自定义图标和卡片颜色；重复网址直接阻止添加。自定义网页工具没有固定图标时不再写入通用 `DEF_ICON`，避免挡住 favicon fallback。
- Desktop 离线体验改为真正的应用内降级：正式 Tauri 始终从本地 `frontendDist` 加载 App Shell，断网、API 网络失败或服务 5xx 不再把用户带到浏览器式错误体验；Titlebar 仅显示低干扰“离线模式 / 服务离线”，Discover 继续使用本地 Tool catalog 并提供“重试连接”，Login 与 AI Assistant 在原页面内提示联网能力不可用。本地工作台、工具、设置、桌宠、Desktop Canvas 与本地数据继续可用；同时修复认证刷新在网络故障时误清本地会话的问题，只有明确 401/403 或 Refresh 本地过期才失效凭据。
- Desktop 侧边栏视觉与窗口拖动优化：保持原 260px 宽度，Logo 收至 42px，主导航改为更轻的系统侧栏列表；“工作台 / 全部工具”保留明确层级但移除厚重玻璃块与外阴影，当前项改为柔和主色底 + 2px 左侧指示，发现/AI/桌面画布降一级；搜索、工具栏、类型筛选和分类同步收轻。Sidebar 品牌区与顶部 Titlebar 均使用显式 `mousedown -> start_main_window_drag`，并统一忽略双击第二次 mousedown、阻止默认文本选择；Titlebar 阴影/间距进一步收轻，遗留 `ease` 过渡统一为 300ms Apple 曲线。Windows 后端继续使用系统原生 `ReleaseCapture + WM_NCLBUTTONDOWN(HTCAPTION)` 接管拖动，解决 Tauri `WebviewWindow::start_dragging()` 返回成功但实际窗口不移动的问题。
- Desktop 工作台主导航强化：撤回 Dashboard 188px compact sidebar，工作台与工具库均恢复原 260px 侧栏宽度与完整信息密度；保留“工作台 / 全部工具”44px 高主入口卡片、独立图标底、左侧 active 指示条和更强选中背景，让两项入口更容易发现。
- `/app` 默认升级为轻量工作台首页：公开 Landing 保持不变；工作台直接读取现有工具使用记录、收藏、自定义工具与分类统计，提供“最近使用 / 收藏 / 快速进入 / 最近添加”以及添加工具、全部工具、发现等快捷入口。原完整工具库保留在 `/app?view=library`，搜索、分类、收藏筛选会自动进入工具库；Desktop Sidebar 同步拆分“工作台 / 全部工具”。
- Desktop Pet 原生拖动跟手优化：不增加任何顶部/边缘吸附；Windows 指针循环由固定 60ms（约 16.7 FPS）改为自适应刷新，拖动中 8ms、交互附近 16ms、展开空闲 24ms、普通空闲 40ms；仅当目标位置实际变化时调用 `set_position`，并让 anchor 只在成功移动后同步，减少重复窗口写入、抖动与合成压力。
- Desktop Pet 白底矩形阴影框修复：Pet Tauri window 保持 `transparent:true / shadow:false`；移除 `.pet-aquarium` 的 `0 12px 30px` 外投影，并对 `html/body/#app/.pet-page/.pet-stage` 明确关闭 box-shadow/outline，只保留水舱内部 inset 高光和宠物本体轮廓阴影，避免透明窗口在白色桌面背景上暴露矩形边界。
- Desktop ToolCard 拖拽跟手优化：拖拽副本不再继承卡片正常态的 280–300ms transform transition，避免副本“追着鼠标跑”；继续使用 body fallback 保证指针坐标稳定，并在拖拽启动时同步原卡片实际宽高、grid columns/rows、padding、圆角、字体及关键子元素布局到 fallback clone，解决副本从 108px 变成 120px、视觉尺寸变化的问题。真实 Tauri trusted drag 回归：指针误差 0×0px、尺寸误差 0×0px、columns 亚像素误差 0.012px、松手残留 0。
- Desktop 工具卡点击后空白修复：真实根因是 ToolCard scoped CSS 中 `:global(html.tool-sort-active) .site-preview-popup` 被 Vue 编译成了 `html.tool-sort-active { display:none!important; }`；单击时轻微指针位移若触发 Sortable start，就会把整个 `<html>` 隐藏。现将完整后代 selector 放入 `:global(...)`，Desktop runtime 工具卡改为非 `<a>` 容器、仅走 Tauri 外部打开；Sortable 启动容差提升到 6px，并在 pointerup/pointercancel/blur 强制清理拖拽状态。前序临时 Windows 1px surface refresh 方案已撤回。
- Desktop Launcher 拖拽排序同步 Web 修复：整理模式继续使用 Sortable fallback + data-tool-key 持久化，并新增网格级 dragstart capture prevent、初始化时对 shell/button/img 强制 draggable=false、应用图标显式关闭 native drag 与 -webkit-user-drag，避免 Windows WebView/Chromium 把图标或内容当原生拖拽对象抢占排序。
- 工具卡拖拽排序修复：工具卡是 `<a>` 时浏览器会优先触发原生链接/图片拖拽，导致 Sortable 排序无法稳定接管。现在 ToolGrid 强制使用 Sortable fallback，并在父级禁用 `.tool-card` 原生 dragstart；ToolCard 同步禁用 native draggable 与 WebKit user-drag。排序结果改用 `data-tool-key` / `tools.getToolKey()` 匹配，避免同名工具或筛选视图下顺序回跳。
- `/app` 手机 Navbar 单行化：`<=640px` 下改为 `FlexiKit | 搜索 | 设置 | 登录` 单排布局，Logo 固定左侧，搜索自适应占满剩余空间，设置与账号固定右侧；不再使用品牌一排、搜索操作一排的两层结构。
- `/app` 手机工作台独立布局：移动端不再渲染桌面 Sidebar/悬浮折叠按钮和 Browser Companion 入口；顶部 Navbar 隐藏“首页/发现/产品介绍”以及主题/收藏冗余按钮，只保留品牌、搜索、设置和账号。Workspace 新增移动端标题/数量、横向分类标签、网页/本地筛选、添加/整理/收藏快捷操作；`<=640px` 工具卡强制单列，`<=480px` 隐藏非必要说明文字，避免桌面结构被硬压缩。
- `/app` 手机工作台二次精修：保持桌面宠物尺寸/位置/行为完全不变；移除 `MY TOOLS` 与重复说明文案，分类在手机端使用“全部/系统/开发/科研/文档/制图/AI”短标签并增加右侧渐隐提示；全部/网页/本地筛选与添加/整理/收藏合并为同一行，Navbar 进一步收薄，单列 ToolCard 压至实际 96px 高、8px 间距。
- 窄窗口 Navbar 响应式修复：解决 `/app` 在约 760–860px 宽度下导航已经换成两排、但 Home 高优先级样式仍把容器锁死为 50px，导致搜索/设置/登录第二排溢出并覆盖工具卡片的问题；现在两排导航高度自适应，第一排为 Logo/页面导航，第二排为搜索/快捷操作/账号区，并提高窄宽度玻璃背景的遮罩与层级完整性。
- 窄窗口 Workspace Header 修复：解决约 620px 宽度下“浏览器扩展 / 工具数量”操作区与标题仍处于同一横向 flex，导致“全部工具”和说明文字被压成逐字竖排的问题；`<=860px` 现在改为标题/说明占满一整行、操作区独立下一行，`<=640px` 再将两侧操作均匀分布，工具卡从 Header 完整结束后开始。
- 侧边栏收起分类导航调整为独立第二排：第一排仅保留 Workspace 标题/说明与右侧“浏览器扩展 + 工具数量”，分类标签在其下方单独占满一整行；保留横向滚动、颜色点、数量、选中态与点击切换。
- 侧边栏收起后的分类导航补全：首页在 `sidebarCollapsed` 且非移动端时，将侧边栏分类自动迁移到 Workspace 标题栏中部，复用原分类顺序、颜色点和数量；支持横向滚动、当前项高亮和点击切换，侧栏展开时自动隐藏，避免重复。
- 工作台侧栏与主内容增加明确呼吸区：桌面端间距改为 16–20px 自适应，移动端 12px，解决侧栏右边缘与导航/工具网格几乎贴合的问题，同时保持全宽布局与大屏多列工具网格。
- 工作台外层宽度根因修复：`#app` 为横向 flex，但 App.vue 路由 wrapper 原先无宽度/无 flex-grow，导致 1753px 可用宽度下 `.app-layout` 仅 1035.6px、主内容仅 715.6px。现新增 `app-window-content` 并设为 `width:100%; min-width:0; flex:1 1 auto`；Chrome DevTools 实测修复后 `.app-layout` 1753px、主内容 1433px、工具网格 1429px，并从 3 列提升为 6 列。
- 工作台去空白与紧凑化：修复 Home 仍通过 `--grid-columns` 继承固定 4 列设置，导致大屏右侧长期留白的问题；首页改为真正 auto-fit 自适应网格，最小列宽约 210px，并将工具卡从约 158px 高的大块卡片压缩为约 108px 的紧凑横向工具单元，最多展示 3 个标签，减少大面积玻璃块占用。
- 工作台 UI 系统重构：基于真实 /app 使用截图重新梳理整体信息密度与视觉层级。Home 工作台改为全宽自适应，顶部导航压缩为 50px 轻量玻璃条，标题区改为标题/空间标签 + 次级说明两层结构；工具网格提升到 240px 最小列宽的自适应 4–6 列，卡片统一为更中性的轻玻璃表面，工具自定义颜色仅保留弱光晕，不再整卡泛蓝；卡片高度、图标、标签、收藏/操作按钮同步收紧，并补齐 1120/860/560px 响应式与 reduced-motion。
- Browser Companion 首页入口收紧：将原全宽安装卡移入“全部工具”标题栏右侧，改为 34px 高紧凑胶囊入口；桌面显示图标、文字与状态点，窄屏仅保留图标；安装面板与 Chrome/Edge 引导保持不变，不再占用工具网格上方整行空间。
- ✨ 落地页 V2：重构 Hero、产品工作台预览、能力证明带、核心能力、隐私设计与 CTA 叙事；导航与按钮交互统一 Apple 曲线，补齐移动端布局和 prefers-reduced-motion；删除旧统计/技术栈/预览反馈死样式，保持轻量且不改变业务路由。
- 🖱️ Desktop Canvas 拖动/缩放手感优化：指针过程改为像素级跟手 + RAF 合帧，20px 栅格仅在释放后吸附；交互期间暂停布局持久化调度并在结束后统一保存，移除拖动时 scale 放大；新增 3px 激活阈值，纯点击只选中不吸附，按 pointerId 隔离当前拖动并处理 lostpointercapture；锁定态光标和选中角点缩放手柄也更明确。

### 新增
- 🌐 Browser Companion v0.2.0：从全站常驻注入原型升级为工具栏 Popup 主工作流；仅在用户点击时通过 activeTab/scripting 读取当前页元数据，支持独立 extension 登录会话与自动 Refresh、API 主机显式授权、URL tracking 清理与服务端双层去重、标签推荐/分类建议、设置/连接检测/退出、正式图标与 Chrome/Edge Manifest V3 构建。Backend 同步支持 extension client type、Browser Companion 设备会话展示和安全扩展 Origin CORS 策略；Chrome/Edge pack-extension 校验通过，商店上架仍需正式扩展 ID 与审核资料。
- 💬 原生桌面 AI 助手 V1：Desktop 新增 /assistant 与侧边栏入口，支持平台自动路由/显式 Provider/Model 和 OpenAI/Gemini/Anthropic BYOK；新增 JWT POST /v1/ai/assistant/generate，继续复用 S5.1 usage/retry/fallback。BYOK Key 仅在发送瞬间从 DPAPI Vault/浏览器运行期内存读取并作为单次请求临时传递，Prompt/Response 不入 usage ledger/数据库；当前页面消息仅 Vue 内存保存，刷新即清空。
- 🧩 AI 当前工具上下文：成功打开 FlexiKit Tool 后仅在运行期内存记录安全元数据，Assistant 发送前可见并可关闭；仅传 id/name/category/web|local/hostname，不传本地路径。Backend 嵌套 DTO 强校验并把工具字段作为不可信描述数据注入，继续不持久化 Prompt/Response/context。
- 📄 AI 当前文件上下文：Assistant 新增用户显式文件选择、更换、移除和逐次发送开关；Windows 原生 IFileOpenDialog 仅读取用户刚选中的单个 UTF-8 文本文件，32 KiB 字节上限且不向 WebView/Backend暴露绝对路径。Backend 对 basename/extension/content 再校验，正文保持 user-role 并加 untrusted-data guard，文件/Prompt/Response 继续不持久化。
- 📋 AI Clipboard 按需上下文：Assistant 只有用户点击读取按钮才访问系统剪贴板，不后台轮询/监听；16 KiB UTF-8 字节限制，内容仅页面内存保存，可重新读取/移除/逐次关闭。Backend 再校验并将正文保持 user-role + untrusted-data guard，Clipboard 内容不进入持久化、日志或 usage ledger。
- 🔒 AI Prompt 历史隐私策略：默认固定“仅本次会话”，刷新/关闭即清空，客户端/服务端持久化均关闭；Assistant 与数据管理页显式披露并支持手动清空。工具/文件/Clipboard 上下文不进入历史，本地加密备份排除 AI Prompt 历史；任何未来本机历史必须先提供独立显式授权。
- ⚡ AI 快捷操作：新增“总结上下文 / 排查问题 / 拆解任务 / 优化表达”四个本地静态模板；上下文型按钮仅在已有授权上下文时可用。点击只填入输入框并聚焦，用户仍需显式发送，不会读取新文件/剪贴板、自动发请求、保存 Prompt 历史或记录快捷操作分析。
- 🧭 本地推荐行为事件：复用“使用历史个性化”开关，记录 tool_open / favorite_add / favorite_remove 三类最小事件；每条只有 toolId/type/timestamp，当前设备最多 400 条并在读/写时淘汰 90 天前数据。事件不上传 Backend、不进入服务器导出或加密本地备份，关闭个性化/清除活动会删除。
- 🏷️ 本地标签匹配：基于设备内行为事件与当前 Tool catalog 计算 Tag/Category affinity，对 Discover“为你推荐”候选做确定性重排；收藏信号高于打开信号，取消收藏抵消收藏偏好，单特征限幅且同分保持原顺序。热门排行/热度、Embedding/pgvector 尚未混入该分数。
- 🔥 Discovery 动态热度排序：统一以公开 upvotes/comments 与发现时间计算 0…100 热度，engagement/freshness 分别占 55/45 分、freshness 14 天半衰期；热门列表、推荐接口和排行榜均按 PostgreSQL 动态公式排序，返回值再以同一 TypeScript 公式重算。爬虫上游 hot_score 不再被信任，负数/非法聚合量会清洗；该层不读取本地用户行为。
- 🧠 Tool Embedding Pipeline：公共 Tool catalog 接入 OpenAI text-embedding-3-small 1536 维 Embeddings；规范化输入仅含工具公开语义与 web hostname，不发送用户私有 Tool/local_path/URL path/query/Prompt/文件/Clipboard/Key。新增 provenance/source hash、并发变更保护、显式批量 backfill 与 Provider usage/成本记账；不在启动或用户 Tool CRUD 中自动调用外部 Provider，pgvector 检索/索引继续留到下一任务。
- 🔎 pgvector 精确检索底座：新增 ToolVectorSearchService，使用 PostgreSQL <=> 完成 cosine distance/similarity，不在 JS 内循环算向量；候选严格过滤 public Tool、当前 embedding provenance 和 stale timestamp，vector/exclusion/limit 全部受限并参数化。当前不盲目增加 HNSW/IVFFlat，等真实数据库 EXPLAIN/latency 证明 exact search 成为瓶颈后再评估 ANN。
- 🧭 相似工具推荐：登录用户以最近公开收藏作为 semantic seeds，通过 pgvector exact cosine 合并相似公共 Tool，排除全部已收藏并在向量缺失/结果不足时用公开热门安全补齐；Discover“全部来源”正式消费该推荐，再叠加设备内标签偏好重排。匿名/来源筛选保留原 Discovery 推荐，服务端不接收本地行为，也不向客户端暴露 embedding/provenance/similarity。
- 💡 推荐解释：新增 /recommendations/explained 安全解释视图，语义推荐仅显示“与你收藏的某工具相似”，fallback 明示“基于公开热度补充推荐”；Discover 再在设备端合并最强 Tag/Category 偏好原因。ToolCard 只在推荐卡片展示低干扰单行文案，不暴露向量、cosine/similarity、内部排名、完整本地行为或伪造置信度。
- 🛡️ AI 调用韧性层：AiService 增加 AbortController 真取消、单次/总预算、瞬时错误有限重试、Retry-After、指数退避+jitter 与 deterministic fallback。只有未显式指定 Provider/Model 的平台调用允许跨 Provider fallback；显式路由和 BYOK 保持供应商边界。OpenAI 额度/消费上限类 429 不重试、不 fallback；失败尝试不重复写 Token/成本账本，只有最终成功结果计一次 usage。
- 💰 AI Token / 成本账本：OpenAI、Gemini、Anthropic 统一采集 Provider-reported usage，PostgreSQL 新增 ai_usage_events 安全运营账本；平台 Key 与 BYOK 分账，使用版本化官方价格目录 + pico-USD 整数计算，支持长上下文/缓存/推理 Token 口径，未知模型与过期价格保持 unpriced，不从 Prompt 字符数猜 Token/成本。Admin AI Usage & Cost 已接入真实聚合。
- 🛡️ Admin Console V1：在 Overview / Users / AI Usage & Cost 基础上完成持久管理员角色、账号状态、账号暂停/恢复、管理员角色管理、append-only 管理审计和高风险账号删除；AI Usage 现展示真实 Provider Token、平台/BYOK 分账、成本估算与 Provider/模型拆分。Admin API/usage ledger 均继续排除密码哈希、Token/Hash、BYOK Key、Prompt、Response 与本地内容。
- 🏷️ AI 模型能力标签落地：Provider model metadata 新增 native / adapter 双层 capability profile，覆盖文本、视觉、流式、工具调用、结构化输出、推理控制、temperature 与 maxOutputTokens；GPT-6、Gemini 3.x、Claude 5 / Haiku 4.5 按官方能力基线标注，自定义模型原生能力保守标 unknown；Registry 严格校验并对普通/BYOK catalog 深拷贝 nested metadata，避免 UI/Router 把厂商原生能力误当作 FlexiKit 已实现能力。
- 🔐 BYOK 安全底座落地：OpenAI / Gemini / Anthropic 用户 Key 在 Windows Desktop 使用独立 DPAPI Current User Vault，Browser 仅运行期内存；个人中心账户页支持安全新增/覆盖/删除并只显示配置状态，不回显原文。Backend 按单次请求创建临时 Provider，不写数据库、不修改全局 Registry、不在 catalog/结果中泄露 Key；Windows DPAPI 真机回归验证密文文件不含明文凭据。
- 🧠 Claude / Anthropic Provider 正式接入：Backend 新增官方 Messages API adapter 与环境配置注册器；默认 Claude Sonnet 5，并兼容 Opus 5 / Fable 5 / Haiku 4.5；system、对话历史、max_tokens 与 stop reason 映射到统一 Provider contract，服务端使用 x-api-key + anthropic-version；temperature 与最终 assistant prefill 在当前基线明确失败关闭；本轮仅使用 mock transport 回归，未提交真实凭据、未伪造外网 live 结果
- ✨ Gemini Provider 正式接入：Backend 新增 Google Gemini generateContent adapter 与环境配置注册器；默认 Gemini 3.8 Flash，并兼容 3.5 Flash / Flash-Lite；system 指令、对话历史、temperature/maxOutputTokens 与内容过滤均映射到统一 Provider contract，使用 x-goog-api-key 且 store=false；本轮仅使用 mock transport 回归，未提交真实凭据、未伪造外网 live 结果
- 🤖 OpenAI Provider 正式接入：Backend 新增 Responses API adapter 与环境配置注册器；当前目录支持 GPT-6 Astra/Sol/Luna，默认 Sol，服务端无 OPENAI_API_KEY 时不注册；所有请求 store=false，raw Responses 输出安全聚合，常见上游失败统一脱敏为 Provider domain error；本轮使用 mock transport 完成回归，未提交任何真实凭据、未伪造外网 live 结果
- 🧹 WebCodex hygiene 误报修复：将未跟踪认证源码/回归脚本/安全文档中会触发 secret-like path 检测的 token/secret 文件名统一收敛为 session/auth/vault 命名，并同步 NestJS、Rust、package scripts 与文档引用；不改变认证协议、Token 字段或存储安全边界。高风险 hygiene findings 从 14 降为 0。
- 🧠 AI Provider 抽象基线：Backend 新增统一 Provider contract、Registry、Model Router、AiService/AiController/AiModule；Provider/Model 元数据严格校验并失败关闭，Provider catalog 接口要求登录；当前不注册任何真实模型、不保存 API Key、不发起外部 AI 网络请求，为后续 OpenAI/Gemini/Claude/BYOK 保持同一上游契约
- 🧾 数据导出 / 删除生命周期闭环：服务器导出使用 versioned 安全字段白名单并排除密码哈希、Token/Hash、Embedding；账户删除要求精确 DELETE 确认并在单事务内清理业务数据与 Refresh Sessions、维护收藏计数；DataManagement 新增当前设备本地用户数据清理并防止已打开 Canvas 把旧便签/路径回写，Profile 原模拟注销入口改为真实数据管理流程


- 🛡️ 隐私设置落地：DataManagement 新增搜索最近项、Tool/App 使用历史个性化、资料本地缓存三项设备级真实开关，关闭即清理已有数据并阻止后续读写；支持单独清除活动，隐私偏好不上传/不备份；Cookie 提示移除无实际行为的功能/分析开关并明确当前仅使用必要 HttpOnly Refresh Cookie
- 🧬 本地数据迁移版本管理落地：新增 pre-mount schema registry 与 `flexikit-local-data-schema-version` v1，Canvas v1→v2 从 Store fallback 收敛为统一幂等迁移；未来 schema 拒绝降级覆盖，写失败回滚；备份增加 `localDataSchemaVersion` 并兼容旧 V1，工具导入 legacy→1.0 且未来未知版本拒绝
- 💾 本地加密备份落地：DataManagement 新增 AES-GCM-256 + PBKDF2-SHA-256 密码备份/恢复，V1 使用严格 L0–L2 allowlist、稳定 user-id 账号绑定与恢复回滚，明确排除 Token/Session/DPAPI/client identity/consent/diagnostics；服务器数据导出与本地备份正式分流，旧 Home 工具文件改名为 `flexikit_tools_export_*`
- 🍪 Browser Secret 存储收敛：Access Token 改为仅运行时内存，Refresh Token 改为 HttpOnly + SameSite=Strict Cookie（生产 Secure），JSON 不再向 Browser cookie mode 暴露 Refresh Secret；旧 Web Storage Token 一次性迁移后清除，Desktop DPAPI 与旧 API body-token 契约保持兼容
- 🧭 完成本地敏感数据分类：建立 L0–L3 数据等级并审计 Web/Desktop 真实持久化点；识别 Canvas 便签/待办/文件夹路径、搜索最近项、应用/工具使用轨迹、资料缓存与诊断日志等隐私边界，同时确认当前“清除本地数据”覆盖并不完整
- 🚪 服务端登出与即时 Session 吊销落地：新增受保护 `POST /auth/logout`，sid-bound Access 每次请求校验 Session active；logout、设备撤销或 Refresh replay 后同 Session 已签发 Access/Refresh 均立即 401，客户端退出采用服务端先吊销、本地 finally 清理
- 🖥️ 登录设备管理落地：Access JWT 绑定 Session `sid`，个人中心可查看当前有效登录 Session、识别当前设备并撤销其他 Session；服务端只返回安全元数据且禁止误撤当前会话，真实 PostgreSQL 回归覆盖 Refresh 失效与会话隔离
- 💻 多端登录 Session 策略落地：Web/Desktop/未来 Mobile 每次登录建立独立 Refresh Session，不互相隐式踢下线；Session 记录客户端类型、随机实例 UUID 和显示名，Auth 响应返回稳定 session_id，旧客户端保持 unknown/null 兼容
- 🗝️ Windows Desktop Token 安全存储落地：Access/Refresh Token 改由 Tauri 原生 DPAPI Current User Vault 保存，固定槽位、磁盘仅密文、原子文件替换；旧 Desktop Web Storage Token 首次启动自动迁移并清除，浏览器存储策略保持独立
- 🔄 Refresh Token 正式落地：新增 `refresh_sessions` 迁移与 opaque rotating token，会话 secret 仅存 SHA-256；轮换使用事务行锁，旧 Token 重放会撤销整条 Session；Web 采用 sessionStorage + Axios 单飞续期，账号删除自动级联清理会话
- 🔐 Access Token 生命周期正式化：默认 TTL 从历史 7d 基线收敛为新部署 30m，签发返回 Bearer/expires_in/expires_at 并标记 `token_use=access`；Web 在初始化、请求前、定时器与窗口 focus 主动处理过期，同时保留旧 JWT 迁移兼容与服务器 401 兜底
- 🔢 API Versioning V1 正式落地：Backend 支持 `/v1/*` 并暂留无版本兼容别名；Web/Desktop Client 默认切到 V1，直连 favicon 等资源 URL 同步版本化；V1 兼容性演进与未来 V2 破坏性变更边界已形成正式规范
- 🪵 Backend 增加统一 HTTP 请求/错误关联日志：安全 `X-Request-Id`、结构化耗时/状态日志、4xx/5xx 错误关联、IP 脱敏与 User-Agent 清洗；HTTP 日志明确不记录 body、query、Authorization 或 Cookie，并增加日志回归与真实 HTTP 烟测
- 🧹 Backend Controller / Service 类型治理：统一认证 Request 类型、Discovery Query DTO、RSS/V2EX 外部数据结构与运行时 guard，清除 Controller/Service 显式 `any` 和未类型化 Request/Query；新增 `test:type-audit` 防回归门禁
- 📦 Backend JSON 成功响应统一为 `{ code: 0, message: 'success', data }`，通过全局 Interceptor 自动包装；Web 唯一 Axios Client 自动解包保持现有业务调用兼容，并为 favicon 等原始二进制响应增加显式 `@RawResponse()` 边界与响应回归
- 🧱 Backend 建立统一错误处理契约：所有 JSON API HttpException 获得稳定 machine `code`，Validation 统一输出 `VALIDATION_ERROR + details[]`，未知 500 对客户端脱敏；Web API Client 同步支持 code/details，并新增无数据库依赖的 S4.1 错误回归脚本
- ⚙️ Widget Config Schema 扩展为 V2：新增 number、color、section/group 和 `visibleWhen` 条件显示，Inspector 自动生成对应控件；Registry 增加类型级严格校验和运行时防御性归一化，Weather 已支持 1–4 天预报设置，Notes 已支持独立强调色
- 🧩 建立 Widget Plugin API V1：统一插件 ID/版本/API 版本、单多实例策略、权限、网络 Origin 与 Tauri Native Command 元数据；Registry 改为严格校验并拒绝重复注册，现有内置 Widget 全部迁移到同一契约，同时明确 V1 不执行远程动态插件代码
- 🌤️ 新增 Weather Widget：用户手动设置城市后通过 Open-Meteo 获取当前天气与 4 日预报，支持摄氏/华氏和预报显示开关；不读取系统/GPS/IP 定位，采用 30 分钟轻量刷新、5 分钟聚焦 freshness gate 和运行期坐标缓存，并明确标注天气数据来源
- 📝 新增 Notes Widget：多实例独立纯文本便签支持标题、查看/编辑、450ms 防抖自动保存、最近编辑时间与二次确认清空；内容仅保存在当前 Widget config / Canvas 本地存储，不联网、不调用原生命令，也不引入 Markdown/富文本/云同步
- 📊 新增 System Monitor Widget：使用 Windows 原生只读 API 展示 CPU、内存、系统盘与开机时长，CPU 采用连续累计时间差分并显示轻量历史；支持 2/5/10 秒刷新和隐藏系统盘，不新增第三方系统监控依赖或后台采样线程
- 📁 新增 Folder Widget：可把 Desktop/PublicDesktop 中的常用文件夹固定到 Canvas，支持子目录浏览、返回/刷新、真实 Shell 图标和文件双击打开；根目录选择随 Widget 持久化，路径失效时提示重选，不开放任意磁盘写操作
- 📅 新增 Calendar Widget：纯本地月历支持今天高亮、日期选择、上/下月和回到今天；可配置周一/周日起始及相邻月份日期显示，复用 Widget Registry / Canvas Inspector，不联网也不读取系统日历账户
- 🔒 Desktop Organizer V2 安全边界正式固化：不提供自动移动、复制、重命名或删除用户文件能力；所有路径读取/搜索/预览/打开继续受 Desktop Known Folder 校验，并通过机器审计确认无用户文件 mutation API
- 🔎 Desktop Organizer 新增桌面范围搜索：支持文件/文件夹名与扩展名匹配、180ms 防抖、真实图标和结果直接打开/展开；搜索严格限制在 Desktop/PublicDesktop Known Folder，设置深度、扫描量和结果数量上限，不读取文件正文或系统使用历史
- 📂 Desktop Organizer 新增文件夹快速展开：桌面文件夹可在 Organizer 内直接预览并继续进入子目录，支持返回/关闭/Esc、子项真实图标和文件双击打开；预览严格限制在 Known Folder 桌面范围，单次扫描和返回数量均有上限
- 🕘 Desktop Organizer 新增“最近修改”：基于当前桌面文件的真实修改时间展示最近 6 个文件，显示相对时间并与常用/普通分类去重；不读取 Windows UserAssist、RecentDocs 或其他系统级使用历史
- ⭐ Desktop Organizer 支持常用文件/文件夹置顶：点击星标后立即进入顶部“常用”分组并从原分类移除，取消后自动归位；置顶顺序随当前 Widget 本地持久化，不改变真实桌面文件
- 🗃️ Desktop Organizer 新增简易分类设置：默认分类可改名和调整扩展名，自定义分类可添加/删除并支持恢复默认；同一扩展名自动保持唯一归属，配置随当前 Widget 本地持久化，仅改变显示分组、不移动桌面文件
- 🎨 Desktop Organizer 新增真实 Windows Shell 图标：文件、文件夹、快捷方式和应用入口显示系统实际图标，安全校验后按路径惰性读取并缓存；兼容 Rust canonical `\\?\` 路径与 Shell 类型图标兜底
- 🗂️ Desktop Organizer 桌面目录改用 Windows Known Folder API：通过 `FOLDERID_Desktop` / `FOLDERID_PublicDesktop` 获取真实桌面位置，正确跟随 OneDrive 重定向、用户自定义目录和系统策略，不再依赖环境变量拼路径
- 🛡️ Launcher 新增失效软件检测：启动时刷新本地软件目录，已固定但卸载/入口损坏的软件明确标记为失效并禁止启动，仍可由用户手动移除；失效项不会进入应用库或自动推荐，启动失败会立即触发重新扫描
- ✨ Launcher 应用库支持手动管理常用项：统一展示可启动的本地软件与 FlexiKit 工具，支持分类/搜索、`+ / ✓` 添加移除、整理模式删除和拖拽排序；手动顺序持久化且不限制固定数量
- ✨ Launcher 新增本地常用软件自动推荐：仅使用已验证可启动的软件目录，综合入口可靠性、FlexiKit 本地使用频次/最近时间与全局搜索最近应用动态排序；默认最多 12 项，按需加载真实图标，用户手动整理后不再自动覆盖
- 🔒 新增受控本地软件启动命令：前端只提交软件名，Rust 原生端从已发现目录重新解析 EXE/AUMID/URL 后执行，拒绝未知软件和不可用目标
- ✨ 新增 Windows 软件真实启动目标解析：Start Menu 快捷方式可解析目标 EXE 与启动参数，Store/MSIX 解析 AUMID，Registry 仅使用可验证的 EXE 兜底；陈旧快捷方式不会再产生无效启动路径
- ✨ 新增 Windows 已安装软件真实图标读取：支持 Registry `DisplayIcon`、Start Menu Shell 图标和 Store/MSIX Package Logo，按需提取并转为前端可直接显示的本地 Data URL，不上传图标或软件清单
- ✨ 新增 Windows 已安装软件自动发现目录：合并 HKCU/HKLM 32/64 位卸载注册表、Start Menu 与 Microsoft Store/MSIX PackageManager，过滤系统组件/更新/Framework/资源包并按名称去重；目录仅保存在本地内存，支持 5 分钟缓存与主动刷新
- ✨ 新增 Desktop 全局搜索：`Ctrl+Shift+Space` 可从系统任意位置唤起 FlexiKit，统一搜索 FlexiKit 工具、Windows 应用入口、文件与文件夹，并支持最近使用、相关性排序和全键盘操作
- ⚡ 新增 Windows 本地搜索索引：启动后预热 Start Menu / Desktop / Documents / Downloads（含可用 OneDrive 根），90ms 输入防抖 + 120 秒内存缓存，打开系统结果前再次执行允许目录校验
- ✨ 项目文档体系（README、部署指南、安全说明、贡献指南）
- ✨ 统一 HTTP 客户端服务，消除代码重复
- ✨ 前端 API 拆分为唯一 `client.ts` + 业务 API 模块，消除循环依赖
- ✨ 建立 Roadmap、Technical Debt、Stable Checklist、Implementation Plan 与 API Migration Plan 文档
- ✨ 新增 `MASTER_PLAN.md` 作为唯一主线执行总表，固定当前阶段、下一项任务、阶段门槛与中断恢复规则；Roadmap / Implementation Plan 改为从属参考文档
- ✨ 将“代码 / 验证 / 文档”闭环设为强制完成条件：每个任务结束后必须同步更新对应专项文档，并按类型同步 CHANGELOG / Stable Checklist / Tech Debt / Desktop Canvas / Monetization / errors-log
- ✨ 新增商业化与收费策略文档，确定 Free / Pro / AI Pro、AI Credits / BYOK、Founder Pro 与 v1.0 收费门槛
- ✨ 校准 API 文档与当前 NestJS Controller，实现路径、鉴权状态和返回结构保持一致
- ✨ 爬虫并发控制和重试机制
- ✨ 数据库索引优化
- ✨ 统一日志系统
- ✨ 新增 Desktop Canvas 第一阶段：独立 Tauri Canvas Window、自由拖拽/缩放、布局持久化、Widget Registry
- ✨ 新增 Clock、Search、Launcher、Disk 四个桌面组件；组件可重复添加且允许空画布
- ✨ 桌宠与主程序均可直接唤起 Desktop Canvas，继续保留桌宠作为独立桌面入口
- ✨ Windows Desktop Canvas 支持挂载 WorkerW 桌面层，并通过原生指针路由实现 Widget 区域可交互、透明背景动态穿透
- ✨ 增加 Windows 11 Progman fallback，并通过真实 debug HWND 烟测确认 Desktop Canvas 成功进入桌面父层
- ✨ Desktop Canvas 新增 Shift 多选、Widget 组合/拆分、组合联动移动和 groupId 持久化
- ✨ 新增 Widget 外观 Inspector，支持名称、透明度、圆角、玻璃模糊与整组锁定
- ✨ Launcher 升级为“小组件 → 快速启动中心 → 全应用 Launchpad”三级交互，支持搜索与分类
- ✨ Launchpad 展开/关闭与原生点击穿透区域同步，关闭动画完成后自动恢复桌面透明区域
- ✨ Launcher 支持每个 Widget 独立维护常用应用，应用库可添加/移除，快速启动中心可拖拽排序并持久化
- ✨ 新增 Todo Widget，待办数据按 Widget 独立持久化
- ✨ 新增 Clipboard Widget 与 Windows 原生剪贴板桥；仅主动读取，不持久化剪贴板文本
- ✨ Music Widget 升级为 Windows GSMTC 当前媒体面板，可显示来源、歌名、歌手、专辑、播放状态、进度和总时长，并保留系统媒体控制
- ✨ Music Widget 接入 GSMTC Thumbnail 专辑封面：切歌自动更新、无封面回退 ♪、单图 4 MB 上限、最多 8 张内存缓存且不持久化
- ✨ Music Widget 新增可选 LRCLIB 歌词：默认关闭，用户主动开启后支持同步 LRC 逐行高亮与普通歌词降级；歌词正文不持久化
- 🛡️ Music 歌词请求增加 6 秒超时、429/5xx/网络错误一次重试与 exact → search 降级，第三方歌词服务异常时不影响系统媒体控制
- ✨ 新增 AI Prompt 快捷台，可选择 AI 工具、复制 Prompt 并直接打开目标工具；Prompt 默认不持久化
- ✨ 桌宠右键菜单新增“添加桌面组件”，可直接唤起 Canvas 编辑态和 Widget 组件库
- ✨ 新增系统级“桌面收纳”组件：自动读取并按类型分类 Desktop 项目，Canvas 显示时隐藏 Explorer 原生桌面图标，关闭时恢复；项目仅展示/打开，不移动原文件
- ✨ Desktop Canvas 默认布局升级为紧凑两排成品布局，缩小时间 / 搜索 / 磁盘 / Launcher / 桌面收纳默认尺寸，并为旧版未修改的默认布局提供一次性自动升级
- ✨ Desktop Canvas Motion V1：统一 300ms 自然曲线，增加编辑网格/控制条/组件库/Inspector 动画；整理与重置支持平滑归位；真实拖动/缩放时自动禁用几何补间并补充 reduced-motion 与中断清理

### 修复
- ✅ 完成 Desktop 离线冷启动视觉复核：Backend/Vite 同时关闭时，release 窗口约 5.2 秒已完整显示 44 个工具；确认此前约 20 秒现象来自 WebView2 UIA 可访问树延迟，不是实际画面卡顿
- 🧪 新增 `scripts/windows-clean-install-smoke.ps1`：面向干净 Windows VM/新机器自动验证 NSIS 安装、真实 44 工具 UI、诊断日志、卸载与残留；检测到既有安装或 AppData 时拒绝执行以保护用户数据
- 🧭 新增 `docs/RELEASE_STRATEGY.md`：统一 Desktop SemVer、发布流水线、Stable/Beta 更新通道、签名/密钥边界、失败回退与 v0.1 自动更新启用条件
- ✅ 新增 `npm run release:check-version`，发布前强制校验 Desktop package/package-lock/Tauri/Cargo/Cargo.lock 版本一致；当前 0.1.0 实测通过
- 🧰 新增原生 Desktop 诊断日志：startup/setup/quit/shutdown/runtime error/panic 写入本地日志，2 MB 自动轮转、最多 3 个备份；release 实机已验证生成日志且不自动上传
- ✅ Tauri 0.1.0 optimized release 构建通过，并重新生成 x64 MSI 与 NSIS 安装包；release exe / MSI / NSIS 均核对新时间戳和 SHA-256
- ✅ 完成本机隔离安装烟测：NSIS 安装到 `%TEMP%` 后，在 Vite 完全关闭时安装版仍完整渲染 44 个工具；静默卸载 exit 0，安装目录与卸载注册均清除
- ✅ 完成独立标识的 NSIS 覆盖升级回归：0.1.0 → 0.1.1 同目录升级成功，二进制哈希变化、卸载项版本更新且无并排重复安装；升级后真实启动正常
- ✅ 完成用户数据升级保护回归：0.1.0 的 `S2 Upgrade Sentinel` 自定义工具在 0.1.1 覆盖后仍存在，页面显示 44 个内置工具 + 1 个 Sentinel；测试安装、注册项和 `com.flexikit.s2upgrade` 专用数据已清理
- 🧰 新增 `src-tauri/tauri.release.conf.json` 发布/CI override：显式完成 Web desktop build 后跳过 Runner 环境中会卡住的重复 `beforeBuildCommand`，不修改正式跨平台 Tauri 配置
- 🛡️ 修复收藏越权：登录用户只能收藏公共工具或自己的私有工具，猜测其他用户私有工具 ID 现在返回 403；不存在工具返回 404
- 🐛 修复数字路径参数未校验导致 `/tools/abc` 进入数据库并返回 500：工具 / 分类 / 收藏 ID 统一使用 `ParseIntPipe`，非法 ID 直接返回 400
- 🐛 修复重复取消收藏仍递减 `favorite_count` 的问题；只有真实存在收藏记录时才执行删除和计数 -1
- 🐛 修复账号删除可能被“其他用户收藏了该账号私有工具”的外键引用阻塞：删除账号前同时清理本人收藏和所有指向本人私有工具的收藏
- ✅ 新增 `npm run test:authz-regression` 双用户权限回归：工具/分类跨用户 403、私有收藏 403、缺失收藏 404、重复收藏幂等及双账号清理均通过
- ✅ 完成 Stage 2 S2.2 Backend 稳定性回归；Redis 明确为 v0.1 非运行依赖，不为满足检查项强行引入无使用场景的连接
- 🐛 修复工具列表空白假象：认证失效/退出登录清理状态时同步重置 `toolTypeFilter` 为 `all`，避免本地工具测试清理后仍停留在“本地”筛选而把 44 个内置网页工具全部隐藏
- 🛡️ Backend 正式启用全局异常 Filter：400/401/404 统一输出 `statusCode/message/error`，未知异常统一返回脱敏 500；用户不存在改用语义正确的 404
- 🛡️ JWT 签发增加 `JWT_EXPIRES_IN` 缺省 7 天兜底，避免环境变量缺失时产生无过期时间的 Access Token
- 🐛 修复认证 Token 生命周期：初始化时仅在明确 401 才删除 Token，临时断网/5xx 不再强制登出；Axios 401 通过统一 `flexikit-auth-invalidated` 事件同步清理 Pinia 与本地认证状态
- ✅ 完成 Stage 2 第一组认证回归：注册、登录、用户资料、错误密码、无/无效 Token、7 天 JWT、账号删除后的旧 Token 失效均通过，测试账号已清理
- 🐛 修复工具列表查询作用域优先级：用 TypeORM `Brackets` 包裹“内置工具 OR 当前用户工具”，确保搜索和分类条件同时作用于两类工具
- 🐛 修复收藏筛选依赖不存在 `tool.favorites` relation 的运行时错误，改为参数化 `EXISTS` 查询现有 `favorites` 表
- ✅ 完成 Stage 2 工具数据链路真实 PostgreSQL 回归：工具 CRUD、描述/tags 搜索、分类创建/编辑/过滤、收藏添加/过滤/移除全部通过，测试夹具已清理
- ✅ 完成 Stage 2 S2.1 核心应用回归：Discover 5 条 API 与 Tauri 页面渲染通过；真实 UI 临时添加本地 Notepad 并通过 `open_local_path` 启动后完整清理；主窗口 ↔ 桌宠 ↔ Canvas 三向联动通过
- ✅ TypeORM migration 可重复执行回归通过：Backend 二次启动前后 migration 记录数保持 1，无重复迁移或 schema 异常
- 🧰 Backend 端口正式统一为 3001，同步修正 `start.bat`、开发 Dockerfile 与部署/Nginx 示例
- 🐛 Desktop Canvas 原生 HRGN 改为跟随 Widget CSS 圆角的 `CreateRoundRectRgn`，并让正常态 Canvas backdrop 完全透明，消除圆角组件外侧矩形框
- 🐛 收紧旧 starter 自动升级判定：兼容 4/5 组件历史默认布局，仅在旧位置/尺寸完全一致时迁移，并保留名称、外观与配置，避免覆盖用户手动布局
- 🛡️ Desktop Canvas 增加 Explorer 桌面图标启动恢复保护；即使上次异常终止发生在图标隐藏状态，下次启动也会先恢复桌面图标
- 🐛 修复 Win11 `Progman` fallback 的真实鼠标命中顺序：Canvas 交互区域现在位于 `SHELLDLL_DefView` 之上，避免“添加 / 编辑 / 整理”和 Widget 点击被 Explorer 截获；HRGN 外桌面空白仍保持穿透
- ✅ 完成 S1.8 真实鼠标回归：用户实机确认 Widget 整块拖动、四边/四角缩放、20px 吸附、右侧缩放不误开设置，以及 Desktop Organizer 双击文件夹/普通文件均正常
- ✅ 完成 S1.9 Canvas 最终回归：真实默认布局截图、圆角/裁切、Launcher/Launchpad/Organizer 多帧稳定性、20 次显示隐藏、Explorer 重建恢复、应用重启持久化、无 runtime warning、Web/Rust 构建与全仓库 diff check 全部通过
- 🐛 修复 Canvas recovery watchdog 对有效 `Progman` / `WorkerW` 父层句柄变化的误判，避免正常编辑期间重复 reattach
- 🐛 修复真实 Explorer 重启会连同 Desktop Canvas child HWND 一起销毁的问题：watchdog 现在等待新桌面父层 ready，并用代次 Canvas label 重建 Tauri WebView、恢复桌面挂载/HRGN/可见状态；真实 Explorer 重启实测通过
- 🧹 增加历史 6 组件重复 Launcher 开发布局的一次性迁移，实机持久化已从 6 个组件收敛为 5 个紧凑默认组件
- 🧰 全仓库 JavaScript / TypeScript 包管理统一为 npm，清理遗留 pnpm lock/workspace 配置；Web/Backend 均通过 `npm ci` 重建依赖，并恢复 vue-tsc 2.2.12 完整构建基线
- 📝 同步项目结构、部署、合规与安全文档到当前 `apps/web` + Tauri 架构，并区分历史 `vue-tsc` 通过基线与当前本机依赖漂移造成的复验阻塞
- 🐛 修复 V2EX 爬虫使用 Math.random() 导致热度随机变化的问题
- 🐛 修复排行榜时间筛选使用工具创建时间而非访问时间的问题
- 🐛 修复 require 与 import 混用问题
- 🐛 修复 console 与 Logger 不统一问题
- 🐛 修复 Web `vue-tsc 1.8` 与 TypeScript 5.9 不兼容导致类型检查无法启动的问题
- 🐛 修复多处前端模型类型缺失及旧 Store API 引用，恢复严格类型检查基线
- 🐛 修复 Desktop 在 Rust 1.97 下 `indexmap 1.9.3` 自动 std 探测失败导致的 `schemars` 编译错误
- 🐛 清理 Store 中重复动态导入，消除 Vite chunk 警告
- 🐛 修复分类创建使用错误用户字段，确保自定义分类正确绑定当前 `userId`
- 🐛 为分类查询补充可选 JWT，登录用户可正确获取自己的分类
- 🐛 调整 `/categories/order` 与 `/tools/batch` 静态路由顺序，避免被动态 `:id` 路由抢占
- 🐛 修正前后端分类排序参数类型为 `number[]`
- 🐛 为 `GET /tools` 增加查询 DTO，正确转换并校验 `favorite`、`limit`、`offset`，避免 Query String 被错误当作 boolean / number
- 🐛 清理本轮 API、认证和工具交互链路中的显式 `any`，保持严格 TypeScript 基线
- 🐛 恢复 Web `vue-tsc`、Vite production build、Backend Nest build 与 Tauri `cargo check --all-targets` 的可验证基线
- 🐛 Desktop Canvas 穿透从 45ms 鼠标轮询升级为 Win32 HRGN 原生窗口区域：普通模式只保留 Widget / 控制条 / 弹层可命中区域，桌面空白区域直接交给 Explorer；普通打开 Canvas 也不再抢焦点
- 🐛 新增 Explorer 桌面层恢复 watchdog：检测 Progman / WorkerW 父层失效或变化后自动重新挂载 Canvas、恢复桌面尺寸和已保存 HRGN，并触发前端交互区域重算
- ✨ Desktop Canvas 增加多显示器 / DPI 布局底座：原生 Monitor 拓扑、Widget `monitorId`、v2 持久化与 v1 自动迁移、拓扑变化相对位置重映射、主屏编辑 UI 和指定显示器迁移
- ✨ Widget 外观 Inspector 升级 V2：玻璃 / 深空 / 轻透 / 实色四预设，支持跟随 / 深色 / 浅色色调，以及表面浓度、边框和阴影强度自由调节；旧布局自动兼容
- ✨ 新增 Registry 驱动的 Widget 用户配置系统：自动生成 boolean / select / range / text 设置项，支持默认值与恢复默认；首批接入 Clock / Search / Todo / Music，并隔离 Todo/Launcher/AI 等内部数据键
- ✨ Desktop Canvas 增加 20px 栅格、拖动/缩放吸附、新增组件自动找空位与一键整理；默认布局重新对齐
- 🐛 修复 Launcher 整理模式无法拖动：移除失效 handle 依赖，改为整块软件图标拖动并启用 WebView fallback
- 🐛 稳定 Inspector / Launcher / Launchpad 滚动区域，保留 scrollbar gutter，减少滚动条出现时的闪动与布局抖动
- 🐛 Widget 编辑交互调整：移除不跟随圆角的外层 outline，支持上下左右四边与四角共 8 向缩放；属性 Inspector 改为仅点击组件设置按钮时打开，边缘拖动不再误弹面板

### 性能
- ⚡ Canvas 布局写入改为 120ms 防抖，编辑拖动期间不再逐帧重算全屏 HRGN
- ⚡ 为常用查询字段添加数据库索引
- ⚡ 爬虫增加请求间隔和频率限制
- ⚡ 前端路由懒加载

## [1.0.0] - 2026-06-26

### 新增
- 🎉 初始版本发布
- ✨ 用户认证系统（注册、登录、资料编辑、头像）
- ✨ 工具管理（增删改查、分类、搜索、收藏、排序）
- ✨ 本地工具支持（打开exe、自动提取图标）
- ✨ 发现页多平台爬虫（V2EX、小众软件、异次元、Product Hunt、掘金、少数派、反斗软件、爱范儿、36氪、开源中国）
- ✨ 智能标签推荐功能
- ✨ 毛玻璃 UI 设计，支持亮/暗主题
- ✨ 完整的移动端响应式适配
- ✨ favicon 多源 fallback 机制
- ✨ 工具卡片详细面板
- ✨ 网页工具/本地工具筛选
- ✨ 离线数据缓存
- ✨ Docker Compose 一键启动数据库

### 技术栈
- 前端：Vue 3.4 + TypeScript + Pinia + Vite 5
- 后端：NestJS 10 + TypeORM + PostgreSQL 16 + Redis 7
- 数据库：pgvector 向量扩展支持
