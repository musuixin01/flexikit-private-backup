# FlexiKit Desktop Canvas — 客户可用的控制台与工具入口

> 当前状态（2026-10-08）：用户明确提出桌面画布直接添加工具及开箱即用控制台样式。已实现桌面 Canvas 的 Vue 前端集成、Tauri 事件监听 capability（仅限 canvas/canvas-recovery-*）、本地安全恢复点和隔离回归；**2026-10-08 23:35 后已完成当前 gnullvm Debug 原生 EXE 编译并启动（PID 18116）**。通过 Windows UI Automation 实机确认主窗、桌宠、Canvas HWND 都可见，Canvas 顶部「＋ 添加工具」与「控制台模板」按钮真实存在；从主窗侧栏触发 Canvas 原生 IPC 并实际打开控制台模板选择面板，三套模板、预览和「使用此模板」均存在。旧版 EXE 已单独备份且 SHA256 核验成功。仍非 Release/客户安装包；真实拖放、工具启动、物理拖动、模板应用/恢复及多屏 DPI 全流程尚待测试。

## 2026-10-10 Canvas 简洁设置的渐进式披露

用户提出 Canvas 可调选项太多、学习和决策成本过高。本轮只更改 Canvas 设置呈现，不更改 WidgetAppearance 任何字段、默认值或存储 schema，也不改变用户布局/模板：顶部常态工具栏从 9 个操作减至 5 个（添加工具、添加组件、编辑/完成、更多、关闭）。控制台模板、GPU 壁纸折射、恢复布局、自动整理及重置仅在「更多」菜单出现；重置需要确认，避免误触。WorkerW 点击穿透的交互区域同步额外包含 .canvas-more-menu，支持非编辑模式下的展开菜单和 Esc 收起。

组件属性面板常态优先名称、锁定以及 3 个无须微调的材质：标准/轻透/柔和，对应既有 glass/clear/dense preset，自动带入圆角/模糊/浓度、文字不透明。其他老风格深空/实色、色调选择、6 条手动滑杆以及 X/Y 精确坐标收进默认折叠的高级外观区域；Widget Registry 自动生成的组件配置单独收进「组件功能设置」折叠区。此前 custom 值不会被打开面板自动覆盖，当前材质标签显示「已自定义」。details 展开/收起触发 WorkerW 交互区域重算。新设置测试 37 项、Canvas 几何 122 项、折射 42 项、GPU 恢复 36 项及控制台回归通过。Windows Native Debug EXE SHA256 E7C82C3B982F84EA71C36BC6781DBB6A8FC614E942115BC8F27AB525101A606C，旧 EXE SHA256 79333BB45EFBC5970D8D2EC92491DE76642E46DC2CA8BF5D48A9DF4D31CF402D 已核验备份到 D:\AI_Cache\flexikit-runtime\flexikit-desktop-before-simple-settings-20261010.exe，新进程 PID 33392；实际 UIA 打开「更多」出现模板/折射/整理/重置入口、确认三个快捷材质，验证高级外观能展开也能完整收起，当前 5 个用户已存组件保持原样。非 Release 的 GPU/Explorer 崩溃/双屏验收不因本设置变更提升。

## 2026-10-09 GPU 会话恢复优化

消除无差别画布 Resize / WorkerW 重挂事件造成的 GPU 预览关闭；以真实显示器几何指纹判断图集失效。新建 Rust 进程内一次性 Canvas-recovery-N 会话授权，用户已开启的同进程恢复无需再次手动操作，但不会持久化图像/路径/权限，手动关闭/隐藏可立即撤销。新增 CPU WebGL 提交 P95 有限长度采样提示（不等于 GPU 执行时间）。Windows 原生 Debug EXE PID 37028 / SHA256 C18AF2EE04A915AD41D80478A6FF36B8346A7150EABF49962714110E26E97351，六 Widget 不变，实机开启→1px 临时 HWND Resize→仍开启、关闭→重开流程通过；真正 Explorer 销毁 HWND 的完整恢复待非生产环境实测。153 项生命周期、144 图集、21 折射和 122 控制台几何检查通过，详情见 docs/CANVAS_WALLPAPER_OPTICS.md。

