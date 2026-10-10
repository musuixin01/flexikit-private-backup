# FlexiKit Desktop Canvas

## 2026-10-09 WebGL 上下文中断与 WorkerW 安全重建

新增两次失效确认与 1/2/4/8×1.5s 退避，修复 HWND 查询错误导致恢复监控长久跳过；HWND 在但 WorkerW 关系失效时只重挂。单共享 WebGL 纹理的 context lost/restored 事件允许驱动恢复后至多两次重建，4 秒超时直接回退普通玻璃；未完成的壁纸解码及 GPU 初始化会被取消。数据仍仅存内存，六组件布局/桌宠不变。原生 Debug 编译成功、Rust 4 与 JS GPU 36 项安全回归通过；用户已运行安装版未被改动，真实 GPU/Explorer 破坏性测试仍待 VM。

## 2026-10-10 属性面板简化与高级参数渐进展开

默认属性面板只保留常用操作与标准/轻透/柔和三种单击即可完成的现有材质组合；之前可调的模糊、透明度、颜色、圆角、边框、阴影、X/Y 坐标不删除，统一放入折叠的高级外观区域。Widget 自有 schema 配置也独立折叠。顶部只放常用添加/编辑/更多/关闭，所有危险或低频动作包括重置需要打开更多菜单，重置另须确认。当前 Canvas 用户保存的五个组件和旧 appearance 内容无需迁移，也没有被覆盖。Native Debug PID 33392 实机验证 5 Widgets、更多展开和高级控件收起/展开通过，完整实现详见 docs/CANVAS_CONSOLE.md。

## 2026-10-09 磨砂玻璃的边框与雾化渐变协调

修正用户截图所示的清晰薄边与模糊主体之间的断层：GPU 圆角 SDF 以 1.25px feather 覆盖率替代硬 discard，折射位移在边缘归零再沿 5→32px 缓变，近中心对原本静态本机壁纸做四邻近轻柔采样并在 4→34px 平滑混入，避免透明边缘突然跳入完整磨砂。CSS 常态 0.75px 边框再淡化至 24% rim，护字板改用和 Widget 相同圆角的 inset:0 径向羽化，不再内缩 5px。六组件/五组件等用户当前库存和坐标均不进行任何主动修改，当前真实 UIA 显示 5 个用户持久化组件；原生 PID 35444 确认 GPU 可开启。详见 docs/CANVAS_WALLPAPER_OPTICS.md。

## 2026-10-09 去掉叠加高光造成的粗边框

本轮视觉回访发现 1px CSS border 与 1px ::after mask 亮环、inset 亮边和 40px Shader SDF 高光重复，让边框仍显厚。改为单一低对比度 .75px border，移除 ::after 重复高光及多层内缘，外侧阴影减轻；Shader 仅在 18px 光学带中做微弱的折射和边缘明暗，维持向内采样。编辑/选择保留一像素高亮反馈；不改任何旧 Widget 坐标及 preset。34/36/122 与 Console 检查及 Windows Native 编译通过，新 PID 14188 GPU-ready。

## 2026-10-09 边缘折射方向与描边精修

壁纸 Shader 的边缘采样从 pixel + bend 修为 pixel - bend，使位移参考回到圆角组件内侧，边缘位移与切向鼠标波纹强度同步减小；不翻转 atlas Y 轴，不改变系统壁纸映射、不改变任何六组件的布局数据。外沿玻璃反光 rim 从 2px 调整为 1px 并降低亮度，视觉更轻薄。桌面 Vue、29 项折射方向/采样、36 项 GPU 恢复和 122 项布局测试通过。Debug EXE SHA256 4E27476C34422E66BE1531C52031F8D454B48D74BF1B51B3EA4C747BC2361A4C，PID 2348 已在 Windows 正常显示并主动开启折射供现场比较。

## 2026-10-09 GPU 预览恢复与画布尺寸事件治理

