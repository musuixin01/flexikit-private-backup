# FlexiKit API Architecture Migration Plan

## 当前状态

API Client 第一轮迁移已经完成：

- 唯一 Axios 实例：`apps/web/src/api/client.ts`
- `apps/web/src/api/index.ts` 只负责统一导出
- 各业务 API 直接依赖 `client.ts`
- 旧 `apps/web/src/api/apiClient.ts` 已删除
- Token key 已统一为 `token`
- API 循环依赖构建警告已消除

## 迁移目标

建立唯一 API Client：

```
apps/web/src/api/
├── client.ts
├── auth.ts
├── users.ts
├── tools.ts
├── discovery.ts
└── stats.ts
```

## 执行原则

1. 不一次性替换所有调用
2. 保持现有功能可用
3. 先建立兼容层
4. 页面逐步迁移
5. 删除旧入口前完成构建验证

## 第一阶段（已完成）

- [x] 确认所有 API 调用位置
- [x] 建立核心 API 输入/响应类型
- [x] 保留现有业务逻辑
- [x] API TypeScript `tsc --noEmit` 验证通过
- [x] Vue SFC / Vite 完整构建复验（后续 S4.1 与 Stage 6 已反复通过 Web/Desktop 构建，早期阻塞已非当前状态）

## 第二阶段（已完成）

- [x] 迁移认证拦截器到唯一 Client
- [x] 删除重复 Axios Client
- [x] 消除 API 模块循环依赖
- [x] 建立统一 API 错误响应类型、网络错误判断和 message/details 解析 helper；S4.1 已补齐 Backend 稳定 machine code、Validation details 与未知 500 脱敏
- [x] 补齐 auth / tools / users / discovery / categories / favorites / stats 主要响应类型
- [x] 迁移页面中绕过统一 Client 的直接 `fetch` 调用；业务 API 请求统一经过 `client.ts`

## 第三阶段（已完成，保留迁移历史）

- [x] 接入统一后端成功响应 envelope：`{code:0,message:'success',data}`；Web 唯一 Axios Client 自动解包，业务 API 类型继续表示 `data` 内部结构
  - 错误响应见 `docs/API_ERROR_CONTRACT.md`；成功响应见 `docs/API_RESPONSE_CONTRACT.md`。二者保持独立，raw/binary endpoint 必须显式 `@RawResponse()`
- [x] 完善并校准 API 文档
- [x] 接入 URI API Versioning V1：新 Web/Desktop Client 默认 `/api/v1` / `/v1`，Backend 暂留无版本兼容 alias；破坏性变更必须进入 V2，详见 `docs/API_VERSIONING.md`
- [x] Access Token 生命周期收敛：新部署默认 30m，登录/注册返回过期元数据，Web 主动过期检查；详见 `docs/ACCESS_SESSION_LIFECYCLE.md`
- [x] Refresh Token rotation / reuse detection：opaque token + server session/hash、`POST /auth/refresh`、Web single-flight 自动续期，详见 `docs/REFRESH_SESSION_LIFECYCLE.md`
- [x] Windows Desktop Token 安全存储：Tauri + DPAPI Current User，Access/Refresh 不再持久化到 Desktop Web Storage；历史明文 Token 自动迁移并清理，详见 `docs/DESKTOP_AUTH_STORAGE.md`
- [x] 多端登录 Session 契约：Web/Desktop/未来 Mobile 独立 Refresh Session + client metadata + session_id，旧客户端兼容且跨端登录不隐式 revoke，详见 `docs/MULTI_CLIENT_AUTH.md`
- [x] 设备管理：Access JWT `sid` 绑定 Session；受保护 Session list / revoke-other API + Profile 登录设备面板，响应不暴露 Token/hash，详见 `docs/DEVICE_MANAGEMENT.md`
- [x] 服务端登出 / 即时 Session 吊销：`POST /auth/logout` 撤销当前 Session，sid-bound Access 在 JwtStrategy 中强制校验 Session active；logout/device-revoke/replay 后旧 Access/Refresh 均立即 401，详见 `docs/LOGOUT_REVOCATION.md`
- [x] Web HttpOnly Refresh Cookie / 持久认证边界：Browser Access memory-only，Refresh 使用 HttpOnly + SameSite=Strict Cookie，生产 Secure；cookie mode JSON 不返回 refresh_token，旧 Web Storage Token 迁移后删除；Desktop 继续 DPAPI / body Refresh，详见 `docs/BROWSER_AUTH_STORAGE.md`
