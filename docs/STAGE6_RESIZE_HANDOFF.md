# FlexiKit Stage 6 / Windows 窗口缩放问题接手记录（2026-10-08）
> **2026-10-08 用户决定暂缓：** 窗口画布分离/跳动仍是已知未解决缺陷，不继续做动态修复或自动对照。此前为了真人操作而遗留的标准边框隔离测试 PID 10280 已在确认路径后退出；不影响正式数据和其他程序。当前主线转至 docs/MASTER_PLAN.md 的 Stage 6 性能指标，相关数据见 docs/STAGE6_PERFORMANCE.md。

> 当前仍是插单，主线执行指针保持 `docs/MASTER_PLAN.md` 的 Stage 6「性能指标」，不能将窗口视觉修复标记完成。

## 本次基线

- 仓库：`master`，HEAD `a13fee6`；接手时相对 `origin/master` ahead 42 / behind 0。
- 接手时 7 个未提交路径：`apps/desktop/src-tauri/Cargo.lock`、`Cargo.toml`、`src/main.rs`、`src/native_main_resize_windows.rs`、`apps/web/scripts/desktop-live-resize-regression.mjs`、`apps/web/src/App.vue`、未跟踪 `apps/web/src/components/layout/NativeWindowResizeHandles.vue`。全部保留，不提交、不清理。
- 已加载 `CLAUDE.md`，参考 `.agents/skills/apple-design-system.md`、`apple-motion-interaction.md`、`vue3-composition-guard.md`。
- 锁定依赖：`tauri-runtime-wry 2.11.4`、`wry 0.55.1`、`tao 0.35.3`。
- 主窗体继续采用非透明、无阴影、`decorations: true` 创建后移除 `WS_CAPTION`，保留原生 `WS_THICKFRAME`；`WM_NCCALCSIZE` 扩展普通窗体客户区，`WM_NCHITTEST` 处理 DPI 命中。
- 当前未提交实现增加八个 Vue 边缘覆盖区域，以 `pointerdown` 调用 `start_main_window_resize`，由 Rust 调度 `start_resize_dragging`。尚未证实真实连续快拖无闪动。

## 2026-10-08 本次验证

- `npm --prefix apps/web run test:desktop-live-resize-regression`：通过（静态/结构回归，不代表动态视觉通过）。
- `npm --prefix apps/web run build`：通过，`vue-tsc` 与 Vite 共 309 个模块。
- `npm --prefix apps/web run build:desktop`：通过。
- `npm --prefix apps/web run test:desktop-auto-scrollbar-regression`：通过。
- 默认 `cargo check --all-targets`：失败；本机默认 MSVC 环境存在 C++ 组件/SDK 初始化不完整，未获取当前业务 Rust 代码诊断。
- 使用项目既有 Clang/gnullvm 路径的 `cargo check --all-targets -j 4`：失败；构建资源文件被占用（OS error 32），不是已证实的源码错误。
- `powershell -File scripts/windows-gnullvm-build.ps1 -SkipFrontend`：因开发版 EXE 仍在运行而按安全保护拒绝覆盖；没有强制关闭应用。该保护也解释了为何不能直接通过当前构建校验。
- 写入 `.agents/skills/errors-log.md` 的尝试被结构化编辑器拒绝：该历史文件混用 LF/CRLF，拒绝后未修改文件。上述错误和限制记录在本文件以供后续补录。

## 下一步（尚未完成）

1. 用户允许或自行关闭正在运行的 `D:\AI_Cache\flexikit-gnullvm-target\debug\flexikit-desktop.exe` 后，以既有保护脚本构建新的 Desktop 测试 EXE；不覆盖公共桌面快捷方式所指向的旧安装版。
2. 真实鼠标分别拖右边、底边、右下角连续往返至少 5 次，检查鼠标命中是否可靠、是否出现黑白露底、画面延迟或跳动；不得用结构性 Node 回归代替动态测试。
3. 通过 Windows 100%/125%/150% DPI 以及混合 DPI 双屏测试，验证 `GetWindowRect`/客户区/WebView 子窗动态尺寸；覆盖最大化、还原、最小尺寸。
4. 在出现可重复、定位明确的故障前，先保留全部原生窗口和 Vue 实现，不添加无根据 CSS 补丁或切换透明设置；如有确认的代码改动，执行 Rust/前端/真实运行态回归。
5. 任务收尾更新 `docs/MASTER_PLAN.md`、`STABLE_CHECKLIST.md`、`TECH_DEBT.md`（如涉及）与 `CHANGELOG.md`（如有用户可见改动），保持 Stage 6 主线不变。

