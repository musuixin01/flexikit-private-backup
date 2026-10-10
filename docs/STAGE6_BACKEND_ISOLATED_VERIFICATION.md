# Stage 6 · 后端隔离编译及真实 HTTP 安全验证（2026-10-10）

> **本轮验证的是源码与隔离 NestJS 测试服务，不是运行中的 FlexiKit 后端、正式 PostgreSQL、完整部署或真实浏览器。** 原项目 backend/node_modules、.env、数据库、桌面 EXE、Canvas Profile 均未写入/覆盖。本次不修改主线 Stage 6「性能指标」指针。

## 为什么要做

原项目 `backend/node_modules` 不完整（`@nestjs/cli/package.json`、`@nestjs/common/package.json`、`class-transformer/package.json` 均缺失），此前无法完成真正的 Nest 编译，浏览器配对/多客户端回归也因缺包中止。Stage 6 公测 P1 手动爬虫 10 个维护接口修复虽然通过源码+Mock，却尚未完成 Nest/HTTP 鉴权。

本轮在系统 **TEMP 下随机 UUID 隔离目录**中只复制 `backend/package.json`、`package-lock.json`、`tsconfig*.json`、`src/` 和选择的测试脚本，**不复制 `.env`**。隔离副本 `npm ci --ignore-scripts --no-audit --no-fund` 下载约 590 个开发依赖（已成功）。不在原项目运行 `npm ci`、`npm install`、`nest start`、数据库迁移或用户桌面操作。临时测试目录保留供后续核查，属于机器临时数据。

## 已验证结果（PASS）

1. **真正编译**：隔离目录执行 `npm run build`（Nest CLI）PASS，使用安装好的 TypeScript 执行 `tsc --noEmit --incremental false -p tsconfig.json` PASS。说明当前源码通过完整 TypeScript 检查；不代表 API 运行/数据库可用。
2. **真实 NestJS HTTP 守卫**：运行仓库 `backend/scripts/stage6-crawler-http-isolated.mjs`。它使用已编译的 `CrawlerController`、项目原有 `JwtAuthGuard`、`AdminAccessGuard` 与 `AdminAccessService` 和本轮 `CrawlerManualTriggerGate`，由 Nest `TestingModule` 启动只监听 `127.0.0.1` 随机端口的服务。**测试 JWT 密钥、Passport JWT Strategy、测试用户及 AdminAccessService Repository stub 是隔离专用**；10 个网络爬虫 Service 全部 stub，不调用任何外部网站、PostgreSQL 或 Redis。真实 HTTP 结果：未授权/无效 Token 401、普通用户/停用管理员 403、管理员 201、60 秒重复触发 429、另一来源在手动任务运行时 429；10 来源全部成功路由一次，等待任务结束恢复执行。PASS。
3. **后端现有回归**：安装完整依赖后原先受阻的 `test:browser-extension-regression` 和 `test:multi-client-regression` PASS；`test:extension-pair-regression` 的模拟数据库生命周期 PASS；`test:crawler-manual-security` PASS。爬虫脚本原本硬编码读取 `apps/web/node_modules/typescript`，在独立后端副本找不到，现改为优先读取后端自身 TypeScript，后备 Web 路径，恢复独立可运行性。
4. **源码与依赖隔离**：原仓库 backend node_modules 仍不完整且未改动；真实用户数据、Canvas、定时爬虫、已安装版均未接触。

## 仍未通过的发布门槛

- **PostgreSQL**：新 `extension_pairings` TypeORM 迁移未在全新隔离 PostgreSQL 做 up/down。Docker CLI 存在，但 `docker info` 本轮 35 秒超时，未确认可用 Docker daemon，因此没有启动 Docker 容器、访问真实数据库或执行迁移。浏览器配对仍缺数据库事务/并发及真实 Chrome/Edge 安装闭环 E2E。
- **真实全系统服务**：HTTP 测试是在最小 Nest 模块中注入真实守卫+模拟仓储/爬虫；不是完整 `AppModule` 配置或生产网关，也未使用正式用户和数据。不可宣称整个后台已上线。
- **跨进程安全**：`CrawlerManualTriggerGate` 为**单进程**互斥和 60 秒来源冷却；不与 cron 锁共用、不跨 Nest 实例，不主动取消超时任务。正式发布还需分布式限流、任务执行预算、审计日志及真实部署测试。
- **性能与发行**：本轮不测实际 Windows Release/DWM/GPU、100/125/150% DPI、7 日用户试测；Stage 6「性能指标」继续进行中。

## 2026-10-10 / 后续隔离 PostgreSQL 事务复验（新增进展）

本报告前述“Docker 状态查询超时，因此没有执行真实 PostgreSQL migration”是**当时的阶段事实**。此后发现正在运行的 PostgreSQL 18 服务，但**没有连接或改动它**；仅复用其安装目录中的工具二进制，在 TEMP 新建独立 PostgreSQL 18.4 测试集群，配合完整类型编译的真实 ExtensionPairingService/AuthService、3 份迁移、真实行锁并发审批/领取、事务回滚重试完成 PASS，测试集群已停机并清理，原服务仍运行。目标 PG16、正式 Nest HTTP 配对及 Chrome/Edge 端到端仍未测。详情见 [STAGE6_POSTGRES_PAIRING_VERIFICATION.md](STAGE6_POSTGRES_PAIRING_VERIFICATION.md)。

## 可重复执行的安全步骤

**仅在独立目录**（先复制源码和 lockfile，不拷贝任何本地账户秘密、`.env` 或数据库）运行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
.\node_modules\.bin\tsc.cmd --noEmit --incremental false -p tsconfig.json
npm run test:browser-extension-regression
npm run test:multi-client-regression
npm run test:extension-pair-regression
npm run test:crawler-manual-security
npm run test:stage6-crawler-http-isolated
```

最后一项由 `backend/scripts/stage6-crawler-http-isolated.mjs` 提供，在同进程真实启动 Nest 测试 HTTP 并自动关闭，只访问 `127.0.0.1` 随机端口。确认端口不对外公开。**不要在用户现有 backend 目录中运行 `npm ci`，也不要在真实数据库上执行迁移作试验。**

详细产品发布约束见 `docs/TECH_DEBT.md`、`docs/STAGE6_PERFORMANCE.md` 和 `docs/BROWSER_COMPANION_ONBOARDING.md`。
