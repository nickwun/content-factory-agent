# Content Factory VPS Deployment (DigitalOcean / 公网 IP)

这份说明对应当前项目的 **最小可上线 VPS 方案**：

- 单机 DigitalOcean Droplet
- Docker Compose
- Nginx 反向代理
- Basic Auth
- 公网 IP 访问
- SQLite 保留
- `/uploads` 目录先作为服务器本地上传目录挂载

## 1. 服务器目录约定

首版统一使用下面这套目录，不要改成分散路径：

- `/opt/content-factory/app`
- `/opt/content-factory/data`
- `/opt/content-factory/uploads`
- `/opt/content-factory/logs`
- `/opt/content-factory/.env`

另外再补一个 Basic Auth 目录：

- `/opt/content-factory/nginx/.htpasswd`

目录含义：

- `app`
  放项目代码和 `docker-compose.yml`
- `data`
  持久化 SQLite
- `uploads`
  持久化服务器本地上传目录
  注意：当前它是目录预留位，不是完整文件资产系统
- `logs`
  Nginx 日志
- `.env`
  应用生产环境变量

## 2. 首次准备

建议 Droplet 规格：

- Ubuntu 22.04 或 24.04
- 2 vCPU
- 4 GB RAM
- 60 GB SSD

安装依赖：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin apache2-utils
sudo systemctl enable --now docker
```

创建目录：

```bash
sudo mkdir -p /opt/content-factory/app
sudo mkdir -p /opt/content-factory/data
sudo mkdir -p /opt/content-factory/uploads
sudo mkdir -p /opt/content-factory/logs/nginx
sudo mkdir -p /opt/content-factory/nginx
```

设置权限（上传目录最容易因为权限出问题）：

```bash
sudo chown -R $USER:$USER /opt/content-factory
chmod 755 /opt/content-factory
chmod 755 /opt/content-factory/data
chmod 755 /opt/content-factory/uploads
chmod 755 /opt/content-factory/logs
chmod 755 /opt/content-factory/logs/nginx
```

如果后面出现 `.txt / .docx` 上传失败，先优先检查：

- `/opt/content-factory/uploads` 是否存在
- 当前系统用户是否对 `/opt/content-factory/uploads` 有写权限
- docker volume 是否正确挂到 `/app/uploads`

## 3. 放代码和环境变量

把仓库代码放到：

```bash
/opt/content-factory/app
```

建议做法：

```bash
cd /opt/content-factory
git clone <your-repo-url> app
```

放置环境变量：

```bash
cp /opt/content-factory/app/.env.example /opt/content-factory/.env
vim /opt/content-factory/.env
```

## 4. Basic Auth

这轮不做应用内登录，统一由 Nginx 做整站保护。

`.htpasswd` 文件放这里：

```bash
/opt/content-factory/nginx/.htpasswd
```

生成用户名密码：

```bash
htpasswd -c /opt/content-factory/nginx/.htpasswd your_username
```

追加第二个用户时不要再带 `-c`：

```bash
htpasswd /opt/content-factory/nginx/.htpasswd another_user
```

不要把真实 `.htpasswd` 提交到仓库。

## 5. 启动方式

进入项目目录：

```bash
cd /opt/content-factory/app
```

启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f app
docker compose logs -f nginx
```

停止：

```bash
docker compose down
```

重启：

```bash
docker compose restart
```

## 6. 环境变量说明

### 必须项

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`
- `EXTERNAL_WECHAT_API_KEY`
- `PUBLIC_IMAGE_STORAGE_PROVIDER`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

### 功能链强相关

外部爆款链：

- `EXTERNAL_WECHAT_API_KEY`
- `EXTERNAL_WECHAT_VERIFYCODE`
- `EXTERNAL_WECHAT_BASE_URL`

头图 / 图片链：

- `PUBLIC_IMAGE_STORAGE_PROVIDER`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

### 发布链

发布链的大部分配置当前由设置页写入 SQLite：

- `wechat_publish_api_key`
- `wechat_publish_base_url`
- `xiaohongshu_publish_api_key`
- `xiaohongshu_publish_base_url`
- `feishu_app_id`
- `feishu_app_secret`

最稳的做法是：

1. 直接把本地已有的 `data/content-agent.sqlite` 带到服务器
2. 启动后在设置页确认这些配置仍然存在

### SQLite 和 uploads

当前代码里没有独立的 SQLite 路径环境变量。

SQLite 默认路径固定为：

```bash
/app/data/content-agent.sqlite
```

所以必须保证：

- `/opt/content-factory/data:/app/data`

当前 `uploads` 目录先按下面方式挂载：

- `/opt/content-factory/uploads:/app/uploads`

## 7. 首次上线验收

先验“服务能打开”：

1. 浏览器访问 `http://<your-server-ip>`
2. 确认先弹 Basic Auth
3. 输入账号密码后能进入首页

再验核心主链：

### 创作中心仿写

1. 上传或粘贴素材
2. 选择 rewrite 类 Prompt Preset
3. 开始仿写
4. 进入工作台

### 创作中心翻译

1. 切到“翻译成中文文章”
2. 粘贴英文文稿
3. 选择 translate 类 Prompt Preset
4. 开始翻译整理
5. 进入工作台

### 外部爆款链

1. 打开 `/topics/wechat-hot`
2. 搜文章
3. 补正文
4. 分析
5. 进入创作中心

### 发布链

1. 飞书发布
2. 公众号发布

## 8. 重启后验证

执行：

```bash
docker compose restart
```

确认：

1. `http://<your-server-ip>` 仍可访问
2. Basic Auth 仍正常
3. Prompt Preset 和设置项仍在
4. 至少再跑通一条最短主链

## 9. 备份

备份脚本：

```bash
/opt/content-factory/app/deploy/backup.sh
```

默认会备份：

- `/opt/content-factory/data`
- `/opt/content-factory/uploads`
- `/opt/content-factory/.env`

默认输出目录：

```bash
/opt/content-factory/backups
```

默认只保留最近 7 份，可通过环境变量覆盖：

```bash
BACKUP_KEEP_COUNT=14 /opt/content-factory/app/deploy/backup.sh
```

## 10. 当前方案的已知边界

这轮明确不做：

- 域名
- HTTPS
- Postgres 迁移
- 对象存储迁移
- 复杂登录系统
- 更大范围的数据服务端化

另外要明确：

当前仍有一部分工作台历史和中间态在浏览器 localStorage。
所以这轮 VPS 上线后：

- 你可以从其他电脑通过公网 IP 使用系统
- 但不同电脑之间不会自动共享全部本地工作台历史

这是当前阶段的已知边界，不是 Docker / VPS 配置错误。
