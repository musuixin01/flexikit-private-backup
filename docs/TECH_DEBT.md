# FlexiKit Technical Debt

记录当前需要逐步治理的技术债。

## 2026-10-10 / Browser 配对隔离真实 PostgreSQL 18 事务已验收（更新历史阻塞项）
- 使用**新创建且已清理**的 TEMP 独立 PostgreSQL 18.4 cluster（默认 PostgreSQL 安装的工具，不访问现有 pg18 服务），项目原 RefreshSessions、ClientContext、ExtensionPairings 的真正 migration up/down、FK/索引及 TypeORM 行锁并发领取、一条 Refresh Session、密码失败锁定、事务回滚/重试全部 PASS，详见 `docs/STAGE6_POSTGRES_PAIRING_VERIFICATION.md`。历史段落中的“无法执行任何隔离 PostgreSQL 迁移”是当时 Docker 检查超时阶段的记录，**现已用独立原生 PG18 实例解决验证阻塞**。
- **尚未通过的门槛**：目标 PostgreSQL 16 版本差异、完整生产 Entity metadata/全部 migration 全量适配、真正 Nest HTTP pairing start/approve/complete/refresh/revoke、Chrome/Edge 一键安装和账号权限、分布式限流与审计，以及公测性能 Release/GPU/DPI/真实 7 日试用。不能宣称生产配对已上线。


## 2026-10-10 / Stage6 后端隔离构建复核（覆盖前期环境阻塞，生产终验仍未完成）
- 通过 TEMP 代码副本+独立 npm ci 安装 590 包，Nest 正式 build 与 TypeScript noEmit PASS，当前源码整体可编译。**原仓库 backend/node_modules 依旧缺 Nest CLI 等依赖，未重装和覆写**；后续正常本地运行仍需经用户环境评估后的安全安装方案。
- 真实 Nest Test HTTP（127.0.0.1 随机端口）验证已有 10 个手动爬虫 Controller 路由的 JwtAuthGuard、AdminAccessGuard、AdminAccessService 角色校验与单实例 429 门槛，401/403/201/429 全 PASS；模拟仓储和爬虫，不是正式 AppModule 或真实 DB。
- Docker CLI 存在但 `docker info` 在 35 秒截止前无响应，未创建/操作容器。无可用隔离 PG 证据，extension_pairings TypeORM up/down、数据库悲观锁同码领取、真实 refresh-session/账号持久化仍需隔离验收。
- 多实例/网关限流、任务执行预算、cron 资源竞争、Release/Native DPI/7日试测仍是发布门槛。上一节历史文字关于“后端建构仍阻塞”是当时原目录环境的真实状态；本轮 isolated build 并不意味着原目录已修复。


## 2026-10-10 / 手动爬虫 P1 保护已编码，生产终验仍阻塞
- 之前 10 个 `POST /crawler/*` 可匿名触发昂贵抓取和发现库写入。现统一 class Guard `JwtAuthGuard + AdminAccessGuard`，`CrawlerModule` 引用现有 `AdminModule` 的导出 Guard，校验仍使用管理员真实账号角色/状态（并兼容 ADMIN_USER_IDS bootstrap）。无新管理权限绕行。
- `CrawlerManualTriggerGate` 仅给 HTTP 手动入口设**单 NestJS 实例**最多一个运行任务、**同来源 60 秒**冷却；异常时释放运行状态，定时抓取 cron 不经此 Gate，不改变自动业务。后端 Mock 10 路由测试通过。
- 尚缺多实例 Redis/网关全局限流、真实任务**可取消执行预算**与爬虫 cron 互斥控制。单进程 Gate **不是**跨进程保护，也不主动中断已开始的上游任务；必须在正式公网投放前补受控环境中的 Nest DI、401/403/429 真 HTTP、安全发布网关与资源预算验收。
- 当前 backend/node_modules 为大量不完整/invalid 依赖目录，npm 缓存缺少核心包；不能安全在用户工作目录内执行可能删除/覆盖文件的 `npm ci`，目前未运行。应在独立位置准备依赖并逐项完成真实 Nest build / TypeORM 迁移与回归。


## 2026-10-10 Browser Companion v0.4.0 上线阻塞
- 新增 TypeORM extension_pairings 迁移尚未实际运行；必须在隔离 PostgreSQL 验证 up/down、同码跨请求及并发锁与真正 JWT 签发，确认账户权限和 session 吊销。
- backend/node_modules/@nestjs/cli/commands 缺失导致本机 Nest build 无法启动；另一次独立 TypeScript 检查因类型依赖缺失无法完整验证。Mock DB 回归/源码转译 PASS 不等于真实 backend build 或 E2E。
- 配对 start 使用进程内 IP 限速与每设备 pending 上限，正式多实例生产仍需共享存储/网关限流、审计告警；仅应确认本人安装的扩展里刚生成的 10 字符码，以降低配对钓鱼风险。
- 真实 Chrome/Edge 官方详情 URL 及商店 ID、后台 CORS 精确 extension Origin、上架隐私审核和真实浏览器安装连接/禁用/升级均未完成。没有链接时应使用「粘贴网址添加」而非引导普通用户进入开发者模式。


## 2026-10-10 Browser Companion v0.3.0 发布与能力边界
- 已实现当前网页的一键添加、右键/键盘入口、服务端去重、撤销与编辑。API 需在线且首次完成授权/登录；离线持久队列、网络恢复自动同步和跨设备通知尚未实现。
- 「放到 Canvas」只能由用户在 FlexiKit 现有工具箱中主动操作，扩展尚无经过审核的原生桌面安全桥接。不得开放未鉴权本地端口或写入 Canvas 私有本地数据。
- 真实 Chrome/Edge 权限与账号交互、扩展安装/更新、签名商店 ID 和离线场景尚未验收；未直接修改运行中的桌面 EXE。
- 2026-10-10 本地 backend 缺少 class-transformer 依赖，两项 Browser Extension / Multi Client 回归都在加载模块时退出，并不是功能断言通过/失败；应在隔离环境准备依赖后重跑，避免 npm ci 清理正在使用的环境。
- 后端 Tools 创建前已有查重，但缺少可确认的数据库 URL 唯一约束；同一浏览器服务 worker 中新加 in-flight 合并和 409 恢复，跨服务进程/多设备极端竞态的原子唯一性仍需数据库级方案及迁移评审。


## 2026-10-09 新状态机及 GPU 资源恢复待验证

已完成有界 WorkerW 状态机：两次 HWND 消失确认、真实 HWND 存在时只重挂、逐步退避不忙重建；纯 Rust 4 单测及 Windows Debug 编译通过。GPU Context Lost 恢复最多 2 次，4 秒超时并取消旧图集解码，JS 36 项回归通过。但实际 Windows 驱动上下文丢失和 Explorer 真正杀死 HWND 均未开展非生产 VM 端到端演练；用户现有两份安装版未换用新代码，Debug 新版只编译、未启动。正式发布前还需要显存增长、连续失效、GPU Present 帧时长、混合 DPI 和 Release 功耗验收。

## 2026-10-09 折射生命周期剩余风险

- 本轮已修复正常 Canvas HWND Resize / WorkerW 重挂事件无条件清除折射；153 项生命周期测试和真实 1px Canvas HWND 变更后折射继续开启的原生 UIA 检查通过。真正 Explorer 销毁并重建 HWND 的 opt-in 单次恢复逻辑已编码于 Rust 进程内 AtomicBool + generation，**尚未对用户真实 Explorer 做破坏性测试**，需在独立 Windows VM / 非生产桌面验证安全与连续性。壁纸图像和授权状态均不落盘，用户关闭即撤销。
- WebGL CPU 画图提交耗时已提供滑动窗口 p95，可悬浮查看，但它不衡量 GPU 着色器完成时间或 DWM Present 物理帧率。尚需 GPU timer query 或 ETW/DWM Frame Analysis、重复 controlled A/B、长时纹理释放、硬件 GPU 设备丢失、混合 DPI、多屏与 Wallpaper Slideshow 验收。原有主窗口 resize bug 仍保持暂停。

