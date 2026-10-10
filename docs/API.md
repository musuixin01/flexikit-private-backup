# API 文档

FlexiKit RESTful API 文档。NestJS 后端没有全局 `/api` 前缀；Web 的 Vite 代理移除外层 `/api`。**规范 API 路由为 `/v1/*`**；本文下列不带 `/v1` 的路径是仍可访问的历史兼容别名，新客户端一律使用 `/v1/*`。见 [API_VERSIONING.md](API_VERSIONING.md)。

**示例说明：** 除明确标注的原始二进制响应外，本文各接口的 JSON 响应示例展示的是成功信封中的 `data` 业务内容，而不是原始完整 HTTP 响应。

## 通用说明

### 基础 URL
- 后端直连开发环境：`http://localhost:3001/v1`
- Web 开发环境：前端默认请求 `/api/v1`，Vite 将 `/api/v1/*` 代理为后端 `/v1/*`。
- 生产环境：是否使用 `https://yourdomain.com/api` 取决于 Nginx/网关配置；NestJS 自身当前不添加 `/api` 前缀。

### 认证方式
除了特别说明的公开接口，其他接口需要在 Header 中携带 JWT Token：
```
Authorization: Bearer <your_access_token>
```

### 响应格式
后端已启用全局 `ApiResponseInterceptor`。普通 JSON 成功响应统一为：
```json
{
  "code": 0,
  "message": "success",
  "data": { "items": [], "total": 100 }
}
```
成功信封 `code` 固定为 `0`，HTTP 200/201 等状态仍独立生效。Web 统一 Axios Client 自动解包 `data`；显式 `@RawResponse()` 的图片/流式接口不包装。详见 [API_RESPONSE_CONTRACT.md](API_RESPONSE_CONTRACT.md)。

### 错误响应
```json
{
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "错误信息",
  "error": "Bad Request"
}
```

### 通用状态码
- `200 OK`：请求成功
- `201 Created`：创建成功
- `400 Bad Request`：请求参数错误
- `401 Unauthorized`：未认证或Token过期
- `403 Forbidden`：无权限
- `404 Not Found`：资源不存在
- `500 Internal Server Error`：服务器错误

---

## 认证接口

### POST /auth/register
用户注册

**请求体**：
```json
{
  "username": "string (3-20位字母数字下划线)",
  "email": "string (邮箱格式)",
  "password": "string (6-32位)"
}
```

**响应**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### POST /auth/login
用户登录

**请求体**：
```json
{
  "username": "string",
  "password": "string"
}
```

**响应**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 用户接口

### GET /users/profile
获取当前用户信息（需要认证）