之前任何 Windows 原生 resize 均会将 opt-in 静态壁纸 GPU 折射关闭，本轮改为仅在显示器几何/缩放/主屏真实变化时失效。WorkerW 真正销毁 HWND 后允许同进程已获用户授权并真实重建的 canvas-recovery-N 视图一次性自动恢复，冷启动与用户主动关闭/隐藏仍是默认关闭，不存任何壁纸到磁盘。仅显示最近 120 帧 JS 命令提交 p95 提示（不含 GPU 执行时间）。Windows Debug PID 37028 实机测试 1px Canvas resize 后折射仍在、六组件位置不变、手动开关成功；真实 Explorer 重建尚未物理验证。详见 docs/CANVAS_WALLPAPER_OPTICS.md。

## 2026-10-09 GPU 壁纸折射样机

Canvas 新增可手动开启的 Windows 静态壁纸 GPU 折射样机：一个共享 WebGL2 着色器，只在 Widget 圆角范围进行本机图片纹理偏移，保留原有文字和配置。默认关闭，关闭后不保留壁纸数据，不截屏/录屏，不上传。仅单屏静态壁纸 Fill/Span 类显示；完整限制、隐私和后续多屏规划见 docs/CANVAS_WALLPAPER_OPTICS.md。
## 2026-10-08 Stage 6 Canvas Store 稳定性说明

- Stage 6 采用真实 Vue 3/Pinia Store 和纯内存型 localStorage 测试：20 轮组件添加、删除、分组、锁定、frame 更新、交互期暂停保存、结束后持久化和 Pinia 重载，共 104 项断言通过；不会读取或覆盖真实用户 Canvas Profile。
- 这只验证 Store 状态层，不包括 WidgetHost 物理指针事件、WorkerW/HRGN、桌面图标保护、跨屏 DPI 或 Canvas 显隐/重启恢复。不能将状态层 20 轮称为真实 Windows Canvas GUI 20 次验收；参见 docs/STAGE6_PERFORMANCE.md。

## 2026-10-08 Canvas 客户控制台与添加工具

- 客户可通过 Canvas 顶部添加工具按钮从原全局工具箱固定本地应用或网站；工具面板还能打开原有的安全网页/本地程序导入器，随后可选择固定。新增 Tool Dock Widget 只持久化 ToolStore key 列表，统一使用 openDesktopTool 运行，不保存或执行另一份裸路径。
- 提供效率控制台、创作工作室和极简专注三套完整预设布局，包含我的工具区域、桌面收纳及按场景组织的时间、搜索、便签或系统状态。模板要预览并二次确认后才能替换；原 Canvas v2 全部 widgets/monitors 会本机备份，多次换模板保留第一次备份，顶部恢复布局可还原。
- 为 Canvas 与 Windows Explorer 恢复后生成的 canvas-recovery-* 开放独立且严格限定的 Tauri core:event:default，仅支持导入器拖放事件；原本地路径和网络约束不变。此版尚未部署到实际运行的原生 EXE，WorkerW、多 DPI 和真实用户 GUI 测试尚未完成。见 docs/CANVAS_CONSOLE.md。

## 定位

Desktop Canvas 是 FlexiKit 桌面端的自由小组件层，与主程序和桌宠并列存在。

核心原则：

- 不限制组件数量
- 不限制用户采用固定尺寸预设
- 允许自由位置与自由尺寸
- 允许空画布
- 桌宠始终保留
- 所有入口共享 Tool / Search / Usage 数据
- Widget 类型通过注册表扩展，Canvas Core 不依赖固定组件集合

## 当前架构

```text
FlexiKit Desktop
├── main
├── pet
└── canvas
    ├── WidgetHost
    ├── Widget Registry
    ├── Desktop Canvas Store
    └── Widget Components
```

Canvas 使用独立 Tauri Webview Window：

```text
index.html#/canvas
```

默认隐藏，由主程序侧边栏或桌宠菜单通过 Tauri IPC 唤起。

## 数据模型

每个组件保存：

- id
- type
- title
- x / y
- width / height
- zIndex
- opacity
- borderRadius
- blur
- locked
- groupId（可选，旧布局无需迁移）
- config

布局当前保存在：

```text
localStorage: flexikit-desktop-canvas-v2
```

