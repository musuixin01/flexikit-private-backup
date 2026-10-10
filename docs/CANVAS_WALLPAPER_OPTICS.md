# FlexiKit Wallpaper Optics — 原生壁纸 GPU 折射试验

> 2026-10-09 ｜ Stage 6 用户插单，实验功能，默认关闭。本说明记录已验证的能力与未覆盖边界，不等于正式版完成或 Apple 私有 Liquid Glass 的完整复刻。

## 2026-10-10 单一连续弱折射曲线与水纹移除

用户发现上一版的过渡仍不自然。根因核查：GPU 另起五点纹理模糊层，在距 Widget 边缘 4–34px 以与 CSS 磨砂不同的曲线混入；折射另有 0–5–32px 双段光学振幅；随时间推进的 sin 波纹又呈明显流动环。三种互不一致的曲线叠加，易在边缘形成可见环状/双层过渡。

本轮仅修改本机静态壁纸 GPU Shader（apps/web/src/desktop/wallpaperRefraction.ts），不更改用户持久化 Canvas 布局及 CSS 主题。改为一个解析型低幅连续光学曲线 (1-exp(-d/4.5))*exp(-d/17)；偏移缩小为 (3+1*strength)*band，常规 glass 最大约 2 像素；保留向卡片内采样和原来正确的 UV Y 轴。圆角 AA 由固定 1.25px 改为基于 fwidth(sdf) 的像素自适应覆盖，去掉中间额外 GPU 五点模糊，让既有 CSS backdrop-filter 统一承担磨砂。时间正弦 ripple 改成低强度、无自主摆动的 pointer parallax。边缘明暗压至 .008/.004、14px 连续指数衰减，壁纸原本五次采样改为一次，理论上减少 GPU 片元纹理访问，不额外读取窗口/录屏/上传/持久化壁纸。

验证：Vue Desktop build PASS，折射专项 42 项、Canvas 控制台、GPU 恢复 36 项、布局 122 项均 PASS。Windows gnullvm Debug Native Build PASS；旧 EXE SHA256 995B1237B6BEA832E2A0A1349E09C07AD88444B1BA2A4262C5F817C4C4DE3362 已核验备份至 D:\AI_Cache\flexikit-runtime\flexikit-desktop-before-single-lens-20261010.exe，单独停止旧 PID 35444 时恢复了原本隐藏的 Explorer 图标。新 EXE SHA256 79333BB45EFBC5970D8D2EC92491DE76642E46DC2CA8BF5D48A9DF4D31CF402D 正在单实例 PID 18848 运行；Windows UIAutomation 验证主窗/Pet/WorkerW Canvas，5 个现存 Widget 未改，人工触发试用后 GPU「关闭折射」表示已进入 ready。未直接检查用户屏幕的最终视觉，是否自然仍待用户确认；大屏/Release GPU 性能与真实 Explorer 失效尚未终验。

## 2026-10-09 玻璃边缘到磨砂体的连续羽化

用户截图反馈边框与模糊交界形成一条清晰壳/雾化体的突兀接缝。核对实际材质发现原 Shader 在 sdf>0.0 直接 discard，边缘法线采样 band=1-smoothstep(0,18,-sdf) 在边界强度最大，紧邻处的 CSS widget body 又采用 5px inset 的独立椭圆护字层；因此 GPU 折射层、物理 border 和磨砂层缺少共同的空间缓冲。

修复：GPU 片元改为 1.25px SDF alpha coverage 平滑圆角轮廓，位移在真正物理边缘为零、距边界 5px 逐渐形成弱折射、向 32px 完全衰减；磨砂增强从距边缘 4px 起经 34px 平滑进入中心，用本机壁纸 atlas 的一个基础样本与四个临近样本进行轻柔混合，保持相同纹理轴方向及 UV 边界裁剪。高光强度由 .035/.014 降为 .018/.008，并依 25px 光学带软衰减。CSS 唯一实体线仍是 0.75px 但 rim 透明混合比例 36%→24%；主玻璃顶光添加低对比 9/5/2% 渐变过渡。widget-body 由 inset:5px/radius:16px 改为 inset:0/radius:inherit 的中央径向渐淡内容板，使边框附近无独立内圈断层、文字仍保持 100% opacity。无图片持久化、无桌面窗口/图标屏幕采集。

