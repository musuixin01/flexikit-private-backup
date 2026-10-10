# FlexiKit v0.1 Stable Checklist

## 2026-10-10 / Stage 6 Browser Companion 真实 PostgreSQL 事务与迁移
- [x] 新建独立 PostgreSQL 18.4 TEMP 数据目录、仅 127.0.0.1 随机端口/随机 SCRAM 密钥的测试账号。Node 脚本强制校验独立 TEST 标志与 PostgreSQL `SHOW data_directory` 完全一致；与运行中的 PostgreSQL 正式服务隔离。
- [x] 项目原 3 份真实 refresh/context/extension-pair migration 的 up/down、8 字段、3 索引、FK 23503；实际 TypeORM/pg 与 ExtensionPairingService/AuthService、真实行锁验证双并发审批、双并发领取仅一次成功和一条 Refresh Session。
- [x] 错误设备密钥 5 次自动锁定；模拟会话签发失败可回滚 `consumed_at`，之后同码恢复领取，证明 PostgreSQL 事务原子性。
- [x] `backend/scripts/run-stage6-postgres-isolated.ps1` 可重复执行，增强二次核验与 finally 自动停止/清理；完整重复 PASS、原有 `postgresql-x64-18` 服务仍 Running。
- [~] **本轮为 PG18.4，不是目标 PG16 兼容验收**；测试 EntitySchema 用精确相关列模拟实体关系，未测试完整 AppModule/真实 HTTP 配对/Chrome Edge/生产负载，正式发布门槛保持未完成。见 `docs/STAGE6_POSTGRES_PAIRING_VERIFICATION.md`。


## 2026-10-10 / Stage6 隔离后端构建与真实 Nest HTTP 验收
- [x] 在操作系统 TEMP UUID 目录复制后端源代码、package-lock、tsconfig 和验证脚本（不含 .env/用户数据），`npm ci --ignore-scripts --no-audit --no-fund` 安装 590 个依赖；**原 backend/node_modules 未修改**。
- [x] **真实 NestJS `npm run build` PASS**、**TypeScript `tsc --noEmit --incremental false -p tsconfig.json` PASS**，覆盖当前后端源码与 Browser v0.4/Stage6 守卫。此前原项目依赖不完整是运行环境阻塞，不是隔离编译失败。
- [x] `stage6-crawler-http-isolated.mjs` 实际启动 NestJS 127.0.0.1 随机端口：真实 JwtAuthGuard、AdminAccessGuard、AdminAccessService（用户 Repository stub）与 CrawlerManualTriggerGate，**401** 匿名/坏 JWT、**403** 普通/停用管理员、**201** 管理员、**429** 冷却/运行中互斥、10 路由全部通过。不会访问真实爬虫/数据库。
- [x] 原先缺包的 `test:browser-extension-regression`、`test:multi-client-regression`、`test:extension-pair-regression` PASS；`test:crawler-manual-security` 修正硬编码前端 TypeScript 路径后在独立后端环境 PASS。
- [!] Docker 只读 daemon 状态检查 35 秒超时；**无隔离 PostgreSQL migration up/down**、无正式 AppModule/网关与真实 Browser-E2E，不能作为生产部署许可。
- [~] Release/Native Canvas/DWM/GPU、跨 DPI、真实 7 日试测仍未完成；Stage 6「性能指标」继续进行中。详见 `docs/STAGE6_BACKEND_ISOLATED_VERIFICATION.md`。


