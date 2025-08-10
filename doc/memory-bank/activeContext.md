# 当前活跃上下文（Ops Helios）

## 当前工作状态
- **主要任务**: ✅ 启用严格构建校验并通过；开发提效已落地（tsc watch + 并行开发）
- **技术焦点**: 去除无效依赖、统一数据库访问适配、修复脚本类型
- **最近完成**: 移除 fumadocs 依赖、pg-client 适配、脚本类型修复
- **最后更新**: 2025-08-10  
  - 品牌重命名：Amazon Analyst → Ops Helios（代码与文档可见文案已替换）  
  - 分析功能：移除“多日聚合”，仅保留“单日分析”（`analysis-period-selector.tsx` 精简）
  - 法务：更新《隐私政策》《服务条款》，统一为 Ops Helios，标注 Built by Tepin Team（特拼团队打造）

### 仓库与版本状态
- 本地分支 `main` 已与 `origin/main` 同步
- 最新提交: `b835ff9` refactor(erp-sync): unify database schema and remove saihu_ prefix
- 上一次提交: `46e1286` feat: 建立 Memory Bank 系统和解决 PostgreSQL 连接问题
- 本次任务: 数据库架构统一化重构

## 用户当前需求
1. **✅ 已完成**: 数据库架构统一化
   - 问题: run_30day_backfill_sync.py 代码检查，发现表名不匹配
   - 需求: 去除 saihu_ 前缀，统一数据库架构
   - 解决: 更新schema和所有配置文件，使用统一表名

2. **✅ 已完成**: PostgreSQL连接配置问题
   - IP地址: 113.71.250.72
   - 数据库: amazon_analyst
   - 用户: amazon_analyst
   - 解决方案: pg_hba.conf配置指导、SSL连接方案、DBeaver配置

3. **✅ 已完成**: Cursor CLI记忆保存系统
   - 需求: 手动保存Cursor的记忆
   - 实现: 完整Memory Bank系统 (7个核心文件)
   - 工具: .cursorrules文件配置

## 项目当前状态
- **数据库**: PostgreSQL统一数据库架构已完全统一 ✅
- **表结构**: 去除saihu_前缀，使用统一表名 ✅
- **开发环境**: Next.js + TypeScript + Drizzle ORM ✅
- **同步系统**: Python赛狐ERP数据同步系统运行中 ✅
- **记忆系统**: Memory Bank系统已建立并运行 ✅（本次已同步品牌更名与功能收口）
- **仓库**: 已推送至提交 `b835ff9`（origin/main）

## 当前活跃任务
- **构建修复**: 清理依赖与修复类型错误 ✅（已通过）
- **开发提效**: 已添加本地提效脚本与配置 ✅
- **严格构建**: 已移除本地跳过配置，恢复类型与 ESLint 严格校验，构建通过 ✅
- **数据库访问**: 应用层改用 `pgClient` ✅
- **Memory Bank维护**: 定期更新项目记忆和上下文
- **后续项**: 统一 `AnalysisResult.insights` 类型与展示组件；如需恢复“多日聚合”，需重新设计API与聚合服务入口

## 重要配置信息
- **数据库连接**: postgresql://amazon_analyst:amazon_analyst_2024@localhost:5432/amazon_analyst
- **数据库表**: product_analytics, fba_inventory, inventory_details, sync_task_logs (无saihu_前缀)
- **项目路径**: /root/amazon-analyst (当前环境)
- **项目品牌**: Ops Helios（原名 Amazon Analyst）
- **开发工具**: DBeaver (数据库管理), Memory Bank (记忆管理)
- **记忆文件**: memory-bank/ 目录下的7个核心文件
- **最新提交**: b835ff9 (2025-08-09 数据库统一化重构)
