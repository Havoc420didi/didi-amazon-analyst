# 项目开发笔记

## 最新笔记

### 2025-01-02 AI分析功能重构
- **外部API集成**: 切换到 Helios API `http://localhost:8000/api/helios/stream`
- **数据库方言**: Drizzle ORM 从 MySQL 切换到 PostgreSQL 方言
- **流式传输**: 实现 SSE + 打字机效果的实时分析内容显示
- **UI简化**: 去除处理时间、风险等级模块，专注分析内容
- **Markdown支持**: 集成 `@/components/markdown` 组件渲染格式化内容
- **CSV模式**: 支持已有分析结果时重新分析功能

### 2025-08-10 品牌与功能
- 品牌统一：Amazon Analyst → Ops Helios（前端文案与文档已替换）
- 功能调整：移除"多日聚合"，保留"单日分析"；后续若恢复需与聚合服务和 API schema 对齐

### 2025-08-09 18:10 - 构建修复与依赖清理
- **依赖清理**: 移除 `fumadocs-ui/mdx`、`fumadocs-mdx/config` 相关引用
- **适配器统一**: 以 `pgClient` 统一 Postgres 访问，封装 `PostgreSQLManager`
- **脚本修复**: 迁移/测试脚本修正类型与异常处理、增加占位方法
- **剩余问题**: `AnalysisResult.insights` 类型与组件期望不一致，需统一

### 2025-08-09 17:00 - 数据库配置统一完成
- **问题解决**: 成功修复了 /inventory 页面的数据库连接问题
- **技术方案**: 创建了 pg-client 兼容层，实现了 MySQL 到 PostgreSQL 的无缝迁移
- **配置统一**: Python 脚本和 Next.js 现在使用相同的数据库用户和连接参数
- **开发环境**: Next.js 运行在 localhost:3001，PostgreSQL@14 服务正常
- **测试结果**: Python 脚本数据库连接测试达到 60% 成功率，主要功能正常

### 2025-08-09 15:30 - i18n 流程梳理
- **next-intl v4**: 完整分析了国际化实现流程
- **配置问题**: 发现 middleware matcher 包含了未支持的语言前缀
- **优化建议**: 提供了语言切换组件的容错处理方案
- **文档输出**: 生成了完整的 i18n 使用指南

## 历史笔记

### 常用开发命令（新增）
- 快速并行开发：`pnpm dev:fast`
- 全量类型检查：`pnpm typecheck`
- 持续类型检查：`pnpm typecheck:watch`
- 严格生产构建：`pnpm build`

### 技术债务记录
- [ ] inventory_points 表还需要添加 is_eu 字段以完全兼容 Python 脚本
- [ ] next.config.mjs 中的 turbopack 配置警告需要处理
- [ ] Python 脚本的 UPSERT 功能测试仍有部分失败，需要进一步调试

### 重要发现
- **数据库迁移**: MySQL 到 PostgreSQL 的占位符转换是关键技术点
- **配置管理**: 统一环境变量比分散配置更容易维护
- **兼容性设计**: 保持 API 接口不变可以减少重构成本

### 开发工具配置
- **PostgreSQL**: 使用 Homebrew 安装的 PostgreSQL@14
- **开发端口**: Next.js 默认使用 3001 端口（3000 被占用）
- **数据库用户**: 统一使用 amazon_analyst 用户，密码 amazon_analyst_2024
- **外部API**: Helios AI分析服务运行在 http://localhost:8000
- **Markdown渲染**: 使用 @uiw/react-md-editor 组件库

### AI分析技术栈
- **前端流式显示**: Server-Sent Events (SSE) + React状态管理
- **打字机效果**: 15ms间隔的字符逐一显示
- **内容过滤**: 过滤控制事件，只显示实际分析内容
- **数据提取**: 后端只保存"综合分析报告"部分到数据库
- **格式支持**: Markdown标题、列表、粗体、代码块等格式