## 2026-10-09 最新：多屏映射、旧显示器记录隔离与 GPU 初测

已引入 Windows IDesktopWallpaper 逐屏物理 Rect + 置图模式与背景颜色；前端按虚拟物理桌面合成单张限 2048px 的 WebGL 纹理，支持 Fill/Fit/Stretch/Center/Tile/Span。Windows 保留失效显示器记录，本机壁纸 COM 显示 3 屏但 Tauri 仅 1 屏，改为过滤活动屏并在单屏保留 SPI 旧版可靠通道。Debug EXE SHA256 21CC80DD152DBA32D639F9AEF8E3959D65A96D047759F9B89479418D732E38B5、PID 26316；实机已点击「试用折射」确认 GPU 首帧成功。144 项多屏合成、21 项折射集成、122 项 Canvas 布局通过；仅短时进程树/GPU 引擎对照，尚无双屏真实像素、长期功耗/60fps 验收。旧 EXE SHA 备份、桌面图标恢复、六组件布局不变。详细见 docs/CANVAS_WALLPAPER_OPTICS.md。

## 2026-10-09 GPU 壁纸折射单屏样机运行记录

已研发手动开启的 Windows 本机静态壁纸 GPU 纹理折射，不再只是 CSS 高光。Canvas 顶部增加「试用折射 / 关闭折射」；只有点击才读取配置的本机壁纸，单屏场景下 WebGL2 单上下文对 Widget 圆角区域进行纹理位移，最大 2048px 纹理和有限指针绘制帧率。未截取桌面窗口/图标、未上传、未持久化图片，不更改现有六个组件位置。真实 Windows Debug EXE 已启动 PID 36596（SHA256 `FBC49009A54CD21F8821F58A4491F604996DBDFFFB010FB7466A91AA9D044745`），Canvas UIA 中出现「关闭折射」，仅在内存中对少量输出像素采样确认可见 GPU 壁纸颜色；Vue 构建、18 条安全专项与 122 条几何回归通过。仅适用于单屏静态壁纸近似 Fill/Span；动态壁纸、多屏和其他桌面窗口不折射，仍非 Apple 系统级实时折射。详细架构、隐私和未来门禁见 `docs/CANVAS_WALLPAPER_OPTICS.md`。

## 2026-10-09 Liquid Glass v1 二次视觉核查与光学增强（用户反馈「不像新版」）

