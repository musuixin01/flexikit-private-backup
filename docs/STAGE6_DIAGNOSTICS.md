# FlexiKit Stage 6 — 本地 Crash / Error 诊断

> 适用：当前 Windows Desktop/Tauri 构建。实现默认**只保存在设备本机**；没有远程崩溃 SDK、自动报告网络接口或未经用户操作的日志上传。

## 已实现

- Rust：启动、退出、主窗口拖动、热键/已安装程序发现等现有诊断事件仍保留在本机轮转日志；panic 仅记录 `*.rs` 文件名和数值行列，**不保存 panic payload、stack 或绝对路径**。
- Rust：`log_event` 只允许小写下划线事件 ID；除由程序自身构造的有限启动元数据与枚举数外，详情统一写为 `details_omitted`，不直接落盘操作系统异常原文。
- Frontend：Desktop 的脚本错误、未处理 Promise 拒绝、Vue 组件错误仅发送固定类别 `script/promise/vue`，不传 `Error.message`、stack、页面 URL、用户输入和上下文。前端每次页面运行最多报告 12 次，原生进程最多记录 16 次，防止错误风暴无限写日志。
- 设置页：仅 Desktop 显示“本地诊断 → 复制诊断摘要”。**只有用户点击**才读取报告并写入系统剪贴板；报告仅含 FlexiKit 版本、OS/arch、允许的事件类别及最近 1,024 行日志内的类别计数。
- 本机日志文件由旧轮转机制控制：单文件约 2 MiB 后在下次启动轮转，最多保留 3 份备份。当前未实现后台实时轮转或留存天数限制，不能称为长期自动归档。
- 事件摘要不读出源日志的详情字段，不包含具体时间戳、路径、异常原文、个人文件、AI Prompt/Response、剪贴板或凭据。即使旧日志含历史未脱敏详情，也不会被“复制诊断摘要”带出。

## 隐私边界与已知限制

- **旧版本地日志**：版本升级不会擅自删除原有 `%LOCALAPPDATA%\com.flexikit.desktop\logs\flexikit.log` 和备份。旧日志仍可能保有之前版本写入的原始 Windows 错误或 panic 文本；需要用户主动审阅或清理，新的摘要已排除这些内容。
- 日志路径及内容均不自动向服务端传输；用户若把摘要粘贴给维护者，属于主动分享。
- JS 事件不自动采集消息、URL、路径或堆栈，因此默认诊断**只提供问题类别和发生频次**，不能替代经过用户授权的复现步骤或脱敏截图。
- 进程被 Windows 强制终止、断电或在 Rust 初始化前直接崩溃，不保证一定写出事件；没有将“缺少正常退出日志”直接认定为崩溃。
- 目前只覆盖 Desktop 主进程和已加载页面。系统级 dump/minidump 及自动故障汇聚必须重新完成隐私与授权设计后才能增加。

## 回归门禁

1. `npm run test:desktop-diagnostics-regression`：检验原生/前端/设置的安全数据流，没有错误原文进入命令参数，手动复制不触发自动上传。
2. Rust `cargo test privacy_tests`：验证包含 `token-secret`、私有路径等恶意详情会被拒绝或丢弃，旧日志原文只作为类别计数，不进入报告。
3. `npm run build`、`npm run build:desktop`、`cargo fmt --check`、Desktop 完整 Rust 构建。
4. 手动在 Desktop 设置中点击“复制诊断摘要”，核对剪贴板仅含版本、平台及类别次数，且无网络请求。该动作**不模拟人为制造 panic**。
5. 升级旧设备时应另做日志历史风险提示与手动清理指引；当前不隐式删除用户既有诊断资料。

**本轮执行结果（2026-10-08）：** 网页严格构建与 Desktop Vite 构建 304 modules、`test:desktop-diagnostics-regression`、Rust `privacy_tests` 2/2、原生完整 gnullvm Desktop build、Rust fmt 和 `git diff --check` 均通过；新的 Desktop EXE 已启动并检测到主窗口与桌宠。由于用户剪贴板可能有未保存内容，本轮不自动点击“复制诊断摘要”，此项列入人工终验。

下一项：按照 Stage 6 计划量测**启动时间、内存、CPU 空闲占用、Canvas 与关键操作耗时**；性能采样不得依赖新增静默用户画像。