## 2026-10-09 新折射样机待完成的正式验收
- IDesktopWallpaper 现已接入且支持计算 6 种静态壁纸铺放与负坐标，144 条模拟多屏几何检查通过；本机单屏有失效 COM 显示器历史记录，已保护性回退 SPI。尚缺双屏真实 Windows 物理视觉/DPI 准确度测试、WallPaper slideshow 更新、GPU context loss 后恢复与热插拔、60fps/P95 长期性能指标、功耗/Release。
- 已观察 Canvas 在 Explorer 恢复/重挂时实验开关会自动关闭；目前默认不持久化符合隐私目标，但连续使用稳定性需后续评估。动态壁纸与活动窗口不能自动采样；如未来讨论实时桌面图像必须额外做隐私授权和 ADR。详情 docs/CANVAS_WALLPAPER_OPTICS.md。

## GPU 壁纸折射已实现，但完整 Windows 系统光学材质仍待设计（2026-10-09）
- 当前已完成静态单屏壁纸+WebGL2 圆角组件 GPU 位移采样的 opt-in 样机，用户可手动「试用折射」，关闭即释放图片和 GPU。没有读取桌面图标、用户窗口，也未上传或持久化壁纸；详见 docs/CANVAS_WALLPAPER_OPTICS.md。
- 尚不能折射实时窗口、动态壁纸；多屏、DPI、非 Fill/Span 投影、GPU 资源/电池能耗、Live Wallpaper 和 HDR 都未验收。下一阶段应接入微软 IDesktopWallpaper 显示器 ID、rect、位置接口，完整实时桌面合成需独立隐私授权/ADR，禁止默认屏幕录制。

## Windows WebView2 真正液态玻璃折射材质待架构设计（2026-10-09）
- 当前 `backdrop-filter` 仅能模糊 WebView 本身的层；透明 WorkerW 背后 Explorer 的真实壁纸不会被 CSS 原样采样。经 `PrintWindow` 实际画面验证，现有 Liquid Glass v1 加强边缘高光后仍像半透明浮层，不具备系统级动态折射。不得宣传为完整复刻苹果私有 Liquid Glass。
- 候选架构：Windows 原生壁纸/桌面底图获取后进行限制在 Widget 圆角区的局部采样、GPU 位移/折射和渐进模糊，并把镜片高光与前景控件分离；确认 Windows 动态壁纸/多屏/DPI/壁纸隐私、GPU/CPU 预算、最坏帧率和缩放行为，不改当前暂停的尺寸 bug。需要先做独立样机与 ADR，不能直接把屏幕截图传给前端或在未授权时持久保存桌面画面。

## 自定义控制台横竖布局待补实机验收（2026-10-08）

- 新布局生成器在模拟 1648×810/960×640 下 122 项几何断言通过，小窗口压缩后的某些 Widget 内部文字和交互仍需真人实际查看；跨 DPI/多屏/WorkerW/Explorer 图标恢复尚未执行。
- 自定义个人预设只保存组件类型、排序、方向、停靠点和偏移。各组件内容、手动拖动后的精确尺寸/坐标仍通过既有 Canvas v2 保存；跨用户/跨设备预设导入导出、直接从实际任意布局保存为多版本模板尚未实现。
- 新源码与已运行中的 Debug EXE 可能版本不同，需在确认现有 App 可安全退出后另行编译/重启；本轮不触碰用户真实 Profile 或运行中的程序。

## Canvas 客户工具面板 / 控制台模板待验证（2026-10-08）

- Rust 工具链门禁未完成：gnullvm 复用运行中开发版的 target 运行 cargo check 被 libresource.a 文件占用阻断；改用旧 resize 隔离 target 时 cargo check 的 zerofrom_derive、cargo build 的 tauri/windows 依赖 E0463 缺失。未执行 cargo clean，未停用户主程序，未覆盖正式 EXE；须在不影响正式运行程序的全新独立缓存中重建/检查依赖产物，再做原生 Canvas 真实操作验收。

- 新组件只保存工具库稳定 key 并通过 openDesktopTool 启动；改名后的自定义工具 key（当前 getToolKey 依赖 custom:name）可能失效，属于工具标识协议既有技术债，不在本次新组件中复制本地路径作为绕行。
- 三套模板仅在用户预览与二次确认后覆盖 Canvas 当前布局，旧 v2 widgets/monitors 留在同一来源 localStorage 的单份备份；多次应用不会覆盖第一次备份。需要对 quota、强退/断电、用户真实跨屏及长期迁移单独实测；备份不是云同步也不是异机迁移。
- Web Vue/Pinia 构建和模拟存储验证不等于已在 WorkerW 真实桌面挂载、原生拖放和 canvas-recovery-N 事件权限通过；运行中的原版 EXE 未切换，仍需本机窗口人工验收。

## Stage 6 Canvas / WebView2 交互测量剩余验证（2026-10-08）

- 真实 Vue+Pinia Canvas Store 的纯内存测试 20 轮成功，保证状态增删/锁定/移动/缩放模拟更新与延迟持久化流程；并未启动原生 WidgetHost/WorkerW，也未测 Explorer 桌面图标、鼠标指针/GPU 或 HRGN 场景，**不能宣布 Canvas 真实操作 20 循环完整通过**。
- 隔离 WebView2 20 次/方向的工作台/工具库性能 P95 ~93/123ms，口径仅是 CDP 设置 hash → Vue DOM → 双 requestAnimationFrame，不是 Windows DWM 用户最终可见的真实点击响应时间；Release 与不同负载有待补测。

## Stage 6 性能度量限制（2026-10-08）

- 已建立脚本手动本地只读采样（启动里程碑、Windows 主进程+WebView2 后代 CPU、工作集、USS 和线程），无自动上报、没有应用内隐藏性能画像。只测到不含 Pet/Canvas 的隔离测试版 7 个静止样本和 3 次温启动。隔离版 RSS 约 135.34 MiB 中位数，CPU 两位小数约 0%，这些数字不等于正式版性能。
- 当前启动自动测量能判断 Windows HWND 可见和 Chromium 调试页面出现，但不能证明 Windows DWM 用户看到的完整首屏。随后已启动实际 Desktop 开发版 PID 38324 并取得 30 个本地样本：整机 CPU 中位 0.27%、USS 中位 263.05 MiB、工作集和中位 732.35 MiB（跨进程共享页重复计数，**不能视作内存泄漏**）；仍缺正式优化 Release/多机对照、Canvas 稳定 20 循环与关键操作延迟 p50/p95。详见 docs/STAGE6_PERFORMANCE.md；不可制定未经实际测量的跨设备 SLA。

## Windows Tauri / WebView2 实时缩放（Stage 6，2026-10-08）

- 已确证/修复的用户体验问题：根滚动条曾占主窗口右缘 8px，导致缩放热区无法覆盖物理右侧及右下角；中间版本将主内容宽度缩窄 8px 又引入分离空隙。当前 Desktop 主滚动容器已全宽，内层 scrollbar-gutter 稳定，右侧仅 4px 覆盖缩放热区，真实 WebView2 命中已恢复，不修改透明 Pet/Canvas。
- 仍待解决/验证：WebView2/Wry 实时缩放 8～10ms 采样中仍有偶发最高约 6px 子窗口几何偏差，屏幕像素采样未检出强烈黑白条但不代表肉眼连续快速拖动无闪动；高 DPI、多屏、最大化还原及人工实机拖动仍是发布前门禁。自动鼠标不能取得隔离窗口前台焦点，故不作为本项目功能失败或成功的有效证据。
- 版本为 tauri-runtime-wry 2.11.4、wry 0.55.1、tao 0.35.3；`transparent:true` A/B 没有改善几何采样，不依赖旧 Issue 中的临时解决方法；不在业务 `WM_SIZE` 添加逐帧 `SetWindowPos` 或大面积 CSS 动画补丁。详见 `docs/STAGE6_RESIZE_HANDOFF.md`。

- 2026-10-08 补充根因隔离：动态尺寸采样最高 6px 发生在 Windows 处理尺寸变化过程中；每次 SetWindowPos 返回时，不透明和透明各 195 次的主窗/WRY_WEBVIEW 子窗尺寸差均不超过 1px，同线程。无需增加重复的 `WM_SIZE` 尺寸写回；若画面仍有黑白闪块，重点排查 DWM/DirectComposition 帧提交。已有独立 WebView2 渲染 flags A/B 测试器，尚需人工视觉确认，不在正式生产配置启用实验 flags。

