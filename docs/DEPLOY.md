# 部署指南

本文档介绍如何在生产环境部署 FlexiKit。

> 当前仓库内的 `docker/docker-compose.yml` 只负责 PostgreSQL 与 Redis。本文件中的 Backend + Nginx 全栈 Compose 属于生产部署模板，并不是当前仓库已落地的 Compose 配置；正式上线前需要单独验证。Web 应用当前实际目录为 `apps/web/`。

## 服务器要求

- **操作系统**: Ubuntu 22.04 LTS / Debian 12 / CentOS 8+
- **CPU**: 2核及以上
- **内存**: 4GB及以上
- **磁盘**: 20GB及以上
- **Node.js**: 18.x 或 20.x LTS
- **Docker**: 24.x+
- **Docker Compose**: v2+

## 部署方式

### 方式一：Docker Compose 部署（推荐）

#### 1. 准备环境
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER

# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### 2. 克隆代码
```bash
git clone <repository-url>
cd flexikit
```

#### 3. 配置环境变量
```bash
# 后端配置
cd backend
cp .env.example .env
```

编辑 `.env` 文件：
```env
PORT=3001
NODE_ENV=production

# 数据库配置（使用docker网络内地址）
DB_HOST=postgres
DB_PORT=5432
DB_USER=flexikit
DB_PASSWORD=your_strong_password_here
DB_NAME=flexikit_db

# JWT / Access Token 配置（使用强随机字符串）
JWT_SECRET=your_very_strong_jwt_secret_here_at_least_32_chars
ACCESS_TOKEN_TTL=30m
REFRESH_TOKEN_TTL=30d

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# CORS 配置（改为你的域名）
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
# Browser Companion：发布后填写正式扩展的精确 chrome-extension Origin
CORS_EXTENSION_ORIGINS=chrome-extension://your_published_extension_id
```

#### 4. 构建前端
```bash
cd ../apps/web
npm install
npm run build
```
构建产物将生成在 `apps/web/dist` 目录。

#### 5. 构建后端
```bash
cd ../backend
npm install
npm run build
```

#### 6. 启动服务
创建生产环境 docker-compose.yml：
```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: flexikit-postgres
    restart: always
    environment:
      POSTGRES_USER: flexikit
      POSTGRES_PASSWORD: your_strong_password_here
      POSTGRES_DB: flexikit_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - flexikit-network
    # 不对外暴露端口，只在内部网络访问

  redis:
    image: redis:7-alpine
    container_name: flexikit-redis
    restart: always
    command: redis-server --requirepass your_redis_password_here --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - flexikit-network
    # 不对外暴露端口

  backend:
    build: ./backend
    container_name: flexikit-backend
    restart: always
    ports:
      - "127.0.0.1:3001:3001"
    env_file: ./backend/.env
    depends_on:
      - postgres
      - redis
    networks:
      - flexikit-network

  nginx:
    image: nginx:alpine
    container_name: flexikit-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./apps/web/dist:/usr/share/nginx/html
    depends_on:
      - backend
    networks:
      - flexikit-network

volumes:
  postgres_data:
  redis_data:

networks:
  flexikit-network:
    driver: bridge
```

#### 7. 配置 Nginx
创建 `nginx/nginx.conf`：
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 前端静态文件
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # FlexiKit 新客户端正式使用 /api/v1/*。
    # proxy_pass 的尾部 / 会移除外层 /api/：
    # /api/v1/tools -> Backend /v1/tools。
    # 无版本 /api/* 当前只作为迁移兼容路径保留。
    location /api/ {
        proxy_pass http://backend:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cookie 转发
        proxy_cookie_path / "/; HttpOnly; Secure; SameSite=Lax";
    }
}
```

#### 8. 配置 SSL
使用 Let's Encrypt 获取免费证书：
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/* nginx/ssl/
```

#### 9. 启动所有服务
```bash
docker-compose up -d
```

### 方式二：手动部署

#### 1. 启动数据库
```bash
cd docker
docker-compose up -d
```

#### 2. 启动后端
```bash
cd backend
npm install
npm run build
NODE_ENV=production pm2 start dist/main.js --name flexikit-backend
```

#### 3. 部署前端
```bash
cd apps/web
npm install
npm run build
# 将 dist 目录部署到 Nginx
```

## 反向代理配置（Nginx）

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    root /path/to/flexikit/apps/web/dist;
    index index.html;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 数据库备份

### 自动备份脚本
创建 `backup.sh`：
```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="flexikit-postgres"

docker exec $CONTAINER pg_dump -U flexikit flexikit_db | gzip > $BACKUP_DIR/flexikit_$DATE.sql.gz

# 只保留最近30天的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

添加定时任务：
```bash
chmod +x backup.sh
crontab -e
# 每天凌晨3点备份
0 3 * * * /path/to/backup.sh
```

## 监控和维护

### 查看日志
```bash
# 后端日志
pm2 logs flexikit-backend
# 或 Docker
docker logs -f flexikit-backend

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 更新部署
```bash
git pull
cd apps/web && npm run build
cd ../../backend && npm run build && npm run migration:run
pm2 restart flexikit-backend
```

### 性能优化
1. 启用 Redis 缓存
2. 配置数据库连接池
3. 启用 Nginx 缓存
4. 使用 CDN 加速静态资源

## 常见问题

### 端口被占用
```bash
# 查看端口占用
lsof -i :3001
# 或
netstat -tulpn | grep 3001
```

### 数据库连接失败
1. 检查 Docker 容器是否运行：`docker ps`
2. 检查数据库密码是否正确
3. 检查防火墙是否开放端口

### CORS 错误
1. 确认后端 CORS_ORIGIN 配置正确
2. 确认前端访问地址在允许列表中
3. 检查 Nginx 是否正确转发 Origin 头
