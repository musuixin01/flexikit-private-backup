# FlexiKit — AI 驱动的个人数字工作空间

<div align="center">

![FlexiKit Logo](https://aka.doubaocdn.com/s/CKzi1wfKW7)

**集工具管理、AI 助手、Windows 桌宠和 Desktop Canvas 于一体的个人数字工作空间。**

[![Vue](https://img.shields.io/badge/Vue-3.4-4FC08D?logo=vuedotjs)](https://vuejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)


</div>

## ✨ 特性

- 🎨 **精美UI设计** - 毛玻璃效果，支持亮/暗主题自动切换
- 📱 **完美响应式** - 适配桌面端、平板、手机
- 🔐 **用户系统** - 注册登录、个人资料、头像自定义
- 🛠️ **工具管理** - 自定义工具、分类管理、标签、搜索、收藏
- 💻 **本地工具支持** - 打开本地exe程序、自动提取程序图标
- 🔍 **智能发现** - 多平台爬虫自动发现优质工具（V2EX、小众软件、Product Hunt等）
- 🏷️ **智能标签推荐** - AI辅助标签推荐，分类更轻松
- ⭐ **收藏排序** - 自定义工具排序、收藏夹
- 🚀 **极速体验** - 离线缓存、多源favicon fallback、流畅动画

## 🛠️ 技术栈

### 前端
- **框架**: Vue 3 + TypeScript + Composition API
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **HTTP客户端**: Axios
- **工具库**: VueUse
- **构建工具**: Vite 5

### 后端
- **框架**: NestJS 10
- **ORM**: TypeORM
- **数据库**: PostgreSQL 16 + pgvector
- **缓存**: Redis 7
- **认证**: JWT + Passport
- **验证**: class-validator + class-transformer
- **定时任务**: @nestjs/schedule

### 基础设施
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx（生产环境）

## 📁 项目结构

```
flexikit/
├── backend/                 # NestJS 后端
│   ├── src/
│   │   ├── auth/           # 认证模块
│   │   ├── users/          # 用户模块
│   │   ├── tools/          # 工具管理模块
│   │   ├── categories/     # 分类模块
│   │   ├── favorites/      # 收藏模块
│   │   ├── discovery/      # 工具发现模块
│   │   ├── crawler/        # 多平台爬虫
│   │   ├── embedding/      # 向量嵌入模块
│   │   ├── recommendations/# 推荐模块
│   │   ├── common/         # 公共守卫、DTO
│   │   ├── config/         # 配置
│   │   └── database/       # 数据库相关
│   ├── package.json
│   └── tsconfig.json
├── apps/
│   ├── web/                # Vue 3 Web / Desktop 共用前端
│   │   ├── src/
│   │   │   ├── api/        # API 与 Desktop Runtime 封装
│   │   │   ├── components/ # 通用组件与 Desktop Widgets
│   │   │   ├── desktop/    # Widget Registry / 外观系统
│   │   │   ├── views/      # 页面与 Desktop Canvas
│   │   │   ├── stores/     # Pinia 状态
│   │   │   └── types/      # TypeScript 类型
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── desktop/            # Tauri 桌面壳与 Rust 原生能力
│   │   └── src-tauri/
│   └── mobile/             # 移动端预留目录
├── docker/                 # Docker 配置
│   └── docker-compose.yml
├── docs/                   # 项目文档
├── scripts/                # 工具脚本
└── start.bat               # Windows 启动脚本
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18.x
- Docker & Docker Compose
- npm >= 9

### 1. 克隆项目
```bash
git clone <repository-url>
cd flexikit
```

### 2. 启动数据库
```bash
cd docker
docker-compose up -d
```
这将启动 PostgreSQL（端口5433）和 Redis（端口6379）。

### 3. 启动后端
```bash
cd backend
npm install
cp .env.example .env
# 编辑 .env 配置数据库连接信息
npm run start:dev
```
后端将在 http://localhost:3001 启动。

### 4. 启动前端
```bash
cd apps/web
npm install
npm run dev
```
前端将在 http://localhost:5173 启动。

### 5. 一键启动（Windows）
双击 `start.bat` 可启动后端和 Web 前端；PostgreSQL / Redis 仍需先通过 `docker/docker-compose.yml` 启动。

## 📖 使用说明

### 添加工具
1. 点击右上角「+ 添加工具」按钮
2. 输入工具名称、URL、描述
3. 选择分类，系统会智能推荐标签
4. 图标会自动从网站获取，也可以自定义
5. 点击保存即可

### 添加本地工具
1. 在添加工具时选择「本地工具」
2. 选择exe文件路径
3. 系统会自动提取程序图标
4. 点击即可直接打开本地程序

### 发现新工具
1. 点击左侧「发现」菜单
2. 可以按平台筛选（V2EX、小众软件、Product Hunt等）
3. 可以按时间筛选（今日、本周、本月、全部）
4. 鼠标悬停在工具卡片上查看详情
5. 点击「添加到我的工具箱」即可收藏

## 🔧 配置说明

### 后端环境变量 (.env)
```env
# 服务端口
PORT=3001
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=5433
DB_USER=flexikit
DB_PASSWORD=flexikit123
DB_NAME=flexikit_db

# JWT / Access Token 配置
JWT_SECRET=your_super_secret_key_here
ACCESS_TOKEN_TTL=30m
REFRESH_TOKEN_TTL=30d

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS 配置（生产环境）
CORS_ORIGIN=https://yourdomain.com
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

详细请参考 [贡献指南](docs/CONTRIBUTING.md)。

## 📄 文档

- [安全说明](docs/SECURITY.md)
- [部署指南](docs/DEPLOY.md)
- [API 文档](docs/API.md)
- [商业化与收费策略](docs/MONETIZATION.md)
- [产品路线图](docs/ROADMAP.md)
- [主线阶段执行计划（唯一执行总表）](docs/MASTER_PLAN.md)
- [更新日志](docs/CHANGELOG.md)
- [贡献指南](docs/CONTRIBUTING.md)

## 📝 许可证

当前仓库没有 LICENSE 文件，不能仅凭文档推定已采用 MIT 或其他开源许可证。代码使用、再分发和对外授权范围须由项目所有者明确，并在对外开源前添加正式许可证文件。

## 🙏 致谢

- 感谢所有开源项目的作者
- 感谢 [V2EX](https://www.v2ex.com/)、[小众软件](https://www.appinn.com/)、[异次元软件](https://www.iplaysoft.com/) 等平台提供优质内容