- 2026-10-08 默认模式进一步回归：用户视觉对照选择 Default，禁用 DirectComposition/GPU 合成出现画布与外框分离，不应作为修复。Default/opaque 125% DPI 下五档 WebView2/客户区对齐、201 次尺寸变更返回后差≤1px、最大化还原/滚动/命中通过。15 个稳定屏幕样本与 147 个缩放期间窗口矩形稳定样本未捕获阈值定义的黑白露边；仍非 DWM/手动快拖终验，100%/150% DPI 仍待补测。

- 2026-10-08 换版后新正式运行的 gnullvm 开发程序（PID 26216）在 125% DPI 下 Win32 主窗客户区比外框底部小 1px，WRY 子窗口相对客户区多 1px；已保留用户可回退备份。右/下/角原生命中正常，UI 可见，但 GPU 帧闪动和用户鼠标快拖仍需手工确认。另有 `D:\Own_Tools\Flexikit` 旧安装版独立存在，正式安装包升级需要独立执行，不能以开发 EXE 换版冒充安装版升级。

- 2026-10-08 用户实际 Default 开发版仍报画布与边框分离/跳动。另发现 Main Desktop Scroll 子容器在外侧多保留 8px 留白、scroll bar 溢出变化引起内容可用宽度跳变；新补丁全宽/稳定 gutter/右缘4px拖动带/禁用结构尺寸过渡已在真实开发程序 PID 32476 使用。独立 DOM 和系统窗口缩放回归通过；不能宣称 WebView2 DWM 真实快速拖动最终消除跳动。新实时 Win32 末边仍有约 1px DPI 差异，保留问题为开放技术债。

- 2026-10-08 最新隔离 Standard vs Custom / Full vs Minimal 四象限 75 步测试：四组并发 HWND/WRY 子窗最高均约 6–7px 差，命令回返后最大 1px；WebView2 自身截图两窗口均 24/24 边缘正确，但实体桌面截图受其它窗口遮挡而不可用，仍无法断言 DWM 旧帧。真实人工快拖仍待用户在 Standard 测试 PID 10280、随后 Custom 窗口对比；生产版 PID 32476 未修改。

## API 层

已完成：

- `apps/web/src/api/client.ts` 成为唯一 Axios Client
- 业务 API 直接依赖 `client.ts`，消除 `index.ts` re-export 形成的循环依赖
- 删除未使用的旧 `apiClient.ts`
- Token key 统一使用 `token`
- `tools` / `users` API 的主要 `any` 已替换为明确类型
- auth / discovery / categories / favorites / stats 等主要 API 响应已补齐类型
- S4.1 已将全部 `*.controller.ts / *.service.ts` 的显式 `any` 清零，并清除未类型化 `@Request() req` / 整体 `@Query() query`；共享认证 Request 类型、DiscoveryQueryDto、RSS Feed 类型与 V2EX unknown+guard 已落地，`test:type-audit` 作为持续门禁
- 业务页面中的直接 `fetch` 已迁回统一 Client
- 建立统一 API 网络错误判断与后端 message 解析 helper
- S4.1 已建立统一 Backend 错误契约：`statusCode / code / message / error / details?`，Validation 统一 `VALIDATION_ERROR`，未知 500 不向客户端暴露内部异常；Web client 已兼容 `code/details`

待完成：

- Backend 成功响应已统一为 `{code:0,message:'success',data}`，Web Axios 兼容层自动解包；后续 API 返回类型应继续描述解包后的业务数据，不要让 envelope 类型扩散进每个页面
- 逐步把页面自定义错误处理迁移到统一 helper
- 当前错误 `code` 已稳定，但多数页面仍只展示 message/details；需要在确有业务分支需求时逐步改为基于 code 判断，禁止再通过中文错误文案做程序逻辑
- `@RawResponse()` 当前只允许确有二进制/流式协议需要的端点使用，并需在 API 契约中记录。未来下载、SSE、流式 AI 等端点若引入 raw response，必须显式标记；普通 JSON Controller 禁止绕过全局 envelope
- 本轮门禁刻意只覆盖 Controller / Service。`common/guards/optional-jwt-auth.guard.ts` 仍沿用 Passport AuthGuard 的宽泛 override 参数，`database/vector.transformer.ts` 仍有 TypeORM transformer 边界 cast；二者属于框架适配层类型债，后续应基于上游方法签名/驱动类型单独收敛，不能为了“any=0”盲目强转
- S4.1 HTTP 日志当前使用 Nest Logger/stdout，没有引入文件轮转、保留周期、集中日志、Sentry/Loki/ELK 或 OpenTelemetry。真正部署多实例 Backend 前应统一日志运输与 retention，并把 requestId 接入告警/支持工具；在出现多服务调用链之前不提前引入分布式 trace/span 复杂度
- 新 HTTP 日志本身不记录 query/body/Authorization/Cookie，IP 已脱敏；但 TypeORM 在非 production 环境仍按既有配置输出 SQL debug 日志，这是独立日志源，可能包含查询参数。生产已关闭 SQL logging；若开发/测试环境也需要严格隐私，应新增专门的 DB_LOGGING 开关，而不是修改 HTTP 日志契约
- API V1 已成为新客户端正式入口，但 Backend 暂时同时注册 `VERSION_NEUTRAL`，所以无版本旧路径仍然存在。该 alias 是迁移债而不是长期第二套 API；只有在所有受支持 Web/Desktop/Mobile/外部集成都迁到版本化路径，并经过明确 deprecation/rollback 计划后才允许移除
- Backend `API_V1='1'` 与 Web Runtime `API_VERSION='v1'` 当前分别位于两个 package。现阶段为避免为一个常量引入共享包而接受少量重复；当后续建立跨端 contracts package/OpenAPI codegen 时应统一版本常量，避免 V2 迁移时人工同步遗漏

## Authentication

当前：

- Access Token 生命周期已完成：默认 30m，显式 expires_in/expires_at，服务端 exp 校验
- Refresh Token rotation / reuse detection 已完成：服务端只保存 SHA-256，默认绝对 30d session，旧 Token replay 会 revoke 整条 Refresh Session
- Web/Desktop/Mobile/Browser Companion 多端 Session 契约已完成：每次登录独立 Session，client_type/instance UUID/name 仅作展示和归类，Refresh 不改变归属、不影响其他 Session；旧客户端为 unknown/null
- Windows Desktop Access/Refresh Token 已迁到 DPAPI Current User Vault，磁盘不落 Web Storage 明文；旧 Desktop Web Storage Token 会在首次 hydrate 后迁移并删除
- DPAPI 仅提供静态数据保护：同一已攻陷 Windows 用户、WebView XSS、运行时内存读取仍可能获取正在使用的 Token，因此不能替代 CSP、renderer hardening 和服务端 revocation
- macOS Keychain / Linux Secret Service 尚未实现；未来扩展对应 Desktop 平台前必须补齐等价安全存储
- 为升级兼容，旧无 `token_use` JWT 暂时仍可作为 Access Token；待已发布旧 Token 的迁移窗口结束后移除此兼容分支
- Browser Web Access Token 已改为 memory-only，Refresh Token 已改为 HttpOnly + SameSite=Strict Cookie（生产 Secure）；旧 Web Storage Secret 仅作为一次性迁移输入并删除
- Browser Companion 使用独立 `extension` Refresh Session；密码不落盘，认证数据仅保存在扩展自己的 `chrome.storage.local` 且不使用 sync。该存储不等同 OS 安全密钥库，同一已攻陷本机用户仍可能读取浏览器 Profile；若未来威胁模型要求更强的 Token-at-rest 保护，应改为 Desktop/Native Messaging 签发的短期凭据，而不是 JavaScript 自行加密长期 Token。
- `JWT_EXPIRES_IN` 仍作为旧环境 Access TTL fallback；新部署统一使用 `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL`
- 服务端 logout 与即时 Session 吊销已完成：设备撤销、当前 logout、Refresh replay 写入 revoked_at 后，sid-bound Access/Refresh 均立即 401
- 当前 sid-bound Access 的即时吊销通过每个受保护请求查询 Refresh Session 实现，正确性优先但增加一次数据库读；未来如引入缓存/session-version 优化，必须保持确定性的即时吊销语义
- 当前不限制并发 Session 数，也不按 client_instance_id 自动去重；同一实例重复登录会产生多个 Session。设备管理已经按 session_id 作为权威撤销单位，client_instance_id 仅辅助展示/分组

目标：

- 如产品后续需要，单独设计 logout-all / revoke-all 的明确 UX 与审计语义
- Browser HttpOnly Refresh Cookie 已完成；后续重点转为 CSP/XSS hardening、Cookie 部署域策略与敏感本地内容生命周期
- 若 Desktop 扩展到 macOS/Linux，补齐 Keychain/Secret Service 实现