测试：Desktop Vue build:desktop PASS；折射专项 40 项（含边缘光学位移归零、中心磨砂渐入、alpha coverage 与护字板无内圈断层）、Canvas 控制台合同、122 项布局和 36 项 GPU 恢复通过；Windows 官方 gnullvm Debug 构建 PASS。旧 EXE SHA256 9D7AE993C21BF58BAA4447B95931E8F88A6DD968741C92CECE8D013E76D0A289 已备份至 D:\AI_Cache\flexikit-runtime\flexikit-desktop-before-feathered-glass-20261009.exe，新 EXE SHA256 995B1237B6BEA832E2A0A1349E09C07AD88444B1BA2A4262C5F817C4C4DE3362 正在 PID 35444 运行；原生 UIA 找到主窗/桌宠/WorkerW Canvas，当前 5 个用户保存组件不变，手动开启 GPU 后 UI 显示「关闭折射」。需用户现场观察视觉是否完全符合期待；新增 4 tap 纹理的 Release/GPU 长期耗电和大屏性能仍需后续基准测试。

## 2026-10-09 移除双重玻璃亮框的实机改进

用户指出上一轮由 2px → 1px 后边缘依然过粗，源代码检查证实视觉轮廓叠加了：WidgetHost CSS 边框 + 单独 ::after 高光 mask ring + top/left/right inset shadows + 重复 gradient glint + GPU shader 40px SDF halo。只缩窄 ::after 无法消除其它亮线。

本轮将常态玻璃本体减为 **0.75px、36% 主题 rim 混合透明细描边**，彻底关闭 ::after 重复描边，取消常态内侧高光和暗色下沿叠描，减轻左上光斑、鼠标高光与外阴影，保留独立文字板、拖动和选择。选中与移动的强调圈也统一为 1px，保持编辑可发现性。Shader 保持前轮的 samplePoint=pixel-bend 内向折射，但光学边缘影响带从 40px→18px、亮边强度从 0.15→0.035、暗边 0.055→0.014；避免卡片在强色壁纸上形成宽亮框。

桌面前端 build:desktop 成功；折射回归 34 项，GPU 恢复回归 36 项，布局 122 项，Canvas Console 既有功能测试均通过。Console 原旧断言必须存在 mask-composite 双边框，与本轮“取消双层描边”的用户要求相冲突，已根据新目标更新为检查唯一低对比边框，并在 errors-log 记录。Windows 原生 gnullvm Debug 完整编译通过；旧运行 EXE SHA256 4E27476C34422E66BE1531C52031F8D454B48D74BF1B51B3EA4C747BC2361A4C 已备份校验为 D:\AI_Cache\flexikit-runtime\flexikit-desktop-before-hairline-border-20261009.exe，恢复 Explorer 图标后安全重启。新版 EXE SHA256 9D7AE993C21BF58BAA4447B95931E8F88A6DD968741C92CECE8D013E76D0A289，当前单实例 PID 14188，实机 UIA 看到 FlexiKit 主窗、Pet、Canvas 原有 6 个组件，手动试用折射成功进入 GPU-ready「关闭折射」。用户实际是否觉得边框够轻薄仍需其目视验收；未截屏保存/上传、未修改六组件存储与布局、未修复暂停的主窗口 Resize。

## 2026-10-09 实机折射方向与玻璃边框微调

用户反馈当前背景像被反向拉扯。核对实际 GLSL 发现先前采样 pixel + bend，其中 normal 指向卡片外部，使卡片边缘采样向外偏移；修为 pixel - bend，沿卡片内部方向取样。边缘法线位移从 10+5*strength 降为 5+2*strength 像素级别，指针切向波纹从 4.5 降到 1.8，避免过度拖拽。上传 atlas 的 UNPACK_FLIP_Y_WEBGL=true 配合 uv.y 的 1-uv.y 仍属一致的上下方向转换，故未改变整张壁纸的 Y 取样。CSS 高光 rim 从 2px / .96 opacity 收细为 1px / .72，内嵌高光亦减轻；编辑与选中交互保留。

