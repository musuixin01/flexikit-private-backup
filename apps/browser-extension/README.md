# FlexiKit Browser Companion

Chrome / Edge Manifest V3 浏览器扩展，用于把当前网页快速保存到 FlexiKit 工具箱。

## 当前版本

Browser Companion v0.4.0 遵循**默认简单、一次连接、一键保存**：

- 新手默认在 FlexiKit 中看到「浏览器快速添加」：只有真实官方商店地址配置后才提供安装按钮；尚未上架时不要求开启开发者模式，可直接粘贴网址自动导入。
- 首次配对采用 5 分钟有效的一次性配对码：扩展设备持有仅在 `storage.session` 中保存的 256 位随机验证密钥，用户在已登录 FlexiKit 中确认后，扩展领取独立登录会话；原账号密码登录保留为折叠后备。

- 首次授权 API 主机、登录扩展会话；之后点击工具栏图标自动保存当前网页，默认不再要求填写字段或点击二次确认，全程不切标签页。
- 页面标题、URL、favicon 和 description 仅在用户操作时读取，自动规范化 URL、清理追踪参数，服务端负责重复检查与最终冲突保护。
- 添加成功支持「撤销」；名称、分类、描述和标签默认收起，点击即可编辑已添加条目，不创建第二份工具。
- 页面空白处右键「添加到 FlexiKit」可不打开弹窗直接保存，扩展图标徽标提示结果；快捷键 Alt+Shift+S 打开同一个一键保存弹窗（可由浏览器自定义）。
- 分类和标签由现有后端自动推荐；推荐失败不妨碍保存。并发 Access Token Refresh 合并为一次请求。
- 仍使用浏览器本机 `storage.local` 保存扩展独立会话，不保存密码，不向全部网页常驻注入脚本，也不默认获得所有网页的持续读取权限。
- 首期保存到既有「我的工具」，无需修改 Canvas 布局；用户可在 FlexiKit 内自行固定到桌面。

**当前边界：** 后端离线会显示错误/手动重试，不支持离线排队；不支持扩展直接投放到桌面 Canvas；真实 Chrome/Edge 交互、商店上架和正式扩展 ID 尚待验收。

新手入口、配对契约与验证限制见 [`docs/BROWSER_COMPANION_ONBOARDING.md`](../../docs/BROWSER_COMPANION_ONBOARDING.md)。后端 Nest 编译受本机 CLI 依赖缺失阻塞，PostgreSQL 迁移尚未执行；模拟测试通过不等于正式服务已可用。

## 权限

- `storage`：保存本机 API 配置和扩展独立登录会话。
- `activeTab`：仅在用户点击扩展时访问当前标签页。
- `scripting`：仅在当前活动页执行一次元数据读取函数。
- `contextMenus`：用户主动右键添加网站，不监听浏览历史。
- `optional_host_permissions`：用户明确授权后，只用于访问配置的 FlexiKit API 主机。

扩展不会后台遍历浏览历史，不会抓取页面正文，不保存登录密码，也不会把认证数据同步到浏览器账号。

## 开发与构建

在 `apps/browser-extension` 目录运行：

```bash
npm test
npm run build
```

构建产物位于 `dist/`。

仅开发者本地加载（不是正式用户的安装路径）：

1. 打开扩展管理页。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展”。
4. 选择 `apps/browser-extension/dist`。
5. 首次点击图标允许 API 主机连接；使用一次性配对码在 FlexiKit 主程序确认，或展开账号密码后备登录。再次点击即可自动保存当前页。

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
- `npm run build`（`npm test` 含模拟后端的保存/去重/编辑/撤销/推荐异常/409 竞态/右键/并发刷新回归）
- Backend `npm run build`
- Backend `npm run test:browser-extension-regression`
- Backend `npm run test:multi-client-regression`
- Web `npm run build`
- `git diff --check`
- Chrome 最新稳定版手动链路：授权、登录、自动 Refresh、重复 URL、普通网页、tracking query、退出。
- Edge 最新稳定版同样链路。
- Chrome / Edge `pack-extension` 校验。
- 商店隐私声明和权限说明核对。

当前完成了代码、模拟 API 回归和可加载的未打包 dist；尚未在真实 Chrome/Edge 安装并验收，也未进行商店发行。发布仍需正式扩展 ID、商店账号、截图/隐私资料与人工审核。