## 2026-10-08 续修 / 根滚动条抢占右侧缩放热区（动态视觉未完成）

- **实机 DOM 根因**：主窗口 `innerWidth=1456` 时，根页面 `clientWidth=1448`，右侧原生根滚动条占 8px；fixed resize handles 只到 x=1448，右边缘 `elementsFromPoint(1453,415)` 为空。底边/右下无法可靠鼠标命中并非单纯原生 `WM_NCHITTEST` 问题。
- **已修正**：仅 `html.desktop-main-window` 禁止根滚动，主内容 `.app-window-content` 使用 100vh 原生可滚动容器、`max-width:calc(100% - 8px)`，让滚动条向内 8px，留出鼠标缩放区域。独立真实 WebView2/CDP 注入同等 CSS 后根 `clientWidth` 恢复 1456，外侧右边 `elementFromPoint` 命中 `native-resize-east`、右下 `native-resize-southeast`、底边 `native-resize-south`；内层滚动条仍在距外缘 8px 内侧，容器可实际 scrollTop=22。代码已写到 `apps/web/src/styles/desktop-resize.css`，不影响 Pet/Canvas。
- **隔离构建**：新增 opt-in `resize-test` Cargo feature，独立 `com.flexikit.resize-test` 标识、只有主窗口、无 Pet/Canvas/全局快捷键/工具索引，日志位于独立目录；另有 `scripts/windows-resize-diagnostics.py` 和 `scripts/windows-resize-compositor-ab.py`，不采集用户屏幕图片/隐私内容。独立 EXE 在 `D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe`，已经通过 gnullvm 完整编译、无需覆盖正在运行的旧开发版。
- **动态几何 A/B，非视觉结论**：改前 opaque 562 样本中 174 次偏差≥2px、最大 6px；transparent 566 中 195 次、最大 6px。改后 opaque 596 样本中 192 次、最大 6px；transparent 597 中 195 次、最大 6px。像素采样两种模式均未检出阈值定义的黑白离群点，但不是连续快拖视觉证据。保持生产 `transparent:false`，不盲目按旧 Issue 修改 Wry/WM_SIZE；现有 Wry 0.55.1 中 `WM_SIZE` 先调用 Controller.SetBounds 再调用 SetWindowPos。
- **真实鼠标局限**：自动右/底/右下拖动均返回 0px；补采样发现 `GetForegroundWindow` 不是隔离测试主窗口、`SetForegroundWindow` 无法取得焦点，日志亦无 `main_window_resize_requested`。故该结果不能证明真实鼠标有效或失败。仍需人工前台往返各 5 次，以及 100/125/150% DPI、最大化/恢复和主题切换。尚未确认用户原述黑白闪块彻底消失。
- **验证与环境**：Web `vue-tsc && vite build`、Desktop Vite、窗口缩放静态回归、滚动条 DOM 回归及离线回归通过；独立 gnullvm EXE 成功编译，Rust fmt 检查通过。默认 MSVC 组件不完整、共享 target `libresource.a` 曾遇 OS error 32、独立目标首次缺 `libunwind.whl` 运行库均属构建环境问题，已切换独立 target 并校验部署。历史 `.agents/skills/errors-log.md` 混合 CRLF/LF，结构化编辑器拒绝写入，异常记录在本文件。未清理 Git 已有改动、用户数据或覆盖桌面快捷方式，Stage 6 主线仍为性能指标。