构建验证：npm run build:desktop 通过；折射回归扩展到 29 项（包括四个边缘向内采样与壁纸 UV 方向不被反转），GPU 恢复 36 项、Canvas 几何布局 122 项全部通过。官方 Windows gnullvm Debug 编译通过，新 EXE SHA256 4E27476C34422E66BE1531C52031F8D454B48D74BF1B51B3EA4C747BC2361A4C；旧运行版 B1DAF197DBB87A70CA5C3645972543E8D5DB1590559DDA63CB3D216655BFA90A 已 SHA 校验备份在 D:\AI_Cache\flexikit-runtime\flexikit-desktop-before-inward-refraction-20261009.exe，精准停止旧进程，恢复 Explorer 图标后启动新单例 PID 2348。Windows UIAutomation 确认 FlexiKit 主窗/Pet/WorkerW 画布正常，六组件及原布局未改变；点击试用折射后进入 GPU-ready「关闭折射」，已将效果留在开启态供用户直观判断。未进行用户壁纸截图保存、上传、活动窗口像素采集或自动配置写入。视觉方向是否理想仍以用户实际看到的画面为准。

## 2026-10-09 新版桌面 Canvas GUI 已启动

用户明确要求运行新版。最新 Rust/Vue Debug Native EXE SHA256 B1DAF197DBB87A70CA5C3645972543E8D5DB1590559DDA63CB3D216655BFA90A 现在在 Windows 唯一进程 PID 24696 中运行，真实主窗口、Pet 和 WorkerW 子层 Canvas 由 UIAutomation 验证；可见 6 个组件、「控制台模板」、「试用折射」、「恢复布局」。原有双旧 Pet 实例按确认的 PID 关闭，旧安装 EXE 未改，桌面图标恢复。未代用户启用壁纸采样或更改现有布局。GPU driver context loss / Explorer HWND destroy 故障恢复仍未做破坏性端到端实验，不因此宣称正式 Release 门槛通过。

## 2026-10-09 WorkerW 有界恢复和 GPU Context Lost 稳定性补强

- 原生根因：WorkerW recovery monitor 在 window.hwnd() 读取失败时直接 continue，可能无限跳过恢复。新增独立纯 Rust desktop_canvas_recovery_policy.rs：Monitoring / Detecting / Rebuilding / Reattaching / Restored / Backoff 状态。连续两次 1.5s 观察确认 HWND 消失才创建窗口；HWND 仍存在但父窗口失效仅重挂不销毁；失败时按 1/2/4/8 个监测周期封顶退避。用户当前 Explorer 未被关闭。
- GPU 设备上下文：监听 webglcontextlost / webglcontextrestored，允许驱动恢复后重新建立一个 shader/program/texture，最多尝试 2 次；4 秒内无法恢复自动切回普通玻璃。失去 Context 后不向无效 GPU 发删除指令、不清空 Canvas 尺寸。Async wallpaper decode + atlas 创建可通过 AbortController 取消，初始化代数防止卸载后迟到纹理覆盖。墙纸始终只在现有明确开启的 Canvas 视图内存中，不持久化、上传或采集其它窗口。
- 单元及构建验证：纯 Rust 恢复策略 4/4、GPU 恢复 JS 状态与静态契约 36 项、Canvas 生命周期 156 项、单屏/多屏图集 144 项、控制台几何 122 项、现有折射材质 21 项通过。Vue Desktop Build 与 Rust gnullvm 完整 Debug Build 均成功。开发版 EXE SHA256 B1DAF197DBB87A70CA5C3645972543E8D5DB1590559DDA63CB3D216655BFA90A；旧开发 EXE SHA256 C18AF2EE04A915AD41D80478A6FF36B8346A7150EABF49962714110E26E97351 已核验并备份至 D:\AI_Cache\flexikit-runtime\flexikit-desktop-before-workerw-gpu-recovery-20261009.exe。运行时 libunwind.whl / WebView2Loader.dll 正常。
- 部署现状：发现两个已运行的独立安装版进程 14776/14956，均来自 D:\Own_Tools\Flexikit，未更改其 EXE、未重启 Explorer，也未启动第三个会争抢 WorkerW 的进程。新代码已编译到独立开发目录，**尚未部署到这些安装版/GUI 实机测试**。Rust 单测与源码检查不等于真实驱动 WebGL contextlost、Explorer 多次崩溃或实际 GPU 性能达标。
- 后续门槛：在隔离 Windows VM 中验证真实 HWND Destroy/rebuild、context loss/restore 注入，确定桌面图标/六组件持久化及多次连续失败行为；真实双屏、混合 DPI、高刷新、Release 60fps / GPU 帧时间/功耗及动态壁纸限制仍待完成。Stage 6 性能指标仍为主线，主窗口缩放暂停问题未动。