当前持久化对象显式带 `version: 2`、`widgets` 与 `monitors`。历史 `flexikit-desktop-canvas-v1` 数组不再由 Canvas Store 自己 fallback；应用挂载前由统一本地数据迁移器执行 v0→v1，转换到 v2 后删除旧 key。合法 v2 优先于 stale v1，未来未知 schema 会阻止旧应用继续启动。迁移规范见 `docs/LOCAL_DATA_MIGRATIONS.md`。

允许用户删除所有组件；空数组是合法配置，不会被自动恢复。

## Widget Registry

核心组件通过 `registerWidget()` 注册。

当前内置：

- Clock
- Search
- Launcher
- Disk
- Todo
- Clipboard
- Music
- AI

Launcher 的 `config.launcherPinnedKeys` 保存该 Widget 自己的常用应用顺序。没有配置时仅使用初始推荐作为默认值；用户可添加、移除任意数量应用，并在快速启动中心拖拽排序。配置随 Canvas 布局一起持久化。

其中：

- Todo 将待办内容保存在各自 Widget 的 `config.todoItems`
- Clipboard 只在用户点击“读取”时访问系统剪贴板，不后台轮询，也不持久化剪贴板文本
- Music 通过 Windows GSMTC 读取当前媒体来源、歌名、歌手、专辑、播放状态、进度、总时长与 Thumbnail 专辑封面，并保留上一首 / 播放暂停 / 下一首 / 停止控制
- GSMTC Thumbnail 只在歌曲变化时读取，单张最多 4 MB；前端最多缓存 8 张封面且仅驻留内存，没有封面时回退到 ♪ 占位，不写入 Canvas 持久化
- Music 的歌词默认关闭；用户主动开启后，才将当前歌曲的歌名、歌手、专辑和时长发送给 LRCLIB 匹配歌词
- Music 优先使用 LRCLIB `syncedLyrics` 做逐行时间轴高亮，没有同步歌词时回退到普通歌词；歌词内容只驻留内存，不写入 Canvas 持久化
- 歌词请求有 6 秒超时，并对 429 / 5xx / 网络失败做一次轻量重试；精确匹配失败后继续使用搜索匹配。LRCLIB 不可用时仅歌词降级，不影响 GSMTC 媒体信息与播放控制
- AI Widget 当前是 Prompt 快捷台：Prompt 默认不持久化，可复制并打开用户选择的 AI 工具；尚未接入 FlexiKit 自有 AI 对话 Provider

Registry 的 `type` 为字符串，不使用封闭枚举，因此后续可以继续注册：

- Calendar
- Folder
- System Monitor
- Custom Widget
- Third-party Widget

无需修改 Canvas Core。

## 交互

编辑模式：

- 添加任意数量组件
- 拖动
- 自由缩放
- Shift 多选
- 多组件组合 / 拆分
- 组合后联动移动，但每个 Widget 仍保持自己的尺寸与内容
- 锁定单个组件或整组
- 删除单个组件
- 自动保存布局
- 自动保存 groupId 与外观配置
- 选中组件 Inspector：名称、透明度、圆角、玻璃模糊

非编辑模式：

- 组件正常交互
- Launcher / Search 与现有 FlexiKit 工具数据互通
- Launcher 支持三级形态：桌面小组件 → 快速启动中心 → 全应用 Launchpad
- Launchpad 支持搜索、分类和不限数量的应用列表
- Launcher 使用 Teleport 展开到 Canvas 顶层，不受原 Widget 边界裁切
- 本地工具通过 Tauri `open_local_path` 打开
- Desktop 端首次加载 Canvas 时会自动补齐系统级“桌面收纳”组件：读取用户 / OneDrive / 公共 Desktop 目录，按文件夹、应用与快捷方式、文档、图片、影音、压缩包、代码、其他自动分类；桌面内容本身不搬移、不重命名
- 默认开箱布局改为紧凑两排：上排时间 / 搜索 / 系统磁盘，下排快捷启动 / 桌面收纳；统一 20px 栅格与留白，优先保证 960×640 最小窗口也能完整展示
- 旧版 4 组件 / 5 组件 starter 布局会自动升级到新的紧凑布局；历史开发阶段遗留的“6 组件 + 2 个 Launcher”布局也会一次性去重并迁移为 5 组件。4/5 starter 仍要求旧位置与旧尺寸完全一致、且未锁定/未组合；迁移保留组件名称、外观和 config
- “桌面收纳”中的项目通过受限 Tauri IPC 打开，只允许打开已检测到的 Desktop 目录内项目；组件每 6 秒轻量刷新并在窗口重新获得焦点时刷新

