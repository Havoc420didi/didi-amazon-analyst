# Amazon Analyst 网站程序运行指南

## 项目简介

Amazon Analyst 是一个基于 AI 的亚马逊运营分析平台，提供 24/7 监控、AI 驱动的洞察和可操作的业务优化建议。

## 技术栈

- **前端**: Next.js 15, React 19, TypeScript
- **UI 组件**: Shadcn UI, Radix UI, Tailwind CSS
- **数据库**: Supabase with Drizzle ORM
- **AI 集成**: 多 AI 提供商 (OpenAI, DeepSeek 等)
- **认证**: NextAuth.js
- **国际化**: next-intl

## 环境要求

- Node.js 18+ 
- pnpm 包管理器
- Git

## 安装和运行步骤

### 1. 克隆项目（如果还没有）

```bash
git clone <项目仓库地址>
cd total_project
```

### 2. 安装依赖

```bash
# 使用 pnpm 安装依赖
pnpm install
```

### 3. 环境变量配置

```bash
# 复制环境变量示例文件
cp .env.example .env.development

# 编辑环境变量文件，配置必要的 API 密钥和数据库连接
nano .env.development
```

### 4. 数据库设置

```bash
# 生成数据库迁移文件
pnpm db:generate

# 运行数据库迁移
pnpm db:migrate

# 打开数据库管理界面（可选）
pnpm db:studio
```

### 5. 启动开发服务器

```bash
# 启动开发服务器
pnpm dev
```

### 6. 访问网站

打开浏览器访问: [http://localhost:3000](http://localhost:3000)

## 其他常用命令

### 开发相关

```bash
# 启动开发服务器（使用 Turbopack）
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint

# 分析构建包大小
pnpm analyze
```

### 测试相关

```bash
# 运行 Jest 测试
pnpm test

# 运行测试（监听模式）
pnpm test:watch

# 运行测试覆盖率
pnpm test:coverage

# 运行 Playwright 测试
pnpm playwright:test

# 显示 Playwright 测试报告
pnpm playwright:show-report

# 运行广告同步测试
pnpm test:ad-sync
```

### 数据库相关

```bash
# 生成数据库迁移
pnpm db:generate

# 运行数据库迁移
pnpm db:migrate

# 推送数据库更改
pnpm db:push

# 打开数据库管理界面
pnpm db:studio
```

## Docker 部署

### 构建 Docker 镜像

```bash
# 构建 Docker 镜像
pnpm docker:build
# 或者
docker build -f Dockerfile -t amazon-analyst:latest .
```

### 运行 Docker 容器

```bash
# 运行容器
docker run -p 3000:3000 amazon-analyst:latest
```

## 生产环境部署

### Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署到 Vercel
vercel
```

### 传统服务器部署

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查找占用 3000 端口的进程
   lsof -i :3000
   
   # 杀死进程
   kill -9 <进程ID>
   ```

2. **依赖安装失败**
   ```bash
   # 清除缓存重新安装
   pnpm store prune
   pnpm install
   ```

3. **数据库连接问题**
   ```bash
   # 检查数据库配置
   pnpm db:studio
   ```

### 日志查看

```bash
# 查看服务器日志
tail -f server.log
```

## 项目结构

```
src/
├── app/           # Next.js App Router 页面
├── components/    # React 组件
├── lib/          # 工具函数
├── services/     # 业务逻辑层
├── db/           # 数据库配置
├── i18n/         # 国际化
└── types/        # TypeScript 定义
```

## 联系支持

如有问题，请查看项目文档或联系开发团队。 