## 2026-10-09 折射会话恢复稳定性（最新版）

- 根因：Canvas 原本在所有 Windows native WindowEvent::Resized / ScaleFactorChanged 和 WorkerW 重挂时收到 canvas-topology-changed，前端便无条件关闭折射；这些事件并不意味着真实显示器发生变化。现在比较有序显示器 ID、位置、宽高、缩放比和主屏的几何指纹（忽略无意义的显示器列举顺序与微小浮点抖动），仅在实际拓扑改变时终止旧 GPU 图集；无实际变化的 Resize 保持当前折射。
- 新增 process-only Native AtomicBool 记录“已由用户手动开启且首帧成功”的同进程同会话 opt-in，另外使用 canvas-recovery-N 的代数标记。仅 WorkerW 原生监视器真正重建 Canvas HWND、用户仍期望显示 Canvas 且有本次进程 opt-in 时，允许新窗口消费一次标记并自动重新读取静态本机壁纸；冷启动、普通新建、手动 Hide/Close/关闭预览不恢复。没有保存图片、路径、用户偏好或任意个人数据到磁盘。隐藏窗口拒绝迟到的 enabled=true；JS on/off IPC 串行避免异步请求反转用户最终的关闭动作。
- GPU 性能诊断：CanvasRefractionLayer 对最多最近 120 帧的 JavaScript 绘图“提交时长”进行滚动 p50/p95/最大值统计，报告节流为 2.5 秒且至少 8 次绘制，仅显示在折射按钮 hover 提示中；这是 CPU WebGL 命令提交时间，不代表 GPU 渲染完成时间、Present 或整机 GPU 占用。卸载时清理统计、像素纹理和 WebGL 程序，无日志与远端请求。
- 本轮构建与实测：Vue build/build:desktop、153 项新生命周期、144 项模拟多屏几何、21 项折射权限/结构、122 项既有 Canvas 布局及 Stage6 Pinia Store 回归通过。官方 Rust/gnullvm+Vue Debug 原生构建成功，EXE SHA256 C18AF2EE04A915AD41D80478A6FF36B8346A7150EABF49962714110E26E97351，当前 PID 37028（本次运行有效）；上一版 SHA256 21CC80DD152DBA32D639F9AEF8E3959D65A96D047759F9B89479418D732E38B5 已核验并备份至 D:\AI_Cache\flexikit-runtime\flexikit-desktop-before-recovery-fix-20261009.exe，停旧实例后恢复 Explorer 图标。实机 UIA 找到六组件，在开启折射时针对真实 Canvas HWND 执行 1px 临时尺寸变化并立即还原，折射仍然开启；手动关闭及重新开启都成功。
- 明确未验收：未刻意毁坏用户 Explorer/WorkerW 以实测真正 Canvas HWND 重建的单次恢复（仅源码静态契约及逻辑已检查）。双屏混合 DPI / Wallpaper slideshow / 电池长时 GPU 性能 / 真实 GPU timestamp 或 Present P95 / Release 公测仍待完成。暂停中的主窗口 resize bug 与原有用户布局均没有改变。

## 2026-10-09 多屏映射开发与实机验证（最新）

