# 安全说明

## 安全承诺

FlexiKit 项目非常重视安全问题。我们致力于保护用户的数据安全和隐私。

## 报告安全漏洞

如果您发现了安全漏洞，请**不要**公开提交 Issue。请通过以下方式私下报告：

- 提交安全Issue并标记为"Security"
- 发送邮件至 [security@flexikit.app]

我们会在24小时内确认收到漏洞报告，并在48小时内给出初步处理方案。

## 安全最佳实践

### 部署时请注意

1. **修改默认密码**
   - 生产环境请务必修改 PostgreSQL 默认密码
   - JWT_SECRET 请使用强随机字符串（至少32位）
   - Redis 请设置密码并绑定127.0.0.1

2. **使用 HTTPS**
   - 生产环境必须使用 HTTPS
   - 配置 Nginx 反向代理并启用 SSL
   - 启用 HSTS

3. **CORS 配置**
   - 生产环境请配置正确的 CORS_ORIGIN
   - Browser Companion 生产访问必须通过 CORS_EXTENSION_ORIGINS 显式列出精确 chrome-extension Origin
   - 不要使用通配符 `*`
   - 只允许可信 Web Origin 和已发布扩展 ID

4. **Cookie 安全**
   - 生产环境请启用 HttpOnly、Secure、SameSite Cookie
   - JWT 建议存储在 HttpOnly Cookie 中，而非 localStorage

### 数据安全

1. **定期备份数据库**
   ```bash
   docker exec flexikit-postgres pg_dump -U flexikit flexikit_db > backup.sql
   ```

2. **不要将 .env 文件提交到版本控制**
   - .env 文件包含敏感信息，请确保在 .gitignore 中
   - 使用 .env.example 作为模板

3. **用户密码**
   - 密码使用 bcrypt 哈希存储（12轮salt）
   - 永远不要明文存储或传输密码
   - 建议用户使用强密码

## 已知安全限制

1. **本地工具打开功能**
   - 本地程序启动只在 Desktop 端通过 Tauri `open_local_path` IPC 执行，不再暴露 Backend HTTP 启动接口
   - IPC 会规范化路径、确认目标文件存在，并仅允许 `.exe` / `.lnk` / `.url` / `.msi`
   - 打开本地程序仍需来自用户已配置的本地路径，请勿添加来源不明的程序

2. **爬虫功能**
   - 爬虫仅抓取公开RSS和API内容
   - 会遵守 robots.txt 规则
   - 不会抓取需要登录的内容

3. **Favicon 获取**
   - 后端获取favicon时会校验目标地址
   - 禁止访问内网IP地址
   - 有请求大小和超时限制

## 版本安全更新

请始终使用最新版本，我们会在 [CHANGELOG.md](CHANGELOG.md) 中记录安全修复。

| 版本 | 安全修复 |
|------|----------|
| v1.0.0 | 初始版本，包含基础安全措施 |

## 安全配置检查清单

部署前请确认：
- [ ] 修改了所有默认密码
- [ ] JWT_SECRET 是强随机字符串
- [ ] 使用 HTTPS
- [ ] CORS 配置正确
- [ ] 数据库端口不对外暴露
- [ ] Redis 设置了密码
- [ ] 定期备份数据库
- [ ] .env 文件权限正确（600）
