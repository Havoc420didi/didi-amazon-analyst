# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amazon Analyst is an Amazon operations analysis platform built with Next.js 15, React 19, and TypeScript. The application provides inventory management, analytics, and AI-powered insights for Amazon sellers.

## Essential Commands

### Development
```bash
# Install dependencies
pnpm install

# Start development server (with Turbopack)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Bundle analysis
pnpm analyze
```

### Database Operations
```bash
# Generate new migrations after schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Open Drizzle Studio (database UI)
pnpm db:studio

# Push schema changes directly (development only)
pnpm db:push
```

### Docker
```bash
# Build Docker image
pnpm docker:build
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 App Router, React 19, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Shadcn UI, Radix UI, Tailwind CSS
- **Auth**: NextAuth.js v5 (beta)
- **AI**: Multiple providers via AI SDK (OpenAI, DeepSeek, etc.)
- **Payments**: Stripe
- **File Storage**: AWS S3
- **Internationalization**: next-intl

### Key Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── [locale]/          # Internationalized routes
│   │   ├── (admin)/       # Admin panel routes
│   │   ├── (default)/     # Public and user routes
│   │   │   ├── (console)/ # User dashboard
│   │   │   └── inventory/ # Inventory management
│   │   └── auth/          # Authentication pages
│   └── api/               # API routes
├── components/            # React components
│   ├── blocks/           # Page section components
│   ├── ui/              # Shadcn UI components
│   ├── inventory/       # Inventory-specific components
│   └── [feature]/       # Feature-specific components
├── db/                   # Database configuration and schema
│   ├── schema.ts        # Drizzle ORM schema definitions
│   ├── config.ts        # Database configuration
│   └── migrations/      # Auto-generated migrations
├── lib/                 # Utility functions
├── types/               # TypeScript type definitions
├── services/            # Business logic layer
├── auth/                # Authentication configuration
└── i18n/               # Internationalization setup
```

### Core Database Schema
The application manages several key entities:
- **Users**: User accounts with invite system and affiliate support
- **Orders**: Stripe payment processing with subscription support
- **Credits**: User credit system for API usage
- **InventoryRecords**: Core inventory data with sales and advertising metrics
- **Posts**: Blog/content management
- **APIKeys**: User-generated API keys for external access

### Authentication Flow
- NextAuth.js v5 with Google and GitHub providers
- Session-based authentication with JWT tokens
- Admin role system based on email configuration
- One-tap Google login support

### Inventory Management System
- Multi-warehouse support (UK, EU)
- ASIN-based product tracking
- Daily sales and inventory data
- Advertising performance metrics (ACOS, CTR, conversion rates)
- Excel upload functionality for bulk data import

### AI Integration
- Multiple AI providers supported via Vercel AI SDK
- Video generation capabilities (Kling AI)
- Text generation and analysis features
- Configurable provider selection

## Development Guidelines

### Code Style
- Use functional components and hooks (avoid classes)
- Prefer named exports over default exports
- Use interfaces instead of types unless union types are needed
- Follow existing naming conventions:
  - Components: PascalCase (`UserProfile.tsx`)
  - Files/directories: kebab-case (`inventory-dashboard`)
  - Variables: camelCase with descriptive prefixes (`isLoading`, `hasError`)

### React/Next.js Best Practices
- Minimize `"use client"` usage - prefer Server Components
- Use Suspense boundaries for client components
- Follow Next.js App Router conventions for routing and data fetching
- Implement proper error boundaries and loading states

### Database Operations
- All schema changes must generate migrations via `pnpm db:generate`
- Use proper indexing for query optimization (see `inventoryRecords` table)
- Follow existing patterns for service layer database interactions

### Internationalization
- All user-facing text should use next-intl
- Translation files are in `src/i18n/messages/`
- Support for English (en) and Chinese (zh)

## Environment Setup