- **版本核实：** 用户看到的确实是上一轮最新原生 EXE SHA256 `2840B54C998323F26EED8AC2D3AAE67EBFC86A33E97B41E103E6180619E15A09`，PID 16760，没有启动旧版。检查 `dist/assets/DesktopCanvas-*.css` 确认 Liquid Glass 样式真实输出。用户反馈差异不明显是有效视觉问题，而非版本错误。
- **实际采样：** 之前 `Graphics.CopyFromScreen` 在 Runner 中因无效句柄失败；这次成功使用 Win32 `PrintWindow(PW_RENDERFULLCONTENT)` 对 WorkerW Canvas 窗口（1648×810）进行内部截图。图中旧版表面确实像普通灰色半透明平板，外圈与光泽不明显；黑色背景是透明画布在离屏截图中的合成结果，**不是用户桌面壁纸**。前后截取相同窗口并对比光学轮廓，绝不能将此黑底截图当成真实壁纸透明采样。
- **编辑态发现：** 原画布停留在编辑模式（顶栏「完成」），该状态禁用了 `WidgetHost` 的指针高光并显示编辑辅助蒙层。已通过 Windows UIAutomation 点击「完成」进入正常展示模式，没有触发整理/重置/模板应用，没有改组件位置。
- **本轮修正：** 增强玻璃顶部弧形高光、角落局部焦散、不同方向的明暗双重边沿及浮动阴影，保持中央内容板独立、文字和图标不受外壳透明度影响。新版 CSS 在 `apps/web/src/styles/canvas-liquid-glass.css`；材质和 122 项布局专项测试通过。受控停止旧 PID 16760、SHA256 备份到 `D:\\AI_Cache\\flexikit-runtime\\flexikit-desktop-before-liquid-optics-20261009.exe`、恢复 Explorer 桌面图标后通过官方 gnullvm 脚本编译。新 EXE SHA256 `13CDD777D94CCAB7DA794C45D239731920871AEAA442DEBEEE89346A65D5FBA6`，已启动新 PID **24604** 并从主窗口打开 Canvas，确认正常渲染/非编辑模式。
- **验收结论：** PrintWindow 前后比较确认表面局部光泽、顶部反射与边框层次有所加强，但仍不能称为苹果原生动态折射；用户批评「与上一版太接近」的核心诉求**尚未完全达成**。主要底层限制是 Tauri/WebView2 的 `backdrop-filter` 只作用于当前 WebView 内容，不会自动获取透明 WorkerW 窗口背后的真实壁纸像素。若要实现真正的桌面背景位移折射与动态流体镜片，需要原生 Windows 材质/壁纸采样合成方案、性能与隐私设计，须单独立项评审，禁止将仅修改 CSS 的结果误称为「完整 Liquid Glass」。
- 仅产生临时截图供本轮视觉比对，应在文档记录完毕后销毁，不把包含用户桌面文件名的图片留下或提交进 Git。暂停中的主窗尺寸问题未碰。

## 2026-10-09 Liquid Glass v1 Windows 原生部署

- 已在最新 Liquid Glass 源码构建后安全升级实际 Windows 原生 Debug 客户端：先检查旧版唯一运行进程 PID 13952 和原 EXE SHA256 `2CA2CD4D6E75F382AAF02B06179EF29A66A37311646BD7A4A6F25F333DB5DF03`，完整备份旧 EXE 到 `D:\\AI_Cache\\flexikit-runtime\\flexikit-desktop-before-liquid-v1-20261009.exe` 并逐字节哈希验证；受控关闭旧进程后恢复此前被隐藏的 Windows Explorer 桌面图标。没有清空 WebView2 用户资料、调整用户 Canvas 位置或应用模板。
- 官方 `scripts/windows-gnullvm-build.ps1` 已执行成功，编译原生 Windows Rust gnullvm Debug EXE、桌面 Vue 资源并 staging 运行时 DLL。新 EXE SHA256 `2840B54C998323F26EED8AC2D3AAE67EBFC86A33E97B41E103E6180619E15A09`，不同于备份。
- 已启动新的唯一原生进程 PID **16760**，Win32 UI Automation 已验证 FlexiKit 主窗口、Pet 以及 Explorer WorkerW 挂载的 `FlexiKit Desktop Canvas` 窗口（1648×810，252 个 UIA 元素），实际出现「＋ 添加工具」「控制台模板」「恢复布局」交互入口。构建 CSS 已包含全新 `liquid-material-opacity`，三档材质可从 Inspector 预设切换。尚未通过屏幕像素截图客观复核深/浅壁纸下的视觉对比度；之前远程屏幕捕获因无效 Win32 句柄失败，因此不冒充视觉终验。
- `build:desktop`、材质整合测试、122 项布局、Pinia 20 轮 117 断言通过；本轮仍是 **Debug 原生版**，Release、用户视觉确认、跨 DPI 及真实物理鼠标拖动需后续验收。缩放跳动旧问题继续暂停。

## 2026-10-09 — FlexiKit Liquid Glass v1 / 用户确认实施

