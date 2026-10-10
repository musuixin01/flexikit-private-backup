# ADR — Windows Canvas 本地壁纸 GPU 折射原型

状态：**2026-10-09 单屏原型已实现并在 Windows Debug 原生程序实测；仅为用户手动开启的实验功能，不作为默认材质。**

> **历史 ADR，不是最新版能力清单。** 下文关于单屏限制、指针水纹和 GPU 模糊的描述对应 2026-10-09 原型。当日后续版本已经增加多屏静态壁纸映射、WorkerW/GPU 有界恢复；2026-10-10 又取消重复模糊与时间波纹。当前实现和未验收项目见 [CANVAS_WALLPAPER_OPTICS.md](CANVAS_WALLPAPER_OPTICS.md) 与 [CANVAS_CONSOLE.md](CANVAS_CONSOLE.md)，多屏真实硬件、Release 与 GPU 功耗仍待验收。

## 问题与选择

先前的 Liquid Glass v1 依赖 CSS backdrop-filter、透明色和伪元素高光。真实 WorkerW 透明窗口下，WebView2 的 backdrop-filter 不能自动取到 Explorer 桌面背后的壁纸，所以显示为灰色磨砂卡片，无法做基于背景像素的形变。

本轮采用 **本机静态壁纸 → 单个受限 WebGL2 纹理 → 局部圆角折射**，不进行桌面截图；这不是复制苹果私有合成器，也不是实时捕获任意背景窗口。对动态壁纸、图标、其他应用窗口和多屏背景，不宣称实时折射。

## 最小可行链路

1. 用户在 Canvas 顶栏主动点击「试用折射」。默认关闭、**不写入本机设置或 Pinia**；重新启动自动关闭。再次点击「关闭折射」销毁 GPU 纹理和持有的 wallpaper data URL。
2. 原生 Tauri 命令 `get_canvas_wallpaper_preview` **仅允许 canvas / canvas-recovery-***，并拒绝多于一台显示器的场景。Windows `SystemParametersInfoW(SPI_GETDESKWALLPAPER)` 读取系统当前的**静态** JPG/PNG/BMP/WebP 文件。路径仅在 Rust 内存中使用；拒绝 UNC/网络路径，仅允许普通文件、最多 8 MiB、校验文件魔数（不只看扩展名）并在读取后再次校验长度；通过 Tauri IPC 返回有限大小的 `data:image/...;base64,...`，**不把文件路径返回 JS**，不截图，不上传，不写磁盘。
3. `CanvasRefractionLayer.vue` 在用户启用时才挂载。`wallpaperRefraction.ts` 解码壁纸，将贴图长边限制到 2048，单个低功耗 WebGL2 上下文复用六个以上 Widget。GPU 使用 `roundRectSdf` + `gl.scissor` 只渲染 `glass/clear/dense` 预设组件，施加边沿法向像素偏移及指针驱动的轻微波纹，前景文字/控件不受 shader 处理。原有深空、实色、自定义不强制改变。
4. 画布背景、原生窗口、工具、桌宠维持原有结构；UI class `is-wallpaper-refracting` 仅在 GPU renderer 确认 ready 后降低对应组件的**背景壳浓度**，保护可读文字。开启前、错误、WebGL2 不可用或 ContextLost 均退回原 CSS Liquid Glass。
5. GPU 不持续运转：静止时无动画循环；帧调度使用 requestAnimationFrame 合并，指针移动每约 32ms 最多触发一次（约 30 FPS）；相机/屏幕采集权限均不请求。DPR 上限 1.5；off/unmount 删除 program/shader/texture/buffer，Canvas 内存清零。多屏 topology 变化自动禁用。

## 安全边界与仍存限制

- 数据边界：仅本机 OS 配置的静态壁纸；不会采集桌面图标、当前窗口、屏幕图像、剪贴板、密码或其它文件。不向后端、网站、日志或 localStorage 发送/保存任何壁纸像素。测试期间 `PrintWindow` 截图仅用于本地比较，完成后清除临时副本。
- **位置对应是近似值**：原型用单屏 Fill / Span 类似的 CSS viewport cover 映射，当前测试环境注册表壁纸样式为 22，WebView Canvas 1648×810 与原 JPG 1920×1080 宽高比不一致；镜面内采样的颜色及变形可见，但未证实与 Explorer 实际桌面逐像素重合。后续需 per-monitor wallpaper style/坐标/DPI 正确转换。
- 动态壁纸、幻灯片切换后本帧自动更新、多屏不同壁纸、GPU 性能 p95、断开独显/系统从睡眠恢复、原生 Release 仍未完成。不要将此当作全功能的系统级实时 Liquid Glass。
- 单帧 GPU shader 与静态 JPEG 解码可能存在较大瞬时开销，须实测功耗与 30 FPS 指针交互（目前是**设计上限**不是性能达标数字）。如出现闪烁/过热，用户可单击关闭，无副作用。
- 用户原有 Canvas v2 的 6 个组件布局不变，不应用模板、不改样式持久化、不关闭或修改其他桌面软件。已搁置的窗口缩放缺陷没有重启调试。

## 2026-10-09 实机验证

- 官方 `scripts/windows-gnullvm-build.ps1` 在无其他 FlexiKit 实例运行时编译通过，原生 EXE SHA256 `FBC49009A54CD21F8821F58A4491F604996DBDFFFB010FB7466A91AA9D044745`，新 Windows 交互进程 PID **36596**，主窗口 / 桌宠 / WorkerW Canvas 正常，Canvas 1648×810。
- Windows UIAutomation 识别到「试用折射」TogglePattern，从 Off 开启后按钮确实变为「关闭折射」，说明 Rust IPC + 壁纸解码 + WebGL 初始化成功；`get_canvas_wallpaper_preview` 在当前单屏静态 JPG 环境可用。
- 使用本地 `PrintWindow` 对同一 Canvas 进行 OFF / ON 对比，等待画面稳定后在组件中确实看到**实物壁纸带来的蓝色/青色背景和边缘采样形变**，而 OFF 时是中性灰磨砂卡片。当前颜色明显偏鲜艳，需要未来调校材质高光、壁纸对齐、白/暗壁纸以及文字对比。最初 1 秒内截图仍读到旧帧，等待后再比对才能看出变化。
- `npm run build`、`npm run test:desktop-canvas-refraction-regression`（18 项合约检查）、现有 Canvas Console/Orientation（122 项）前端回归，以及 gnullvm Debug build 通过。模拟/结构/原生启动测试不代替 GPU p95/Release 验收。

## 下一阶段（不在本次原型范围）

先做壁纸匹配校准（多屏 per-monitor 与 Windows wallpaper style），再评估 DirectComposition/D3D11/Direct2D 着色器或 DirectX shared texture；如必须采集动态背景，应先得到用户授权和独立安全评审。任何方案都要先在**隔离窗口**验证性能、隐私和 DPI/缩放，不擅自改 Explorer 或原生主窗拖动逻辑。