## 2026-10-08 同日后续 / 实时尺寸滞后拆解与 WebView2 GPU 合成对照

- **防止错误归因的同步采样**：`scripts/windows-resize-diagnostics.py` 新增 `guarded_alignment`（WebView 子窗读数前后重复采集主窗口客户区和屏幕原点，剔除采样时主窗口大小/位置发生变化的样本），并检测主 HWND 与 WRY_WEBVIEW 的所属 UI 线程。实测二者属于**同一 Win32 UI 线程**。高速连续尺寸变化时，几百次有效采样中仍可出现最高 6px 的短暂落后，说明不能全部解释为跨采样竞争。
- **关键追加检验**：用 `SetWindowPos` 连续尺寸变化 3 组，每组 65 步；在每步 Win32 `SetWindowPos` **返回后立刻**读取对齐结果。不透明模式与透明模式各 195 个步骤均为 `gap≥2px: 0`，最大仅 1px；而并发采样（可能撞到处理中的 `WM_SIZE`）分别记录 424 次中的 66 次和 443 次中的 77 次偏差≥2px，峰值 6px。意味着原生 `WM_SIZE` 完整处理后 WRY 子窗跟上，不能以这组结果断言画面渲染帧也同步。**禁止据此向正式程序重复添加 WM_SIZE -> SetWindowPos 补丁**，因为 Wry 已处理同一事件，增加重入/反复布局风险。
- **GPU 合成隔离工具**：新增 `scripts/windows-resize-rendering-ab.ps1`，只允许启动 `flexikit-resize-test.exe`，提供 `Default`、`DisableDirectComposition`、`DisableGpuCompositing` 三个实验模式；在子进程启动期间仅临时设置进程级 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`，启动后恢复脚本进程原值，不修改注册表、系统设置、正式 EXE、Pet 或 Canvas。原生 WebView2 进程查询确认 `--disable-direct-composition` 参数已传入浏览器进程（2 个进程）；这不等于 GPU 内部最终接受该参数或视觉已经无闪动。Windows Microsoft 文档明确推荐此环境变量作为**诊断手段**、不要随意将诊断 flags 随正式应用发布；WebView2Feedback #5574 也报告过某些视频/底部 UI 组合中 DirectComposition 可造成宿主画面陈旧，属于相似的参考案例，不是 FlexiKit 已确诊的同一缺陷。
- **测试方法**：项目根目录使用 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-resize-rendering-ab.ps1 -Mode Default`，手动正常退出测试窗后用 `-Mode DisableDirectComposition`、`-Mode DisableGpuCompositing` 分别测试右/底/右下角连续往返快拖。每次只能运行一个隔离 EXE；观察闪块与拖动可靠性，不能仅凭编译、窗口矩形或模拟帧判定通过。验证不同 Windows DPI 100/125/150% 和最大化/恢复。
- **自动测试保护**：`scripts/windows-resize-compositor-ab.py --mouse` 改为只有隔离测试窗口确实成为前台时才输入鼠标；本环境无法取得前台焦点，测试返回明确的 `skipped`，不再错误记录成 0px 拖动失败。脚本默认不再跑昂贵且不完备的逐点 GDI 屏幕采样，可按需加 `--pixels`；无屏幕录制、网络上传或用户信息读取。
- **结论**：右侧 8px 根滚动条遮挡缩放控制区的代码修正仍保留；WebView2 原生尺寸最终同步正常，合成帧瞬时黑白闪动尚未人工验证，**本次只增加诊断与隔离能力，不对正式程序改透明或 GPU 渲染设置**。主任务仍为 Stage 6 性能指标。

## 2026-10-08 默认（第一种）整体复测：125% DPI，隔离测试版

**用户视觉反馈**：三模式人工对照中，第一个默认渲染模式显示正常；禁用 DirectComposition 与禁用 GPU 合成的第二、第三种虽然没有明显黑边，但出现「画布与窗口边框分离」。据此**保留 Default 作为主窗口渲染基准**，不把禁用合成 flags 写入生产设置。