- 用户批准由上一版偏厚重的 Regular Glass 升级为 **Liquid Glass**；新增独立的 `apps/web/src/styles/canvas-liquid-glass.css`，在 Desktop Canvas 范围内生效，不更改全站样式，也不影响 Windows 透明 WorkerW 宿主或真实用户 Canvas v2 布局。
- **外壳和内容解耦：** 在 WidgetHost 外壳上分别渲染一次背景底色混合（不再将多层透明度累乘）、backdrop blur / saturate、静态与指针位置关联的局部高光、独立高亮描边；组件内容独立 100% 不透明展示，底层放置局部羽化 Content Plate，而不是覆盖整块不透明底板。指针高光用 `requestAnimationFrame` 合并更新局部 CSS 自定义变量，不产生 Vue/Pinia 持久化写入；编辑拖动、触屏、用户要求减少动态和透明时跳过。
- **材质：** 旧 `glass` 改名「液态·标准」，材质背景浓度适配 59–75%，新建默认 66% / blur 30px / 整体 opacity 1；保留 `clear` 为「液态·轻透」（25–43%，默认 34%）；增加 `dense`「液态·浓厚」（78–89%，默认 82%）。旧 `space` 深空、`solid` 实色和 `custom` 自定义保持可用，`dense` 加入存储 schema 白名单。历史已有 `glass` Widget 不改 persisted values，仅新 CSS 控制实际材质渲染区间；`custom` 仍尊重用户专门设置的整体透明度。
- Canvas Toolbar、Widget Palette、Inspector、Tool Picker、Console Studio 共享 `liquid-panel` 设计语言；控制面板更致密但保留背景透出。选中、拖动、缩放等高亮状态继续比非编辑场景更明显；Inspector 标签区分「整体不透明度（含文字）」与「玻璃浓度（只改变背景）」。
- **边界：** 这是 WebView2 / CSS + Windows 原生透明窗口的高保真视觉近似，不是苹果专有 compositor 的真实动态壁纸采样、光线追踪折射。系统深浅主题、用户固定色调、prefers-contrast/reduced-motion/reduced-transparency/forced-colors 提供可靠的对比度适配；目前不宣称能检测 Windows 壁纸的图像复杂度。
- **验证：** `npm run build:desktop` / `npm run test:desktop-canvas-console-regression` / `npm run test:desktop-canvas-orientation-regression`（122 项）通过，`npm run test:stage6-canvas-performance` 的真实 Pinia Store 20 轮 / 117 项断言通过；旧版程序仍在运行时不能误称已更新原生 EXE。后续实机验证和部署结果另补。窗口缩放问题保持暂停。

## 2026-10-09 Apple Regular Glass 材质已部署的运行记录

- 在安全核对 Windows 运行中单例 PID 48300、EXE SHA256 并将原版备份到 `D:\\AI_Cache\\flexikit-runtime\\flexikit-desktop-before-regular-glass-20261009.exe` 后，受控停止旧版并发现之前 Explorer `SysListView32` 图标被隐藏，立即恢复图标可见性，未杀 Explorer/未删除用户本地配置。
- 重新执行官方 `scripts/windows-gnullvm-build.ps1`：Windows gnullvm Debug Rust、Web Desktop Vite 与 `WebView2Loader.dll/libunwind.whl` 资源 staging 全部通过；新 EXE SHA256 `2CA2CD4D6E75F382AAF02B06179EF29A66A37311646BD7A4A6F25F333DB5DF03` 不同于旧版。交互 Windows 会话实际启动单实例 PID **13952**；主窗口、Pet、WorkerW Canvas HWND（52757612）存在。Canvas UI Automation 找到「＋ 添加工具」「控制台模板」「恢复布局」，且 Canvas 有内容。`dist/assets/DesktopCanvas-*.css` 实际包含新材质变量。
- Vue build、`test:desktop-canvas-console-regression`（含 8 项新增外观契约）、122 项布局、真实 Pinia Store 20 轮/117 项断言及 git diff --check 通过。**限制：** 尝试使用 Graphics.CopyFromScreen 捕获真实画面时因当前远程桌面句柄无效而失败；不声称完成像素级实机视觉检验。未替用户应用控制台模板或更改已有布局。Release 发布、真人壁纸亮/暗对比度观察仍待用户验收。

## 2026-10-09 玻璃材质可读性调整：参考 Apple Liquid Glass 与 WWDC26