- Windows 原生层接入 `IDesktopWallpaper`，读取各活动显示器壁纸路径、物理 RECT、铺放方式与背景色。只返回图像 data URL/屏幕几何给 Canvas，不返回壁纸文件路径或显示器 ID；不得获取窗口/桌面图标像素。最多 6 屏、单文件 8 MiB，编码总量上限 32 MiB。
- 发现真实 Windows 机器 `IDesktopWallpaper` 记录 3 屏，但 Tauri 只有 1 块活动屏，其中历史壁纸记录返回 HRESULT 80004005。改为匹配 `available_monitors()` 的**活动屏物理矩形**、跳过失效记录；单屏若原生元数据失败，自动回退先前验证通过的 SPI 静态壁纸渠道；多屏无法一一匹配则拒绝，禁止错误映射。
- 前端新增 `wallpaperLayout.ts`：按虚拟屏幕物理坐标（支持负 X/Y）、屏幕边界和系统底色绘制最多 2048px 的单一离屏 GPU 图集。覆盖 Fill、Fit、Stretch、Center、Tile、Span 六种壁纸布局，并使用既有一套 WebGL2 Shader 在 Widget 圆角区域做边缘偏移。Canvas CSS 长宽比与真实物理桌面超过 3.5% 差异直接回退，避免混合 DPI 错位。
- 自动回归：Vue Desktop 构建、144 项多屏/负坐标/六模式纯几何验证、21 项折射安全契约与 122 项原布局测试均通过。Rust gnullvm Debug + Vue 原生完整构建通过。新唯一运行 PID **26316**，EXE SHA256 `21CC80DD152DBA32D639F9AEF8E3959D65A96D047759F9B89479418D732E38B5`。旧 EXE 均已 SHA256 备份、停止原单例并恢复 Explorer 桌面图标。GUI UIAutomation 实机执行「试用折射」后成功观察到「关闭折射」，本机静态壁纸 GPU 路线实测可运行。
- 粗略性能：原生进程 + 8 个 WebView2 后代。折射开：约 6.80 秒 CPU 单核等效 2.07%，进程树私有内存 484 MiB，Windows GPU Engine 求和平均 0.12%、峰值 0.37%；折射关：约 6.76 秒 CPU 单核等效 3.01%，私有内存 476 MiB，GPU Engine 平均 0.04%、峰值 0.21%。这些是**不同时间的短样本，GPU 引擎求和不等于全机 GPU 利用率**，不能据此宣称性能/功耗已经通过正式门槛；还缺 Release、长时间空闲/指针持续互动的帧延迟与失焦、双屏物理像素以及异步状态恢复测试。
- 当前的 Canvas 可能随 Explorer 桌面层恢复而重新挂载，手动折射开关会按隐私优先原则恢复关闭，这属于未完成的稳定性验收。未开启自动壁纸监测，动态壁纸/实时窗口/桌面图标均不会折射。六个用户组件及位置、桌宠、暂停中的主窗口缩放工作均未修改。

## 范围与事实源

桌面 Canvas 是 Tauri 2 / WebView2 下的透明 Windows WorkerW 子层。CSS 的 `backdrop-filter` 对 Explorer 背后的真实壁纸不能可靠取样；微软 WebView2 反馈也记载了透明 WebView 中 blur 的兼容问题：https://github.com/MicrosoftEdge/WebView2Feedback/issues/4945。

Windows 官方 `IDesktopWallpaper::GetWallpaper`、`GetMonitorDevicePathAt`、`GetMonitorRECT`、`GetPosition` 可用于后续多屏、位置与壁纸更准确的匹配。微软官方：https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-idesktopwallpaper 和 https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/ne-shobjidl_core-desktop_wallpaper_position。

**当前样机不使用屏幕捕获，也不获取活动窗口/文件图标。** 使用 `SystemParametersInfoW(SPI_GETDESKWALLPAPER)` 读取 OS *配置的静态壁纸文件*，并仅在用户明确点击「试用折射」后执行。入口位于 Canvas 顶部菜单。

## 管线

```text
「试用折射」(用户手动开启)
  → 仅允许 Tauri label=canvas 或 canvas-recovery-* 调用原生命令
  → 要求只有 1 个显示器
  → Windows 配置的静态壁纸路径
  → 拒绝 UNC/网络路径、超 8 MiB、不支持的文件魔数
  → 仅在内存中读取二进制 → base64 image/data URL
  → 一次 Tauri IPC 返回当前 Canvas WebView
  → Image 解码并检查最大 48 MP → 画布降采样至最长边 2048px
  → 一份共享 WebGL2 纹理、一个 Shader Program、一个 Canvas
  → 只在非编辑态/用户互动时按需绘制、每次对 Widget 圆角边界 scissor
  → 组件正文位于上层，使用独立内容保护色，不降低字体透明度
  → 用户关闭、离开 Canvas、GL context 丢失 → 释放纹理与内存
```