## 2026-10-10 / Stage 6 稳定性首轮与 P1 手动爬虫入口防护
- [x] 真实 Canvas Store（隔离 Vue/Pinia）20/20 轮、117 项断言 PASS；新增组件 p95 1.233ms、frame 更新 p95 0.123ms，纯 Node 状态耗时，不是 DWM/真实鼠标画面。
- [x] 10 个 POST /crawler/* 路由统一 JwtAuthGuard + AdminAccessGuard；手动运行单实例最多 1 项/每来源最少 60 秒间隔，异常释放锁；原自动定时任务维持原路径。
- [x] `npm --prefix backend run test:crawler-manual-security` 静态源码+模拟实际 TypeScript 类执行：10 route 元数据、双 Guard、竞态/冷却/失败恢复、返回协议 PASS。
- [!] 当前 backend/node_modules 缺少实际包与 Nest CLI，无法宣称 NestJS 生产编译或 401/403/429 HTTP 实测通过。真数据库与跨进程手动触发限制仍需隔离验收。
- [~] Release/WorkerW/真实 Canvas/DWM p95、100/125/150% DPI 和自愿用户 7 日试测继续未完成；主窗 Resize 按用户此前要求仍暂停。


## 2026-10-10 Browser Companion v0.4.0 新手引导与密码免重复输入
- [x] 工作台及工具箱「浏览器快速添加」入口；真实商店链接仅在配置有效 URL 后显示，未上架不显示假按钮；复用现有粘贴网址自动导入。
- [x] 浏览器扩展配对码、临时随机 verifier、JWT 授权批准、一次性事务签发独立 extension 会话代码及新增 TypeORM migration。
- [x] 扩展模拟测试涵盖开始/待审批/领取/取消及 session-only 密钥存储；后端隔离 Mock 测试涵盖编码、5分钟过期、SHA256、暴力尝试锁定及频率限制；前端商店白名单/备用导入回归通过。
- [x] npm --prefix apps/browser-extension run build、npm --prefix apps/web run build PASS；新手体验默认简单，保留旧账号密码入口作为备用。
- [!] 真正 Nest backend build 因本机缺失 backend/node_modules/@nestjs/cli/commands 未通过；独立 TS 检查缺少部分 @types 包；仅语法转译与模拟服务测试，不视作编译和 E2E 通过。
- [~] 新迁移未在隔离 PostgreSQL 做 up/down，真实 Chrome/Edge 安装、配对、升级、生产限流与官方商店发布尚需验收。


## 2026-10-10 Browser Companion v0.3.0 一键收纳插单
- [x] 扩展当前标签页单次点击自动保存、重复检查、撤销、按需编辑，沿用原有 Tools API 且不改动 Canvas 布局。
- [x] 右键快速添加及 Alt+Shift+S 快捷入口；保留 activeTab 与 API 主机可选授权，修复并发 Token Refresh。
- [x] npm test 新增真正加载后台代码与模拟后端的保存/重复/编辑/撤销/推荐失败/409 竞态/右键行为回归。
- [x] 最终 v0.3.0 扩展 npm run build PASS，Web npm run build PASS；扩展新测试涵盖同 URL 并发请求只 POST 一次、并发 Refresh 一次；限定文件 git diff --check PASS。
- [!] Backend test:browser-extension-regression 与 test:multi-client-regression 在启动时均因当前 backend 缺少 node_modules 中的 class-transformer 而中止，未执行真实业务断言。本轮未对运行中的后端执行依赖覆盖安装；补齐依赖后需重跑。
- [~] Chrome/Edge 真实浏览器加载扩展、登录、右键、快捷键、商店打包和更新，以及断网/Canvas 投放仍需实机或后续阶段验收。


## 2026-10-10 文档与技能规范一致性审查
- [x] 原有 70 份 Markdown 文档/技能/README 全文结构与相对链接扫描，针对关键 API/类型/AI/Canvas/安全/合规内容完成源码互证并修正明确错误；新增 DOCUMENTATION_AUDIT_2026-10-10.md。
- [x] 补齐 8 份技能示例缺失的代码围栏，静态复核相对链接缺失 0、未闭合围栏 0；所改受控 Markdown 的 git diff --check 通过。
- [~] 本次是文档/技能更新，没有执行新的端到端 Windows Release、真机 GPU/Canvas、PostgreSQL 或 7 日用户公测；先前未验收门槛及暂停的窗口缩放问题保持原状态。

## 2026-10-10 Canvas 常态简洁设置体验
- [x] 顶部仅保留「添加工具／组件、编辑、更多、关闭」5 个操作；其余模板、折射、恢复、整理、重置转移更多菜单，重置需二次确认。
- [x] 属性面板简化为名字、锁定、三种一键外观，原有深空/实色/3 色调/6 数值滑杆/精确坐标/Widget Schema 设置均可折叠查看，不删除自定义配置，不动 Canvas v2 存储。
- [x] More 弹出层与 details 展开收起触发原生 WorkerW 交互区域同步；静态契约 37 项、原布局 122 项、折射 42 项、GPU 恢复 36 项、控制台及 Desktop build 通过。
- [x] 最新 Windows Native Debug PID 33392，SHA256 E7C82C3B982F84EA71C36BC6781DBB6A8FC614E942115BC8F27AB525101A606C 正在运行；原有 5 Widget 保留。UIA 打开「更多」看到所有次要命令、高级外观折叠/展开/收起均正常，最后保持收起。
- [~] 前端默认呈现更简洁，但用户实际使用反馈仍需观察；完整 Release 和双屏性能待验收。

## 2026-10-10 折射曲线统一、取消模糊叠环
- [x] GPU 五点径向雾化过渡已移除，CSS 背景模糊负责唯一磨砂层；片元壁纸纹理采样 5→1。
- [x] 双段折射 band 与持续 sin 纹路改为单一指数柔和曲线及稳定的细微鼠标视差；边缘采用 fwidth(sdf) 自适应抗锯齿，不更改 Y 轴。
- [x] Vue build:desktop、折射 42 项、Canvas Console、GPU 恢复 36 项和布局 122 项 PASS；Windows gnullvm Native Build PASS，Debug EXE SHA256 79333BB45EFBC5970D8D2EC92491DE76642E46DC2CA8BF5D48A9DF4D31CF402D。
- [x] Windows 单例 PID 18848 实机主窗/Pet/WorkerW Canvas 正常，原有 5 Widget 保留，GPU 试用正常进入「关闭折射」状态。
- [~] 最终光学观感由用户目视确认；真实 GPU/Release/双屏和故障恢复场景不在本次验证范围。

## 2026-10-09 羽化过渡边界与磨砂连续性
- [x] GPU SDF 原硬轮廓 discard 改为 ±1.25px 抗锯齿 coverage；折射偏移从边缘 0 平滑渐入，并向内 32px 归零，不再在卡片边界瞬间发生纹理位移。
- [x] 本机 atlas 五点轻模糊与 4→34px 的中心雾化曲线、低亮度 25px 光学带；CSS 0.75px 单层细线透明度下降，径向护字板 inset:0 按继承圆角铺设，不留下 5px 内圈。
- [x] Vue Desktop build PASS、折射 40 条、布局 122 条、GPU 恢复 36 条及 Console 回归通过；Windows 原生 Debug 编译成功，新 SHA256 995B1237B6BEA832E2A0A1349E09C07AD88444B1BA2A4262C5F817C4C4DE3362。
- [x] 原生唯一进程 PID 35444 已实际启动；UIA 主窗、Pet、WorkerW Canvas 5 个已保存组件都在，GPU「试用折射」完成成功变为「关闭折射」，未改 Widget 配置。
- [~] 视觉由用户现场确认；新增四邻近纹理采样尚未测 Release/GPU 长期性能、混合 DPI 大屏压力。

## 2026-10-09 单一细玻璃外沿验收
- [x] 复合描边根因已定位：本体 1px border + ::after 1px mask + 3 层 inset + GPU 40px 光学 halo。实际去掉第二伪描边、内部多层亮线，常态唯一 .75px 低透明边框；选中高亮保留 1px。
- [x] GLSL 光学亮带由 40px 缩到 18px，增强亮边由 .15 缩到 .035、暗边 .055 缩到 .014，保留正确纹理/采样方向。
- [x] npm build:desktop、折射 34 项、GPU 恢复 36 项、Canvas 布局 122 项、控制台合同检查通过；git diff --check 最终检查。
- [x] Windows Native gnullvm Debug 编译并运行 PID 14188，SHA256 9D7AE993C21BF58BAA4447B95931E8F88A6DD968741C92CECE8D013E76D0A289；六 Widget 完好，用户曾明确开启折射，已在新版中重新启用。
- [~] 细线视觉是否符合用户审美仍待用户观察，动态壁纸与实时桌面折射仍非现有功能。

## 2026-10-09 折射向内与细边框运行核验
- [x] 旧 shader samplePoint=pixel+bend 改为 pixel-bend，近边缘采样方向朝卡片内部；幅度收敛至 5+2*strength 与 1.8 pointer ripple。
- [x] 壁纸上传和纹理 Y 轴转换保持不变；CSS Rim 2px→1px，亮度减少，不修改原 Widget 配置。
- [x] Frontend build:desktop、折射 29 项、GPU 恢复 36 项、Canvas 几何 122 项通过；Windows gnullvm 新 EXE 4E27476C34422E66BE1531C52031F8D454B48D74BF1B51B3EA4C747BC2361A4C 编译成功。
- [x] 原生单实例 PID 2348 已运行，主窗口/Pet/桌面 Canvas 均存在，UIA 显示 6 个组件；试用折射成功切换 GPU-ready 关闭折射，供用户直接比较。
- [~] 用户截图中的视觉判断需其现场复核；无实际屏幕录制、没有声称苹果系统级折射或真实 Explorer/GPU 故障恢复终验。

## 2026-10-09 最新开发版实际运行验证
- [x] 新版原生 EXE 校验 SHA256 B1DAF197DBB87A70CA5C3645972543E8D5DB1590559DDA63CB3D216655BFA90A；备份前一版本 SHA256 C18AF2EE04A915AD41D80478A6FF36B8346A7150EABF49962714110E26E97351。
- [x] 识别旧安装版两个进程 14776/14956（仅 Pet UI），仅停止上述已识别实例；旧 D:\Own_Tools\Flexikit\flexikit-desktop.exe 本体未改，Explorer 桌面图标从隐藏恢复为可见。
- [x] 独立运行最新 Windows Debug EXE 成功，仅一实例 PID 24696。原生 UIA 检测到主窗口 FlexiKit、桌宠 FlexiKit Pet Ready 和 WorkerW 桌面子窗口 FlexiKit Desktop Canvas。
- [x] UIA 显示「6 个组件 · 20px 栅格 · 1 屏 · 100% · 桌面层」、控制台模板、试用折射、恢复布局。未替用户点击试用折射，不自动读取壁纸；也未应用/覆盖 Canvas 布局。
- [~] GPU Context Loss 与 Explorer 真正销毁 HWND 的故障注入仍须隔离 VM 测试；本次验证为新版正常运行及 UI 功能入口检查，不称为真实故障恢复验收。

## 2026-10-09 WorkerW 状态机与 GPU Context Lost

- [x] HWND 查询失败作为潜在失效而非无限 continue；连续两轮失效才重建，父层丢失仅重新挂接，失败后最多 8×1.5s 退避；纯 Rust 策略测试 4/4。
- [x] WebGL contextrestored 时限定两次重建、4 秒超时，Context 已丢失时不调用 GPU 删除；旧异步壁纸图集解码可 AbortController 取消，不持久化图像。
- [x] JS GPU 安全回归 36 项、生命周期 156 项、图集 144 项、布局 122 项、折射材质 21 项及 Vue Desktop Build 通过。Windows gnullvm Native Debug 完整 Build PASS，SHA256 B1DAF197DBB87A70CA5C3645972543E8D5DB1590559DDA63CB3D216655BFA90A；旧开发版已备份。
- [~] 两份当前独立安装版实例未改动，最新 Debug 尚未 GUI 启动。真实 Explorer HWND 崩溃恢复和驱动 WebGL context lost 实机验证、双屏 DPI/Release 性能仍未完成。详见 docs/CANVAS_WALLPAPER_OPTICS.md。

## 2026-10-09 折射生命周期原生稳定性测试

- [x] 普通 Canvas Resize 不再无条件清除 GPU 预览，只有实际显示器/缩放拓扑变化才释放纹理。
- [x] 原生工作进程中的显式 opt-in + canvas-recovery-N 单次标记，可在 WorkerW HWND 真正销毁后的重建窗口中恢复；关闭/隐藏/冷启动不保留，任何图像/路径/许可不落盘；序列化 IPC 防止取消被迟到的启用覆写。
- [x] 有上限 120 帧的 JS 提交耗时 P50/P95，报告节流并在关闭时释放，不宣称 GPU 提交完成时间。
- [x] build:desktop、153 项生命周期、144 项图集、21 项折射、122 项原布局及 Stage6 Store 回归成功。Windows Debug PID 37028，UIA 真实可见 6 个 Widget，实测主动开、关、再开及在 1px Canvas HWND 临时尺寸变化后仍能保持开启。
- [~] 真正故意销毁 HWND 后的重新创建没有在当前用户 Explorer 上进行破坏性测试；真正 GPU timestamp / 高 DPI 双屏 / Slideshow / Release 长期性能未终验，详见 docs/CANVAS_WALLPAPER_OPTICS.md。

## 2026-10-09 GPU 壁纸折射多屏适配版
- [x] 通过 IDesktopWallpaper 读取活动屏的静态壁纸 Rect、底色与铺放方式，过滤失效显示器 ID；单屏损坏或残留记录使用原 SPI 安全回退，不读取其他窗口/桌面内容。
- [x] 单 GPU 图集最大 2048px，Fit/Fill/Stretch/Center/Tile/Span 均实现几何映射；144 项三屏、负坐标纯计算断言、21 项 IPC/GL 结构、122 项 Canvas 布局通过。
- [x] Rust gnullvm + Vue build 成功、原生运行 PID 26316，UIA 点击试用后看到关闭折射；原有六组件布局和桌宠保留。
- [~] 单屏实机 GPU 功能通过，双屏物理位置/高 DPI/动态壁纸/软件窗口无法称为验收通过。6-7 秒进程树采样：内存 484 MiB(开)/476 MiB(关)，GPU Engine 引擎和平均约 0.12%/0.04%，尚需 Release、真实鼠标互动与长期功耗。桌面层恢复时实验开关可能被重置。见 docs/CANVAS_WALLPAPER_OPTICS.md。

## 2026-10-09 GPU 壁纸折射实验版
- [x] 本机 Windows 静态壁纸手动读取、Canvas-only 原生 IPC、8 MiB 大小/魔数校验/拒绝网络路径；不会截取窗口/图标或持久化壁纸。
- [x] 共享 WebGL2 + 圆角局部位移/色散、最长 2048px 的纹理、GPU 生命周期与帧率限制，失败后回退旧材质。
- [x] Web 构建、18 条折射专项结构验证、122 项布局验证通过；Debug EXE PID 36596 GUI 中「关闭折射」说明 GPU 首帧已成功。
- [~] 真正实时桌面内容、动态壁纸、多个显示器、完整 GPU 性能和 Release 尚未验收。详见 docs/CANVAS_WALLPAPER_OPTICS.md。

## 2026-10-09 液态玻璃实际效果二次检查
- [x] 证实旧 PID 16760 对应的确是 Liquid Glass v1 最新版，但真实 Canvas PrintWindow 图像表明液态折射并不明显；原因包含 Canvas 仍处于编辑模式，已无损切回正常展示模式。
- [x] 调整光学高光/轮廓/双层阴影并经 UI 构建和材质、122 项布局回归。旧 EXE SHA256 备份、单实例停止、Explorer 图标恢复后官方 gnullvm Debug 编译成功，最新 PID 24604 已启动；实机窗口可见。
- [~] 玻璃局部边缘有所改进但仍不是苹果原生背景像素折射；要实现强烈液态效果需针对 Windows 原生壁纸采样/合成器另立设计方案，不能把本轮 CSS 变更宣称为完整 Liquid Glass。参考 docs/CANVAS_CONSOLE.md。

## 2026-10-09 Liquid Glass v1 原生 Windows 验证
- [x] 旧 PID 13952 和旧 EXE 哈希确认、备份、受控单实例关闭及 Explorer 隐藏桌面图标恢复后，原生 gnullvm Debug + Vue Desktop 官方构建成功；新版唯一进程 PID 16760 已启动，EXE SHA256 与旧版不同。
- [x] Win32/UIAutomation 确认主窗口、Pet、挂载桌面层的 1648×810 Canvas HWND 及 252 个可读取 UIA 元素，三个原有画布动作存在；本轮未应用模板或改动真实画布资料。
- [~] Liquid Glass 真实色彩/折射观感还需用户人工确认（远程截图接口此前出现无效句柄）；原生 Release 安装包、鼠标拖动及多屏 DPI 未终验，窗口缩放问题仍按用户要求暂停。

## 2026-10-09 Liquid Glass v1（用户已批准）
- [x] 自定义液态玻璃外壳+羽化内容保护层+动态局部高光、深浅主题和 reduced-motion/transparency/contrast 兼容；外壳透明不降低文字图标本身 alpha。
- [x] 三个液态材质 Regular/Clear/Dense 已入 appearance presets，旧 space/solid/custom 不破坏，本地 Canvas v2 存档无需迁移。
- [x] Canvas 顶栏、组件面板、属性 Inspector、工具选择器、控制台设计中心全部统一材质；Inspector 明确区分整体透明度与材质浓度；编辑/选择边框保留。
- [x] Vue/Desktop 构建、控制台材质结构回归、122 项布局、Pinia 20 轮/117 断言均通过。仍需 Windows 原生部署与真实像素级玻璃体验核查。

## 2026-10-09 新磨砂玻璃 Windows 原生更新
- [x] 旧 PID 48300 的 EXE SHA256 备份校验后单实例受控停止；Windows Explorer 隐藏图标恢复可见，不触及 Canvas v2 用户本地数据；新 gnullvm Debug 原生 build 和前端构建成功。
- [x] 新原生唯一进程 PID 13952 活动；Canvas HWND 存在，UIA 已看见三个原有画布动作和内容；新 `.css` 材质变量确实输出到构建资源，Canvas 20 轮/117 项及 122 项布局回归通过。
- [~] 远程 UI 捕获被 Win32 invalid handle 阻止，无法在当前执行环境进行真实色彩/壁纸对比度像素验收。需用户观看新版界面后反馈；不得将 UIA DOM 证据冒充视觉截图。

## 2026-10-09 Apple Regular Glass 画布可读性
- [x] 识别 Widget 原样式中 `--glass-bg` 半透明后又按 `surfaceOpacity` 参与透明混合，形成双重衰减；改为实色基底叠加单次 alpha，旧 Regular 组件最低 84% 可读浓度而不改本机存档，Clear / Custom 保留自主设置。
- [x] 新默认 opacity 1、材质 .88、blur 34；Canvas 顶部控件及面板使用更厚 Regular 磨砂层；明/暗/自动模式文字和按钮区分，以及 reduced transparency/forced colors 兜底。官方参考见 docs/CANVAS_CONSOLE.md。
- [x] Vue strict 构建、Canvas 材质与入口结构专项测试、122 项横竖布局检查均通过；原生部署及人工壁纸可读性尚待验证。

## 2026-10-09 新版控制台实际启动验收
- [x] 旧运行程序 PID 18116 已核验 SHA256 备份并受控退出；原本隐藏的桌面图标已通过 Explorer `SysListView32` 显示调用恢复，不清理用户持久化资料。
- [x] 官方 `scripts/windows-gnullvm-build.ps1` 最新 Windows Debug 原生完整编译与 Web 前端资源构建通过；新版唯一进程 PID 48300 正常运行，主窗口/Pet/Canvas HWND 可见，EXE SHA256 与前一版不同。
- [x] Windows UIA 在真实 Canvas 的「控制台模板」入口打开「设计你的桌面控制台」，横向、纵向、自定义和应用入口真实显示；未点击确认应用/未清空布局。详见 docs/CANVAS_CONSOLE.md。
- [~] 此次为 Debug 开发版可视化验证；Release、鼠标拖放、真实工具执行、DPI 和画布保存/恢复实操仍为发布前门禁。

## 2026-10-08 控制台横竖布局及自定义（新用户需求）
- [x] 控制台横向/纵向排列、九宫格停靠、X/Y 偏移、实时预览、按 20px 栅格自动适配小屏的纯布局生成器；宽度 960 与 1648 两档，3 预设、9 点、2 方向、自定义 6 件组合共 122 项检查通过，无尺寸互相覆盖。
- [x] 自定义组件选取（最多 6 项）、顺序上移下移、独立本地预设保存/恢复；个人预设值白名单校验。画布 Inspector 还可输入单个组件 X/Y；工具 Dock 也支持横向图标和纵向列表。
- [x] 应用仍需明确二次确认，并为 Canvas v2 提供备份恢复；模拟存储写入失败时状态回滚，不触碰真实用户数据。Vue/TS、Desktop 前端资源构建、控制台集成回归均通过；Canvas Store 20 轮/117 项断言通过。
- [~] Vue/TS 与单元回归验证后仍须原生 EXE 更新和真实 UI/多屏 DPI 人工检查；不强行关闭运行中的客户端，也不涉及暂缓的窗口缩放问题。详见 docs/CANVAS_CONSOLE.md。

## 2026-10-08 Canvas 客户控制台与工具固定入口
- [x] **本轮新增：** 原有桌面实例已自行退出后，使用 `scripts/windows-gnullvm-build.ps1` 成功编译完整 Windows gnullvm Debug 原生 EXE 和运行时 DLL；原 EXE 独立 SHA256 备份，最新程序启动 PID 18116，主窗/Pet/Canvas 均可见。Windows UIA 点击主窗口「桌面画布」、Canvas「控制台模板」后真实出现效率控制台/创作工作室/极简专注三套模板选项及二次确认之前的入口；没有修改现有布局。
- [~] 本轮原生 Debug 编译成功解决“尚未构建”的门禁，但不等于 Release 发行或真实拖拽/工具启动/模板数据迁移与恢复已完整验收；仍需客户实际视觉确认和 Windows 交互实测。
- [x] 网页严检 / Desktop Vite 构建、Web Tool Import、Local Tool Import、Canvas v2 数据迁移、Customer Console 结构回归及 localStorage-only 113 断言均通过；新 Canvas Toast 可显示启动失败反馈。
- [~] 原生 Rust check 两次遭 libresource.a 资源锁；隔离目录 Rust check/build 发现 zerofrom_derive/tauri/windows 依赖产物缺失（E0463），属 Windows gnullvm 工具链/缓存失败；正式 EXE 保持运行并未更换，**当时**原生构建不可标记通过；此历史障碍已由后续官方 gnullvm build 成功解决。
- [x] 独立「我的工具」Widget + 顶部「添加工具」选择器 + 现有网页/本地导入器复用；独立 ToolStore 引用列表与既有 openDesktopTool 安全启动契约，模块注册与 Vue strict build 通过。
- [x] 三套有预览的控制台模板均明确二次确认；Canvas v2 本机完整布局备份（仅用户点击后）和首次备份保留/一键恢复。隔离 Vue/Pinia Store 测试 20 轮加 9 项备份恢复断言，总 113 项通过。
- [~] Windows 原生 canvas/canvas-recovery-* 拖放 capability 已新增，但仍需最新正式 EXE 重新编译和干净 Profile 的真人鼠标、原生 WorkerW 与 DPI GUI 验收，现已在新 Debug 实际运行程序中可见（PID 18116），剩余真实拖放/跨屏/Explorer 终验。详见 docs/CANVAS_CONSOLE.md。

## 2026-10-08 Stage 6 Canvas 与 WebView2 页面性能回归
- [x] npm 再执行 Canvas Store 20 轮/104 项断言、Web `npm run build`（vue-tsc + Vite）、Desktop resize 防回归和 `git diff --check` 均通过；二次状态方法延迟 P95 add 0.645ms、frame 0.063ms，为短次隔离数字，无发布 SLA。
- [x] 实际 desktopCanvas.ts + Vue/Pinia 纯内存 Store 连续 20 轮、104 项断言通过，42 次内存布局存储写入；更新位置/尺寸的交互期间停止持久化，放手后写入，重建 Pinia 恢复 5 个组件与监听器清理均正确。
- [x] Store 方法 P95：添加 0.573ms (40)、frame 更新 0.070ms (160)、删除 0.193ms (40)、分组 0.127ms (20)；不含 DOM/GPU 绘制。
- [x] 独立 Tauri WebView2 工作台/工具库目标 Vue DOM→双 rAF 各 20 次成功，P95 92.82ms/122.90ms；不是物理鼠标/DWM 的完整操作耗时。
- [~] WorkerW/WidgetHost 真实 Canvas 20 轮物理拖动、跨屏/显隐/重启及优化 Release 实机延迟仍待复测。窗口缩放按用户要求暂停。

## 2026-10-08 Stage 6 性能指标基线（新主线）
- [x] 手动、仅本机进程白名单资源采样脚本 scripts/windows-stage6-performance.py 新建；Python 自检 5 项通过，7 个隔离版空闲样本（7.5s）完成。CPU 整机占比中位数 0.00%（两位采样精度）、测试版进程树 RSS 中位数 135.34 MiB、USS 中位数 52.61 MiB；严格不冒充生产版资源成绩。
- [x] 3 次仅隔离 Tauri/WebView2 的温启动里程碑采样通过：窗口可见 343ms 中位数、Chromium 调试目标可访问 524ms 中位数；不是正式冷启动或用户可见完整首屏。
- [x] 搁置的旧 Standard 缩放测试 PID 10280 确认身份后已关闭，未更动正式开发版/独立安装版二进制或用户资料。
- [x] 真实现有 Desktop 开发 EXE PID 38324 已在交互会话启动，主窗口及 Pet 确认显示；非 Release 的首次只读资源采样 30 个点/33.39s，整机 CPU 中位 0.27%、p95 1.05%，进程树 USS 中位 263.05 MiB、RSS 工作集合计中位 732.35 MiB（共享页重复计数），WebView2 8 个进程。仅单机/低交互基线，不构成稳定性发布门槛。
- [~] 真实程序 Debug / Release 冷/热启动视觉首屏、Canvas 活动 CPU/USS、Canvas 20 次操作稳定性、常用交互 10 次/项的 p50/p95 仍按 docs/STAGE6_PERFORMANCE.md 人工终验；Stage 6 性能指标不勾完成。

## 2026-10-08 Windows Desktop 缩放热区专项
- [x] 新增测试特性下 Standard/Custom 原生窗口 × Full/Minimal DOM 四组独立测试，各 75 步，四组采到 6–7px 瞬时尺寸差，全部返回后≤1px；不能据此称实际画面无跳动。
- [x] WebView2 Chromium 内部合成截图 Standard/Custom 各 24/24 纯色边缘正确；实际屏幕截图因测试窗口非前台且被遮挡全部无效。
- [~] 供人手测试的 Standard 原生边框隔离窗口 PID 10280 已打开，与 Custom 对照真人右/底/角快拖和 DWM 视频仍待结果；实际 FlexiKit PID 32476 保持原状。

- [x] 用户旧升级版仍反馈真实外框/画布分离与跳动，补查确认内层 `.app-window-content` 比 WebView viewport 硬缩窄约 8px。现改全宽，右缩放带 4px，scrollbar-gutter stable、结构布局无宽度过渡；独立 CDP 验证未被溢出变化触发 scrollbar 8px 横跳，5 档 DOM 8/8 及 201 步检查通过。
- [x] 上述源码已重新编入正常 EXE、完整 SHA256 备份旧 PID 26216 后通过内置退出正常重启真实开发版 PID 32476；主窗口、桌宠显示正常、右/底/角 HT=11/15/17。另一安装版未覆盖。
- [~] 用户还未复测**当前这一轮**的新 PID 32476 的手工鼠标缩放视频；125% DPI 的 1px 宿主/WebView 子窗末端差仍存在，若仍动态闪动需对 DWM/WebView2 提交帧深入调查。

- [x] Default 模式修复已经实际换入此前运行的 gnullvm 开发版并重启：旧 PID 23572 经桌宠退出按钮正常结束，已备份旧 exe/运行库并原子替换，验证当前新 PID 26216、EXE SHA256 匹配、新主窗口和桌宠均可见，右/下/角原生命中 11/15/17。另有独立安装版未覆盖。
- [~] 新实机仍有 125% DPI 下底部最多 1px 的 HWND/WRY 量测差异；需要对新运行版进行物理连续拖拽与肉眼画面验收，不可仅凭合成测试标记彻底无黑边。

- [x] 用户确认三模式对照中只有第一种 Default 画布/外框协调，禁用 DirectComposition 与 GPU 合成出现画布和边框分离；不采用实验 flags 为生产修复。
- [x] 独立默认模式 125% DPI 全项自动验证：5 档外框/客户区/WRY 子窗一致、DOM 八方向命中 8/8、原生 HT 11/15/17、内容可滚动、201 次缩放完成后差异≤1px、最大化还原正常；15 张固定边缘画面和 147 张连续缩放稳定矩形画面启发式检测未发现大面积黑白露边。
- [~] 前台人工真实鼠标快拖、DWM 完整视频观测与 100%/150% 或跨屏 DPI 验收未完成；不代表第一个方案已经彻底消除每一帧黑白闪动。

- [x] 双读校验排除采样中主窗口几何发生变化；Win32 主窗口和 WRY_WEBVIEW 同线程，分别在透明/不透明模式下各 195 次 SetWindowPos 返回后检查，全部差异 < 2px（最大 1px）。
- [x] 新增 `windows-resize-rendering-ab.ps1` 隔离测试启动器（默认/禁用 DirectComposition/禁用 GPU 合成），验证实验参数确实到达 WebView2 子进程；未修改正式渲染策略。模拟自动鼠标因前台焦点不可得会被明确标为 skipped。
- [~] 三种模式用户前台快速拖动的实际画面、四边输入与不同 DPI 下的视觉验收尚未完成；不能将窗口闪动标为已彻底修复。


- [x] WebView2 页面实测根滚动条吞掉右侧 8px 缩放热区；注入隔离 CSS 后右、底、右下 DOM 命中正常，原生滚动条向内移动且仍可滚动。
- [x] 已写入主窗口专属 CSS；Web 严格构建、Desktop Vite、窗口缩放、滚动条与离线回归及隔离 gnullvm EXE 构建通过，不覆盖原运行 EXE。
- [~] 前台真实鼠标右/底/角往返 5 次、DPI 100/125/150%、最大化恢复、连续快拖黑白闪块人工确认均未完成。自动鼠标无法使测试窗口成为前台，0px 不代表功能验收通过；WebView2 仍有约 6px 动态几何瞬态。

## 构建验证

- [x] Web TypeScript / Vue SFC 严格类型检查通过（2026-09-23，`npm ci` 恢复 vue-tsc 2.2.12 + TypeScript 5.9.3）
- [x] Web `npm run build` 完整链路通过（`vue-tsc && vite build`）
- [x] Web production Vite 构建通过（2026-09-23，Vite 5.4.21，214 modules）
- [x] Web desktop mode Vite 构建通过（2026-09-23，Vite 5.4.21，214 modules）
- [x] Backend NestJS 编译通过（2026-09-23）
- [x] Tauri Rust `cargo check --all-targets` 通过（2026-09-23，使用 `D:\\DevTools\\VisualStudio\\2022\\BuildTools` x64 开发环境）
- [x] Tauri release bundle / 安装包构建验证（2026-09-23：optimized release + x64 MSI/NSIS；Vite 关闭时 release 与隔离安装版均完整渲染 44 个工具；NSIS 卸载清理通过）
- [x] NSIS 覆盖升级验证（2026-09-23：独立 `com.flexikit.s2upgrade` 0.1.0 → 0.1.1，同目录覆盖、exe SHA-256 变化、单一卸载项更新到 0.1.1、升级后主窗口正常启动）
- [x] 升级用户数据保留（0.1.0 `S2 Upgrade Sentinel` 自定义工具在 0.1.1 覆盖后仍可由 UIA 读取；总工具数 45 = Backend 44 + Sentinel 1）
- [x] Desktop 发布版本一致性门禁（`npm run release:check-version` 校验 package/package-lock/Tauri/Cargo/Cargo.lock，当前 0.1.0 通过）
- [x] Desktop 本地诊断日志（release 实测写入 startup + setup_complete；2 MB 轮转、最多 3 个备份，不自动上传）
- [x] 自动更新架构方案（签名 Tauri updater + HTTPS manifest + Stable/Beta + 用户确认；v0.1 在线更新保持关闭直到端点/密钥/失败回归就绪）
- [x] Desktop 离线冷启动视觉回归（Backend 3001 / Vite 5173 均关闭；窗口出现约 5.2 秒时截图已完整显示 44 个工具；UIA 树晚到不视为视觉首屏延迟）
- [~] 真实干净 Windows 安装回归（自动脚本 `scripts/windows-clean-install-smoke.ps1` 已完成并通过 PowerShell AST 语法检查；当前主机无现成 VM/ISO，Sandbox Disabled，待真实干净客体环境执行）
- [x] Docker Compose 配置校验通过
- [x] Docker runtime / 容器启动验证（Docker Desktop Engine 恢复；既有 `flexikit-postgres` / `flexikit-redis` 容器运行，5433 / 6379 映射正常）
- [x] Backend migration 可重复执行（两次启动前后 `migrations` 表记录数保持 1，无重复迁移/Schema 异常）
- [x] Backend 端口统一为 3001（start.bat、Dockerfile.dev、DEPLOY、README/API/Vite 基线一致）
- [x] S4.1 Backend 统一错误处理基线（Global Filter + 稳定 machine `code` + Validation `details[]` + 未知 500 脱敏；400/401/403/404 等 HttpException 自动映射，Web client 向后兼容；`test:error-regression` 全通过，Backend build + Web 238 modules 通过；favicon 空 404 明确为二进制探测特例）
- [x] S4.1 Backend 统一成功响应基线（全局 `{code:0,message:'success',data}` envelope；`@RawResponse()` 显式绕过二进制端点；Web Axios 自动解包保持业务 `response.data` 兼容；response + error regression、Backend build、Web 238 modules 及独立 3011 真实 HTTP 烟测全部通过）
- [x] S4.1 Controller / Service 类型治理基线（共享 Authenticated/Optional Request；Discovery Query DTO；RSS `RssFeedItem` + V2EX `unknown` type guard；Favorites/HttpService 去除残余 any；`test:type-audit`=explicit_any 0 / untyped Request 0 / untyped whole Query 0；Backend build、S4.1 regressions、Web 238 modules、独立 3012 HTTP 行为烟测通过）
- [x] S4.1 HTTP 日志基线（全局 requestId + `X-Request-Id` 回传/CORS 暴露；结构化 request/error 日志、duration/outcome、userId 可选、IP 脱敏、UA 清洗截断；不记录 body/query/auth/cookie；4xx warn、5xx internal stack；logging/error/response/type 回归 + 独立 3013 真实日志烟测通过）
- [x] S4.1 API Versioning V1 基线（Nest URI versioning；Backend `/v1/*` / Web `/api/v1/*` 为正式入口；`VERSION_NEUTRAL + 1` 保留旧路径兼容；Web/Desktop Client 默认 V1；`/v2` 当前 404；versioning + 既有 S4.1 regressions、Web 238 modules、3014 live compatibility smoke 通过）
- [x] S4.2 Access Token 生命周期基线（默认 `ACCESS_TOKEN_TTL=30m`，60 秒–30 天 Fail Fast；Bearer + expires_in/expires_at；新 JWT `token_use=access`，显式 refresh token 被 Access Strategy 拒绝且旧无 token_use JWT 暂兼容；Web 初始化/请求前/timer/focus 主动过期；Backend/Web build、Access + S4.1 regressions、3015 live lifecycle smoke 通过，测试账号已清理）
- [x] S4.2 Refresh Token 基线（opaque sessionId.secret；DB 仅 SHA-256、默认 30d；`refresh_sessions` migration + CASCADE；事务行锁 rotation、绝对 expiry、reuse detection/revoke；Web sessionStorage + Axios single-flight refresh/one retry；Backend/Access/Refresh/S4.1 regressions、Web 240 modules、真实 3016 PostgreSQL smoke 与 migration idempotency 通过）
- [x] S4.2 Windows Desktop Token 安全存储基线（DPAPI Current User + 固定 access/refresh Tauri IPC；app-local vault 仅密文、原子替换、输入大小/格式防御；Desktop Web Storage 明文自动迁移并删除；Rust fmt/check/test/build 通过 17/17，含真实 DPAPI 磁盘无明文 round-trip；Web 240 modules、Access/Refresh regressions 与 Desktop setup_complete smoke 通过）
- [x] S4.2 多端登录策略基线（每次登录独立 Refresh Session；client_type/instance UUID/name 元数据 + 显式 session_id；旧客户端 unknown/null 兼容；Refresh 只轮换当前 Session 且不修改其他端；multi-client regression + 3017 PostgreSQL 三 Session 并存烟测、3015/3016 既有 live smoke、S4.1 regressions、Web 241 modules 与 migration idempotency 全通过）
- [x] S4.2 设备管理基线（Access JWT `sid` 服务端标识当前 Session；GET sessions 仅暴露有效 Session 安全元数据，DELETE session 只能撤销其他会话且拒绝当前/旧无 sid 上下文；Profile 账户页登录设备 UI；device regression + 3018 PostgreSQL smoke、既有 Access/Refresh/Multi-client/S4.1 regressions 与 live smoke、Web 244 modules 全通过；后续 logout/revocation 已补齐被撤 Session 的 Access 即时 401）
- [x] S4.2 登出 / 即时吊销基线（`POST /auth/logout` + sid Session authority；JwtStrategy 对 sid-bound Access 每次校验 Session active，logout/device-revoke/replay 后旧 Access 与 Refresh 立即 401；sid-less 旧 Access 支持 Refresh-secret logout 迁移兜底；Web/Desktop server-first + local-finally logout；logout regression + 3019 live、更新后的 3018/3016 live、Web 244 modules 全通过）
- [x] S4.3 本地敏感数据分类基线（L0–L3；真实扫描 Web Storage / Desktop vault / diagnostics；Canvas Notes/Todo/Folder path、Global Search recents、Installed App/Tool usage、Profile cache 均完成分类；确认无 IndexedDB/local SQLite/password cache；记录 clear/delete/account-vs-device scope 缺口，详见 `docs/LOCAL_DATA_SECURITY_CLASSIFICATION.md`）
- [x] S4.3 Secret / Token 存储基线（Windows Desktop DPAPI 保持不变；Browser Access memory-only + Refresh HttpOnly/SameSite=Strict Cookie，生产 Secure；cookie mode JSON 无 refresh_token；旧 Browser Web Storage Token 一次性迁移清理；single-flight + Web Locks 防多标签 rotation 竞态；3020 live + 3016 legacy body-flow + Backend/Web build + Secret Web Storage 静态审计通过，Web 245 modules）
- [x] S4.3 本地数据备份基线（版本化 V1 + AES-GCM-256 / PBKDF2-SHA-256 250k；固定 L0–L2 allowlist，L3 Token/Session/DPAPI/client identity/consent/diagnostics 明确排除；稳定 user-id 账号绑定；恢复前校验 + 完整快照语义 + 写失败回滚；DataManagement 服务器导出与本地备份分流；local-backup regression 全通过，Web strict build 246 modules）
- [x] S4.3 数据迁移版本管理基线（`flexikit-local-data-schema-version` 当前 v1；启动前集中 registry 执行逐版本迁移；v0→v1 将 Canvas v1→v2，合法 v2 优先且 stale v1 清除；幂等、未来版本降级保护、损坏数据保留、写失败回滚；备份 localDataSchemaVersion/旧 V1 恢复复用同一迁移链；工具导入 legacy→1.0 且未来版本拒绝；migration + backup regressions 与 Web 247 modules 全通过）
- [x] S4.3 隐私设置基线（设备级 `flexikit-privacy-preferences-v1`；搜索最近项、Tool/App usage personalization、资料本地缓存三项真实门控；关闭即删除对应历史并阻止后续读写；支持独立清除活动；隐私偏好不上传/不备份；Canvas 用户内容与 tracking 分离；Cookie 提示与政策收敛为必要 HttpOnly Refresh Cookie、无分析 Cookie；privacy + backup regression、Web 249 modules 通过）
- [x] S4.3 数据导出 / 删除基线（服务器导出改为 versioned 显式安全字段白名单，不暴露 password/token hash/secret/embedding；账户删除要求精确 DELETE 确认并使用事务 + 用户行锁，维护 surviving Tool 收藏计数并删除业务数据/Refresh Sessions；当前设备本地用户数据按 allowlist 完整清理且 Canvas 跨窗口防旧内容回写，主题/布局/隐私偏好/client instance 保留；Backend/Web lifecycle regressions、privacy/backup/migration regressions、Backend build、Web strict build 250 modules、3021 PostgreSQL HTTP live smoke 与 Browser Cookie live smoke 全通过）
- [x] S5.1 AI Provider 抽象基线（统一 Provider request/response contract + Registry + deterministic Model Router + AiService/AiController/AiModule；注册时校验 provider/model/default model 并拒绝重复；无 Provider/Provider 不存在/Model 不存在 typed fail-closed；GET /v1/ai/providers 受 JWT 保护；当前无真实 Provider/API Key/外部 AI 网络调用；Backend build、Provider regression、type-audit、3022 HTTP mount smoke 全通过）
- [x] S5.1 OpenAI Provider 基线（官方 Responses API；OPENAI_API_KEY 存在才注册；GPT-6 Astra/Sol/Luna，默认 gpt-6-sol 且 OPENAI_MODEL 可覆盖；store=false；安全聚合 raw output_text；max_output_tokens 映射；认证/限流/超时/5xx/失败响应/无效响应 typed + 脱敏；Backend build、OpenAI Provider regression、原 Provider regression、type-audit 全通过；无用户凭据故未执行外网 live）
- [x] S5.1 Gemini Provider 基线（官方 v1beta models.generateContent；GEMINI_API_KEY 存在才注册；默认 gemini-3.8-flash，同时提供 3.5 Flash / Flash-Lite，GEMINI_MODEL 可覆盖；systemInstruction + user/model 历史角色映射；temperature/maxOutputTokens generationConfig；store=false；prompt/candidate safety 归一化 content_filter；认证/限流/超时/5xx/无效响应 typed + 脱敏；Backend build、Gemini/OpenAI/Provider regressions、type-audit 全通过；无用户凭据故未执行外网 live）
- [x] S5.1 Claude / Anthropic Provider 基线（官方 Messages API POST /v1/messages；ANTHROPIC_API_KEY 存在才注册；默认 claude-sonnet-5，同时提供 Opus 5 / Fable 5 / Haiku 4.5，ANTHROPIC_MODEL 可覆盖；x-api-key + anthropic-version 2023-06-01；system 顶层映射、user/assistant 历史映射、max_tokens 缺省 4096；adapter 当前显式拒绝 temperature，模型能力标签单独记录各 Claude 模型的 native sampling/thinking 差异；最终 assistant prefill fail-closed；text block 聚合与 refusal/context-window stop reason 归一化；认证/限流/超时/5xx/无效响应 typed + 脱敏；Backend build、Anthropic/OpenAI/Gemini/Provider regressions、type-audit 全通过；无用户凭据故未执行外网 live）
- [x] S5.1 BYOK 安全基线（OpenAI/Gemini/Anthropic；Desktop 独立 Windows DPAPI Current User Vault，固定 Provider 槽位、原子密文落盘；Browser 运行期内存 only；账户页只显示配置状态，不回显原文；Backend 按请求创建临时 Provider，不入 Registry/数据库/响应/catalog；GET /v1/ai/byok/providers 只返回安全模型元数据；DPAPI 4/4 真机测试验证磁盘无明文 Key，Backend/Web build、BYOK backend/storage、三家 Provider、通用 Provider、type-audit、cargo fmt/check 全通过）
- [x] S5.1 模型能力标签基线（AiModelDefinition 统一 native/adapter 双层 capability profile；8 个能力键覆盖文本、视觉、流式、工具、结构化输出、推理控制、temperature、maxOutputTokens；native 支持 supported/conditional/unsupported/unknown，reasoningControls 支持 effort/thinking-level/manual-budget；三家内置模型按官方文档标注，自定义模型 native fail-safe=unknown；Registry 强校验并深拷贝 nested metadata，普通/BYOK catalog 同源；Backend build、model-capabilities/Provider/OpenAI/Gemini/Anthropic/BYOK regressions、type-audit 全通过）
- [x] S5.1 成本 / Token 统计（OpenAI Responses / Gemini usageMetadata / Anthropic Messages Provider-reported usage 统一归一化；ai_usage_events 仅存安全运营元数据；平台/BYOK 分账；版本化官方价格目录 + pico-USD 精确计算；OpenAI 长上下文、Gemini 3.8 价格有效期、Anthropic cache-read/cache-write 分类；未知/过期定价 fail-closed=unpriced；三段增量迁移已落库（含 usage.user_id ON DELETE SET NULL 去关联）；真实 PostgreSQL 写入/聚合/ROLLBACK、Backend/Web build、Provider/BYOK/model-capabilities/AI-usage/Admin/type-audit 全通过）
- [x] S5.1 超时 / 重试 / fallback（AiResiliencePolicy；Provider AbortSignal 真取消；默认 attempt=60s / total=90s / maxAttempts=3；Retry-After 优先、指数退避+jitter；仅瞬时错误重试；隐式平台路由才允许按 Registry 顺序 fallback；显式 Provider/Model 与 BYOK 禁止跨 Provider；OpenAI credit/spend/usage-limit 429 fail-closed 不重试；失败尝试不写 usage，最终成功只记一次；Backend build + resilience/OpenAI/Provider/Gemini/Anthropic/BYOK/model-capabilities/AI-usage/Admin regressions 全通过）
- [x] S5.2 原生桌面 AI 助手（Desktop /assistant + Sidebar 入口；JWT POST /v1/ai/assistant/generate；平台自动路由/显式 Provider/Model；OpenAI/Gemini/Anthropic BYOK 单次临时凭据；复用 S5.1 usage/retry/fallback；Prompt/Response 不入 usage ledger/数据库；页面消息 Vue 内存 only，刷新清空；Backend/Web build、S5.2 Backend/Web、BYOK、resilience、type-audit 全通过）
- [x] S5.2 当前工具上下文（最近一次由用户明确成功打开的 FlexiKit Tool；runtime memory only；openDesktopTool/ToolCard/Pet 成功路径同源；Assistant 可见且可关闭；请求仅 id/name/category/kind/hostname；本地路径不进入类型/DTO/system metadata；Backend 将 metadata 标记为 untrusted descriptive data；Backend/Web build、assistant/BYOK/resilience/type-audit 全通过）
- [x] S5.2 当前文件上下文（用户授权）（Windows 原生 IFileOpenDialog；仅用户主动选择后读取单文件；UTF-8 文本扩展名白名单 + 32 KiB UTF-8 字节限制 + binary/control-char 拒绝；明确拒绝 env/pem/key/exe/pdf；Tauri 只返回 basename/extension/content，不返回绝对路径；Assistant 内存 only、可更换/移除/逐次关闭；Backend DTO/Service 双重校验，正文保持 user-role + untrusted-data guard；Backend/Web build、assistant/type-audit、cargo fmt、Rust 3/3 tests 全通过）
- [x] S5.2 Clipboard 按需上下文（仅显式“读取剪贴板”按钮触发 get_clipboard_text；无 mount/focus/send 自动读取、无 polling/listener；Vue runtime memory only；16 KiB UTF-8 字节 + control-char 双端限制；可重新读取/移除/逐次关闭；Backend 正文保持 user-role + untrusted-data guard；不进数据库/log/usage；Backend/Web build、assistant/BYOK/resilience/type-audit 全通过）
- [x] S5.2 Prompt 历史隐私策略（session-only；client/server persistence disabled；刷新/关闭清空；Assistant/DataManagement 明示“仅本次会话”；手动清空本次对话；工具/文件/Clipboard 附件历史 excluded；加密备份 excluded；预留 history key 仅作防御性清理；未来本机历史必须独立显式 opt-in；history/Web build/assistant/privacy/data-lifecycle regressions 全通过）
- [x] S5.2 快捷操作（4 个本地静态 Prompt 模板；上下文型仅在已有且启用的工具/文件/Clipboard 上下文时可用；点击仅填入/合并 composer 并聚焦，绝不自动 Send、不读新文件/Clipboard、不触发 Backend/analytics、不持久化；最终显式发送继续走既有 Provider/BYOK/resilience/usage；Web build、assistant/history regressions 全通过）
- [x] S5.3 用户行为事件（device-local only；复用 usagePersonalization；tool_open/favorite_add/favorite_remove；仅 toolId/type/timestamp；400 条上限、读写时淘汰 90 天前事件；不上传 Backend、不进入服务器导出或加密备份；关闭个性化/清除活动/清除本地数据均删除；Web build + recommendation-behavior/privacy/data-lifecycle/local-backup regressions 全通过）
- [x] S5.3 标签匹配（device-local behavior + loaded Tool tags/category；tool_open=1、favorite_add=4、favorite_remove=-4；Tag×2/Category×1；单特征 clamp ±24；NFKC/case/whitespace 归一化；同分稳定保持候选原顺序；Discover 候选池 18→本地匹配→展示 6；fallback 同规则且无随机；不影响热门排行；tag/behavior regression + Web build 全通过）
- [x] S5.3 热度排序（公开 upvotes/comments + freshness only；engagement 55 分、comments×4、scale=5000；freshness 45 分、14 天半衰期；0…100 clamp；findAll hot/recommendations/rankings PostgreSQL 动态排序 + response 同公式回填；ingest 清洗聚合量且不信任上游 static hot_score；不读取 device-local 行为；Backend build + discovery-heat regression + type-audit 全通过；PostgreSQL live smoke 因 Runner EACCES 环境限制未执行 SQL）
- [x] S5.3 Embedding Pipeline（public Tool only，user_id IS NULL；OpenAI text-embedding-3-small / 1536d；canonical source ≤8,000 UTF-8 bytes、仅 hostname 不含 URL/local path；provenance + source SHA-256 + timestamptz；legacy vector reset；select:false provenance 显式 hydration；batch≤32、sync 默认100/上限500；pessimistic lock + source recheck；Provider model/index/dimension/finite/usage fail-closed；Provider-reported tokens 进入 AI Usage/成本；仅显式 embedding:sync，不自动产生外部费用；Backend build + embedding/AI-usage regressions + type-audit 全通过；Runner localhost:5433 EACCES/ECONNREFUSED，migration:show/run 未执行）
- [x] S5.3 pgvector（ToolVectorSearchService；PostgreSQL <=> cosine exact search + SQL-side 1-distance similarity；1536d vector/limit/exclude ids 校验并参数化；public Tool only；embedding non-null + current provider/model/dimensions/source-version + source hash/updated-at；embedding_updated_at >= updated_at stale guard；stable id tie-break；no in-memory vector math；当前无 HNSW/IVFFlat，待真实 EXPLAIN/latency 证据后再评估 ANN；Backend build + pgvector/embedding regressions + type-audit 全通过）
- [x] S5.3 相似工具推荐（最近最多 3 个公开收藏为 semantic seeds；复用 ToolVectorSearchService exact cosine；best-similarity + seed/candidate rank + Tool id deterministic merge；全部收藏最终排除；vector failure/shortfall → favorite-safe public popular fallback；匿名/无收藏保持 popular fallback；Discover 登录+全部来源接 /recommendations，source filter/匿名保留 Discovery path，device-local tag matcher 只在客户端重排；不返回 embedding/provenance/similarity；Backend/Web build + similar/pgvector/tag/heat UI regressions + type-audit 全通过）
- [x] S5.3 推荐解释（/recommendations/explained 与原 Tool[] 接口并存；服务端仅 similar_favorite/popular + 可选公开收藏种子名称；不返回 cosine/similarity/embedding/provenance/internal ranks/confidence；Discover 本机合并 strongest tag/category affinity 原因且行为不上云；ToolCard discovery-only 单行解释；popular fallback 明示且不伪造热度；Backend/Web build、Web explanation/tag/heat UI、Backend similar/pgvector/type-audit 全通过）
- [x] Admin Console V1（Overview / Users / AI Usage & Cost；users.role=user/admin + users.status=active/suspended 持久化；ADMIN_USER_IDS 仅作 bootstrap/recovery；暂停账号事务化撤销 Refresh Sessions；普通管理员可管理/删除普通用户，bootstrap-admin 才可管理管理员角色；禁止自停用、自降权、自删除和直接删除管理员；删除用户名二次确认 + 事务清理 + append-only 审计；AI Usage 已展示真实 Provider Token、平台/BYOK 分账、成本估算与未定价保护；安全字段继续排除 password hash / Token hash / BYOK Key / Prompt / Response / 本地内容）
- [x] Landing V2 产品打磨（Hero/Workspace Preview/产品能力带/核心能力/隐私/CTA 响应式重构；Apple 交互曲线 + reduced-motion；移除旧统计/技术栈/preview dead CSS；Web `vue-tsc && vite build` 通过）
- [x] Browser Companion 紧凑入口回归：安装入口已从工具区全宽卡片迁到 workspace 标题栏右侧，单一入口仍打开原 Teleport 安装面板；520px 下收为纯图标，Chrome/Edge 安装引导保持；Web vue-tsc && vite build 283 modules、结构回归、git diff --check 全通过。
- [x] /app 工作台视觉重构（全宽自适应；50px 紧凑 Navbar；两级 Workspace Header；240px 最小列宽自适应工具网格；158px 紧凑中性玻璃卡片；自定义颜色降为弱光晕；标签/图标/收藏/操作按钮密度收紧；1120/860/560px + reduced-motion；Web `vue-tsc && vite build` 283 modules、结构回归、`git diff --check`、运行页 HTTP 200 全通过）
- [x] `/app` Dashboard 首页回归（默认 `/app`=工作台，`/app?view=library`=原完整工具库；真实 `toolUsage/favoriteTools/customTools/categoryCounts` 驱动最近使用/收藏/最近添加/分类；桌面 1262×804 viewport 下 Dashboard 932.6px、顶部双栏各 458.3px、无横向溢出，点击“全部工具”后 44 张 ToolCard 完整恢复；500px viewport 下 Dashboard=468px、主面板单列、无 Sidebar/移动工具库 Header/横向溢出；Web/Desktop build 286 modules、HTTP 200、`git diff --check` 与 Chromium 运行态断言通过）
- [x] Desktop Dashboard 主导航回归（工作台与工具库均保持原 260px sidebar；“工作台 / 全部工具”两项均为 44px 主入口卡片并有独立 active 指示；工作台不再触发 compact-mode，工具库搜索/分类布局不因 Dashboard 变窄；Web/Desktop build、`git diff --check` 与真实 Tauri 运行态验证通过）
- [x] Desktop Sidebar 视觉与窗口拖动回归（真实 Tauri：sidebar=260px、Logo=42×42、工作台/全部工具行高=39px、发现/AI/桌面画布=36px、active box-shadow=none，仅保留轻主色底与左侧指示；Sidebar Logo 与 Titlebar 均注册显式 mousedown；Windows `start_main_window_drag` 使用 `ReleaseCapture + WM_NCLBUTTONDOWN(HTCAPTION)`，真实 Win32 鼠标回归 Sidebar 拖动窗口 `+91×+49px`、Titlebar 拖动 `-56×+35px`；Web/Desktop build 286 modules、Rust fmt/check/debug build、`git diff --check` 通过）
- [x] /app 去空白紧凑布局回归（移除 Home 的 `--grid-columns` 固定列数绑定；auto-fit 210px 自适应填满可用宽度；工具卡约 108px 高、横向双栏信息结构、最多 3 标签；Web `vue-tsc && vite build` 283 modules、结构回归、`git diff --check` 通过）
- [x] /app 外层 wrapper 全宽回归（App.vue `app-window-content` = width 100% + flex 1；Chrome DevTools 实测 1761px viewport 下 layout 1753px / main 1433px / grid 1429px / 6 columns；Web build 283 modules、`git diff --check` 通过）
- [x] 侧边栏收起分类迁移回归（展开时无重复分类条；收起后标题栏中部显示 7 个分类、横向滚动、颜色点/数量/选中态；Chrome 运行态实测分类条宽约 869px，点击分类后标题同步切换；Web build 283 modules、结构回归、`git diff --check` 通过）
- [x] 侧边栏收起分类独立行回归（第一排仅标题/说明/右侧操作，第二排为完整分类条；Chrome 运行态实测第一排 bottom≈139.7px、分类条 y≈148.7px、宽≈1401px、7 个分类；Web build 283 modules、结构回归、`git diff --check` 通过）
- [x] `/app` 窄窗口 Navbar 安全区回归（约 760px CSS viewport；Navbar 高度自适应为 96px 两排；nav-left bottom=53px、nav-right bottom=99px 均位于 Navbar bottom=108px 内；Workspace Header y=128px，确认从导航下方开始；首张 ToolCard y≈200.7px；Web build、结构回归、`git diff --check`、HTTP 200 与 Chromium 运行态测量通过）
- [x] `/app` 窄窗口 Workspace Header 回归（622px CSS viewport；heading width=584px；“全部工具”82.5×23.3px 横排；说明 584×16.7px；操作区 y≈181.7px 独立位于说明下方；Header bottom≈226.7px、首张 ToolCard y≈238.7px；Web build、HTTP 200、`git diff --check` 与 Chromium 运行态测量通过）
- [x] `/app` 手机工作台独立布局回归（Chromium phone probe 实际 CSS viewport=500×748；Sidebar/SidebarToggle/Desktop Workspace Header/Browser Companion 均不存在；Navbar 桌面链接/主题/收藏按钮隐藏；移动标题 84.4×23.2px 横排；分类条 464px 可横滑；网页/本地筛选与快捷操作均 464px；工具卡 468×104px 单列，第二卡从 y=461.2px 开始；分类点击可从“全部工具”切换到“本地硬核与系统辅助”；Web build 283 modules、`git diff --check` 与运行态断言通过）
- [x] `/app` 手机工作台精修回归（明确不修改 Pet；Chromium 实测 CSS viewport=500×748，Navbar=78px、移动 Header=119px；分类短标签=全部/系统/开发/科研/文档/制图/AI；类型筛选与快捷操作同一 y=176px、同高 34px；ToolCard=468×96px，卡间距=8px；Web build 283 modules、HTTP 200、`git diff --check` 与运行态断言通过）
- [x] `/app` 手机 Navbar 单行回归（Chromium CSS viewport=542×704；Navbar=510×48px；Logo=84.2×24px、Search=298.3×32px、Settings=32×36px、Account=59.5×32px，四者同排且全部位于 Navbar 内；Web build、HTTP 200、`git diff --check` 与运行态断言通过）
- [x] 工具卡拖拽排序结构回归（Sortable `forceFallback/fallbackOnBody/fallbackTolerance`；父级扫描 `.tool-card` 写入 `draggable=false` 并捕获阻止原生 dragstart；ToolCard 禁用 WebKit 原生拖拽；onEnd 使用 `data-tool-key` 生成新顺序；Web build 283 modules、`git diff --check`、结构断言通过。Chromium headless 可触发 Sortable start/chosen/fallback，但不可靠触发 end/swap，真实鼠标拖放仍需人工实机确认）
- [x] Desktop ToolCard 单击空白回归（真实 Tauri WebView CDP 证明异常时 `html.tool-sort-active` 被编译规则直接设为 `display:none`；手动移除 class 后 Body 立即恢复 1432×1316、卡片恢复 211.9×108。修复后运行态 CSS 为 `html.tool-sort-active .site-preview-popup { display:none }`，Desktop ToolCard 为 DIV 且无 href/target；可信鼠标单击后 URL 仍为 `#/app`、html display=block、class 为空、App 1432×1316、Sortable fallback=0。Web/Desktop build 283 modules、Rust fmt/check 通过）
- [x] Desktop ToolCard 拖拽跟手回归（body fallback 保留；fallback/dragging/chosen/ghost transform transition 与 animation 均关闭；onStart 同步 source 计算后的卡片尺寸与 grid/padding/关键子元素布局到 fallback。真实 Tauri trusted drag：鼠标与副本中心误差 0×0px，原卡片与副本均 211.86×108，尺寸误差 0×0px，grid column 最大误差 0.012px，释放后 global sort class/fallback 均为 0；Web/Desktop build 283 modules 通过）
- [x] Desktop Pet 白底透明边界回归（Tauri pet window 配置仍为 transparent=true/shadow=false；Pet 根层 html/body/#app/page/stage box-shadow none；构建产物 `.pet-aquarium` 已无 `0 12px 30px` 外投影，仅保留 3 条 inset 内阴影；Web/Desktop build 283 modules、`git diff --check`、built CSS 结构断言通过）
- [x] Desktop Pet 原生拖动刷新回归（不新增 snap/magnet/edge 吸附；native pointer loop 拖动中 8ms、交互附近 16ms、展开空闲 24ms、普通空闲 40ms；旧固定 60ms sleep 已移除；`last_drag_target` 去重相同窗口位置写入；cargo fmt/check 与结构断言通过）
- [x] Desktop Sidebar / Titlebar 视觉一致性回归（Sidebar 仍固定 260px；Logo 样式唯一来源为 42px；核心导航约 39px、无常态厚玻璃底/外阴影，active 保留 2px 左侧指示；Sidebar 拖动入口与 Titlebar 均忽略双击第二次 mousedown；Titlebar 交互过渡统一为 300ms `cubic-bezier(.25,.1,.25,1)`。Windows 原生拖动后端未改动；Web build 与 Desktop mode build 均 286 modules 通过）
- [x] Desktop 离线原生体验回归（正式 Tauri `frontendDist=../../web/dist`，5173 仅 devUrl；系统离线/API 网络失败/5xx 均留在 FlexiKit App Shell 内局部降级，Titlebar 显示低干扰离线状态，Discover 使用本地 Tool catalog，Login/AI 使用应用内提示与重试；网络/5xx 不清除 Refresh Session，仅明确 401/403/Refresh 本地过期失效认证。实测 Backend 3001 不可达时 Discover 仍完整渲染并显示“本地模式 / 重试连接”；`test:desktop-offline-regression`、Web build、Desktop build 290 modules、AI Assistant/History Privacy/Data Lifecycle 回归通过）
- [x] Desktop 本地工具导入结构/权限/新版壳回归（工作台独立“添加本地工具”入口；专用拖放/选择弹窗；`main` capability 开放 `core:event:default`，修复 `event.listen not allowed`；使用 `Window.onDragDropEvent`，Tauri `scaleFactor()` 将物理拖放坐标换算为 CSS 逻辑坐标后仅 drop zone 接收；Windows allowlist `.exe/.lnk/.url/.msi` + canonicalize + Shell 图标；重复过滤、多文件逐个确认、Web 无本地拖放入口。运行态已显示“拖放已就绪”，原生 Picker 可弹出；专项回归、Web/Desktop build 300 modules、`cargo fmt --check`、`git diff --check` 通过；完整新版 Desktop 壳已用隔离 gnullvm 工具链成功 `cargo build`）
- [x] Desktop 本地工具真实人工拖放终验（用户实机确认从 Windows 桌面/资源管理器拖入程序后可以正常识别并添加）
- [x] Desktop 本地工具导入元数据与入口统一回归（本地工具优先渲染 `customIcon/icon` 中的真实 Shell `data:image`，失败才回退本地图标；后端自定义工具映射保留 icon，创建 API 优先同步 customIcon；导入时自动生成可编辑描述/标签；多文件队列在 drop zone 显示最多 8 个图标+名称及溢出数量；通用“添加工具”新增模式点击“本地应用”会直接转入专用 LocalToolImportModal，Home/Discover 均接入。专项回归、Web/Desktop build 300 modules、`git diff --check` 通过）
- [x] 网页工具极简智能导入回归（默认只输入 URL；无协议地址自动规范化；`/tools/preview` + `recommend-tags` 自动补名称/描述/分类/标签；离线/Backend 不可用时有域名与关键词确定性 fallback；高级字段默认折叠；重复 URL 阻止添加；自定义网页工具空 icon 不再被 `DEF_ICON` 覆盖，继续走 `ToolIcon` favicon fallback。`test:web-tool-import-regression`、既有 Desktop 本地工具回归、Web/Desktop build 303 modules、`git diff --check` 通过）

- [x] Desktop 主窗口缩放渲染修复门禁（新 Tauri native window + WebView2 同步不透明背景；主窗口独占 `desktop-main-window` CSS；缩放时轻量合成与 160ms 空闲恢复；Pet/Canvas 保留透明且不进入缩放保护。Web/Desktop build 304 modules、gnullvm 完整 Desktop cargo build、Rust fmt、desktop-live-resize/local-tool regressions、diff check 通过；新 EXE 已启动。Win32 SetWindowPos 模拟从原尺寸到 70% 再恢复的 10 段连续尺寸变化均成功，最终位置和尺寸精确复原；人工鼠标边框拖动视觉终验仍单独保留）
- [ ] Desktop 主窗口连续鼠标边框拖拽终验（人工在 100%/125%/150% DPI、浅色/暗色主题下反复拉伸左右和右下角，确认无黑白分离、无白闪或卡片残留，松手后玻璃/动效自动恢复；自动静态截图不能替代该终验）

- [x] Desktop 真实右边框鼠标拖动交互烟测（Win32 foreground + WindowFromPoint 验证测试输入确实落到 FlexiKit；按下右边框后程序窗口从 1200px 增至 1315px，释放并将原几何精确恢复。仅证明真实边框尺寸变化，不代表黑白闪块已完成跨 DPI 的视觉终验）
- [x] Stage 6 真实用户测试**计划**编制（`docs/STAGE6_USER_TEST_PLAN.md`，含 UT-01–12、6–10 人/7 日计划、DPI/离线/桌宠/Canvas/隐私矩阵、缺陷模板和发布阻断条件；无真实招募或成绩）
- [ ] Stage 6 首轮实际用户试测与 7 日回访（待自愿参与者、安装包及反馈渠道就绪后执行）

- [x] Stage 6 Desktop 本地 Crash / Error 安全基线（Rust panic 仅文件名/行列、错误详情拒绝落盘、frontend script/promise/vue 分类限流、日志事件白名单、手动调用的去敏诊断摘要；Web strict/desktop build 304 modules、Rust privacy_tests 2/2、Desktop gnullvm build、桌面诊断结构回归通过；新 EXE 主窗口/桌宠启动正常，未自动读取剪贴板）
- [ ] Desktop 设置中手动“复制诊断摘要”交互与剪贴板内容实机终验（须由测试者主动点击，不自动覆盖现有用户剪贴板）

- [x] Windows gnullvm 调试版 libunwind.whl 缺失修复：补齐到 EXE 同级并比对 SHA-256，使用 `scripts/windows-gnullvm-build.ps1 -SkipBuild` 验证自动 staging，独立 EXE 不注入 PATH 连续运行 8 秒，计划任务启动后进程路径正确，主窗口恢复可见；文档见 `docs/WINDOWS_GNULLVM_BUILD.md`。
- [ ] 新版主窗口（opaque / shadow false）连续拖边框的视觉终验：未用 DLL 加载修复结果冒充此前黑白闪块的完成证明；需人工快拖边框确认。

- [x] Windows 主窗口使用原生边框缩放：启动时移除系统标题栏 WS_CAPTION、保留 WS_THICKFRAME，确认没有 Tauri 辅助 resize HWND；右/底/右下角命中为 11/15/17；完整桌面构建、Rust 格式与专项回归通过。
- [ ] 连续快速鼠标拖动右边、底部与右下角，并在 100%/125%/150% DPI 下确认不跳动、不露黑白边；自动输入因前台焦点限制而跳过，实际人工视觉验收仍待进行。

- [x] Desktop 内部稳定渲染代码门禁：五档 Win32 主窗口几何测试显示 WRY_WEBVIEW 与 ClientRect 对齐；移除 resize 事件上反复切换模糊/动画的 CSS class，主题背景保持稳定渐变，宽 Hero 自然换行；Web strict、Desktop build（304 modules）、desktop live resize 与 offline regressions 通过，不影响透明 Pet/Canvas。
- [ ] Desktop 内部动态画面连续快拖终验：右侧/底部/右下角至少各 5 次，观察内容布局、图标、WebView2 帧和 100%/125%/150% DPI 的闪动；结构测试不代表视觉已通过。

- [x] 主窗口边缘 8px 非客户区修复：native-main Comctl32 子类 WM_NCCALCSIZE 让恢复窗口客户区与 WindowRect 对齐，DPI-aware WM_NCHITTEST 保留四边四角缩放，最大化遵守 Windows 默认 NC；5 档实机 WindowRect=ClientRect，右/底/右下命中 11/15/17、中央 1；Rust 3/3、完整 Desktop/gnullvm 构建与最大化还原通过。
- [ ] 真实连续鼠标快拖右边和底部、125%/150% DPI 下的画面视觉终验（用户观察不到窄边缘闪块后方可标记通过）。

- [x] Desktop 滚动条自动隐藏实现：静止仅透明隐藏滑块，不移除可滚动轨道；滚动、靠近右/下边缘时显示，1100ms 后自动隐藏；滚动捕获支持嵌套容器且不影响原有隐藏分类条；功能性模拟回归和 Vue 严格构建通过。
- [ ] Desktop 侧边栏、全部工具、设置、弹窗、画布滚动条实机鼠标与触控板视觉确认（同时检查仍可拖动滚动条）。

## 核心流程

- [x] 用户注册/登录（真实 HTTP API 回归：注册 201、正确登录 200、错误密码/删除账号后 401）
- [x] 用户资料修改（GET/PUT 真实回归，未暴露 `password_hash`）
- [x] 工具创建、编辑、删除（真实 PostgreSQL 集成回归）
- [x] 工具搜索与分类（描述/tags 搜索、分类创建/编辑/过滤通过）
- [x] 收藏功能（添加、列表、favorite 过滤、移除通过）
- [x] Discovery 页面加载（5 条 API + Tauri WebView 页面实测）
- [x] 本地工具启动流程（真实 UI 添加 Notepad 后点击启动，确认进程出现；测试工具/进程已清理）
- [x] Desktop Canvas 实际窗口回归（Stage 1 S1.8/S1.9 完整验收已通过）
- [x] S3.1 全局搜索基线（`Ctrl+Shift+Space` 原生全局快捷键、FlexiKit 工具/本地应用/文件/文件夹统一检索、最近使用、结果排序、↑↓/Enter/Esc 键盘操作、90ms 防抖 + 120 秒原生索引缓存；Web strict build、Rust check/build 和真实快捷键注册/触发日志均通过）
- [x] S3.2 已安装软件自动发现基线（HKCU/HKLM 32/64 位卸载注册表 + Start Menu + Store/MSIX PackageManager，系统组件/更新/Framework/资源包过滤、名称去重、5 分钟本地缓存；真实 Desktop 启动发现 537 条；Web strict build、rustfmt、Rust check/build 全部通过）
- [x] S3.2 软件图标读取基线（Registry `DisplayIcon`、Start Menu Windows Shell、Store/MSIX Package Logo；按需读取 + 本地内存缓存，Shell HICON 转 64×64 PNG/Data URL；真实已安装软件图标测试 2/2 通过，Web strict build、rustfmt、Rust check/test/build 全部通过）
- [x] S3.2 软件路径解析基线（Start Menu `.lnk` ShellLink 目标/参数、直接 EXE/URL、Store/MSIX AUMID、Registry 现存 EXE 保守兜底；按来源优先级合并，陈旧快捷方式目标拒绝；真实已安装软件路径测试通过，Rust 3/3 tests + Web strict build + debug build 全部通过）
- [x] S3.2 Launcher 自动推荐基线（可启动本地软件最多 12 项；来源可靠性 + FlexiKit 启动频率/时间 + 全局搜索最近应用综合排序，噪声软件降权；展示项图标惰性加载，手动整理后固定顺序；原生命令按软件名二次校验目标再启动；Web 222 modules、Rust 4/4 tests、debug build 与真实 Desktop 启动均通过）
- [x] S3.2 Launcher 手动增删基线（统一应用库展示可启动本地软件与 FlexiKit 工具；分类/搜索、`+ / ✓` 加入移除、整理模式 `−` 删除、拖拽排序；`launcherPinnedKeys` 无固定数量上限并随 Canvas Widget 配置持久化；Web 222 modules、Rust 4/4 tests、debug build 与 Desktop 启动烟测通过）
- [x] Desktop Launcher 拖拽防抢占回归（整理模式使用 forceFallback/fallbackOnBody；排序读取 app-tile-shell[data-tool-key] 并持久化 launcherPinnedKeys；center grid 捕获阻止 native dragstart，shell/button/img 初始化时强制 draggable=false，应用图标显式关闭原生/WebKit 拖拽；Web build 283 modules、Desktop mode build 283 modules、git diff --check 与结构回归通过）
- [x] S3.2 软件失效路径检测基线（启动挂载强制刷新 + 60 秒后重新打开 Launcher 时刷新；失效/卸载的固定软件显示禁用占位并保留手动移除入口，应用库/自动推荐排除失效项；启动失败立即强制刷新；Web 222 modules、Rust 4/4 tests、debug build 与 Desktop 烟测通过）
- [x] S3.3 Desktop Organizer Known Folder 基线（用户桌面 + 公共桌面改用 `SHGetKnownFolderPath(FOLDERID_Desktop/PublicDesktop)`，读取与 `open_desktop_item` 路径校验共享同一根目录；真实 Known Folder 测试通过，Rust 5/5 tests + debug build + Desktop 启动烟测通过）
- [x] S3.3 Desktop Organizer 真实图标基线（桌面文件/文件夹/快捷方式/EXE 使用 Windows Shell 真实图标，HICON 转 64×64 PNG；canonical `\\?\` 路径在 Shell 边界归一化，SHGFI_USEFILEATTRIBUTES 兜底；命令先做 Known Folder 路径校验，前端按路径缓存；Web 222 modules、Rust 6/6 tests、debug build 与 Desktop 烟测通过）
- [x] S3.3 Desktop Organizer 分类规则配置基线（默认分类可重命名/编辑扩展名；自定义分类可新增删除；同一扩展名自动转移归属、可恢复默认；规则保存在 Widget config，仅改变显示分组不操作真实文件；Web 222 modules、Rust 6/6 tests、debug build 与 Desktop 启动烟测通过）
- [x] S3.3 Desktop Organizer 常用置顶基线（桌面项目 `☆ / ★` 星标；置顶后进入顶部常用分组且不与原分类重复，取消后自动回归；最近置顶优先、最多 80 项，完整路径随 Widget config 持久化；Web 222 modules、Rust 6/6 tests、debug build 与 Desktop 启动烟测通过）
- [x] S3.3 Desktop Organizer 最近文件基线（Known Folder 桌面文件元数据 `modifiedAt`；最多 6 个未置顶文件按修改时间降序，显示相对时间；不读 Windows 全局 MRU/UserAssist/RecentDocs，常用/最近/分类三层去重；Web 222 modules、Rust 7/7 tests、debug build 与 Desktop 启动烟测通过）
- [x] S3.3 Desktop Organizer 文件夹快速展开基线（桌面文件夹显式 `›` / 双击进入 Organizer 内预览，支持子目录进入、返回、关闭与 Esc；Known Folder 边界二次校验，隐藏/系统项过滤，单次扫描≤512、返回≤30，子项真实图标；Web 222 modules、Rust 9/9 tests、debug build 与有界 Desktop 烟测通过）
- [x] S3.3 Desktop Organizer 搜索基线（180ms 防抖；文件名精确/前缀/包含 + 扩展名匹配；仅 Desktop/PublicDesktop Known Folder，递归深度≤4、扫描≤5000、结果≤60，隐藏/系统项过滤；结果可打开/展开且复用真实图标；Web 222 modules、Rust 11/11 tests、debug build 与有界 Desktop 烟测通过）
- [x] S3.3 Desktop Organizer 不修改用户文件安全基线（原生 Organizer 模块无 rename/remove/copy；前端仅调用读取/搜索/图标/预览/受控打开五类命令，所有路径仍受 Known Folder 校验；机器审计退出 0；全项目仅 diagnostics 日志轮转存在 rename/remove，与用户文件无关）
- [x] S3.4 Calendar Widget 基线（纯本地 6×7 月历；今天高亮、日期选择、月切换/回到今天；Registry 支持周一/周日起始与相邻月份显示开关；不联网、不读取系统日历/账户；Web 225 modules、Rust 11/11 tests、debug build 与有界 Desktop 烟测通过）
- [x] S3.4 Folder Widget 基线（从 Desktop/PublicDesktop 顶层文件夹选择并固定，根路径随 Widget config 持久化；支持子目录进入/返回/刷新、真实图标、文件双击打开；失效根保留意图并可重新选择；仅复用四个 Known Folder 受控命令；Web 228 modules、Rust 11/11 tests、debug build、有界 Desktop 烟测与安全审计通过）
- [x] S3.4 System Monitor Widget 基线（Windows `GetSystemTimes` + `GlobalMemoryStatusEx` + `GetTickCount64` + 现有系统盘统计；前端 CPU 差分、18 点历史、内存/磁盘/开机时长；2/5/10 秒刷新与磁盘显示配置；无新第三方依赖/后台线程；Web 231 modules、Rust 13/13 tests、debug build 与有界 Desktop 烟测通过）
- [x] S3.4 Notes Widget 基线（多实例独立纯文本便签；标题≤40、正文≤12000，450ms 防抖自动保存 + 完成/失焦/卸载 flush，最近编辑时间与 3 秒二次确认清空；仅当前 Widget config + Canvas localStorage，不联网/无原生命令；Web 234 modules、Rust 13/13 tests、debug build、有界 Desktop 烟测与本地安全审计通过）
- [x] S3.4 Weather Widget 基线（手动城市后才联网，无系统/GPS/IP 自动定位；Open-Meteo 当前天气 + 4 日预报，摄氏/华氏与预报开关；30 分钟周期、5 分钟聚焦 freshness gate、10 秒超时、运行期坐标缓存；固定双域名/CORS/真实 API 烟测通过；Web 237 modules、Rust 13/13 tests、最终 Desktop rebuild 与有界烟测通过；商业发布前必须完成天气 API 商业授权或自托管切换）
- [x] S3.4 Widget Plugin API V1 基线（统一 Plugin Manifest：ID/SemVer/API version/source/instance policy/permissions/network origins/native commands；Registry Fail Fast 校验与重复 type 拒绝；14 个内置 Widget 权限元数据迁移；Desktop Organizer single-instance 生效；明确 V1 不动态执行远程/第三方 JS；Web 238 modules、Rust 13/13 tests 通过）
- [x] S3.4 Widget Config Schema V2 基线（新增 number/color/section + `visibleWhen`，兼容 boolean/select/range/text；Inspector 自动生成分组/数字/颜色 UI 和条件显示；注册严格校验 key/select/numeric/text/color/condition，运行时统一归一化；Weather 1–4 天预报与 Notes 强调色完成真实接入；Web 238 modules、Rust 13/13、debug build 与有界 Desktop 烟测通过）
- [ ] Widget 组合回归（Shift 多选、组合、联动移动、整组锁定、拆分、持久化）
- [ ] 外观 Inspector 回归（名称、透明度、圆角、模糊、批量修改）
- [ ] Launcher 三级展开回归（快速启动中心、Launchpad 搜索/分类、Esc/关闭、展开后原生穿透区域恢复）
- [ ] Launcher 常用应用回归（添加、移除、数量不限、拖拽排序、重启后顺序持久化）
- [ ] Todo Widget 回归（新增、完成、删除、清理完成项、重启持久化）
- [ ] Clipboard Widget 回归（主动读取、写入、清空显示、不后台采集、不持久化文本）
- [ ] Music Widget 回归（GSMTC 歌名/歌手/专辑、播放状态、进度/总时长、上一首、播放/暂停、下一首、停止）
- [ ] Music 专辑封面回归（GSMTC Thumbnail、无封面回退、切歌自动更新、4 MB 上限、内存缓存、不持久化）
- [ ] Music 歌词回归（默认不联网、主动开启后匹配 LRCLIB、同步歌词逐行高亮、普通歌词降级、切歌重新匹配、关闭后清空内存歌词）
- [ ] Music 歌词容错回归（LRCLIB 404 / 429 / 5xx / 超时：一次重试、exact → search 降级、媒体控制保持可用）
- [ ] Music 隐私回归（歌词正文和当前歌曲元数据不写入 Canvas localStorage，仅持久化 `musicLyricsEnabled` 用户选择）
- [ ] AI Prompt Widget 回归（AI 工具选择持久化、Prompt 不持久化、复制并打开）
- [x] Windows 桌面父层烟测（当前 Win11：Canvas HWND 父窗口已验证为 `Progman / Program Manager`）
- [x] Windows Canvas 原生交互区域烟测（普通模式 `GetWindowRgnBox` 已验证为 `RGN_KIND=3` Complex Region，不再使用 45ms 全窗口穿透轮询）
- [x] Explorer 桌面层自动恢复机制（1.5 秒低频父层/尺寸 watchdog；父层失效后自动 reattach、恢复 HRGN 并触发 Region 重算；空闲多周期烟测通过）
- [x] 多显示器 / DPI 布局底座（Monitor API、`monitorId`、v2 持久化、v1 自动迁移、拓扑变化重映射；当前单屏运行态烟测通过）
- [ ] 真实双屏 / 混合 DPI 回归（跨屏拖动、指定显示器迁移、热插拔、主屏切换、不同缩放比例）
- [x] Widget 外观 V2 数据/构建基线（旧布局兼容、完整默认值、预设/自定义持久化、Vue strict typecheck、Desktop build）
- [ ] Widget 外观 V2 视觉回归（四预设、深/浅/跟随色调、批量修改、重启后持久化、小屏 Inspector 滚动）
- [x] Registry 驱动 Widget 配置基线（boolean/select/range/text、默认值解析、恢复默认、内部数据隔离、Vue strict typecheck、Desktop build）
- [ ] Widget 配置 GUI 回归（Clock / Search / Todo / Music 实时修改、恢复默认、重启后持久化、Music 双入口同步）
- [x] 20px 栅格 / 自动整理 / 新增 Widget 空位布局构建基线（Vue strict typecheck、Desktop build）
- [x] 默认开箱布局几何烟测（5 个系统组件、20px 栅格、组件间至少 20px、不重叠、完整容纳于 960×640）
- [x] 旧默认布局升级保护（兼容 4/5 组件旧 starter；并识别历史开发阶段“6 组件 + 重复 Launcher”签名，一次性迁移为 5 组件紧凑布局；保留名称/外观/config）
- [x] Desktop Organizer 原生基线（Desktop 根目录扫描、hidden/system 跳过、受限路径打开、Web strict build、Rust check）
- [x] Explorer 图标恢复保护（Canvas 关闭/应用退出恢复；应用启动先恢复，覆盖上次异常终止后残留隐藏状态）
- [x] Windows 11 实机桌面图标显示回归（打开 Canvas 后 Explorer 原图标隐藏，关闭 Canvas 后恢复）
- [x] Windows 11 Canvas Z 顺序 / 命中烟测（Progman 模式将 Canvas 置于 `SHELLDLL_DefView` 之上；`WindowFromPoint` 已确认“添加 / 编辑 / 整理”和 Widget 坐标命中 Canvas WebView，HRGN 外空白不命中 Canvas）
- [x] Canvas GUI 可访问性烟测（5 个系统组件实际加载；Clock Inspector 可打开；Launcher “快速启动 → 应用库 → 关闭”真实 UI Automation 链路通过；滚动区域外项目正确标记 offscreen）
- [x] Desktop Organizer GUI 回归（分类内容、Canvas 打开时图标隐藏/关闭恢复已验证；2026-09-23 用户实机确认双击文件夹与普通文件均正常打开）
- [x] Launcher 拖拽根因修复（失效 handle、整块 tile 拖拽、Sortable fallback、严格类型）
- [x] 鼠标交互回归（顶部控件/Widget 原生命中已验证；2026-09-23 用户实机确认整块拖动、四边/四角缩放、20px 吸附和右侧缩放不误开 Inspector 均正常）
- [x] Canvas 动画 / 交互优化回归（统一自然曲线；编辑网格、顶部控制条、Palette/Inspector 入场；整理/重置几何补间；拖动/缩放期间禁用几何动画；pointercancel/blur 安全清理；Vue strict build + 基本 GUI 链路通过）
- [x] 2026-10-04 Canvas 跟手性专项回归（Pointer Capture 保持；拖动/缩放过程像素级更新并由 RAF 合帧，释放时统一 20px 吸附；交互期间暂停持久化 timeout churn；拖动态取消几何 scale；后续补充 3px 激活阈值、纯点击不吸附、pointerId 隔离、lostpointercapture 清理、锁定态 cursor 与选中角点缩放提示；Web strict + desktop build、10 项交互结构断言均通过）
- [x] 2026-10-04 Desktop 自动化回归（Rust fmt/check/build 通过；cargo test --all-targets 24/24；本地备份/迁移/隐私/数据生命周期/BYOK/AI Assistant/Prompt 历史回归全通过；Debug 实际启动出现 setup_complete、全局搜索快捷键注册成功并发现 434 条本机软件记录）
- [x] 滚动视觉回归（Launcher 快速启动 / Launchpad / Desktop Organizer 静止态各连续 10 帧像素区域哈希唯一值 = 1；无闪动、无横向抖动；Inspector 已使用 stable gutter，继续在配置 GUI 专项回归中观察）
- [~] 桌面层完整交互回归（桌面图标隐藏/恢复、HRGN 透明区域穿透、Widget 点击、真实 Explorer 重启后 Canvas 重建恢复均已验证；真实桌面右键菜单/框选仍保留人工扩展回归）
- [x] 桌宠 -> Desktop Canvas 菜单联动回归（2026-09-23 Windows 11：通过真实 UI Automation 打开桌宠菜单并触发“桌面画布”，Canvas 成功显示）
- [x] S1.9 Canvas 最终验收（真实窗口截图、默认布局、圆角、紧凑内容、20 次开关、滚动稳定、Explorer HWND 重建恢复、应用重启持久化、无 runtime warning、Web/Rust 构建、全仓库 diff check）
- [ ] 桌宠 -> “添加桌面组件”联动回归（打开 Canvas、进入编辑态、自动展开 Widget 组件库）

## 架构检查

- [x] API Client 单一入口
- [x] Token 生命周期明确（v0.1：7 天 Access Token；401 统一失效事件同步清空 Store/localStorage；网络/5xx 保留 Token；Refresh Token 延后 Stage 4）
- [x] Stage 2 工具数据链路回归（真实 PostgreSQL：分类创建/编辑、工具创建/编辑/删除、描述/tags 搜索、分类过滤、收藏添加/过滤/移除；测试夹具全部清理）
- [x] Stage 2 Backend 异常 / 授权回归（统一 400/401/403/404 错误形态；数字路径参数 ParseInt；跨用户工具/分类越权阻断；私有工具越权收藏阻断；账号删除关联清理；`npm run test:authz-regression` 可重复通过）
- [x] Web TypeScript / Vue SFC 严格类型检查通过
- [ ] 统一包管理器与锁文件策略
- [ ] 文档与代码结构完全同步

## 发布前

- [x] 更新 CHANGELOG
- [ ] 创建稳定版本标签
- [ ] 完成回归测试
