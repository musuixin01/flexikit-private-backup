# FlexiKit Browser Companion

Chrome / Edge Manifest V3 浏览器扩展，用于把当前网页快速保存到 FlexiKit 工具箱。

## 当前版本

Browser Companion v0.2.0 已完成可安装产品化基线：

- 工具栏 Popup 主工作流，不再向所有网页常驻注入悬浮脚本。
- 只有用户点击扩展时，才通过 `activeTab` + `scripting` 临时读取当前页标题、URL、favicon 和 description。
- URL 自动规范化：去除 hash、常见 tracking 参数并稳定排序查询参数。
- 独立 `extension` 登录会话，使用 Access/Refresh Token 自动续期；密码只用于登录请求，不保存。
- Access/Refresh Token、API 地址和 client instance id 仅保存在浏览器本机 `storage.local`，不使用 `storage.sync`。
- 创建前调用服务端 URL 去重；服务端创建接口同时做最终冲突保护。
- 复用 FlexiKit 分类目录和 `recommend-tags` 接口生成标签建议，并给出分类建议；用户可以在保存前修改。
- 设置页支持 API Base URL、主机权限授权、连接检测、当前账号状态和退出。
- API 主机权限使用 `optional_host_permissions`，扩展默认没有所有网站的常驻访问权。
- Chrome / Edge 共用同一 Manifest V3 构建产物。

## 权限

- `storage`：保存本机 API 配置和扩展独立登录会话。
- `activeTab`：仅在用户点击扩展时访问当前标签页。
- `scripting`：仅在当前活动页执行一次元数据读取函数。
- `optional_host_permissions`：用户明确授权后，只用于访问配置的 FlexiKit API 主机。

扩展不会后台遍历浏览历史，不会抓取页面正文，不保存登录密码，也不会把认证数据同步到浏览器账号。

## 开发与构建

在 `apps/browser-extension` 目录运行：

```bash
npm test
npm run build
```

构建产物位于 `dist/`。

Chrome / Edge 本地加载：

1. 打开扩展管理页。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展”。
4. 选择 `apps/browser-extension/dist`。
5. 点击 FlexiKit 图标，授权 API 主机并登录。

默认 API：

```text
http://127.0.0.1:3001/v1
```

## Backend CORS

开发环境允许合法的 unpacked Chromium extension Origin，便于本地调试。

生产环境不会自动信任任意扩展。发布到 Chrome Web Store 或 Edge Add-ons 并确定正式扩展 ID 后，Backend 必须显式配置：

```env
CORS_EXTENSION_ORIGINS=chrome-extension://<published-extension-id>
```

多个正式扩展 Origin 使用逗号分隔。不要使用 CORS 通配符。

## 发布门禁

发布前至少执行：

- `npm test`
- `npm run build`
- Backend `npm run build`
- Backend `npm run test:browser-extension-regression`
- Backend `npm run test:multi-client-regression`
- Web `npm run build`
- `git diff --check`
- Chrome 最新稳定版手动链路：授权、登录、自动 Refresh、重复 URL、普通网页、tracking query、退出。
- Edge 最新稳定版同样链路。
- Chrome / Edge `pack-extension` 校验。
- 商店隐私声明和权限说明核对。

当前代码已完成本地产品化和自动/浏览器打包校验；真正商店发布仍需正式扩展 ID、商店账号、截图/隐私资料与人工审核。