- 用户反馈「画布太透明，看不清」，本轮查阅 Apple 2026 官方设计指南 `https://developer.apple.com/wwdc26/guides/design/`、Apple Materials `https://developer.apple.com/design/human-interface-guidelines/materials` 与 WWDC25 `https://developer.apple.com/videos/play/wwdc2025/219/`。官方区分 Regular（需要文字可读、动态模糊与明暗调整）与 Clear（背景照片优先），并不建议把所有内容层叠成高透明玻璃。
- 找到根因：WidgetHost 原本将**自身已有 alpha 的全局 `--glass-bg`** 再按 `surfaceOpacity` 混合透明，暗/亮双重衰减（浅色根 `--glass-bg` alpha 为 0.32，旧默认 surfaceOpacity 为 0.72，实际底色贡献约 0.23）。修复为实色材质基底，再按组件实际表面浓度混合；`glass` 历史组件可读下限 84%、`space` 89%、`solid` 96%；`clear` 轻透和用户 `custom` 继续遵循自己明确设置的浓度，不自动覆写现有 Canvas v2 存储。
- 新建组件默认不再连文字整体变淡：`opacity=1`、`surfaceOpacity=.88`、`blur=34`、`shadowStrength=.10`；亮色使用淡暖白 / 深色使用深墨色的高纯度半透明 Regular 基底。文字、按钮与图标表面区分层级，窗沿高光与柔和阴影分离壁纸；避免把整张桌面盖成灰幕，Canvas backdrop 保持透明。
- 加厚画布顶栏（89%）、组件面板（94%）、属性面板（95%）、控制台模板与添加工具弹层（96%）；覆盖明确的亮/暗/系统自动主题，支持 OS `prefers-reduced-transparency` 和 `forced-colors`，无须更改 Rust 窗口透明性或桌面 WorkerW 逻辑。动态真正的 Apple 私有镜片折射不是 CSS 复制，设计只借鉴其分层与对比度原则。
- 回归：`npm run build`、`npm run test:desktop-canvas-console-regression`（额外 8 条材质契约断言）、`npm run test:desktop-canvas-orientation-regression`（122 项布局）通过。仍需在新 Windows Debug EXE 中看视觉并核对明暗壁纸的实机效果；正式 Release、不同 DPI/高对比度人工验收另列。

## 2026-10-09 新版原生程序启动与真实界面确认

- 按用户「运行新版」要求，在桌面进程 PID 18116 仍运行时先备份原 EXE 到 `D:\\AI_Cache\\flexikit-runtime\\flexikit-desktop-before-console-custom-20261009.exe`，SHA256 核验通过。对唯一进程进行受控停止之前检查 Windows Explorer 桌面图标可见性；原本图标为隐藏，停止后显式恢复 Explorer `SysListView32` 可见性并确认恢复成功，不杀 Explorer、不清空用户 Canvas Profile。
- 然后在没有运行中 FlexiKit 进程时执行 `scripts/windows-gnullvm-build.ps1`，Vite Desktop 与 Rust gnullvm Debug 原生编译、运行时 DLL staging 均成功。新版 EXE SHA256 `071F197515EF4157E7FD61F09B90837BEA7CD961C507242B17EB63EE1DF62E03`（与原版不同）；使用交互会话独立持久启动，当前 PID **48300**。
- Win32 HWND 确认新进程主窗、Pet、WorkerW 子层 `FlexiKit Desktop Canvas` 均可见；Windows UI Automation 从原生 Canvas 的「控制台模板」入口真实打开新「设计你的桌面控制台」面板，确认「横向控制台」「纵向控制台」「自定义控制台」「应用到桌面」均真实渲染。没有点击应用，也没有写入/清除真实布局。122 项纯内存方向/停靠点/自定义布局检查同步通过。
- **当前已运行的是开发用 Windows gnullvm Debug EXE，不是客户 Release 安装包。** 鼠标拖放、真实工具执行、不同屏幕尺寸/DPI 与保存模板后的恢复流程仍需终验；暂停的窗口缩放问题未动。

