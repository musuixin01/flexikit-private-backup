# FlexiKit Roadmap

> 本文档只描述产品方向。具体“现在做到哪、下一步做什么、阶段完成门槛”统一以 [MASTER_PLAN.md](./MASTER_PLAN.md) 为准。

## 项目定位

FlexiKit 的目标定位是 AI 驱动的个人数字工作空间，而不仅是工具导航站。

核心方向：

- 工具发现
- 工具管理
- AI 推荐
- 桌面入口
- 个人效率工作流

## Phase 0 - 稳定基础

- 完成 Web / Backend / Desktop 构建验证
- 建立 v0.1 Stable 版本
- 固化开发流程
- 保证核心功能可回归测试

## Phase 1 - 架构治理

- 统一前端 API Client
- 优化 Token 管理
- 统一后端响应格式
- 提升 TypeScript 类型覆盖
- 清理历史技术债

## Phase 2 - 智能化能力

- 用户行为分析
- 工具标签体系优化
- Embedding Pipeline
- pgvector 相似度搜索
- AI 工具推荐

## Phase 3 - 桌面生态

- [x] 保留并继续演进桌宠入口
- [x] 建立 Desktop Canvas 自由小组件底座
- [x] Widget Registry、自由布局与持久化
- [x] 首批 Clock / Search / Launcher / Disk 组件
- [x] Windows 桌面层挂载（WorkerW + Win11 Progman fallback；真实 HWND 父层烟测通过）
- [x] Widget 原生 HRGN 区域交互 + 桌面空白穿透（Complex Region 运行态烟测通过，完整鼠标交互回归待完成）
- [x] Explorer 桌面层自动恢复 watchdog（父层失效/变化后自动 reattach、恢复尺寸与 HRGN）
- [x] 多显示器 / DPI 布局底座（Monitor 拓扑、Widget `monitorId`、v2 持久化迁移、主屏编辑 UI；真实多屏回归待完成）
- [x] Widget Shift 多选、自由组合 / 拆分与组合联动移动
- [x] Canvas 20px 栅格布局（默认排布、拖动/缩放吸附、新增 Widget 自动找空位、一键整理）
- [x] Launcher 软件网格与拖拽排序修复（整块图标拖动、WebView fallback、固定单元尺寸）
- [x] Launcher 小组件 → 快速启动中心 → 全应用 Launchpad 三级展开
- [x] Launcher 常用应用自定义、添加/移除与拖拽排序
- [x] Widget 外观 Inspector V2（4 个中性预设、深/浅/跟随色调、透明度、圆角、模糊、表面浓度、边框、阴影、锁定；手动调节自动进入自定义）
- [x] Registry 驱动的 Widget 用户配置系统（boolean / select / range / text、默认值、恢复默认、持久化；内部数据与公开设置隔离）
- [x] Todo Widget（独立配置持久化）
- [x] Clipboard Widget（按需读取/写入，不持久化剪贴板文本）
- [x] Music Widget（GSMTC 当前媒体信息、播放进度、系统媒体控制）
- [x] Music 可选歌词（LRCLIB 同步 LRC / 普通歌词、逐行高亮、不持久化歌词正文）
- [x] AI Prompt 快捷台（复制 Prompt + 打开指定 AI 工具）
- [x] 桌宠 → Canvas Widget 组件库直接联动
- [ ] 全局工具搜索
- [x] 原生桌面 AI 助手基础版（S5.2 已接入 Provider / Model Router、BYOK、用户明确授权的工具/文件/剪贴板上下文；高级多模态、工具调用和持久会话并未包含，见 [AI_ASSISTANT.md](AI_ASSISTANT.md)）

## Phase 4 - 商业化基础

详细策略见 [MONETIZATION.md](./MONETIZATION.md)。

- [x] 确定 Free / Pro / AI Pro 基础商业化原则
- [x] 确定核心桌面体验永久免费，不通过 Widget 数量等人为限制逼迫付费
- [x] 确定 AI Credits / BYOK 与本地 Pro 分离
- [ ] Account / Subscription / License 数据模型
- [ ] Entitlement Service 与 Feature Flags
- [ ] Founder Pro 早期用户方案
- [ ] 支付、恢复购买、退款 / 撤销授权
- [ ] AI Credits 与成本治理
- [ ] 跨设备同步
- [ ] 团队工具空间
- [ ] 企业工具管理
- [ ] v1.0 正式商业化发布
