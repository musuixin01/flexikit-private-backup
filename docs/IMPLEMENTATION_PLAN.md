# FlexiKit Implementation Plan

> 本文档保留历史 Sprint 和技术实施背景，不再作为“下一步任务”的唯一依据。当前执行阶段和任务顺序统一以 [MASTER_PLAN.md](./MASTER_PLAN.md) 为准。

## 当前阶段

目标：从可运行项目推进到可长期维护和持续演进的平台。

原则：

- 文档先行
- 小步修改
- 每次修改保持可验证
- 优先解决架构稳定性问题

---

# Sprint 1 - v0.1 Stable 基线

## 目标

建立稳定开发基线，避免后续功能开发破坏已有能力。

当前进度：Web / Backend / Tauri 编译与核心运行时回归均已完成；optimized release、x64 MSI/NSIS、本机隔离安装/卸载、0.1.0 → 0.1.1 覆盖升级和 localStorage 用户数据保留均已通过。自动更新安全架构、Desktop SemVer 门禁与本地诊断日志也已落地并验证。Stage 2 当前仅剩真实干净 VM / 新机器安装路径的最终外部环境回归。

## 任务

### 1. 构建验证

- Web 构建
- Backend 编译
- Desktop(Tauri) 构建
- 数据库迁移验证

### 2. 核心流程回归

验证：

- 用户注册登录
- 工具管理
- 收藏功能
- 发现页
- 本地工具启动
- 桌面窗口交互

---

# Sprint 2 - 架构治理

## API 层

目标：

- [x] 单一 API Client
- [x] 统一错误处理（全局异常过滤器、稳定错误码与验证详情，参见 `API_ERROR_CONTRACT.md`）
- [x] 统一请求拦截

## Authentication

目标：

- 优化 Token 生命周期
- 为 Web/Desktop/Mobile 多端扩展准备

## 类型系统

目标：

- [x] 清理 API 层主要 any
- [x] API TypeScript 基础检查恢复为可通过基线
- [x] Vue SFC `vue-tsc` 当前复验通过
- [x] Web/Desktop 前端包管理统一为 npm，并建立 `npm ci` 可重复安装基线
- [x] 后端 Controller / Service 显式 `any` 清理与类型审计门禁（S4.1 已完成，后续继续回归）

---

# Sprint 3 - AI 能力

## 推荐系统

阶段一：

- 标签匹配
- 热度排序
- 用户行为

阶段二：

- Embedding Pipeline
- pgvector 检索
- AI 推荐解释

---

# Sprint 4 - Desktop Evolution

目标：

让桌面端成为 FlexiKit 的主要入口。

方向：

- [x] Desktop Canvas 自由布局底座
- [x] Widget Registry 与持久化
- [x] 桌宠与 Canvas 互通入口
- [x] Windows 桌面层挂载（WorkerW + Progman fallback；真实父窗口烟测通过）
- [x] 区域穿透桥接（代码与编译验证完成）
- [ ] 透明区域 / Widget 点击 / Explorer 重启 / DPI 实机交互回归
- [x] Widget 多选、组合 / 拆分、组合联动移动
- [x] Launcher 三级展开与 Launchpad 搜索 / 分类
- [x] Widget 外观 Inspector
- [x] Todo / Clipboard / Music / AI Prompt Widget
- [x] Windows 原生剪贴板桥与系统媒体控制命令
- [x] Windows GSMTC 当前媒体元数据 / 时间轴读取
- [x] Music Widget 可选 LRCLIB 同步歌词与逐行高亮
- [ ] 全局搜索
- [x] 原生 AI 助手基础版（S5.2 已接入统一 Provider/Model Router；不代表完整 AI Agent）

---

# Sprint 5 - Monetization Foundation

目标：

在不破坏 Free 完整体验的前提下，为 v0.8 商业化测试和 v1.0 正式收费建立基础设施。

策略见 [MONETIZATION.md](./MONETIZATION.md)。

- [x] 定义 Free / Pro / AI Pro 产品边界
- [x] 明确 AI Credits / BYOK 方向
- [x] 明确 Founder Pro 只覆盖本地永久权益
- [ ] Account / Subscription / License 数据模型
- [ ] Entitlement Service
- [ ] Feature Flags / capability keys
- [ ] Desktop 离线权益缓存与宽限期
- [ ] 设备管理与恢复购买
- [ ] 支付订单服务端校验
- [x] AI Provider Token 与成本估算基线（S5.1 已实现，仍需持续刷新价格表）
- [ ] AI Credits
- [ ] v0.8 小规模付费测试
- [ ] v1.0 正式商业化门槛检查

---

# 执行规则

每次开发：

1. 检查当前状态
2. 阅读相关代码和文档
3. 最小范围修改
4. 构建验证
5. 更新 CHANGELOG