## 2026-10-08 控制台横竖布局与自由定制（本轮新增）

- 「控制台模板」升级为「控制台设计中心」，提供 **横向一排/宽布局** 与 **纵向叠放/高布局** 两种排列方式；6 个组件时自动改为两行或两列，防止极端尺寸出现很窄的组件。三套原有预设仍可选，新增「自定义控制台」按需勾选（1–6 个）组件和上移/下移排序。
- 布局定位支持 3×3 **九宫格（四角、四边中心、正中）** 和水平/垂直各 ±300px 的细调；实时布局预览随着方向、停靠位置和偏移而更新。应用后，编辑模式仍可用鼠标拖动、缩放组件，并通过 Inspector 直接输入 X / Y 坐标精细定位；同一个「我的工具」 Widget 也可在 Inspector 中选择「自动/横向图标/纵向列表」。
- 自定义预设（名称 + 组件类型顺序 + 方向 + 停靠点 + X/Y 偏移）只在用户点击「保存为我的控制台」时持久化到独立的 `flexikit-canvas-console-custom-v1`；严格校验版本、白名单组件类型、最大数量与偏移，坏 JSON 或未来版本不替换布局。个人预设与 Canvas v2 当前布局分开，移动单个组件后原 v2 自动保存，不会覆盖个人预设。
- 应用控制台仍必须点击「应用到桌面」和「确认应用」两步，并复用已有 **本机 Canvas v2 完整布局备份与恢复**。新加存储失败内存回滚：写入最新布局失败时还原原有组件、选择状态与编辑状态，避免空画布。
- 已有工具与桌宠不会被删除。仍处 Stage 6 中的插单开发；**本轮前端资源尚未替换已启动的 Windows Debug EXE（此前 PID 18116）**，当前原生窗口仍为前一版本；实机真实拖动、DPI、Explorer 终验未完成。窗口缩放问题按用户要求继续搁置。
- 验证：`npm run test:desktop-canvas-orientation-regression` 使用内存存储与真实 TS 生成函数覆盖 2 种显示器尺寸（1648×810/960×640）、2 方向、9 停靠点、3 预设及自定义 6 组件组合，**122 项布局检查通过且无组件重叠**；控制台集成回归、Vue 严格构建及 Desktop 前端构建通过，Canvas Store 20 轮/117 项断言（包含本机存储写入失败回滚检查）通过。模拟数据没有访问真实 Desktop/Profile。

## 客户使用方式

打开 Desktop Canvas，画布顶部现在有：

- **「＋ 添加工具」**：工具选择面板，直接从现有工具箱中搜索/筛选/固定网页与本地工具。首次固定时自动生成一块「我的工具」组件；后续点击组件右上角「＋」或底部「编辑工具」可修改固定内容，支持移除并取消固定。组件只保存工具 Store 的稳定 key 列表，不保存/拷贝 exe 路径或第三方凭据。
- **「＋ 网页工具 / ＋ 本地程序」**：在工具面板中复用原来的 `WebToolImportModal` / `LocalToolImportModal`（网址自动识别、Windows shell 图标、文件类型白名单与 Tauri 安全 IPC）。用户先导入到全局工具箱，然后将其固定到本 Canvas。Canvas 打开导入器时已进入编辑状态，使用原有安全边界。
- **「＋ 组件」**：现有 Widget Registry 新增「我的工具」独立 Widget，可不限数量添加及拖拽/缩放/锁定；默认未指定工具列表的样板组件会展示当前工具库前 8 项。客户编辑后 `config.toolKeys` 持久化，卸载/删除工具时该快捷入口自动消失，绝不通过缓存路径继续启动。
- **「控制台模板」**：提供「效率控制台」「创作工作室」「极简专注」3 种统一设计语言的成套布局；选中后预览排版并二次确认才应用。均包含工具区与桌面收纳，另外根据场景组合时间、搜索、磁盘、便签或 AI。按主显示器宽高缩放、20px 栅格和 margin 布局。其余组件仍由用户自行编辑。
- **「恢复布局」**：用户第一次应用任一模板之前把原 Canvas v2 `widgets/monitors` 保存为一个只在本机/当前 App Origin 生效的独立备份 key `flexikit-desktop-canvas-v2-before-template`。再次切换其它模板**不会覆盖第一次备份**；点击恢复时恢复所有保存的组件配置与监视器状态，并删除备份。打开模板面板不写存储。不存在自动替换或清空用户画布的后台行为。