桌宠右键菜单可以直接打开 Desktop Canvas，也可以通过“添加桌面组件”直接唤起 Canvas、进入编辑态并展开 Widget 组件库。

## Windows 桌面层

Windows 端已经加入 WorkerW / Progman 桌面层挂载。

Canvas 启动后会尝试：

1. 通过 Progman 消息创建 / 获取桌面承载层
2. 优先使用经典 WorkerW；如果 Windows 11 将 `SHELLDLL_DefView` 直接挂在 Progman 下，则回退到 Progman
3. Progman fallback 会把 Canvas 放到该父层顶部、位于 `SHELLDLL_DefView`（桌面图标层）之上；非编辑态只有 HRGN 内的 Widget / 控制条 / 弹层区域真实存在于命中测试中，空白区域仍直接穿透给 Explorer。WorkerW parent 模式继续使用底层放置
4. 校验 `GetParent(Canvas HWND)` 确认挂载真实生效
5. 自动铺满当前桌面父层客户区
6. 编辑模式下通过移除 Window Region 限制，让整张 Canvas 恢复可交互
7. 非编辑模式下把 Widget、控制条、组件面板、Launcher Overlay 的 CSS 区域转换为物理像素，并使用 Win32 HRGN 合并成 Canvas 的原生 Window Region
   - HRGN 现在同步读取 CSS `border-radius` 并使用 `CreateRoundRectRgn`，正常态 Canvas 背景完全透明，避免圆角 Widget 外露出矩形 WebView/Backdrop 边框
8. Window Region 之外的桌面区域在 Windows 命中测试中不再属于 FlexiKit，因此右键、刷新、桌面图标点击和框选会直接交给 Explorer，而不依赖 45ms 鼠标轮询
9. Launcher 展开/关闭会主动触发 Region 重算；DPI / resize 也会重新同步
10. 普通“打开 Desktop Canvas”不再强制抢焦点；“添加桌面组件”仍会聚焦并进入编辑流程
   - Canvas 显示时会临时隐藏 Explorer 原生桌面图标列表，关闭 Canvas / 退出应用时恢复；应用每次启动还会先恢复图标，避免上次异常终止后留下隐藏状态；文件没有被删除或移动
11. 原生恢复 watchdog 每 1.5 秒轻量检查 Canvas HWND、父层和尺寸：父层仍为存活的 `Progman` / `WorkerW` 时只做轻量尺寸/Region 同步；如果 Explorer 重启直接销毁了 Canvas 子 HWND，则等待新桌面父层 ready 后，用 `canvas-recovery-N` 代次 label 重建 Tauri WebView，重新挂载、恢复可见状态/桌面图标策略/已保存 HRGN，并触发前端 Region/拓扑重算。恢复窗口只有在 attach 成功后才提交新代次，失败的临时窗口会立即销毁后重试

如果桌面层挂载失败，Canvas 会保留普通透明窗口作为降级模式，并在顶部显示“窗口模式”。

默认进入非编辑模式，避免打开 Canvas 后整张桌面被编辑层接管。

## 多显示器与 DPI 布局

- 原生端通过 Tauri Monitor API 返回显示器名称、虚拟桌面坐标、尺寸、缩放比例和主屏标记，并统一转换为 Canvas CSS 坐标
- Widget 新增可选 `monitorId`；拖动跨越屏幕中心后会自动更新所属显示器
- 布局持久化升级为 `flexikit-desktop-canvas-v2`，同时保留旧 `v1` 数据不删除；首次升级会自动读取旧布局并写入新结构
- 显示器分辨率、位置、主屏或 DPI 发生变化时，Widget 会按原显示器内的相对位置映射到新几何范围；显示器消失时回退到主屏
- 新增组件默认放到主屏；多屏编辑时 Inspector 可把单个 Widget 直接迁移到指定显示器
- 顶部控制条、组件库和 Inspector 锚定在主屏；编辑模式会显示每块显示器的边界、名称、主屏标记和缩放比例
- Canvas 的 resize / ScaleFactorChanged / Explorer 恢复事件都会触发显示器拓扑刷新和 HRGN 重算
- 当前仍采用一张跨虚拟桌面的 WebView Canvas；真正的混合 DPI 多屏渲染仍需实机验证，如 WebView2 在跨 DPI 边界出现缩放差异，后续再评估“一屏一个 Canvas 窗口”架构