## Local Data Security

当前：

- 本地数据已按 L0 偏好 / L1 个人元数据 / L2 敏感内容与行为 / L3 Secret 分类，详见 `docs/LOCAL_DATA_SECURITY_CLASSIFICATION.md`
- Windows Desktop Access/Refresh 使用 DPAPI；Browser Access 为 memory-only、Refresh 为 HttpOnly Cookie，L3 Secret 已从 Browser Web Storage 正常持久化路径移除
- Desktop Canvas 为 L2 混合容器：Notes/Todo 用户文本、Folder 完整路径、Weather 城市与 monitor topology 共同持久化在 WebView localStorage
- Global Search recents、Installed App usage、Tool usage 为明确 device-global 数据，现已由设备级隐私设置控制；关闭对应设置会立即清除历史并停止后续读写
- `flexikit-profiles` 含 email/avatar/displayName，属于 L1 个人数据；现已可通过“缓存账户资料到本机”关闭并立即清理，默认仍保持既有缓存行为
- Desktop 诊断已对新日志进行类别白名单/详情脱敏，panic 仅保留 Rust 文件名/行列号，手动复制的摘要不含原始日志内容。但升级前的历史明文轮转日志仍可能含旧版 panic/runtime/discovery 详情；不擅自删除用户已有日志，需要后续补充用户主动清理说明与留存周期策略。另需规划实时轮转（当前仅启动时按 2MiB 门槛轮转）、操作系统异常终止场景与更细粒度但仍安全的错误分组。
- 当前未发现 IndexedDB、本地 SQLite 或密码缓存
- DataManagement 已具备手动加密本地备份/恢复（AES-GCM + PBKDF2、版本化 allowlist、账号绑定），L3 Secret 与 device identity 不进入普通备份
- 本地 schema marker/迁移 registry 已完成 v1 基线；Canvas legacy、备份恢复与工具导入均已纳入显式版本兼容边界
- DataManagement 原误导性的“清除本地数据”已改名为“重置界面偏好”；活动历史与资料缓存已有独立隐私控制，但 Canvas 等完整 device-local 数据删除及账号删除后的本地清理仍待下一任务统一覆盖

目标：

- L3 Secret / Token 存储已完成 Browser/Desktop 基线收敛；后续不以 JavaScript-side 加密 Web Storage 作为安全方案
- 本地数据/备份 schema 已建立显式迁移注册表；后续任何 schema 变化必须追加可测试的 N→N+1 迁移，不得修改历史迁移语义或对未来格式做猜测式降级
- Search/Tool/App/Profile 的 device-scope 已显式化并可控；Canvas 用户内容仍需在完整数据导出/删除任务中确定账号删除与设备清理语义
- 下一步数据导出 / 删除必须基于完整清单，覆盖 Canvas、活动历史、资料缓存、界面偏好与必要的设备级残留，而不是只清 UI 偏好
- 自动/云备份仍不在当前基线；未来若引入必须先定义端到端密钥、保留、恢复与删除策略
- 日志继续禁止 Token/Secret/用户正文，并为未来日志收集增加显式脱敏与授权

## API Response

部分接口返回格式不统一，需要逐步统一。

目标：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

## Package Management

当前：

- 全仓库 JavaScript / TypeScript 包管理统一使用 npm；根级 Web/Desktop 脚本与 `start.bat` 均使用 npm
- Web、Backend、Desktop 各自保留 `package-lock.json`；遗留 pnpm lock/workspace 配置已清理
- 2026-09-23 Web 使用 `npm ci --registry=https://registry.npmjs.org` 按 lockfile 恢复 vue-tsc 2.2.12 + TypeScript 5.9.3，并通过完整 `npm run build`；Backend 也已通过 `npm ci` 重建依赖
- Backend 对外端口已统一为 3001：`backend/src/main.ts`、Vite proxy、README/API、`start.bat`、`backend/Dockerfile.dev` 与部署文档均已同步；`http://localhost:3000` 仅在开发 CORS 列表中作为可选前端 Origin 保留

待完成：

- 在 CI 中统一使用 `npm ci` 按锁文件做可重复安装

## Security Boundaries

当前：

- 本地程序启动已从 Backend 移除，桌面端通过 Tauri `open_local_path` IPC 执行；IPC 会规范化路径、验证文件存在，并仅允许 `.exe/.lnk/.url/.msi`
- `GET /tools/local-icon` 仍接收本地文件路径并在 Backend 主机读取/提取图标；远程部署前应迁移到 Tauri 或增加严格本机边界
- `POST /crawler/*` 手动触发接口仍未接管理员鉴权
- 登录页旧的本地明文密码重置逻辑已移除，自助重置暂时禁用

待完成：

- 将本地图标提取能力从远程 Backend 隔离到桌面本机可信边界
- 为爬虫维护接口增加管理员权限控制
- 设计服务端密码重置 / 邮件验证流程

## Repository Hygiene

- 仓库当前已跟踪多个 `.env.*` 路径（`apps/web/.env.*`、`apps/web/src/.env.*`）以及 `backend/.env.example`；本轮未读取或改动其内容
- 发布稳定版前必须人工确认这些已跟踪环境文件只包含公开配置/示例值，不包含密钥、Token、账号或内部地址
- 后续应明确环境文件策略：真实 secret 永不入库，仅保留经过审查的 `.env.example` / public build-time config

## Docker / Runtime

- `docker compose config` 已验证通过
- 当前本机 Docker Desktop daemon 未就绪，因此 PostgreSQL / Redis 容器启动和数据库迁移运行态验证仍未完成

## AI Recommendation

当前：

- 数据模型已经支持 embedding
- pgvector 基础已经存在

待完成：

- 真实 embedding 生成
- 向量检索
- 推荐排序模型

## Desktop

当前：