Copy `.env.example` to `.env.development` and configure:
- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: NextAuth secret (generate with `openssl rand -base64 32`)
- `AUTH_GOOGLE_ID/SECRET`: Google OAuth credentials
- Stripe keys for payment processing
- AWS S3 credentials for file storage

## Testing

Currently no test framework is configured. When adding tests, check existing patterns in the codebase first.

## Important Notes

- The project uses Turbopack for faster development builds
- Drizzle Studio provides a web UI for database management
- The inventory system supports unique daily records per ASIN/location
- Admin access is controlled via `ADMIN_EMAILS` environment variable
- The application supports both light and dark themes

## 📊 Database Setup (Completed: 2025-08-08)
✅ **PostgreSQL 16.9** has been successfully installed and configured for this project.

### 🎯 Database Configuration - **统一数据库架构**
- **统一数据库**: `amazon_analyst` - 支持Next.js系统 + Python ERP同步系统
- **用户**: `amazon_analyst` with password `amazon_analyst_2024`
- **Host**: `localhost:5432`

### 🔗 数据库架构说明
**2025-08-08 更新**：数据库架构已从双数据库模式升级为统一数据库模式
- ✅ **Next.js系统表**: 保留原有Drizzle ORM表结构
- ✅ **赛狐ERP同步表**: 新增`saihu_***`系列表到同一数据库
- ✅ **数据共享**: 两个系统共享同一数据库，支持SQL联合查询

### 🔗 连接URI - 统一配置
```bash
# Next.js + 赛狐ERP统一连接 (已配置)
DATABASE_URL="postgresql://amazon_analyst:amazon_analyst_2024@localhost:5432/amazon_analyst"

# Python同步系统配置 (sync_saihu_erp/data_update/config/config.yml)
host: localhost
port: 5432
database: amazon_analyst  # 统一使用amazon_analyst数据库
user: amazon_analyst
password: amazon_analyst_2024
```

### 🛠️ Database Management
```bash
# Check database status
./manage_postgres.sh status

# Create backup
./manage_postgres.sh backup

# Test connections
python3 test_database.py

# Reset databases (use with caution)
./manage_postgres.sh reset
```

### 📁 新增赛狐ERP同步系统文件
- **数据库表结构**: `/root/amazon-analyst/src/db/saihu_erp_schema.sql`
- **测试脚本**: `/root/amazon-analyst/test_database.py`
- **管理脚本**: `/root/amazon-analyst/manage_postgres.sh`
- **Python同步目录**: `/root/amazon-analyst/sync_saihu_erp/data_update/`
- **即时同步脚本**: `/root/amazon-analyst/sync_saihu_erp/data_update/run_sync_now.py`

### 📊 赛狐ERP同步系统架构
- **主表**: `saihu_product_analytics` (产品分析数据)
- **库存表**: `saihu_fba_inventory` (FBA库存)
- **明细表**: `saihu_inventory_details` (库存明细)
- **日志表**: `saihu_sync_task_logs` (同步日志记录)
- **配置表**: `saihu_api_configs` + `saihu_system_configs`
- **分析视图**: `v_saihu_latest_inventory` + `v_saihu_product_summary`

### ✅ Next Steps
1. Run `pnpm db:migrate` to initialize schema
2. Run `pnpm dev` to start development server
3. Configure API credentials in Python sync system (see ./run_sync_now.py)
4. Import initial data: `python run_sync_now.py`

### 🔄 快速启动流程
```bash
# 1. 安装依赖
pnpm install
python3 -m venv venv_sync && source venv_sync/bin/activate
pip install --break-system-packages -r sync_saihu_erp/data_update/requirements.txt

# 2. 数据库已就绪 (表结构已创建)

# 3. 配置API凭据 (编辑配置文件)
vim sync_saihu_erp/data_update/config/config.yml

# 4. 执行首次数据同步
source venv_sync/bin/activate && python run_sync_now.py

# 5. 启动Next.js开发服务器
pnpm dev
```

All systems are ready to run with unified database architecture! 🚀