**本轮实际执行**：新增可重复运行的 `scripts/windows-resize-default-smoke.py`，只启动 `D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe`；以本机 `GetDpiForWindow=120`（125% 缩放）实测真实 Win32 主窗口、WRY_WEBVIEW、WebView2 DOM（独立本地 CDP）及原生/DOM resize 命中，脚本完成后退出测试进程，未关闭原本 PID 23572 开发版。使用本地 CDP 调试端口仅供隔离测试，不改变 GPU 合成开关，也不截取或存储私人页面文本。

- 5 档窗口大小 `1020×680`、`1180×720`、`1280×790`、`1430×780`、`1130×720`：本次稳定测量所有窗口外框/客户区/WRY_WEBVIEW **完全一致**；document 根可用宽度等于 WebView viewport，主内容区与侧边栏滚动容器保留原生滚动；`scrollTop` 写入/恢复测试通过。每组 `elementFromPoint` 对 8 个角/边 resize 覆盖区域均为 8/8。模拟向主 HWND 发送 `WM_NCHITTEST`，右边 HT=11、下边 HT=15、右下 HT=17，中央 HT=1；此消息探测不等于真实鼠标能拖动。
- 连续缩放 201 次：每步 `SetWindowPos` 返回后主窗口与 WebView 子窗最大偏差 **1 物理像素**，≥2px 计数 **0**；同一时段 WebView2 `requestAnimationFrame` 记录约 939 帧、宽度更新约 203 次、边缘覆盖区域缺失 0，角部 CSS 右缘最大浮点取整约 0.2px。
- 最大化与还原：最大化外框为 `1549×877`、客户区和 WebView2 同为 `1536×864`，属于 Windows 最大化非客户区边框差异；WebView2 偏移均为 0。还原后 `1130×720` 对齐，右缘和右下角命中区仍正常。
- 屏幕像素检测：本地内存中对 5 档稳定尺寸各 3 张画面（15 次采样）检测右/底部大面积黑白露边，**0 次触发阈值**；连续 201 次系统缩放的同步截图探测取得 147 个边缘采样稳定帧，黑白异常计数均 0，另有 65 个截图期间窗口矩形发生变化的样本主动丢弃。无图片写盘、不上传内容。这是**启发式像素检测，不等于肉眼快拖视觉证明**。
- DPI 取整提示：一次早期 `1430×850` 尺寸测试的窗口部分超出本机可视高度，测到 1px 底部客户区与 WRY 差值；重定位复查中某些启动状态下这个 1px 也出现于其它尺寸。正式五档完全在屏幕内、并等待窗口安装完成的重复测试则所有 Win32 几何对齐，部分 WebView2 `innerWidth/innerHeight` 会有 1px 小数物理像素换算差异。未证实该差异形成用户所说的可见黑边，也不可据此直接修改 Windows NC 子类。
- **未覆盖**：真实物理鼠标拖动（Windows 自动化环境无法把隔离窗口设为前台；脚本 `--mouse` 正确返回 skipped），DWM 呈现的每帧时序及持续快拖的视频观察，100%/150% 和混合 DPI 双屏；这些仍保留人工验收项，不标记整个问题彻底修复。

**安全边界**：默认版 `transparent:false`、GPU 合成参数不变；没有修改生产 Rust/Vue 缩放实现。没有覆盖原 EXE/桌宠/Canvas、没有清理任何用户工作区修改。项目主线仍 Stage 6「性能指标」。

## 2026-10-08 默认渲染修复正式切入「当前运行的开发软件」

