# Ops Helios 项目概述

## 项目简介
Ops Helios 是一个基于 Next.js 15 的亚马逊运营分析平台，为亚马逊卖家提供AI驱动的业务洞察。

## 核心功能
- 🤖 **AI分析**: AI驱动的业务洞察和决策建议
- 🔄 **数据同步**: 与赛狐ERP系统实时数据同步

## 技术栈
- **前端**: Next.js 15, React 19, TypeScript
- **数据库**: PostgreSQL + Drizzle ORM
- **UI**: Shadcn UI, Tailwind CSS
- **认证**: NextAuth.js v5
- **AI**: 多AI提供商集成 (OpenAI, DeepSeek等)
- **支付**: Stripe
- **国际化**: next-intl

## 数据库架构
- **统一数据库**: `amazon_analyst` 
- **Next.js系统表**: 用户、会话、订单等

## 项目结构
```
src/
├── app/                    # Next.js App Router
├── components/            # React组件
├── db/                   # 数据库配置和模式
├── lib/                  # 工具库
├── services/            # 业务逻辑服务
└── types/              # TypeScript类型定义
```