**响应**：
```json
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "displayName": "测试用户",
  "avatar": "😀",
  "avatarType": "emoji",
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

### PUT /users/profile
更新用户资料（需要认证）

**请求体**：
```json
{
  "displayName": "新名称",
  "avatar": "data:image/png;base64,...",
  "avatarType": "upload"
}
```

### GET /users/export-data
导出当前用户及其关联工具、收藏、排序和分类数据（需要认证）。

### DELETE /users/account
永久删除当前用户及其关联数据（需要认证，不可逆）。

---

## 工具接口

### GET /tools
获取工具列表（可选认证）

**查询参数**：
- `category`: 分类名称
- `search`: 搜索关键词
- `favorite`: 是否只看收藏（true/false，需要认证）
- `limit`: 每页数量，默认50
- `offset`: 偏移量，默认0

**响应**：
```json
{
  "items": [
    {
      "id": 1,
      "name": "工具名称",
      "url": "https://example.com",
      "description": "工具描述",
      "category": "效率工具",
      "tags": ["标签1", "标签2"],
      "icon": "https://...",
      "is_custom": false,
      "local_path": null,
      "view_count": 100,
      "click_count": 50,
      "favorite_count": 10,
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "total": 100
}
```

### POST /tools
创建自定义工具（需要认证）

**请求体**：
```json
{
  "name": "我的工具",
  "url": "https://example.com",
  "description": "工具描述",
  "category": "效率工具",
  "tags": ["标签"],
  "icon": "https://...",
  "local_path": "C:\\path\\to\\exe"
}
```

### GET /tools/:id
获取单个工具详情

### PUT /tools/:id
更新工具（需要认证，只能更新自己的工具）

### DELETE /tools/:id
删除工具（需要认证，只能删除自己的工具）。

### DELETE /tools/batch
批量删除当前用户自己的工具（需要认证）。

> 本地程序启动不再通过 Backend HTTP API 暴露。Desktop 端使用 Tauri `open_local_path` IPC 在用户本机执行。

**请求体**：
```json
{
  "ids": [1, 2, 3]
}
```

### GET /tools/favicon
获取网站favicon（公开接口）

**查询参数**：
- `url`: 网站URL

**响应**：图片二进制流

### GET /tools/preview
获取网站标题、描述、预览图和主题色（公开接口）。

### GET /tools/local-icon
获取本地文件图标（需要认证）

**查询参数**：
- `path`: 本地文件路径

**响应**：
```json
{
  "icon": "data:image/png;base64,..."
}
```

### GET /tools/recommend-tags
智能推荐标签（公开接口）

**查询参数**：
- `name`: 工具名称
- `url`: 工具URL
- `description`: 工具描述

**响应**：推荐项数组。
```json
[
  {
    "tag": "效率",
    "score": 0.92,
    "source": "keyword"
  }
]
```

### GET /tools/all-tags
获取当前标签词库（公开接口）。

### GET /tools/rankings
获取工具排行榜

**查询参数**：
- `period`: today/week/month/all
- `limit`: 返回数量，默认10

---

## 分类接口

### GET /categories
获取分类列表（可选认证）。

- 未登录：返回内置/全局分类。
- 带合法 JWT：返回内置分类 + 当前用户分类。

### POST /categories
创建当前用户分类（需要认证）。

### PUT /categories/order
按分类 ID 数组更新当前用户分类顺序（需要认证）。

**请求体**：
```json
{
  "order": [3, 8, 12]
}
```

### PUT /categories/:id
更新当前用户自己的分类（需要认证）。

---

## 收藏接口

### GET /favorites
获取当前用户收藏的工具 ID 数组（需要认证）。

### POST /favorites/:toolId
添加收藏（需要认证）。

### DELETE /favorites/:toolId
取消收藏（需要认证）。

---

## 排序接口

### GET /orders
获取当前用户的工具排序 ID 数组（需要认证）。

### POST /orders
保存当前用户的工具排序（需要认证）。

**请求体**：
```json
{
  "ordered_ids": [3, 8, 12]
}
```

---

## 推荐接口

### GET /recommendations
获取工具推荐（可选认证）。

**查询参数**：
- `limit`：返回数量，默认 6。

当前实现：未登录或没有收藏时返回热门工具；已登录且存在公开收藏种子时已接入 pgvector 公开工具相似推荐并融合热门回退，仍会排除已收藏项。见 [SIMILAR_RECOMMENDATIONS.md](SIMILAR_RECOMMENDATIONS.md)。

---

## 发现接口

### GET /discovery
获取发现页工具列表（公开接口）。

**查询参数**：
- `source`：来源平台。
- `category`：分类。
- `search`：搜索关键词。
- `sort`：`hot` / `new` / `upvotes`，默认 `hot`。
- `limit`：每页数量，默认 20。
- `offset`：偏移量，默认 0。

### GET /discovery/recommendations
按热度获取发现页推荐工具（公开接口）。

**查询参数**：
- `limit`：返回数量，默认 6。
- `source`：来源平台。

### GET /discovery/rankings
获取发现排行榜（公开接口）。

**查询参数**：
- `period`：`today` / `week` / `month` / `all`。
- `limit`：返回数量，默认 10。
- `source`：来源平台。

### GET /discovery/latest
获取最新发现（公开接口）。

### GET /discovery/sources
获取所有来源平台及数量（公开接口）。

---

## 爬虫维护接口

当前 10 个手动触发维护接口已加 `JwtAuthGuard + AdminAccessGuard`：需要 JWT 且账号具有现有管理端权限；匿名请求预计为 401、无管理员权限预计为 403。运行时单 NestJS 进程最多一个手动抓取任务、同来源 60 秒触发间隔，过载请求预计返回 429。**后端依赖不完整，以上目前仅通过 Mock/源码契约验证，真实 HTTP 与生产限流仍待验收；请勿未经验证直接公开生产访问。** 定时抓取不受这些手动入口限制。

当前实际路由：

- `POST /crawler/v2ex`
- `POST /crawler/appinn`
- `POST /crawler/iplaysoft`
- `POST /crawler/producthunt`
- `POST /crawler/juejin`
- `POST /crawler/sspai`
- `POST /crawler/apprcn`
- `POST /crawler/ifanr`
- `POST /crawler/36kr`
- `POST /crawler/oschina`

单次执行响应示例：

```json
{
  "success": true,
  "message": "V2EX 爬虫执行完成，新增 3 个工具",
  "newTools": 3
}
```

不存在 `POST /crawler/run/:source` 或 `source=all` 的统一入口。

---

## 统计接口

统计接口当前全部需要 JWT 认证。

### POST /stats/view

```json
{
  "toolId": 1
}
```

记录工具浏览次数。

### POST /stats/click

```json
{
  "toolId": 1
}
```

记录工具点击次数。

### POST /stats/search

```json
{
  "query": "截图"
}
```

记录当前用户搜索行为（当前主要写日志）。

### POST /stats/favorite

```json
{
  "toolId": 1,
  "isFav": true
}
```

调整工具收藏计数。

当前不存在 `GET /stats/overview`。
