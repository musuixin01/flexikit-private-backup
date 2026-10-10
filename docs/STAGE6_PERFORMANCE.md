# FlexiKit Stage 6 — 性能指标与测量基线

> 状态：本机手动资源测量、Canvas Store 20 轮隔离回归与 WebView2 关键页面 DOM 延迟样本已完成；Release / 真实首屏 / Native Canvas / 用户真实交互仍未验收（2026-10-08）。Windows 缩放跳动暂缓，未宣称解决。

## 一、测量范围与隐私原则

本阶段覆盖：启动时间、内存、CPU 空闲占用、Canvas 稳定性、关键操作耗时。所有数据必须注明执行程序、是否 Debug/Release、测试时长、显示器/DPI 和运行负载。隔离开发版不能冒充正式版成绩。

测量由开发者手动启动，默认只输出 JSON 到终端：**不定时后台采样、不保存文件、不自动上传、不接触用户页面/网址/Prompt、剪贴板、个人文件、进程完整命令行或路径**。原生进程采样只接受 FlexiKit Desktop 或 isolated resize-test 本机 PID，且只读宿主及后代进程的 CPU/内存/线程与数量。启动测试只启动和回收自己创建的隔离测试程序，不关闭正式版，不清理 Canvas 配置。

## 二、已交付的工具与使用方法

脚本：scripts/windows-stage6-performance.py（Python 3.12 + psutil，Windows）。

在项目根目录手动执行：

    python -B scripts/windows-stage6-performance.py --self-test
    python -B scripts/windows-stage6-performance.py --pid <FlexiKit-PID> --seconds 30 --interval 1
    python -B scripts/windows-stage6-performance.py --startup 3

- --pid 对已运行进程只读采样，要求进程名称和 EXE basename 均在显式白名单中。时间 2–120 秒、采样间隔 0.25–5 秒；若进程退出，立即失败。
- CPU% = 进程树 CPU 秒数差 / 采样实际秒数 / 逻辑处理器数 × 100，代表**整机 CPU 处理能力占比**。
- Windows 工作集（Working Set/RSS）之和**重复计算共享内存页**；同时输出 Windows 可访问时的各进程独占物理内存（USS）合计，不能把 RSS 总和称为独占内存。
- 同时按宿主、msedgewebview2.exe、其他子进程分组，输出采样 p50/p95/峰值、子进程和线程数。不读取 WebView 内容与用户路径。
- --startup 最多 5 次，要求事先关闭已有隔离测试进程；独立 Tauri 测试身份（只有主窗口，无桌宠、Canvas、后台索引），在默认 GPU 合成条件下记录：进程创建到 Windows 主 HWND 可见、WRY_WEBVIEW 子 HWND 出现、CDP 页面目标出现。仅属**温缓存启动检查点**，不是用户可见首帧，也不是正式版冷启动或发布 SLA。

## 三、2026-10-08 第一轮内部冒烟记录

设备条件：Windows；16 个逻辑处理器。独立测试目标：D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe；默认非透明 GPU 合成和完整 Desktop 网页资源。最先进行的隔离样本中没有正式 FlexiKit 进程；随后在同日另行启动已知 SHA256 的正常 Desktop 开发版并追加真实进程样本，两类数据独立列示，不能混算。

| 指标 | 初始隔离测量 | 限定解释 |
| --- | --- | --- |
| 主 HWND 可见 | 558、339、343 ms；中位数 **343 ms** | 3 次温缓存启动，不是 DWM 最终呈现 |
| WRY_WEBVIEW 子窗出现 | 558、339、343 ms；中位数 **343 ms** | 不代表 Vue 首屏全部绘制 |
| Chromium 页面目标可访问 | 765、524、503 ms；中位数 **524 ms** | CDP target 不是首屏可用 |
| 空闲样本 | **7 次 / 7.5 秒** | 隔离程序 PID 10280，未主动操作 |
| Tauri 宿主工作集 | 中位数 **9.94 MiB** | 单个测试主进程 |
| WebView2 子进程工作集之和 | 中位数 **125.23 MiB** | 共 6 个 WebView2 后代 |
| 全进程树工作集之和 | 中位数 **135.34 MiB**；p95 136.17 MiB | 共享页可能被重复计算 |
| 进程树 USS 独占内存之和 | 中位数 **52.61 MiB**；p95 52.67 MiB | 当前 Windows 可访问 USS |
| 整机 CPU 占比 | 中位数 **0.00%**（两位显示） | 只代表此短时空闲采样，不能宣称永远是零 |

