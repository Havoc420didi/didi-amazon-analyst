# CLAUDE.md

此文件为 Claude Code(claude.ai/code) 提供在此代码库中工作的指导。

## 项目概览

**项目名称**: Ops Helios (amazon-analyst)
**版本**: 2.5.1
**作者**: Tepin Team
**技术栈**: Next.js 15 + TypeScript + Tailwind CSS + Drizzle ORM
**部署平台**: Vercel

## 核心命令

### 开发与构建
```bash
# 开发服务器
pnpm dev              # 启动开发服务器（支持 Turbopack）
pnpm dev:fast         # 同时运行类型检查和开发服务器

# 构建与部署
pnpm build            # 构建生产版本
pnpm start            # 启动生产服务器
pnpm analyze          # 构建分析（Bundle Analyzer）

# 代码质量
pnpm lint            # 运行 ESLint
pnpm typecheck       # TypeScript 类型检查
pnpm typecheck:watch # 监听模式类型检查
```

### 测试
```bash
# Jest 单元测试
pnpm test            # 运行 Jest 测试
pnpm test:watch      # 监听模式测试
pnpm test:coverage   # 测试覆盖率

# Playwright E2E 测试
pnpm playwright:test      # E2E 测试
pnpm playwright:show-report # 查看测试报告

# AD 同步专项测试
pnpm test:ad-sync       # AD 同步测试
pnpm test:ad-sync-coverage  # 带覆盖率的 AD 测试
```

### 数据库操作
```bash
pnpm db:generate    # 生成数据库迁移文件
pnpm db:migrate     # 执行数据库迁移
pnpm db:push        # 推送架构到数据库
pnpm db:studio      # 启动 Drizzle Studio
```

### Docker 与部署
```bash
pnpm docker:build   # 构建 Docker 镜像
```

## 项目结构

### 核心架构
```
app/                 # Next.js 应用目录（App Router）
src/
├── components/      # 共享组件
├── lib/           # 工具函数和配置
├── db/            # 数据库配置和架构
├── hooks/         # 自定义 Hooks
└── types/         # TypeScript 类型定义

public/            # 静态资源
scripts/          # 构建脚本和工具
doc/              # 项目文档
```

### 关键技术栈
- **前端**: Next.js 15 (App Router), React 19, TypeScript
- **样式**: Tailwind CSS + Radix UI 组件库
- **数据库**: MySQL2 + Drizzle ORM
- **AI**: OpenAI, LangChain, AI SDK (多家 AI 提供商)
- **认证**: NextAuth.js v5
- **测试**: Jest + Playwright
- **部署**: Vercel

### 主要目录用途
- `app/`: 应用路由和页面组件
- `src/components/`: 可重用 React 组件
- `src/lib/`: 核心业务逻辑、工具函数
- `src/hooks/`: 自定义 React Hooks
- `src/db/`: 数据库配置、迁移、架构定义
- `src/types/`: TypeScript 类型定义

## 开发工作流

### 1. 环境设置
确保有 `.env.local` 文件用于本地开发，包含必要的环境变量。

### 2. 数据库开发
- 使用 Drizzle ORM 进行数据库操作
- 迁移文件位于与 `src/db/config.ts` 同级目录

### 3. 新增功能
1. 在 `src/components/` 创建组件
2. 在相应类型文件中定义 TypeScript 类型
3. 添加测试文件（如需要）
4. 运行测试验证

### 4. 代码规范
- 使用 ESLint 进行代码检查
- 严格的 TypeScript 类型检查
- 支持现代 React Hooks 和异步组件

## 重要配置

### 核心配置文件
- `next.config.mjs`: Next.js 配置
- `tailwind.config.ts`: Tailwind CSS 配置  
- `tsconfig.json`: TypeScript 配置
- `source.config.ts`: 项目源配置（目前主要为文档配置）

### 特殊集成
- **亚马逊分析**: 集成 AWS S3 客户端用于数据分析
- **多种 AI 服务**: 支持 OpenAI、DeepSeek、OpenRouter 等
- **支付系统**: Stripe 集成用于付款处理
- **分析工具**: OpenPanel 和 Vercel 分析

## 性能考虑
- 使用 Turbopack 支持快速开发
- Bundle 分析和内存监控
- 响应式设计和移动端优化