代码：
- `apps/desktop/src-tauri/src/canvas_wallpaper_windows.rs`：8 MiB 限额、格式白名单与魔数、网络路径保护；
- `apps/desktop/src-tauri/src/main.rs`：Tauri 命令 `get_canvas_wallpaper_preview` 限定 Canvas origin/单显示器；
- `apps/web/src/desktop/wallpaperRefraction.ts`：GPU 几何映射与圆角边缘位移 Shader；一个共享 WebGL2 context，最长纹理边 2048、绘制 DPR 上限 1.5；
- `apps/web/src/components/desktop/CanvasRefractionLayer.vue`：生命周期、context loss、geometry rAF 更新和指针更新节流（约每秒最多 30 帧）；
- `apps/web/src/views/DesktopCanvas.vue`：显式启用/关闭、不持久化图片或状态、无法取样自动恢复；
- `apps/web/src/styles/canvas-liquid-glass.css`：仅在 `is-wallpaper-refracting` 并确认 GPU ready 时降低玻璃壳密度，仍保留内容保护层。

## 实测

- Vue + TypeScript 构建通过，`node apps/web/scripts/desktop-canvas-refraction-regression.mjs` 完成 18 条无真实用户输入的安全与结构检查，Canvas 原有材质回归及 122 个布局验证通过。以上不等于真实 GPU 耗时基准。
- Windows Debug EXE 当前 SHA256 `FBC49009A54CD21F8821F58A4491F604996DBDFFFB010FB7466A91AA9D044745`，原生交互进程 PID **36596**（PID 只对本次运行有效）。UIA 确认 1648×810 WorkerW Canvas 中已经出现「关闭折射」按钮，表示可选原生壁纸通道与首次渲染已确认成功。Win32 `PrintWindow` 在本机进行了开启/关闭前后对比：最初 1 秒由于 WebView2 画面缓存仍显示旧帧，等待稳定后观察到明显的青蓝静态壁纸纹理和边缘变化；测试中短暂生成了 3 张本地临时 PNG 用于核对，之后已全部删除并确认临时目录不存在，未上传或持久保留截图。与上一轮单纯灰色卡片的内部样式相比，彩色壁纸纹理进入了 GPU 页面合成。
- 粗测约 3 秒原生主进程 CPU 时间 78.1ms（单核口径约 2.6%），**未包括 WebView2 子进程与 GPU**，不可当作最终 CPU/GPU 性能基准。需要完整进程树/GPU/Release 真机测量。

## 明确不能做的事与边界

- 无任何屏幕录制、截图流或后台壁纸轮询。静态壁纸以外的动态壁纸/视频/正在变化的背景不采集，关闭后仅回退现有 Liquid Regular/Clear/Dense。
- 当前只处理 **单显示器**、近似 Windows Fill 或单屏 Span 的壁纸映射。居中、平铺、拉伸、Fit、Windows Spotlight、动态壁纸、多显示器/混合 DPI 的精准图像投影还需要专门实现。不要谎称已有完整背景重构。
- 这是一种真实的 **静态壁纸纹理局部 GPU 位移与微量色散**，不是实时桌面像素折射（应用窗口/文件图标不被折射），也不是 Apple 的私有系统合成器。
- 单屏持续展开较多组件时共享 canvas 可以避免 WebGL 多上下文上限。只在已打开 Canvas 且用户主动开启时分配纹理。GPU 初始化失败、设备丢失、图像无效、减少透明度模式时应立即回退。
- 样机默认 **关闭**，无自动开机、无 localStorage / 数据库 / 用户配置持久化；不改变现有 Canvas 组件位置、工作台、桌宠及暂停中的主窗口缩放问题。

## 下一阶段发行门槛

1. 为每块屏建立 `IDesktopWallpaper` monitor ID + rect + position 真正映射（超宽、多负坐标、缩放与跨屏）。
2. 先支持本地静态壁纸的 Fit/Fill/Span 正确布局并覆盖壁纸切换；非支持场景有明确 UI 提示。
3. 真机用多种亮/暗/复杂图像进行折射强度与文字 WCAG 对比度验收，并加入 GPU 资源/帧时间/失去上下文恢复的自动检查。
4. 观察高分屏、多显示器、全屏游戏与电池模式的性能，明确暂停/低功耗回退阈值。发布前确保无文件内容泄漏到日志/磁盘/网络。
5. 若将来要求实时桌面内容的 GPU 折射，须单独取得授权并做隐私、安全与合成架构 ADR；目前**不允许**默认为用户录屏或把屏幕内容传往后台。
