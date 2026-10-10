# Browser Companion · 新手安装与一次性账号配对

> 2026-10-10 Browser Companion v0.4.0 实现基线。属于 Stage 6 用户体验插单，不能替代正式上架/实机认证验收。

## 用户流程

1. 在 FlexiKit 工作台或工具箱点「浏览器快速添加」。新手默认看到「浏览器一键添加」和「直接添加网址」。
2. 已发布并配置官方商店详情页时，才显示真正的商店跳转。普通 Chrome/Edge 网页可识别当前浏览器；Windows Tauri 使用 WebView2，**不可据此猜用户默认浏览器**，因此显示可用的 Chrome/Edge 两个选项。
3. 还未上架时准确显示「浏览器扩展尚未正式上架」，不提供指向无效地址的虚假安装按钮。普通用户无需开发者模式，可直接通过旧有 WebToolImportModal 粘贴网址、自动识别并保存。
4. 扩展安装后，首次需要手动允许对所配置的 API 主机访问。选择「连接已登录的 FlexiKit」，扩展显示有效期 5 分钟的 10 位配对码。
5. 已登录 FlexiKit 的用户打开「浏览器快速添加 → 已安装扩展」，**仅核对本人扩展刚生成的代码**并确认。扩展弹窗打开时定时检查；若关闭后重新打开，可恢复本次配对进度。
6. 连接成功后，扩展获得独立 `extension` Refresh Session。之后打开需要收藏的网站，点扩展图标自动保存，不切换页面；右键也可直接添加。密码登录收于次级折叠区域作后备。
7. 用户可通过已有设备/会话管理撤销该扩展会话；设置页可退出。不自动添加到 Canvas、不修改用户布局。

## 商店 URL 配置

仅在扩展**实际发布并得到商店 ID**后，给前端的编译/发布环境设置：

```env
VITE_CHROME_EXTENSION_STORE_URL=https://chromewebstore.google.com/detail/flexikit/<real-chrome-extension-id>
VITE_EDGE_EXTENSION_STORE_URL=https://microsoftedge.microsoft.com/addons/detail/flexikit/<real-edge-extension-id>
```

此处尖括号为占位说明，绝不可原样配置；具体店铺详情页路径以真实上架 URL 为准。程序仅接受 HTTPS、官方域名和合法扩展详情页的 32 字母扩展 ID，不接受自定义域、重定向参数、带搜索字符串的外链。若尚未配置或格式非法，则永远不显示该商店按钮。后台生产 CORS 仅允许正式扩展 ID 的确切 `chrome-extension://<id>` Origin，不能写 `*`。

## 后端一次性配对契约

路由均受现有 URL API 版本前缀 `/v1` 约束：

- `POST /auth/extension-pair/start`：扩展未登录发起，体 `{client_instance_id:UUIDv4, verifier:43-char-random-base64url}`；返回 `{code, expires_at}`。
- `POST /auth/extension-pair/approve`：**必须带登录 JWT** 的 FlexiKit 客户端提交 `{code}`；只有账号本人显式确认时才将 pending code 绑定到该账号。
- `POST /auth/extension-pair/complete`：扩展提交相同 `code, client_instance_id, verifier`，待确认时返回 `{status:'pending'}`；通过后返回 `{status:'connected',auth:AuthResult}`。领取操作与建立新 `refresh_sessions` 在**同一数据库事务**完成，一次码不可重复领取。

数据库迁移 `backend/src/migration/1791600000000-AddExtensionPairings.ts` 新增 `extension_pairings`，不修改原有账号、工具表或现有 Session。表设配对随机码 PK、设备 ID、仅 SHA-256 保存的随机验证密钥、到期时间、已审批用户、已消费时间与失败计数。到期记录由新请求清理。按设备限制同时最多 3 个 pending，进程内按来源每分钟最多 8 次 start，全局未消费 live 1500，错误密钥 5 次失效。10 字符代码使用 32 字符字母表（50 位），但**展示码本身绝不可作为可兑换令牌**；必须同时具备扩展保存的 256 位验证密钥，且有登录用户的 JWT 审批。