- **原始用户反馈**：上一次只运行隔离测试 EXE，实际用户仍使用旧开发进程；本次明确把已通过隔离验证的 Default/opaque 窗口缩放修复切入实际运行的 `D:\AI_Cache\flexikit-gnullvm-target\debug\flexikit-desktop.exe`，而非仅重新报告测试结果。
- **构建与备份**：重新执行 `npm run build:desktop`（309 modules）和原项目 `scripts/windows-gnullvm-build.ps1 -TargetDir D:\AI_Cache\flexikit-resize-isolated -SkipFrontend`；完整 gnullvm Rust 构建成功，新正常桌面二进制 SHA256 为 `AB2DA676F971B43D07BB0C634035DE9C2CE84DBBC57B1057DDFC2BFDB2624902`。旧实际运行进程 PID 23572、构建时间 14:16、EXE SHA256 `74768282D228009BC391F9A13B2C593B8432EC5EC6F54B3CB34439A0964ADD2B`。先把旧 EXE、`WebView2Loader.dll`、`libunwind.whl` 复制到 `D:\AI_Cache\flexikit-gnullvm-target\backup\20261008-default-resize-before-upgrade\`，逐项校验 SHA256；新旧 DLL 的 SHA256 相同。
- **正常退出再切换**：旧主窗口单击关闭实际会隐藏进程，不能直接覆盖。通过旧桌宠右键菜单上可见的「退出 FlexiKit」按钮的 UI Automation InvokePattern，调用其原有 `quit_app` 实际退出，确认 PID 23572 已消失；没有直接强杀旧进程。之后在同目录原子化替换 EXE，另留 `flexikit-desktop.before-default-resize.exe` 本地可回退副本，并校验新 EXE 完整哈希一致。
- **实际启动验证**：临时注册同用户、同交互 Session 的 Windows Task Scheduler 按需启动任务，实际启动新 `flexikit-desktop.exe` PID **26216**（Session 1；17:53:41），然后注销临时任务。再次确认新 PID 存活、进程路径和 SHA256 正确，旧 PID 不存在；UI Automation 观察到实际新主窗口 `FlexiKit`（可访问按钮 51 个）和透明桌宠 `FlexiKit Pet Ready`（按钮 1 个）均可见。
- **新运行程序原生验收**：本机 DPI 120（125%），Win32 `WM_NCHITTEST` 实测主窗口右边 HT=11、下边 HT=15、右下角 HT=17、中央 HT=1；对应新 Win32 主外框约 1319×882、客户区 1319×881、WRY_WEBVIEW 1319×882，边界最大相差 **1px**（WebView2 偏移 [0,0,0,-1]）。属于仍需关注的 DPI 取整/末边像素问题，不能凭原生命中声称物理鼠标拖动和黑白闪动全部消失。
- **安装版边界**：`D:\Own_Tools\Flexikit\flexikit-desktop.exe` 是另一份旧的已安装/独立桌面程序，此次没有覆盖其安装文件或快捷方式，也未生成升级安装包；本次明确完成的是**当前实际运行中的 gnullvm 开发版**换版。正式用户安装分发待下一轮专门制作/验收，不能混淆这两份 EXE。所有仓库未提交修改与用户数据均保留，不发布、不提交 Git。
- **待人工终验**：真实鼠标对新主窗口右/底/角连续快拖、125% 下是否有可见 1px 异色条、100%/150%/混合 DPI，仍不得以隔离自动化代替。主线依然 Stage 6 性能指标。

## 2026-10-08 用户正式开发版实测仍跳动 / 全宽滚动布局修正并再次实际换版

**反馈优先级提升**：在此前已更新并运行的 Default 模式开发版（PID 26216）中，用户仍明确看到「画布和外框分离、跳动」。之前的 HWND 矩形稳定及有限像素采样**不等于连续真实鼠标画面通过**；正式问题保持待验证，不能宣称已完全修复。

**新增确证的界面根因**：`apps/web/src/styles/desktop-resize.css` 将独立主窗口的 `.app-window-content` 显式设为 `width/max-width: calc(100% - 8px)`，即使外框、WRY_WEBVIEW 子窗精确同步，滚动容器/工作区仍比物理 WebView2 视口右缘**少约 8px**。在 125% DPI 的真实隔离 WebView2 中，视口 1455px、滚动盒右边 1447.2px（外露 7.8px），且其自身再有内侧 8px 的滚动条。直接在 CDP 内改为 `width/max-width:100%` 并等待样式更新，右侧间隙降至 CSS 布局小数取整约 -0.2px。**这是确定存在的布局分离缺陷**，不应再将其误归因于 WebView2 HWND 尺寸。

**针对性补丁**：
- 主窗滚动容器改为 `width/max-width:100%`，让工作区背景绘制至边缘；保持 root `overflow:hidden` 防根滚动条抢占缩放区。应用于 Main Desktop 主窗专属类，不影响 Pet、Canvas。
- 右侧透明 resize handle 从宽 8px 改为宽 4px，保留外侧鼠标缩放和里侧剩余 4px 的原生滚动条拖动热区；四角维持 14px。
- `.app-window-content`、`.desktop-app-shell`、`.desktop-app-stage` 的结构尺寸过渡关闭，避免布局位置缓动落后 Windows 宿主 HWND；不禁用内容组件正常微交互动画。
- 为主滚动容器设置 `scrollbar-gutter:stable`，防止窗口高低变化跨过 overflow 临界点时 scrollbar 8px 的出现/消失让工作区横跳；保留 auto overflow 和自动隐藏 thumb 策略。

**真实隔离版实测**：重新构建 desktop web 前端及 `flexikit-resize-test.exe`。5 档尺寸 `1020×680,1180×720,1280×790,1430×780,1130×720` 的 HTML 全宽覆盖均通过；八方向 DOM hit、右/底/右下 Win32 HT、内层滚动、最大化恢复、连续 201 次缩放后子窗最大 1px 均通过。新 CDP 对照：视口 1455px、主 scrollbox 右边 1455.2px、原生 scrollbar=8px、CSS gutter=stable、主布局 transition=none；右缘内 2px 命中 East 4px resize handle，右缘内 7px 命中 scroll 容器。通过在**仅隔离 WebView**中隐藏/恢复内容强制切换“无溢出/有溢出”，`clientWidth` 恒定为 **1447px**，没有 8px 横跳。桌宠和桌面画布未启动于独立测试程序。

**真实软件换版**：经过 `npm run build:desktop` 和完整正常 gnullvm Rust 编译后，新 EXE SHA256 `460C44B791C03B754AF68FF052F1D19F327D32D690B96EE105EF8B30CAE8C183`。将仍运行的旧开发版 PID 26216 的 EXE、Loader 与 unwind 原样 SHA 校验备份于 `D:\AI_Cache\flexikit-gnullvm-target\backup\20261008-fullbleed-scroll-stable-before-upgrade\`，使用实际桌宠右键菜单「退出 FlexiKit」调用软件自有 `quit_app` 正常结束 PID 26216；然后原子替换 `D:\AI_Cache\flexikit-gnullvm-target\debug\flexikit-desktop.exe`，同用户交互 Session 1 启动新 PID **32476**。启动后主窗口/桌宠 UIA 均可见、EXE 哈希吻合、原生右/下/角 HT=11/15/17；稳定时 WRY_WEBVIEW 相对客户区有 `[0,0,-1,-1]`（125% DPI），需要保留异色细边调查。临时启动计划任务已删除，另一个 `D:\Own_Tools\Flexikit\` 旧安装目录未覆盖，不修改注册表/GPU/透明模式、用户数据或未提交仓库改动。

**仍未证明**：真实物理鼠标多次快拖下 WebView2/DWM 呈现帧绝对不跳动；这项问题存在 Wry/WebView2 帧异步的独立可能。若用户复测仍见动态黑白闪块，在当前全宽滚动修复基础上针对 DWM/WebView2 帧提交做录屏取证与最小复现，不再凭静态 HWND/自动像素零离群做误判；不得盲目启用 DisableDirectComposition/DisableGpuCompositing，用户已反馈这些模式有更明显画布边框分离。

## 2026-10-08 Standard/Custom × 完整/极简 WebView2 四象限缩放隔离对照

用户确认当前生产开发版仍分离和跳动。本轮**不再触碰实际运行的 EXE PID 32476**，只通过隔离应用标识 `com.flexikit.resize-test` 的专用 EXE 对比 Tauri/Windows 标准标题栏和原有自定义无标题栏。Test feature 下 `FLEXIKIT_RESIZE_TEST_FRAME=standard` 或单次命令参数 `--fk-resize-standard` 跳过自定义 `native_main_resize_windows::install`，实际生产编译完全不受影响；全部保持不透明、默认 GPU 合成，没有启用诊断 GPU flags。

**四象限客观结果**：`scripts/windows-resize-frame-ab.py --steps 75`，每组独立真实 Win32 `SetWindowPos` 连续调整，背景同为 WebView2；Minimal 为临时注入的纯色静态 DOM。

| 隔离窗口 | 完整 FlexiKit 页面 | 纯色最小页面 |
| --- | --- | --- |
| Standard 标准 Windows 标题栏 | 同线程动态窗口偏差最大 7px，165 样本中 33 个≥2px，75/75 操作返回后≤1px，requestAnimationFrame 最大间隔 12.1ms | 最大 7px，184 样本中 23 个≥2px，75/75 返回后≤1px，最大 rAF 间隔 6.4ms |
| Custom 自定义无标题栏 | 最大 6px，165 样本中 25 个≥2px，75/75 返回后≤1px，最大 rAF 间隔 12.2ms | 最大 6px，173 样本中 29 个≥2px，75/75 返回后≤1px，最大 rAF 间隔 6.7ms |

以上并发样本捕获了 Windows 尺寸处理过程中的瞬态，而非实际屏幕 DWM 的绘制时刻；标准窗口和极简页面都仍存在类似差异，因此**不支持“纯粹是自定义边框或 Vue CSS 造成所有尺寸瞬差”的假设**。样本量与测试顺序不足以把 6px vs 7px 判定为显著性能优势。

**WebView2 内部图片对照**：`scripts/windows-resize-chromium-probe.py` 对纯色隔离 DOM 调用 Chrome DevTools `Page.captureScreenshot`，Windows Standard 和 Custom 各 24 张在中心/右边缘均完全匹配预设颜色（24/24 + 24/24）；持久化后重测各 12/12 正常。仅内存读取，没有保存/上传截图。这**不是 Windows 桌面最终呈现画面**，不可据此宣告肉眼快拖无跳动。

**实体桌面截图为何无效**：`ImageGrab` 对隔离窗口的截图读到 RGB(210,210,210) 而非合成页面的 RGB(165,91,141)，检测到隔离 HWND 不是前台，存在遮挡。本次四组外部像素检测均为 `not_visible_or_occluded`，没有有效 DWM 图像证据；不应误报成 “未检测到黑边”。测试器已修正 ctypes RECT 与 `vars` 比较不可靠的问题。若要进一步区分 WebView2 内部和 DWM 实际呈现，必须在人机交互可见时录制真实窗口，并追踪帧时序。

**可供人工拖动的对照窗口**：新专用 EXE 已重新构建，仅隔离版支持 `--fk-resize-standard`。通过同用户 Windows Interactive Session 的一次性任务成功启动 **标准窗口 PID 10280**，UI 标题为 `FlexiKit Resize A/B - Standard Windows Frame`，任务已注销而程序存活；当前真实开发版 **PID 32476** 完全未关闭。另有 `scripts/windows-resize-frame-manual.ps1 -Frame Standard/Custom` 本地启动器（必须先退出已打开的测试窗口再切换）。用户真人分别右/底/右下连续快拖 5 次，对比 Standard/Custom 是否同样分离，仍为**待验收**。

**结论与范围**：已明确两种 Windows 外框和两类 HTML 在原生几何层共享同量级临时差；当前还不能区分 Tauri/Wry WebView2 子窗尺寸更新与 Windows DWM 实际显示的帧。停止重复 CSS 修补，不切换生产 GPU/透明策略，不把此诊断记为问题已修复。Git 未提交内容、真实安装版和用户数据完整保留。

## 边界

当前不能宣称窗口视觉问题已修复。旧版安装目录、用户资料、桌宠与 Canvas 的透明模式、Git 未提交工作一律不主动清理、覆盖或发布。
