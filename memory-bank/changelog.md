# 变更日志

## [2025-08-09] - 数据库架构统一化重构

### 🚀 重大系统重构
- ✨ **数据库表名统一化**: 去除所有 saihu_ 前缀，使用统一表名
- ✨ **数据库合并**: 将 saihu_erp_sync 数据库合并到 amazon_analyst
- ✨ **系统统一**: Next.js主ERP系统与Python同步系统共享同一数据库

### 📊 数据库更新
- 🔄 **表名变更**:
  - `saihu_product_analytics` → `product_analytics`
  - `saihu_fba_inventory` → `fba_inventory`  
  - `saihu_inventory_details` → `inventory_details`
  - `saihu_sync_task_logs` → `sync_task_logs`
- 🔄 **数据库名变更**: `saihu_erp_sync` → `amazon_analyst`

### 🛠️ 配置更新
- 📝 更新 11 个文件的数据库配置和表名引用
- 📝 修复所有 Python 配置文件中的数据库名称
- 📝 更新 shell 脚本和文档中的数据库引用

### ✨ 新增功能
- 🆕 **30天回补脚本**: 新增 `run_30day_backfill_sync.py` 用于历史数据回补
- 🆕 **统一数据查询**: 支持 Next.js 和 Python 系统的 SQL 联合查询

### 💾 提交信息
- **提交ID**: `b835ff9`
- **类型**: refactor(erp-sync)
- **影响**: 破坏性变更，需要数据库迁移

### 📝 文档更新  
- 更新 Memory Bank 文档记录本次重构
- 更新 `activeContext.md` 和 `progress.md`

---

## [2025-08-09] - Memory Bank 例行更新 (早期)

### 文档更新
- 更新 `activeContext.md` 与 `progress.md`，记录仓库同步状态与最近一次维护
- 当前仓库已同步至提交 `46e1286`（origin/main）
- 无功能性代码变更

## [2024-12-19] - Memory Bank 系统建立版本

### 🎉 重大功能发布
- ✨ **完整Memory Bank系统**: 创建7个核心记忆文件的完整体系
- ✨ **Cursor CLI记忆保存**: 实现手动记忆保存的完整解决方案
- ✨ **项目上下文管理**: 建立结构化的项目知识管理系统

### 🔧 技术问题解决
- ✅ **PostgreSQL连接问题**: 完整解决pg_hba.conf访问控制问题
- ✅ **DBeaver连接配置**: 提供SSL模式配置的完整指导
- ✅ **IP白名单问题**: 解决113.71.250.72的数据库访问权限

### 📁 新增文件结构
```
memory-bank/
├── projectbrief.md    # 项目概述和架构
├── activeContext.md   # 当前工作上下文
├── progress.md        # 项目进度跟踪
├── rules.md          # 开发规范和约定
├── changelog.md      # 版本变更记录
├── notes.md          # 配置和问题解决方案
└── README.md         # Memory Bank使用指南
```

### 📝 文档和配置更新
- 📝 创建完整的Memory Bank使用指南
- 📝 更新.cursorrules文件增强AI理解
- 📝 建立PostgreSQL连接故障排除流程
- 📝 记录DBeaver配置最佳实践

### 🚀 系统增强
- 🔧 建立AI记忆的持久化机制
- 🔧 优化项目上下文的结构化存储
- 🔧 实现多层次的记忆保存策略

## [2024-12-08] - 数据库架构升级

### 重大变更
- 🚀 **数据库架构统一**: 从双数据库模式升级为统一数据库
- 🚀 **PostgreSQL迁移**: 完成从MySQL到PostgreSQL的迁移
- 🚀 **数据表整合**: Next.js系统表 + 赛狐ERP同步表统一管理

### 新增功能
- ✨ 统一数据库连接配置
- ✨ SQL联合查询支持
- ✨ 数据库管理脚本 (manage_postgres.sh)
- ✨ 数据库测试脚本 (test_database.py)

### 技术改进
- 🔧 数据库连接池优化
- 🔧 查询性能优化
- 🔧 索引策略优化

## [2024-11] - 赛狐ERP同步系统

### 新增功能
- ✨ 赛狐ERP数据同步系统
- ✨ 产品分析数据同步
- ✨ FBA库存数据同步
- ✨ 库存明细数据同步
- ✨ 定时任务调度系统

### 技术架构
- 🏗️ Python异步数据处理
- 🏗️ APScheduler任务调度
- 🏗️ 数据验证和清洗
- 🏗️ 错误处理和重试机制

## [2024-10] - 核心平台建设

### 新增功能
- ✨ Next.js 15 + React 19 升级
- ✨ TypeScript严格模式
- ✨ Drizzle ORM集成
- ✨ NextAuth.js v5认证系统
- ✨ Stripe支付集成

### UI/UX改进
- 🎨 Shadcn UI组件库
- 🎨 Tailwind CSS样式系统
- 🎨 深色/浅色主题支持
- 🎨 响应式设计优化

### 国际化
- 🌐 next-intl集成
- 🌐 中英文双语支持
- 🌐 本地化格式支持

## 技术债务解决记录

### 已解决
- ✅ 数据库连接池内存泄漏
- ✅ API响应时间优化
- ✅ 前端组件性能优化

### 待解决
- 📋 数据库查询优化
- 📋 缓存策略改进
- 📋 错误处理标准化
