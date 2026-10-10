# Stage 6 · Browser Companion 真正 PostgreSQL 事务验收（2026-10-10）

> **PASS：只针对本次临时 PostgreSQL 18.4 实例的数据库迁移与 TypeORM 配对事务。** 生产基线 PostgreSQL 16 尚需兼容验证；不是完整 Nest HTTP + Chrome/Edge 扩展端到端验收，也没有使用正式用户或数据库。

## 隔离与数据安全

本机发现原有 `postgresql-x64-18` 服务正在运行。**没有连接它、读取它的配置秘密或操作它的数据目录**，也没有使用此前超时的 Docker daemon。仅复用已安装的 `initdb.exe`、`pg_ctl.exe` 等 PostgreSQL 二进制，在 Windows TEMP 新建名称为 `flexikit-stage6-pg-<32位随机ID>` 的独立数据目录；随机可用端口仅监听 `127.0.0.1`，账号为临时 `stage6_test`，密码是全新随机值，SCRAM-SHA-256。独立 backend 编译副本位于 TEMP，不复制 `.env`，不触及仓库正在使用的 `backend/node_modules`。

测试 Node 脚本采用**双重防护**：要求显式 `FLEXIKIT_STAGE6_TEMP_PG=isolated-test-only`，并查询 `SHOW data_directory` 精确对比指定 TEMP UUID 数据目录及固定测试角色 `stage6_test`。验证条件不满足即拒绝执行任何表结构修改。每次测试都创建新集群，用完 `pg_ctl -m fast stop`，确认对应测试进程退出才删除自己的随机临时目录。历史正式 PostgreSQL 服务的状态在测试前后均为 Running。

首次直接启动 `pg_ctl start` 在远程命令执行环境因后台子进程继承输出流而超时，已检查后仅清理对应临时实例；随后采用 `Start-Process` + 明确输出重定向 + `pg_isready` 轮询，确保测试及安全清理执行完毕。第二次测试出现 TypeORM DataSource 参数错误：`pg` 使用 `user`，但 TypeORM 连接配置使用 `username`，导致 TypeORM 在迁移已于独立临时集群执行、准备创建连接池时以 Windows 用户名认证失败；出错集群随后已安全停止并清理，未触及现有数据库。已修正独立脚本后重新完成完整验证。上述异常已记入 `.agents/skills/errors-log.md`。

## 真实测试范围

执行的真实原项目代码（来自隔离 Nest CLI 编译的 `dist`）：

- `AddRefreshSessions1790298000000.up/down`、`AddRefreshSessionClientContext1790299800000.up/down`、`AddExtensionPairings1791600000000.up/down`。
- 实际 `ExtensionPairingService.start/approve/complete` 和 `AuthService.login`（正式的刷新会话材料生成及真实事务仓储）。
- 真正 `pg` 和 TypeORM PostgreSQL 连接/连接池，`pessimistic_write` 行锁，在真实并发查询中序列化操作。
- 独立测试使用最小 `users` 表（仅测试用户，所有数据合成）以及 `EntitySchema` 描述与业务实体相同的相关字段和表名。这测试**真实 SQL、真实服务方法与数据库语义**，但不等于生产全部 TypeORM Entity 关系/全表迁移或完整 AppModule/HTTP 路径已经 E2E。

已通过的断言：

1. 上述 3 份真实迁移 `up` 可执行，配对表字段数、索引及指向 `users(id)` 的 FK 约束正确；非法引用触发 PostgreSQL `23503`。
2. 配对码生成后未确认状态 `pending`；**两次并发审批**中只有一次成功，另一条被冲突拒绝。
3. 两个并发配对领取请求作用于同一个已批准的配对码，PostgreSQL 的真实写锁保障**恰好一个成功，另一个被拒绝**；成功请求签发一条独立 `extension` Refresh Session，记录正确设备 UUID 与 `consumed_at`。
4. 错误设备密钥连续尝试 5 次，`failed_claims=5`、配对码过期，无额外 Refresh Session。
5. 模拟在已标记领取后会话签发出错：数据库**回滚 `consumed_at`**，不增加会话，之后同码仍可正常领取并创建会话，验证事务原子性与可恢复性。
6. 完成测试后，执行真实迁移 `down`，`extension_pairings` 表已不存在，清理其余测试表/临时数据库；独立 PG 实例安全停止、对应数据目录已删除。未操作原有数据库。

## 可重复执行

先在**隔离后端副本**（通过原 backend 的 package.json、package-lock.json、tsconfig*.json、src 拷贝到 TEMP，绝不复制 .env）执行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
```

在 FlexiKit 仓库根目录运行（PowerShell）：

```powershell
.\backend\scripts\run-stage6-postgres-isolated.ps1 -IsolatedBackendRoot "C:\Users\<username>\AppData\Local\Temp\flexikit-stage6-isolated-<UUID>"
```

其中隔离 backend 路径必须为真实由开发者准备的独立 TEMP UUID 目录，脚本主动校验路径格式、编译依赖与测试脚本。默认使用本机 PostgreSQL 18 bin 路径，也支持 `-PostgresBin <path>` 指向 PostgreSQL 安装工具目录。主入口仅在独立 TEMP 后端和独立新建的 TEMP PG 上运行；严禁配置成真实现有数据库、不得自行改动现有 Windows PostgreSQL 服务。

测试文件：`backend/scripts/stage6-extension-pair-postgres-isolated.mjs`（含环境与真实 data_directory 二次断言）、`backend/scripts/run-stage6-postgres-isolated.ps1`（受限临时集群生命周期）。

## 尚待正式发布的门槛

- PostgreSQL **16** 的兼容性；本轮是实际安装的 **18.4**，不能标记为 PG16 通过。
- 完整 `AppModule` 与真实 HTTP 配对 Start → JWT Approve → Complete → Refresh → Revoke 的集成测试；真实 Chrome/Edge 扩展安装、升级、权限、错误提示和 UX。
- 爬虫/配对多实例分布式限流、审计告警与密钥/CORS 域名管理；独立 Session 的生产安全性、官方商店发布。
- Windows Desktop Release、WorkerW/DWM/GPU、各 DPI 和 6–10 人 7 日试用仍归 Stage 6 主线，不因本轮后端成功改变阶段指针。

相关文档：`docs/STAGE6_BACKEND_ISOLATED_VERIFICATION.md`、`docs/BROWSER_COMPANION_ONBOARDING.md`、`docs/TECH_DEBT.md`。