## Widget 外观系统 V2

- 外观预设不是固定档位，只是快捷入口：玻璃、深空、轻透、实色
- 每个 Widget 可独立选择跟随主题 / 深色 / 浅色色调
- 除原有整体透明度、圆角和玻璃模糊外，新增表面浓度、边框强度和阴影强度
- 用户修改任意参数后自动进入 `custom`，不会被预设值限制；多选 Widget 时仍支持批量修改
- 所有外观参数继续保存在 Widget 自身的 Canvas v2 数据中；旧布局缺少字段时自动补默认值，不重置 Widget 内容、位置或尺寸
- WidgetHost 统一通过 CSS Variables 渲染外观，因此 Clock / Todo / Clipboard / Launcher / Music / AI Prompt 等现有组件无需单独适配
- 深空预设使用中性深空灰，不引入额外品牌蓝色；Inspector 自身保持当前 FlexiKit 玻璃设计语言
- Inspector 增加紧凑滚动区域和定制细滚动条，小分辨率下不会把属性面板撑出屏幕

## Widget 用户配置系统

- Widget Registry 现在可声明 `configSchema`，Inspector 会自动生成配置 UI，不再为每种 Widget 单独硬编码设置面板
- 当前支持四种字段：`boolean`、`select`、`range`、`text`；字段自带默认值、说明、范围/选项等元数据
- 新增 Widget 时会把 Registry 默认配置写入自身 `config`；旧 Widget 缺少字段时由 Schema 默认值兜底，无需迁移存储版本
- “恢复默认”只覆盖 Registry 明确公开的配置键，不会删除或重置 Widget 的内部数据
- `todoItems`、`launcherPinnedKeys`、`aiToolKey` 等内部状态没有暴露给通用配置系统，避免用户设置误伤业务数据
- 第一批已接入：
  - Clock：显示秒、12/24 小时制、显示日期、显示星期
  - Search：结果数量、搜索提示文字
  - Todo：是否显示已完成项目
  - Music：联网歌词开关
- Music 的 Registry 歌词开关与组件内歌词按钮使用同一个 `musicLyricsEnabled`，任一入口修改都会实时同步
- 配置仍保存在现有 Canvas v2 Widget 数据中，并沿用当前深空灰玻璃 Inspector 设计语言

## 栅格、拖动与滚动稳定性

- Canvas 编辑模式最终布局统一使用 20px 栅格；真实拖动/缩放过程中保持像素级 1:1 跟手，只有在交互结束时才吸附到同一 20px 网格，避免移动过程中逐格跳动
- 默认 Widget 布局已改为 20px 倍数，新增 Widget 会扫描当前显示器空位，不再斜向错位堆叠
- 顶部新增“整理”操作，可把当前已保存的凌乱布局重新按栅格无重叠排布，不会自动打乱现有布局
- 编辑模式下整个 Widget 都可以拖动，并使用 Pointer Capture 保持连续拖动；按下后需移动至少 3px 才真正进入 move/resize，因此纯点击只完成选中/置顶，不触发布局吸附或持久化
- pointermove 只接收当前 pointerId，记录最新坐标并通过 requestAnimationFrame 每帧最多提交一次 frame 更新；pointerup / pointercancel / blur / lostpointercapture 会先 flush 最后坐标，再在已实际移动的前提下完成网格吸附并统一清理 Pointer 状态
- Launcher 整理模式改为整块软件图标拖动，并启用 Sortable pointer fallback
- Launcher 小组件、快速启动和 Launchpad 使用稳定 CSS Grid 单元
- Inspector、Launcher 和 Launchpad 使用稳定 scrollbar gutter，减少滚动条出现时的布局闪动
- Widget 布局持久化基础仍为 120ms 防抖；2026-10-04 起拖动/缩放期间暂停持久化调度并只标记待保存，释放后统一恢复调度，避免每个 pointer frame 反复清理/创建 timeout；编辑模式不再逐帧重复重算全屏 HRGN
- 2026-09-23 用户实机确认：整卡拖动、四边/四角 8 向缩放、20px 吸附、右侧缩放不误开 Inspector 均正常；Desktop Organizer 双击文件夹与普通文件也正常打开
- 2026-09-23 S1.9 最终回归：默认两排布局通过真实窗口实拍；Launcher 快速启动 / Launchpad / Organizer 各连续 10 帧稳定；Canvas 20 次显示/隐藏无失败；应用重启后默认布局持久化一致