以上隔离数据只说明测量链路可用，不代表真实用户工作负载或发布性能达标。此前留下的隔离窗口已单独退出，正式安装版与用户数据不动。

### 同日追加：真实 FlexiKit Desktop 开发版，非 Release

使用 SHA256 为 460C44B791C03B754AF68FF052F1D19F327D32D690B96EE105EF8B30CAE8C183 的现有、**未重新构建**桌面开发 EXE，由同一 Windows 用户交互会话启动，新 PID **38324**（主窗口 FlexiKit 与桌宠 FlexiKit Pet Ready 都已实际显示）。一次性启动计划任务已注销；未覆盖安装程序、持久化数据或项目工作区。

30 个逐秒资源样本的实际采集历时 **33.39s**，仍为一台机器、一段本地低交互状态，不包括 Canvas 20 循环、跨屏或优化 Release；不读取用户桌面内容。

| 真实开发版项目 | p50 | p95 | 最高值 |
| --- | ---: | ---: | ---: |
| CPU 占整机总计算资源 | **0.27%** | **1.05%** | 1.63% |
| Desktop 主宿主工作集 | **61.34 MiB** | 61.69 MiB | 61.69 MiB |
| WebView2 子进程工作集之和 | **660.50 MiB** | 666.16 MiB | 670.94 MiB |
| 整个进程树工作集之和 | **732.35 MiB** | 737.88 MiB | 743.20 MiB |
| 整个进程树 USS 独占内存之和 | **263.05 MiB** | 272.99 MiB | 274.63 MiB |
| WebView2 后代进程数 | **8** | 8 | 8 |
| 线程数量之和 | **274** | 278 | 279 |

解释：进程树工作集可能重复计算共享页面，因此实际独占内存应优先参考约 263 MiB USS。CPU 采样的 0.27% 是整机 16 逻辑处理器归一化值，不能解读为“一个 CPU 核心被占 0.27%”；设备上其他程序负载、用户是否有轻微交互和 GPU 实际帧开销未在此次采样中单独控制。真实生产程序保持运行，以方便后续本人验证。

## 四、接下来的正式测量与验收方式

**启动时间**：对真实 Desktop 的开发版与优化 Release 分开测至少 3 次，明确标记进程启动、窗口可见、WebView2 页面就绪和**真人观察到可操作工作台**四个时间点。当前脚本只能覆盖前三项。要测冷启动需征得许可并确保不误关用户会话或强行清缓存。当前已有隔离版温启动数字不可作为 Release SLA。

**CPU / 内存**：测试者自愿在本人设备启动正式 FlexiKit 后，手动对它的 PID 采样，每组至少 30 秒：工作台稳定空闲；仅打开桌宠；显示静态 Canvas；交互之后恢复空闲。CPU 记录 p50/p95，工作集和 USS 分列并注明 WebView2 子进程数；记录测试期是否操作了应用。100%、125%、150% DPI、多屏、显卡型号仅记录实际可得的自愿环境，不虚构覆盖。

**Canvas 稳定性**：在隔离或有备份的测试 Profile 中开展至少 20 次组件添加、拖动、缩放、编辑/锁定、Canvas 显隐和重启恢复循环。检测无响应、GPU 峰值、布局/数据丢失与 30 秒静止 CPU/USS。绝不为了测量改动用户原有 Canvas 布局或读取 Todo、Clipboard、Music、AI 的私有内容。对应 Widget 持久化与生命周期合同仍以 docs/DESKTOP_CANVAS.md 为准。

**关键操作耗时**：手动计时工作台/全部工具切换、工具库本地搜索稳定、网页工具预览、Canvas 显隐与新增空白组件；每种至少 10 次，记录 p50/p95、失败次数与真实完成标准。计时只存操作类别和持续时间，不保留搜索词/工具名/URL/路径。网络 API 时间另计，不能与纯前端响应混算。

**门槛**：同机器、同构建、同业务负载的重复 p95 若持续恶化超过约 20%，应作为性能回归线索而非跨设备发布判据。首批 6–10 位自愿用户完成 7 天测试后，才设置可靠的首屏、CPU、内存和交互绝对预算。崩溃、数据损坏、隐私风险仍依据 P0/P1 单独阻断发布。

