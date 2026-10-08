# FlexiKit Windows gnullvm 构建与运行时依赖

## 现状

本机 MSVC C++ 开发组件不完整时，Desktop 调试版可通过 Windows gnullvm + Windhawk Clang 工具链构建。当前工具链产物的 EXE 导入表把 LLVM unwind 运行库命名为 **libunwind.whl**；尽管后缀为 .whl，实际文件是 Win64 的 unwind 动态库副本，并非 Python wheel。Windows 加载程序按导入表查找这个确切文件名，只有 libunwind.dll 不足以启动。缺失时系统错误码为 0xC0000135。

## 构建与依赖自动部署

在仓库根目录运行（完整重编前先关闭正在运行的该路径 FlexiKit，否则 EXE 会被 Windows 锁定；脚本会提前阻止覆盖）：

```powershell
npm run build:desktop:gnullvm
```

这会先构建 Desktop 前端，再用已配置的 gnullvm/Clang 目标进行 Rust 构建，最后将对应版本的 libunwind.whl 自动放到 flexikit-desktop.exe 同级目录，并校验 SHA-256；WebView2Loader.dll 缺失时也会报错，而不是提供无法启动的 EXE。

已有构建产物只需补齐依赖时可以执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-gnullvm-build.ps1 -SkipBuild
```

默认产物位于 D:\AI_Cache\flexikit-gnullvm-target\debug\，这三个文件必须一并保留：

- flexikit-desktop.exe（主程序）
- WebView2Loader.dll（WebView2 加载器）
- libunwind.whl（当前 gnullvm 调试构建的 unwind 动态库）

可以通过 TargetDir、CompilerRoot、WindresDir 参数按实际安装位置覆盖默认值。Release 参数可编译 release profile，但**正式 MSI/NSIS 发布仍需针对对应编译目标单独核验依赖打包与许可证**；本脚本不意味着已完成干净 VM 安装测试。

## 与桌面快捷方式的区别

现有公共桌面快捷方式目标为 D:\Own_Tools\Flexikit\flexikit-desktop.exe，是一份较早安装版本，不是上面的开发测试 EXE。本次没有擅自更改旧快捷方式或覆盖安装目录。验证新窗口缩放修复时，应打开同一构建目录的最新版，避免混用旧程序与新程序。

## 实测及限制（2026-10-08）

- 首次诊断证实 D:\AI_Cache\flexikit-gnullvm-target\debug 中缺少 libunwind.whl，补齐后与原编译器库的 SHA-256 一致。
- PowerShell 构建脚本使用 SkipBuild 进行依赖部署回归：通过。
- 不向 PATH 添加任何临时运行库目录，直接启动新 EXE 连续运行 8 秒：通过；之后通过计划任务启动进程，确认真实路径是 D:\AI_Cache\flexikit-gnullvm-target\debug\flexikit-desktop.exe。
- 主工作台因继承最小化窗口状态而不可见，手动恢复后能够正常显示；这不是 DLL 加载失败。
- 当前主窗口配置为 opaque + native shadow disabled，相关静态结构回归通过。**窗口缩放过程的黑白闪块问题仍待用户手动快拖确认，不能仅凭静态截图或 DLL 修复标记完成。**

不提交编译器 DLL 或 debug EXE 到 Git，也不修改用户已有的安装版或真实工具数据。