- Tauri 桌面端已接入
- 桌宠能力保留并继续作为独立交互入口
- Desktop Canvas 已建立：独立窗口、自由布局、Registry、持久化；当前内置 Desktop Organizer / Clock / Calendar / Folder / System Monitor / Notes / Weather / Launcher / Search / Disk / Todo / Clipboard / Music / AI 共 14 类 Widget
- Windows 桌面层挂载已实现：经典 WorkerW + Windows 11 `SHELLDLL_DefView -> Progman` fallback；debug HWND 烟测已确认 Canvas 实际成为 Progman 子窗口
- Canvas 非编辑模式已改用 Win32 HRGN 原生窗口区域，只保留 Widget / 控制条 / 弹层命中区域；`GetWindowRgnBox` 已验证为 Complex Region
- Explorer 恢复 watchdog 已升级并通过真实重启回归：如果 Canvas HWND 仍活着则轻量 reattach；如果 Explorer 连 child HWND 一起销毁，则等待桌面父层 ready 后用 `canvas-recovery-N` 代次 label 重建 WebView，恢复 attach / HRGN / 可见状态；失败的临时恢复窗口会销毁后重试
- Canvas 布局持久化已升级为 v2：保存显示器拓扑与 Widget `monitorId`，保留 v1 数据用于兼容/回滚，并支持旧布局自动迁移
- 已实现显示器几何/DPI/主屏变化后的 Widget 相对位置重映射、显示器消失回退主屏和 Inspector 指定屏迁移
- 当前 Canvas 仍是一张跨虚拟桌面的 WebView；真实双屏、热插拔和混合 DPI 尚未在当前单屏环境验证，如出现跨 DPI 渲染偏差需评估 per-monitor Canvas window
- Canvas 允许空画布、重复组件和任意正数尺寸，不使用固定尺寸档位
- Widget 已支持 Shift 多选、groupId 持久化、组合 / 拆分与组合联动移动；删除组成员后会清理单成员残留组
- Canvas 已统一为 20px 栅格：默认布局、拖动/缩放、新增 Widget 空位放置和手动“整理”共用同一对齐规则
- 默认 starter layout 已重做为紧凑两排并降低核心 Widget 默认尺寸；兼容历史 4/5 组件 starter，并针对开发阶段遗留的“6 组件 + 重复 Launcher”签名做一次性去重迁移；实机 LevelDB 最新记录已验证为 5 组件新布局
- 编辑拖动采用 Pointer Capture + 整卡拖动；2026-10-04 进一步改为像素级跟手 + requestAnimationFrame 合帧，20px 网格只在指针释放后吸附；拖动/缩放期间暂停 120ms 布局持久化调度，结束后统一恢复，避免高频 reactive/localStorage timeout churn；新增 3px 激活阈值，纯点击不会进入 frame interaction 或触发吸附，move/cancel/up 按当前 pointerId 隔离，并用 lostpointercapture 兜底清理；编辑态也不再每帧重复提交全屏 HRGN
- Canvas Motion V1 已完成：非指针布局变化支持 300ms 几何补间；真实拖动/缩放期间通过全局 pointer-active 状态禁用所有 Widget 几何 transition；补充 pointercancel/blur 清理和 reduced-motion 降级
- 2026-10-04 拖动态不再使用 transform scale，改为 grabbing 光标 + 阴影/描边反馈，避免视觉中心缩放造成鼠标锚点漂移；专项 Web/Rust/本地数据与 AI 回归、Debug 启动诊断均通过。真实双屏/混合 DPI、桌面右键/框选和桌宠“添加桌面组件”完整 GUI 链路仍属于人工门禁，不能用源码断言替代。
- Launcher 原 Sortable handle 因 `.drag-grip{pointer-events:none}` 无法命中，现改为整 tile 拖动并启用 fallback；Widget 主体拖动/缩放真实鼠标回归已通过，Launcher 排序仍在后续完整交互回归中继续观察
- Inspector / Launcher / Launchpad 已增加稳定 scrollbar gutter；Launcher 快速启动、Launchpad、Desktop Organizer 的 S1.9 连续 10 帧像素稳定性测试均为唯一哈希 1，未再观察到滚动条闪动/横向抖动；Inspector 继续随配置 GUI 专项覆盖
- 外观 Inspector 已支持名称、透明度、圆角、玻璃模糊与整组锁定
- 外观系统已升级 V2：玻璃 / 深空 / 轻透 / 实色四预设 + adaptive/dark/light 色调 + 表面浓度 / 边框 / 阴影强度；预设仅作快捷入口，手动参数可继续自由修改
- 旧 Canvas v2 Widget 缺少新外观字段时会自动补默认值，无需再次升级存储 key；仍需真实 GUI 视觉回归确认不同 Windows 背景下的对比度
- Widget Registry 已增加声明式 `configSchema`，Inspector 自动渲染 boolean/select/range/text；第一批接入 Clock / Search / Todo / Music
- 新增系统级 Desktop Organizer：仅扫描 Desktop 根目录、跳过 hidden/system 项目、按扩展名自动分类；原生桌面图标只在 Canvas 可见期间临时隐藏，Canvas 关闭/应用退出时恢复；应用启动会先恢复 Explorer 图标，修复异常终止后的隐藏残留
- 非编辑态 HRGN 已从矩形区域升级为跟随 CSS 圆角的 RoundRect 区域，正常态 Canvas backdrop 不再填充 Widget 圆角外的透明角
- Win11 Progman fallback 已再次校正命中顺序：Canvas 作为 Progman 子窗口放到 `SHELLDLL_DefView` 之上，由 RoundRect HRGN 控制实际可命中区域；实测顶部控制条和 Widget 坐标命中 Canvas WebView，HRGN 外空白不命中 Canvas。watchdog 对仍存活的 Progman/WorkerW 父层不再误 reattach
- 通用配置只操作 Schema 白名单键，Todo 数据、Launcher 固定应用、AI 工具选择等内部状态不暴露；恢复默认采用 merge，不清空其他 config
- Launcher 已支持小组件、快速启动中心和全应用 Launchpad 三级状态，并与原生穿透区域同步
- Clipboard 使用 Windows 原生 Win32 桥，只有用户主动点击读取时才访问内容；剪贴板文本不写入 Canvas 持久化
- Music Widget 已接 Windows GSMTC，可读取当前媒体来源、标题、歌手、专辑、播放状态和时间轴；系统媒体控制继续保留
- Music 已接 GSMTC Thumbnail：原生读取 WinRT Stream 后转 Base64，单图限制 4 MB；前端按歌曲键最多缓存 8 张，仅驻留内存
- Music 歌词为用户主动开启的可选联网能力，使用 LRCLIB 同步/普通歌词；歌曲元数据和歌词正文不持久化
- LRCLIB 请求已加入 6 秒超时、一次轻量重试和 exact → search 降级；外部歌词服务故障不会阻断本地媒体面板
- AI Widget 当前仅做 Prompt 快捷入口，不冒充原生模型对话；统一 AI Provider / Model Router 仍待实现
- 2026-09-23 Web `npm run build` 已在 Canvas Motion V1 后再次完整通过（vue-tsc 2.2.12 + TypeScript 5.9.3 + Vite 5.4.21；217 modules）；desktop mode Vite 构建基线继续有效
- Rust `cargo check --all-targets` 已通过；正确的 VS Build Tools 位于 `D:\\DevTools\\VisualStudio\\2022\\BuildTools`
- Stage 2 认证回归确认当前 v0.1 使用 7 天 JWT Access Token；401 已统一同步清理 Pinia/localStorage，网络/5xx 不再误删 Token。Refresh Token、Desktop 安全凭据存储仍按 Stage 4 处理
- Redis 架构决策已明确：Redis 7 环境可用，但 Backend 当前没有 Redis client 或运行时调用，v0.1 不把 Redis 作为启动/发布依赖；等出现明确缓存、限流或任务队列需求时再按缓存策略正式接入
- Stage 2 工具查询回归已修正两项运行时问题：访问范围条件使用 `Brackets` 避免 SQL `AND/OR` 优先级错误；收藏过滤改为参数化 `EXISTS`，不再依赖未定义的 `Tool.favorites` relation
- Stage 2 授权异常回归进一步修复：数字路由参数统一 ParseInt；收藏服务校验私有工具所有权；重复取消收藏不再错误递减计数；账号删除会先清理所有指向本人私有工具的跨用户收藏。已固化 `backend/scripts/s2-authz-regression.mjs` 作为双用户可重复回归脚本
- 工具 UI 状态清理已补齐 `toolTypeFilter = 'all'`；此前 S2.1 本地工具回归删除最后一个本地测试项后，残留 `local` 筛选会让“全部工具”页面视觉上变成空列表，但数据库中的 44 个内置工具实际仍完整存在
- `FavoritesService.getFavorites()` 仍保留 `select: ['tool_id'] as any`，属于类型层遗留，不影响当前真实数据库回归，后续 Backend 类型治理时清理
- Tauri optimized release 与 MSI/NSIS bundle 已于 2026-09-23 实际构建通过；当前 Runner 内 Tauri 直接拉起 `beforeBuildCommand` 会卡住，因此发布验收采用“先显式 `apps/web build:desktop`，再用 `tauri.release.conf.json` 跳过重复 beforeBuild”的稳定流程，正式跨平台配置不变
- Desktop 版本策略已固化为 SemVer，并提供 `npm run release:check-version` 检查 5 类版本来源；根仓库/Web/Backend package version 不作为 Desktop 产品版本真源
- Desktop 基础诊断日志已接入并在 release 实际写盘验证；当前只本地保留、不上传。后续若增加用户主动上传，需要单独做隐私字段审查与脱敏
- S2.3 升级回归使用独立 `com.flexikit.s2upgrade` + `target-s2upgrade`，0.1.0 → 0.1.1 NSIS 覆盖升级、单一卸载项更新、升级后启动和 WebView/localStorage Sentinel 数据保留均已通过；正式 `com.flexikit.desktop` 数据未被测试触碰。一次性升级配置、测试安装、专用 AppData 与测试 target 均已在验收后清理，流程保留在发布文档中
- 离线 release 冷启动已通过真实窗口截图复核：Backend/Vite 同时关闭时约 5.2 秒即可看到完整 44 工具工作台；此前 UIA 约 20 秒才完整属于 WebView2 Accessibility 树延迟，因此未为了测试工具延迟而错误收紧全局 API timeout
- 干净机发布回归已固化 `scripts/windows-clean-install-smoke.ps1`，会拒绝已有安装/AppData 并自动验证安装、UI、日志、卸载；当前机器 Hyper-V 已启用但无 VM，Sandbox Disabled 且无本地 ISO，因此最后的真实 clean guest 验收仍是外部环境阻塞项
- 动态恢复 label 会在 Tauri manager 内留下由 Explorer 外部销毁造成的旧 stale label；实际活动 Canvas 只使用当前代次，不影响运行，但长期多次 Explorer 重启后的 manager stale entry 清理可在后续评估更底层的 unregister 方案
- S3.1 全局搜索当前使用轻量本地索引而非 Windows Search/NTFS 全盘索引：应用源覆盖 Start Menu + Desktop，文件源覆盖 Desktop / Documents / Downloads（含可用 OneDrive 根），递归深度 4、最多 24,000 条、120 秒内存缓存。该边界用于控制 v0.x 成本和性能，不代表全磁盘搜索；后续若需要扩大范围应优先评估 Windows Search API，而不是无边界递归扫描
- 全局搜索快捷键当前固定为 `Ctrl+Shift+Space`。注册失败会写入本地诊断日志但不会抢占其他应用快捷键；可配置快捷键留到后续设置中心，不阻塞 S3.1
- S3.2 已安装软件目录已覆盖传统 Win32（HKCU/HKLM × 32/64 位 Uninstall Registry）、Start Menu 入口与 Store/MSIX PackageManager；目录只在本机内存中维护，5 分钟缓存，可强制刷新，不上传软件清单
- S3.2 已完成启动目标解析，但保留 `entry_path` 与 `launch*` 两套语义：`entry_path` 是原始发现入口（例如 `.lnk`），真正启动必须使用 `launchKind / launchTarget / launchArgs`；未解析或目标已失效的软件记录其 `launchTarget` 为空，后续 Launcher 不得回退到猜测路径
- Registry 软件目录即使过滤 `SystemComponent`、更新、Hotfix 等，仍可能包含 Runtime/SDK/驱动辅助组件；后续 Launcher 推荐必须优先使用已确认可启动的软件记录，不能把全部发现目录直接展示给用户
- S3.2 Launcher 推荐已落实上述约束：只对有有效 `launchKind / launchTarget` 的记录评分，Start Menu / Store 用户入口优先，Runtime / SDK / Updater / Driver / Helper 等名称在没有真实使用信号时强降权；Registry-only 项仅作低权重兜底
- 推荐个性化数据只保存在 WebView `localStorage`：`flexikit-installed-app-usage-v1` 最多 160 条，仅保存本软件内的启动次数与最近时间；同时只读取 FlexiKit 自己的 `flexikit-global-search-recents-v1`。当前不读取 Windows UserAssist、Prefetch 或其他系统级行为历史，也不上传软件使用记录
- Launcher 手动常用项复用 Canvas Widget 的 `launcherPinnedKeys`，没有单独数据库；第一次增删/排序会把当时的推荐序列固化，之后自动推荐不再覆盖用户顺序。当前稳定检查表中的“Launcher 常用应用回归”仍保留为后续真实 GUI 全流程回归门禁，避免把编译/启动烟测等同于完整鼠标交互验收
- S3.2 失效检测采用“保留用户意图而非自动删除”的策略：失效的 `app:*` 固定键继续保存在 `launcherPinnedKeys`，Launcher 显示禁用占位并统计失效数量，用户自行整理移除；如果软件之后以同名有效入口重新安装，该固定键可自动恢复绑定。完全卸载的软件若已从当前目录消失，占位名称只能从稳定键恢复，英文可能以规范化大小写显示
- 软件目录在 Launcher 首次挂载时强制刷新，之后快速启动/应用库每 60 秒至多触发一次强制刷新；这是为及时发现卸载/路径变化设置的产品层策略，不改变原生目录自身 5 分钟缓存机制。后续若软件规模显著增大，可把刷新改为 Windows 安装/卸载事件驱动或后台增量扫描
- S3.2 软件图标读取已经与启动路径解析隔离：前端只能按已发现的软件名请求图标，原生端从内部 `icon_hint` 读取，不开放任意文件路径图标读取接口；图标结果仅保存在进程内存缓存中
- 启动目标来源有明确可靠性顺序：Start Menu ShellLink/直接入口 > Store/MSIX AUMID > Registry `DisplayIcon` 现存 EXE。Registry 不扫描安装目录猜主程序，也不使用 UninstallString，避免误把卸载器、更新器、Runtime 或辅助进程当主应用
- `launch_installed_app` 不接受前端传入路径、参数或 AUMID，仅接受软件名并在原生缓存目录内二次查找启动描述；这样 Launcher 推荐或手动固定数据即使被前端状态篡改也不能借此打开任意本地文件。S3.2“手动添加 / 删除”仅管理已发现且可启动的软件与 FlexiKit 工具，不提供卸载能力，也不允许任意 EXE/AUMID 登记；未来若增加“浏览文件添加程序”，必须单独设计受控登记与持久化模型
- 多入口 Store/MSIX Package 若无法用 DisplayName 唯一匹配 AppListEntry，则保持 AUMID 未解析而不是任取第一个；后续若要支持同一 Package 多应用，应把发现模型升级为 AppListEntry 级记录
- S3.3 Desktop Organizer 已移除桌面路径的环境变量猜测，`desktop_roots()` 现在只信任 `FOLDERID_Desktop` 与 `FOLDERID_PublicDesktop` 的 Known Folder 结果，并在读取/打开校验中复用。全局搜索的 Desktop/Documents/Downloads 根目录仍有独立的环境变量策略，属于全局搜索索引实现，不应与 Organizer 的安全根目录混为一谈；后续若统一搜索根目录，应单独迁移对应 Known Folder ID 并回归索引范围
- S3.3 Desktop Organizer 图标接口不开放任意文件路径：`get_desktop_item_icon` 与打开项目相同，先经过 `resolve_desktop_item()` Known Folder 边界校验，再把 canonical 路径交给图标层。Windows canonical 路径通常带 `\\?\` 前缀，图标层仅在 Shell API 边界转换为普通 Win32/UNC 形式，不能把这种显示兼容转换用于绕过路径安全判断
- Desktop Organizer 图标前端缓存以完整项目路径为 key，成功与失败结果在当前 WebView 生命周期内复用；如果同一路径文件被替换且图标发生变化，当前版本不会立即主动失效缓存，重新打开 Canvas/应用后会刷新。若后续需要实时文件监听，可在 S3.3 文件事件层统一失效对应缓存
- S3.3 分类配置刻意保持为“目录类型 + 扩展名”模型，不引入正则、文件名条件、内容识别、优先级 DSL 或自动移动规则。规则存在当前 Organizer Widget 的 `organizerCategories` 配置中，因此多个 Organizer 实例未来可以有不同规则；当前 UI 最多接受 20 个分类、每类 80 个扩展名，基础文件夹/其他分类不可通过 UI 删除
- 编辑扩展名时采用唯一归属策略：用户把某扩展名填入当前分类后，会从其他扩展名分类中自动移除。这样无需向小白暴露“冲突优先级”；如果未来产品确实需要复合规则，应另建规则模型，而不是在当前数组上叠加隐式优先级
- 分类设置只影响 `groups` 计算和失败图标的类别兜底，不调用任何移动/重命名/删除原生文件接口；“不自动移动用户文件”仍是 Desktop Organizer 的固定安全边界
- S3.3 常用置顶复用当前 Organizer Widget 的 `organizerPinnedPaths`，按完整 canonical 桌面路径保存、最多 80 项；缺失路径只在当前 `items` 中无法匹配时隐藏，不自动删除用户的置顶意图。如果同一路径后续重新出现会重新进入“常用”。若未来需要跨重命名/移动追踪，应使用文件 ID/USN 等稳定标识另做模型，不能把当前路径列表误当成稳定文件身份
- “常用”只是 Organizer 的显示层排序：置顶项从普通 `groups` 过滤后单独展示，取消置顶立即重新按当前分类规则归组；不调用移动、复制、重命名或删除文件的原生命令
- S3.3“最近文件”当前准确含义是“当前桌面最近修改文件”，不是“最近打开”。数据来自 `std::fs::Metadata::modified()`，最多展示 6 个非文件夹、非置顶项；不读取 UserAssist、RecentDocs、Jump List、Prefetch 等系统级行为历史，也不新增持久化行为日志。若未来产品确实需要“最近打开”，应优先记录 FlexiKit 自己发起的打开行为并清晰区分语义，而不是静默扫描系统历史
- `modifiedAt` 以 UNIX 秒加入 Desktop item tuple，修改时间读取失败时返回 0 并自动排除“最近修改”分组，不影响普通分类或打开能力。文件系统时间可被外部工具修改，因此该排序只是便利视图，不应作为审计时间线或可靠活动记录
- S3.3 文件夹快速展开不是通用文件管理器：`get_desktop_folder_preview` 仅接受能通过 `resolve_desktop_item()` 的 Desktop Known Folder 路径，并对每个 canonical 子项再次做根目录范围校验；不会提供任意盘符浏览入口，也不实现移动/复制/删除
- 文件夹预览为按需单层读取，单次最多检查 512 个目录项并在排序后返回前 30 项；因此超大目录不会无限枚举，但也不保证展示第 513 项之后的内容。若未来需要完整大目录浏览，应做分页/游标而不是移除当前边界
- S3.3 Organizer 搜索是受控名称搜索，不是全文索引：只在 Desktop/PublicDesktop Known Folder 下递归最多 4 层，单次最多检查 5000 个项目并返回前 60 条；不会读取文件正文、文件内容元数据索引或其他盘符。若未来需要全文搜索，应复用/对接专用索引服务并单独设计隐私与资源边界
- 搜索结果 ranking 为精确 → 前缀 → 文件名包含 → 扩展名兜底，之后目录优先、较新修改时间优先、名称稳定排序。当前每次有效输入都在 180ms 防抖后触发一次 bounded native scan，没有持久索引；如果桌面层级/文件量明显增长，可再做短期内存缓存或文件系统事件增量索引
- S3.3 的固定产品安全原则是“Organizer 不自动修改用户文件”：当前原生 Organizer 模块没有 rename/remove/copy，前端也没有暴露此类命令。未来若产品新增整理/移动/重命名能力，必须作为新的显式用户动作单独立项，并包含确认、冲突处理、撤销/恢复策略与独立安全回归；不得通过扩展现有 Organizer 读取命令隐式加入
- S3.4 Calendar 当前是本地“日期导航”组件，不是日程系统：没有事件模型、提醒、系统日历/Google/Outlook 同步或账户权限。当前选中日期仅保存在组件运行态，周起始与相邻月份显示属于 Widget config 持久化。若未来加入日程/提醒，应单独设计事件 Schema、时区/DST、重复规则、权限与同步冲突处理，不要直接把业务状态塞进现有简单配置字段
- S3.4 Folder V1 只允许从 Desktop/PublicDesktop 顶层目录选择根文件夹，后续子目录访问继续依赖 `get_desktop_folder_preview` 的 Known Folder 边界；不提供系统级目录选择器或任意绝对路径输入。这是刻意的安全/产品边界，不是完整文件管理器。若未来扩展到任意用户目录，应新增原生目录选择器、显式授权根列表、失效/重授权机制与独立路径回归，不能直接放宽 `resolve_desktop_item()`
- Folder 仅把根路径与显示名存入 `folderWidgetRootPath / folderWidgetRootName`；当前导航历史和目录内容只存在运行内存。文件夹重命名/移动会导致保存路径失效，V1 保留该路径并提示重新选择；若未来需要跨重命名恢复，应考虑稳定文件 ID，而不是猜测新路径
- S3.4 System Monitor V1 的 CPU 是 `GetSystemTimes` 机器整体累计时间差分，内存是 `GlobalMemoryStatusEx` 物理内存，磁盘只展示当前 `SystemDrive`；不包含 GPU、温度、风扇、网络速率、单进程占用或多磁盘。CPU 首次采样必须等第二个样本才有有效百分比，这是正确的差分语义，不应使用伪造初值
- System Monitor 默认 2 秒刷新，另有 5/10 秒选项；原生端每次调用只做即时只读查询，不保存采样历史、不启动线程。若未来增加 GPU/温度/网络，应先评估 ETW/PDH/DXGI/WMI 的权限与长期常驻开销，避免把昂贵查询塞进当前轻量快照命令
- S3.4 Notes V1 直接复用 Widget config + Canvas localStorage，不建立独立 Notes 数据库；这适合纯文本速记，但正文单实例硬限制 12000 字符，且没有全文搜索、附件、版本历史、跨设备同步或冲突合并。若未来升级为真正笔记系统，应迁移到独立实体/存储层，不要继续无界扩张 Widget config
- Notes 的 `noteUpdatedAt` 仅表示 FlexiKit 最近一次便签内容/标题保存时间，不是审计时间；清空同样更新该时间。当前清空只有 3 秒二次确认，没有撤销/历史版本；若未来承载重要笔记，应优先加入本地版本/撤销机制后再扩展富文本或同步
- S3.4 Weather V1 的定位原则是“用户显式城市”，不读取 `navigator.geolocation`、系统定位或 GeoIP。只持久化 `weatherLocation / weatherTemperatureUnit / weatherShowForecast / weatherForecastDays`；解析出的经纬度和天气结果只保存在运行内存。城市解析当前取 Open-Meteo Geocoding 第一条结果，因此同名城市可通过“城市, 国家/省州”输入提高确定性；若未来做候选列表，应继续保持用户显式选择
- Weather 当前直接从 renderer 请求 Open-Meteo 免费域名，并在 UI 显示 attribution。**这是开发/非商业阶段方案，不是商业发布终态**：Open-Meteo 免费 API 条款限制为非商业使用。FlexiKit 商业化前必须使用付费 customer endpoint 或自托管；付费 API key 不能嵌入 WebView 前端，应通过 FlexiKit Backend/受控代理持有，或采用自托管服务。该项列为正式商业发布许可门禁
- Weather 同一城市在单次运行中缓存 geocoding 经纬度，周期刷新仅请求 forecast；进程重启后会重新 geocode 一次。默认 30 分钟周期、聚焦 5 分钟 freshness gate、单请求 10 秒超时；当前不持久化天气缓存，所以离线重启后不会显示陈旧数据。若未来需要离线体验，应给天气缓存增加 TTL 和“数据时间”标记，不能把旧数据当实时结果
- S3.4 Widget Plugin API V1 的 permission / networkOrigins / nativeCommands 当前是**声明与审计层**，不是 JavaScript 安全沙箱。现阶段 `source=extension` 只是为将来本地扩展预留的契约；产品不得据此直接开放第三方插件安装或远程 JS 执行。开放插件市场前必须增加真正的权限执行层、包签名/发布者信任、隔离运行环境、Host API capability gate、安装/升级/卸载与审计机制
- Plugin API 当前固定 `apiVersion=1` 且不提供兼容桥；不支持的版本注册时直接 Fail Fast。插件自己的 `version` 使用 SemVer，但目前没有独立插件迁移器或自动更新器。未来若 Host API 升级，应先设计 V1→V2 兼容策略和配置迁移，再允许不同 API 版本并存
- Widget 生命周期继续使用 Vue `onMounted/onBeforeUnmount`，临时状态归组件实例，持久状态归当前 `DesktopWidget.config`。该约定通过文档与代码契约约束，不会替插件自动释放定时器/事件监听/AbortController；新增插件仍必须在代码审查中验证 cleanup
- Config Schema V2 的 `visibleWhen` 当前刻意只支持单个 `{ key, equals }`，且注册时要求控制字段出现在被控制项之前；这避免循环依赖并保持 Inspector 可预测。当前不支持 AND/OR/NOT 表达式、嵌套 group 折叠或动态 Schema 函数；只有出现真实复杂配置需求时再扩展，不把 Inspector 演变为通用表单引擎
- `section` 只用于 Inspector 分组，不产生持久化 key/default；number/range 在读取和写入时都会 clamp + step 对齐，text 读取会再次执行 maxLength 截断，color 仅接受 `#RRGGBB`。Notes 的 `noteAccentColor` 与 Weather 的 `weatherForecastDays` 是当前 V2 真实使用样例。未来增加 file/folder picker 或快捷键 Schema 时必须同时定义权限边界，不能只添加前端控件
- Registry `DisplayIcon` 允许带资源索引，Start Menu `.lnk/.exe` 使用 Windows Shell，Store/MSIX Logo 会尝试匹配 `scale-*` / `targetsize-*` 资源；单个直接图片读取限制为 8 MB，Shell 图标统一转为 64×64 PNG。极少数旧式无 Alpha 图标可能视觉边缘不如系统原生 ImageList，后续若需要更高保真可评估 `SHGetImageList`/WIC