## 五、状态与待办

- [x] 手动白名单资源监视 + 启动检查点脚本；自检 5 项通过。
- [x] 隔离版空闲 CPU/USS/RSS 7 样本，温启动 3 组；采样与测试对象边界记录。
- [x] 当前 Desktop 开发版实际进程 30 样本/33.39s 的 CPU、RSS 与 USS 初步基线（仅这台机器、低交互，不代表发布达标）。
- [ ] 真实 Desktop Debug / Release 冷热启动至屏幕可操作、优化 Release 与多次不同负载的可重复 30s 稳态指标。
- [x] Canvas Store 独立纯内存 20 轮模拟组件增删/锁定/分组/frame 更新/持久化/重载（104 项断言通过），不等于原生 GUI 已通过。
- [x] 独立 Tauri WebView2 工作台与工具库各 20 次 hash 导航→目标 Vue DOM→两个 rAF，P95 约 93/123ms。
- [ ] Pet + Canvas 真实 WorkerW/WidgetHost 鼠标与窗口显隐、跨屏恢复的 20 轮操作及 CPU/GPU 测试。
- [ ] 原生鼠标和 DWM 最终帧、工具搜索与导入等端到端关键交互 p50/p95（本轮仅有隔离路由 DOM/Store 方法基线）。
- [ ] 6–10 位自愿参与者的 7 日试测与发布门槛判定。

## 2026-10-10：隔离 PostgreSQL 配对事务安全验收

在全新 TEMP PostgreSQL 18.4 实例中真实执行浏览器配对/刷新会话 3 份迁移 up/down、FK/index 检查、TypeORM 双并发 approve/complete、唯一 extension 会话、错误密钥 5 次锁定、签发失败事务回滚与重试，全部 PASS 并自动停机清理。无用户数据库或安装版修改；这属于**发布安全/一致性验证而非性能指标测试**，目标 PG16 及完整浏览器 E2E、Release/WorkerW/真实 GPU/DWM p95 仍未验收。见 `docs/STAGE6_POSTGRES_PAIRING_VERIFICATION.md`。

## 2026-10-10：隔离后端构建与 Nest 真实 HTTP 验证补充

- 系统 TEMP 独立源码副本（无 .env、无用户数据）安装锁定依赖，**真实 Nest CLI build + TypeScript --noEmit PASS**；原项目不完整的 node_modules 未修改。
- 真实 Nest TestingModule + 127.0.0.1 临时端口 + 实际 Guard/Controller/AdminAccessService（账号 Repository stub、爬虫 Stub）验证：401 匿名/无效令牌，403 非管理员/停用管理员，201 有权限触发，429 并发或重复来源。10 个维护路由皆运行成功一次，不进行网络抓取。
- 本轮仅验证服务端的功能性稳定性，不采集 CPU、内存或响应时延数据；Release/真实 AppModule/真实数据库未完成。新增 TypeORM extension_pairings 迁移因无隔离 PG（Docker 状态查询超时）未执行。详见 `docs/STAGE6_BACKEND_ISOLATED_VERIFICATION.md`。

## 2026-10-10：Stage 6 状态性能复测与公测安全门禁

- 执行 `npm --prefix apps/web run test:stage6-canvas-performance`，真实 `desktopCanvas.ts` + Vue + Pinia 在隔离 Node 内存 localStorage 上完成 **20/20 轮、117 项断言**；没有打开系统 Canvas、没有读取用户配置或写入浏览器真实 Profile。
- 本轮 `addWidget` 40 样本 p50 **0.482ms**、p95 **1.233ms**；`updateFrame` 160 样本 p50 **0.054ms**、p95 **0.123ms**；`removeWidget` 40 样本 p95 **0.621ms**。共 48 次内存存储写入、拖动帧更新期间 0 次重复持久化，测试末尾 5 个基础组件正常重载。
- 上述耗时是 Node 中的**同步 Store 方法成本**，包含 VM 波动，不是 WebView2 Canvas 绘制、GPU/DWM 或人手交互延迟；不能因相较 2026-10-08 单次基线变大就直接断言产品出现性能回退。须同版本/同机器/同负载重复多轮，结合 Release 真实屏幕基线复核。
- 公测 P1 安全门禁：此前 10 个匿名可触发的手动爬虫接口已新增管理员 + JWT 守卫、单进程单任务运行锁与同来源 60 秒冷却，`npm --prefix backend run test:crawler-manual-security` Mock 通过。由于后端 node_modules 安装不完整，**尚未有真实 HTTP/数据库完整验收**；定时爬虫运行和已有内容未改变。分布式限流/取消超时另行评审，见 TECH_DEBT。
- 下一验收：隔离的完整后端依赖/构建与 401/403/429 真 HTTP，Release/原生 Canvas 20 次实机操作、交互/DWM 最终帧及 6–10 位自愿用户 7 日试测。不得把任一 Mock 测试当作发布通过。