## 动画与交互反馈

- Canvas 动画统一使用 `cubic-bezier(.25,.1,.25,1)` 和约 300ms 节奏，避免不同控件各自使用不一致 easing
- 顶部控制条进入时使用轻微位移 + 透明度过渡；进入编辑态时背景氛围和 20px 网格改为渐入，不再瞬间闪现
- Widget 组件库 / Inspector 使用 opacity + 微位移 + 轻 blur 的入场/退出；组件库条目增加轻量级错峰入场，但不引入长延迟
- Widget 在“整理 / 重置 / 显示器布局重映射”等非指针操作时对 `left/top/width/height` 做平滑补间
- 一旦用户开始真实拖动或缩放，会给 `html` 加临时 `canvas-pointer-active` 状态并立即关闭全部 Widget 几何 transition，保证鼠标 1:1 跟手；结束后再恢复动画
- 当前被拖动 Widget 只使用阴影、描边和 grabbing 光标形成提起反馈，不再做几何 scale，避免拖动时视觉锚点偏移并继续保证边缘不越出 Win32 RoundRect HRGN
- `pointercancel` 和窗口失焦会主动结束交互并清理 Pointer 状态，降低 Alt-Tab / 系统打断后卡在拖动状态的概率
- 所有新增动效支持 `prefers-reduced-motion: reduce`，系统要求减少动态效果时会关闭非必要动画
- 2026-10-04 专项验证：Web strict / desktop-mode build 通过；Rust fmt/check/debug build 通过；原生 24/24 tests 通过；本地备份/迁移/隐私/数据生命周期/BYOK/AI Assistant/Prompt 历史回归通过；Debug 实际启动日志出现 setup_complete、global_search_shortcut_ready，并真实发现 434 条本机软件记录。

## 当前边界

桌面层挂载与区域穿透已经通过 Rust / TypeScript 编译验证；Windows 11 实机确认 `FlexiKit Desktop Canvas` 挂在 `Progman / Program Manager`，普通模式 HRGN 为 Complex Region。2026-09-23 先修复 Progman 子窗口 Z 顺序，确保“添加 / 编辑 / 整理”和 Widget 命中 Canvas WebView、HRGN 外空白继续交给 Explorer；随后完成真实拖动/8 向缩放/吸附/Organizer 双击回归。S1.9 又通过真实 Explorer 重启暴露并修复了“Explorer 销毁 child HWND 后旧 watchdog 无法恢复”的缺口：现在会等待新 Progman/WorkerW ready，创建恢复代次 Canvas、重新 attach 并恢复 HRGN/可见状态；实测 Explorer PID 变化后新 Canvas HWND 重新挂到 Progman、保持可见且 `RGN_KIND=3`。Stage 1 Canvas 稳定基线至此完成。

下一阶段：

1. Windows 桌面真实右键 / 刷新 / 图标点击 / 框选，以及实际 Explorer 重启后的人工回归
2. 真实双屏 / 混合 DPI / 热插拔 / 主屏切换人工回归
3. Canvas 与桌宠拖放联动
4. Calendar / Folder / System Monitor 等下一批 Widget
5. 继续验证不同播放器的 GSMTC Thumbnail / 时间轴兼容差异
6. AI Provider / Model Router 接入后，将 AI 快捷台升级为原生 AI 助手