扩展设备密钥只保存在 `chrome.storage.session` 的临时状态中，不同步至浏览器账号、不放入普通网页。扩展长期独立 Refresh Token 仍按既有 `chrome.storage.local` 安全基线。弹窗关闭可以重新打开继续，浏览器重启后待配对状态丢失，需要重新开始。切换 API 服务/登出会清理待配对信息。

**警惕配对码钓鱼**：只批准自己安装的正版扩展刚显示的代码；不要批准聊天消息或第三方网页发来的代码。正式发布仍需认证 Origin 校验、网关/分布式限流、异常审计和配对请求监控。

## 2026-10-10 / Stage6 后续隔离验证补充

已在全新 TEMP 后端源码副本安装依赖并完成真正 `npm run build` + `tsc --noEmit`，Browser Extension / Multi Client / Extension Pair Mock 回归也通过，说明此前 Nest CLI/TS 类型缺包的**源码编译阻塞在隔离环境已解除**。这**不等于原来的 backend/node_modules 被修复**，也不等于实际浏览器配对、账号刷新或迁移已在生产后端 E2E 跑通。Docker daemon 状态查询超时，未在全新 PostgreSQL 实际执行 `extension_pairings` up/down；仍不得宣称配对正式可用。隔离证据见 [STAGE6_BACKEND_ISOLATED_VERIFICATION.md](STAGE6_BACKEND_ISOLATED_VERIFICATION.md)。

## 2026-10-10 / 实际 PostgreSQL 配对事务补充验证

此前 Docker 受阻的隔离 PG migration 门槛已有后续进展：通过 TEMP UUID 新建的 PostgreSQL **18.4** 测试实例，3 个原迁移 up/down、FK/index、真实 TypeORM 悲观锁、并发审批/同码领取只签发一条 extension Refresh Session、错密钥锁定及签发异常回滚后重试均 PASS；测试实例已停止并删除。**目标 PostgreSQL 16 的版本兼容和生产完整 AppModule HTTP、Chrome/Edge 扩展 E2E 仍待验证**；不能将这次隔离 PG18 测试称为正式配对可用。见 [STAGE6_POSTGRES_PAIRING_VERIFICATION.md](STAGE6_POSTGRES_PAIRING_VERIFICATION.md)。

## 当前验证与发布门禁

- 扩展 `npm run build` 和新增模拟后端测试：创建、重复、撤销、编辑、右键、并发 Refresh、配对开始/待确认/成功/取消、配对临时密钥不进 localStorage。
- 前端 `npm run build`（Vue 类型检查 + Vite）和 `npm run test:browser-companion-onboarding-regression`，含商店 URL 白名单、Chrome/Edge 识别、WebView2 例外、无扩展 fallback。
- 后端 `npm run test:extension-pair-regression`：TypeScript 语法转译 + Mock DB 生命周期，检查生成、过期、待确认、JWT 签发同事务传参、一次消费、非法设备限次、频率限制。**这不是真实 PostgreSQL、Nest 启动或浏览器 E2E。**
- **未完成：** 本机后端 `nest build` 因 `backend/node_modules/@nestjs/cli/commands` 缺失而无法编译；真实 TypeORM 迁移未在隔离 PostgreSQL 执行，未在 Chrome/Edge 真实界面安装和连接。补足依赖后必须先做真正 Nest 构建、迁移 up/down、权限/并发测试、登录/注销 E2E，再考虑正式发行。
- 目前没有 Chrome Web Store/Edge Add-ons 实际商店详情页。扩展商店账号、上线 ID、审核、截图和隐私声明仍是发行阻塞项。不得宣传为已上架或已完成真正一键安装。

本轮保护原有数据、Canvas、主窗缩放暂停任务和安装程序，不执行数据库迁移，不覆盖安装版、不提交或推送 Git。