- S4.3 数据生命周期已闭环：服务器导出使用安全字段白名单，账号删除事务化并清理 Session/当前设备用户数据；保留的设计边界是其他设备本地副本无法远程擦除、诊断日志不属于账户删除范围、Canvas L2 内容在设备上仍为明文 localStorage。

- S5.1 Provider 抽象当前仍只执行文本生成最小公共契约，但模型能力元数据、Provider-reported Token/成本统计和统一 resilience 已完成。AiService 对三家 Provider 提供真实 AbortSignal 取消、单次/总预算、有限瞬时重试和 implicit-platform-only fallback；显式 Provider/Model 与 BYOK 不跨供应商。当前 fallback 顺序仍由 Registry 注册顺序决定，尚未引入基于健康度/成本/地区/SLA 的动态路由，这应在出现真实多 Provider 生产流量后再设计，避免过早复杂化。
- OpenAI Provider 当前为同步文本 Responses API 基线：默认 gpt-6-sol，目录同时暴露 Astra/Luna；OPENAI_MODEL 可补充自定义/快照模型。Responses usage 已归一化并进入统一账本，标准价与 >272K 长上下文倍率进入版本化定价目录；AbortSignal/Retry-After/瞬时重试/fallback 已由统一层覆盖，credit/spend/usage-limit 429 明确不可重试。adapter 仍未实现 streaming、reasoning effort、tool calls、vision、structured output。
- Gemini Provider 当前为同步文本 generateContent 基线：默认 gemini-3.8-flash，支持 3.5 Flash / Flash-Lite 与 GEMINI_MODEL 自定义覆盖。usageMetadata 已归一化 prompt/cached/candidates/thoughts/total；AbortSignal 与瞬时 429/408/5xx 重试由统一 resilience 层覆盖。仍未实现多 candidate、streamGenerateContent、thinking level、tools、multimodal。
- Anthropic Provider 当前为同步文本 Messages API 基线：默认 claude-sonnet-5，支持 Opus 5 / Fable 5 / Haiku 4.5 与 ANTHROPIC_MODEL 自定义覆盖。Messages usage 已归一化并持久化 cache-read/cache-write 分类；AbortSignal 与瞬时 429/408/5xx 重试由统一 resilience 层覆盖。adapter 当前仍统一拒绝 temperature/assistant prefill，且尚未实现 streaming、adaptive thinking/effort、tools、vision/PDF、structured output。
- BYOK 已接入 S5.2 原生桌面 AI 助手：Windows Desktop Key 仍只保存在独立 DPAPI Current User Vault，Browser Key 仍只在页面运行期内存中；发送时由客户端桥接层临时读取并只附在单次 assistant 请求，Backend 创建请求级临时 Provider 后即丢弃，Key 不进入 PostgreSQL、普通备份、全局 Provider Registry、响应或 catalog。当前仍没有云端 BYOK 同步、跨设备复制、Key 主动有效性探测或商业 Entitlement 门控。
- S5.2 AI 助手基线已完成：独立问答 + 当前工具安全元数据 + 用户显式文本文件 + 按需 Clipboard + session-only Prompt 历史策略 + 本地静态快捷操作。快捷操作只修改 composer，不自动发送/读取上下文/记录分析。当前仍没有服务端会话表、PDF/Office/图片解析、streaming 或本地 Prompt 历史；未来若做本机历史必须新增独立显式 opt-in。
- S5.3 推荐行为事件当前为 device-local foundation：只记录 toolId/type/timestamp，no server event warehouse/analytics/attribution/source/query capture。它只服务后续本地或混合推荐信号；若未来需要跨设备推荐或服务端聚合，必须先设计独立云端授权、retention/export-delete policy，不能复用当前 device-local consent 偷渡上传。
- S5.3 标签匹配保持 deterministic local layer：只用行为事件对应 Tool 的 tags/category，显式静态权重与 clamp，同分稳定保留上游候选顺序；它仍不读取热度、view/click、时间衰减、Embedding 或随机值。S5.3 热度排序已经作为独立服务端公开信号完成，不能反向改变标签层权重语义。
- S5.3 热度排序当前以公开 upvotes/comments + freshness 为唯一输入：engagement 55 分、freshness 45 分、14 天半衰期，查询排序与响应回填共享同一公式。discovery_tools.hot_score 列暂时保留作为兼容/最近计算值，但 hot/recommendations/rankings 不再按该静态列排序；若未来加入 view/click 或用户行为，必须单独定义数据来源、抗刷/隐私和权重审计。当前 Runner 对本机 PostgreSQL 连接返回 EACCES，因此 live SQL smoke 未执行；源码 build/公式 regression/type-audit 已通过。
- S5.3 Embedding Pipeline 已完成生成/同步层：只处理 public Tool（user_id IS NULL），OpenAI text-embedding-3-small 1536 维，canonical input 不含 private/local path 或 URL path/query，且同步必须显式执行 embedding:sync。provenance/source hash 防止模型/规范变化后继续误用旧向量，写入前 row lock + source recheck 防止陈旧结果覆盖。当前不自动重试 embedding Provider，也没有将用户自建 Tool 送往外部 Provider。Runner 当前无法连接 localhost:5433，因此 AddToolEmbeddingProvenance migration 尚未在本轮环境验证实际落库，数据库可连接后必须先 migration:run 再执行真实 embedding:sync。
- S5.3 pgvector 当前为 exact cosine search baseline：ToolVectorSearchService 使用 PostgreSQL <=>，仅查询 public + current-provenance + non-stale embedding，并将 vector/exclusions 参数化；应用层不做向量相似度循环。暂不创建 HNSW/IVFFlat，因为当前没有数据库连接可执行代表性 EXPLAIN/EXPLAIN ANALYZE，也没有已测量的 exact-search latency 瓶颈。若后续公共向量规模/延迟达到瓶颈，优先评估 HNSW vector_cosine_ops，并必须以真实数据的召回、P95 和写入成本为依据。
- S5.3 相似工具推荐当前使用“最近最多 3 个公开收藏 seeds + pgvector semantic candidates + public popularity fallback”的确定性混合策略；兼容 /recommendations 继续返回 Tool[]，/recommendations/explained 只额外暴露 coarse、可审计的 similar_favorite/popular 原因与可选公开种子名称，不包含 similarity/cosine、embedding/provenance、内部 rank 或数值置信度。Discover 的 device-local tag/category affinity 只在客户端转成解释并参与重排，因此服务端仍看不到本地行为事件。当前没有跨设备行为学习、用户私有 Tool embedding、ANN、多臂老虎机或探索随机化；未来扩展解释必须继续保持 coarse/auditable，不能上传完整本地行为历史或泄露向量内部量。
- 模型能力标签是声明层，不等于功能实现层。native 表示厂商当前文档声明，adapter 表示 FlexiKit 当前代码真正可调用；后续新增 streaming/tools/vision/structured output/reasoning 时必须同时更新 adapter 标签与回归。内置模型以 2026-09-26 官方资料为基线，厂商能力变化需重新核对；任何自定义/快照模型在未验证前 native 全部为 unknown，不能从模型名称猜测能力。
- Admin Console V1 已从启动期只读白名单升级为最小持久权限模型，并完成账号删除与 AI Usage & Cost 实数统计。AI Usage 只消费 Provider-reported usage，展示平台/BYOK 分账、Provider/模型聚合与请求级成本估算；估算不包含 Provider 工具/搜索/缓存存储等非 Token 费用，也不等同最终供应商账单。定价目录需要随 Provider 官方价格变化显式更新，未知模型/过期价格不会自动猜价。Admin audit 当前仍是应用层 append-only，不等于监管级 WORM 存储；组织级 RBAC/JIT/双人审批仍按后续商业需求升级。

后续：

- Widget 点击/拖动/缩放、Organizer 双击、HRGN 透明区域命中与真实 Explorer 重启恢复均已完成；真实桌面右键菜单/框选作为扩展人工回归继续保留
- 完成真实双屏 / 热插拔 / 主屏切换 / 混合 DPI 的实机回归
- 完成 Widget 外观 V2 的真实 GUI 视觉/交互回归
- 扩展更多外观主题预设，并让后续 Calendar / Folder / System Monitor 直接复用 Registry 配置 Schema
- 继续评估不同播放器对 GSMTC Thumbnail / 时间轴的兼容差异，并推进统一 AI Provider 接入
- 完成真实干净 VM / 新机器安装验证；自动更新架构方案已完成，但在线 updater 插件、正式签名密钥与发布端点必须等基础设施就绪后再启用，并在 Stage 6 做稳定性回归