## 六、2026-10-08：Canvas Store 20 轮与 WebView2 路由实际渲染基线

**严格隔离**：用户已暂缓窗口缩放，未改动缩放源代码或正式桌面用户数据；专用测试不用真实 Canvas Profile。

1. `apps/web/scripts/stage6-canvas-performance.mjs`：esbuild 加载项目真正 `desktopCanvas.ts`、Vue 3 与 Pinia；Window/localStorage 只在 Node 内存中模拟。每轮增添两组件，选择、组合、拆分、锁定并检查禁止移动、解除锁定、交互过程中 8 次位置/尺寸更新、检查暂停持久化、放手后延迟写入、删除两组件和检查初始布局；每轮结束校验存储 v2，20 轮后全新 Pinia 从内存恢复 5 个原始组件，并检查事件监听释放。**20/20 轮、104 项断言通过，42 次内存写入**。
2. `scripts/windows-stage6-interaction-latency.py`：只启动隔离 Tauri/WebView2 测试 EXE，切换 `#/app` 与 `#/app?view=library` 各 20 次，用 CDP 在目标 Vue DOM 实际存在且经过两个 requestAnimationFrame 后计时；不读页面文本、工具名、用户存储、不上传或保存截图，测试完成仅退出自身创建的进程。

| 样本 | 次数 | P50 | P95 |
| --- | ---: | ---: | ---: |
| Canvas Store 增加 Widget | 40 | 0.255ms | 0.573ms |
| Canvas Store 更新 frame | 160 | 0.026ms | 0.070ms |
| Canvas Store 删除 Widget | 40 | 0.068ms | 0.193ms |
| Canvas Store 组合 Widget | 20 | 0.077ms | 0.127ms |
| WebView2 切入工作台 (DOM+2帧) | 20 | 92.30ms | 92.82ms |
| WebView2 切入工具库 (DOM+2帧) | 20 | 92.85ms | 122.90ms |

特别限制：Canvas Store 同步方法时间**不是 WebView/WorkerW 绘制**。20 轮含每轮固定等待约 465ms，轮次耗时不能作为 GUI 交互时间。WebView2 路由测试也没有执行真实鼠标点击、没有测 DWM 屏幕最终呈现。Canvas WidgetHost 真实鼠标拖动/缩放、WorkerW/HRGN、Canvas 显隐/重启、用户桌面图标恢复、Release 与多 DPI 仍需要独立 Profile 的实机验收；Stage 6 性能指标不标记完成。

运行：`cd apps/web && npm run test:stage6-canvas-performance`；项目根 `python -B scripts/windows-stage6-interaction-latency.py --iterations 20`。两个程序都不会主动修改用户 Canvas 数据。

**本轮最终门禁**：项目命令 `npm run test:stage6-canvas-performance` 再运行 20 轮/104 项断言 PASS，复测采样受宿主瞬时调度影响出现自然波动（新增组件 P95 0.645ms、更新 frame P95 0.063ms；上表为先前首轮测试值，非固定承诺）；`npm run build`（vue-tsc + Vite）、现有 `test:desktop-live-resize-regression`、`git diff --check` 均通过。实际 Desktop 开发进程 PID 38324 未关闭，隔离 WebView2 测试进程已由测试器自行退出。未触碰正式 Canvas/Profile、桌面图标、已安装版或用户数据。

**阶段结论：** Stage 6 性能指标进入可测量阶段，但整体项目不能勾选“完成”；下一项继续补真实 Desktop / Canvas 的实机指标，不自动跳到新手引导或商业化阶段。