## 工程边界

- 工具 ID：依赖现有 `useToolsStore().getToolKey(tool)`，查找不成功的项不渲染也不能启动。仅使用 `openDesktopTool(tool)` 现有规范化 Windows 原生 `open_local_path` 和 HTTPS 外链打开接口；不在 Canvas 中新增未经限制的文件执行途径。
- 全局工具箱与 Canvas 工具区分层：Canvas `config.toolKeys` 只是 **引用列表**，不是第二份商品/工具记录。继续允许主工作台创建、修改、删除工具；Canvas 下次同步展示最新元数据。
- Tauri events：在原 `main-event-listener` 主窗 capability **之外**，新增仅匹配 `canvas` / `canvas-recovery-*` 的 `core:event:default`，支持本地导入既有 drag/drop 监听；无网络权限、文件系统全部访问权限、任意路径启动权限扩张。
- 默认 starter/历史自定义布局不在应用启动时自动替换。现有 Canvas v2/升级逻辑保持不变。二次确认后应用布局时才写本地备份并更新 v2；模板均包含 Desktop Organizer，避免后续挂载时自动补齐产生位置漂移。
- 窗口缩放 DWM 跳动问题继续按用户要求暂缓，不使用模板工作改变相关原生窗口行为。

## 测试与交付门槛

- [x] `apps/web: npm run build` 和 `npm run build:desktop`：Vue TS 严格构建与 Windows Desktop Vite 资源构建通过；新增专用 `test:desktop-canvas-console-regression` 检查视图、模板、权限和工具启动契约通过。
- [x] `apps/web: npm run test:stage6-canvas-performance`：原有 20 轮 Store 压力回归；新增模板前备份、模板切换保留第一次备份、完整恢复 9 项断言（总 113 项）通过。测试 localStorage 是内存桩，不访问任何真实 Canvas 配置。
- [x] 网页/本地工具导入专项回归、Canvas v2 本地迁移保护、独立 capability JSON 名称/权限/窗口作用域检查通过；新增 Canvas 自身 Toast 显示，启动错误可向用户反馈。
- [x] 在旧实例已退出的条件下执行项目官方 `scripts/windows-gnullvm-build.ps1`，Cargo 原生 Debug build 与 Web Desktop 资源构建均成功；旧 EXE 已 SHA256 核验备份到 `D:\\AI_Cache\\flexikit-runtime\\flexikit-desktop-before-canvas-tools-20261008.exe`。运行中的新原生程序 PID 18116；可见主窗、Pet、Canvas HWND，UIA 直接点击主窗「桌面画布」、Canvas「控制台模板」，三套真实模板预览文字与「使用此模板」可读；无模板实际应用或原布局覆盖。此前 gnullvm cargo check 缓存占用和独立缓存依赖 E0463 属历史失败，本次实际 Cargo build 已成功。
- [ ] 独立干净 Canvas Profile 的鼠标工具添加、点击外链、本地程序打开、拖入文件、3 模板布局视觉和恢复历史用户布局验证。
- [~] 开发用原生 Debug EXE 已更新并在用户交互会话可见；Release 安装包和客户人工视觉/交互终验未做。Windows 缩放 DWM 问题按要求继续搁置。

**下阶段指针**：此次是 Stage 6 主线期间按用户要求插入的 Canvas 产品打磨；完成验证之后依旧回到 `docs/MASTER_PLAN.md` 的 Stage 6「性能指标」，无故不跳阶段。
