# Amazon Analyst 项目指南

本文档包含 Amazon Analyst 项目的重要信息和指南，供 Claude 和开发者参考。

## 项目概述

Amazon Analyst 是一个基于 ShipAny 模板构建的亚马逊数据分析工具。该项目使用 Next.js App Router、React、TypeScript、Shadcn UI、Radix UI 和 Tailwind CSS 构建。

## 技术栈

- **前端框架**: Next.js (App Router)
- **UI 库**: Shadcn UI, Radix UI
- **样式**: Tailwind CSS
- **语言**: TypeScript
- **国际化**: next-intl
- **数据库**: Supabase

## 项目结构

```
amazon_analyst/
├── src/
│   ├── aisdk/         # AI 功能相关代码
│   ├── app/           # Next.js App Router 页面
│   │   ├── (legal)/   # 法律相关页面
│   │   ├── [locale]/  # 多语言路由
│   │   │   ├── (admin)    # 管理员页面
│   │   │   ├── (default)  # 普通用户页面
│   │   │   │   ├── (console)  # 用户控制台
│   │   ├── api/      # API 路由
│   ├── auth/         # 认证相关代码
│   ├── components/   # React 组件
│   ├── contexts/     # React 上下文
│   ├── db/           # 数据库相关代码
│   ├── hooks/        # React 自定义钩子
│   ├── i18n/         # 国际化配置和翻译
│   ├── lib/          # 工具函数
│   ├── models/       # 数据模型
│   ├── providers/    # React 提供者
│   ├── services/     # 服务层
│   └── types/        # TypeScript 类型定义
```

## 代码风格指南

### TypeScript 规范

- 使用函数式和声明式编程模式，避免使用类
- 使用描述性变量名，辅助动词前缀（如 isLoading, hasError）
- 使用接口而非类型，除非有特殊需求
- 避免使用枚举，使用映射对象代替

```typescript
// 推荐
interface User {
  id: string;
  name: string;
  isActive: boolean;
}

// 避免
type User = {
  id: string;
  name: string;
  isActive: boolean;
}

// 避免使用枚举，使用映射对象
const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
} as const;

type UserRole = typeof UserRole[keyof typeof UserRole];
```

### 文件和目录命名

- 目录名使用小写字母和连字符（如 `components/auth-wizard`）
- 组件文件使用 PascalCase（如 `Button.tsx`）
- 工具函数文件使用 camelCase（如 `formatDate.ts`）
- 优先使用命名导出而非默认导出

### 组件结构

组件文件的推荐结构：

1. 导出的主组件
2. 子组件
3. 辅助函数
4. 静态内容
5. 类型定义

```typescript
// 导出的主组件
export function UserProfile({ user }: UserProfileProps) {
  // ...
  return (
    <div>
      <ProfileHeader user={user} />
      <ProfileDetails user={user} />
    </div>
  );
}

// 子组件
function ProfileHeader({ user }: { user: User }) {
  // ...
}

function ProfileDetails({ user }: { user: User }) {
  // ...
}

// 辅助函数
function formatUserName(user: User) {
  // ...
}

// 类型定义
interface UserProfileProps {
  user: User;
}
```

### React 和 Next.js 最佳实践

- 尽量使用 React Server Components (RSC)，减少 `use client` 的使用
- 仅在需要客户端交互时使用 `use client`
- 使用 Suspense 包装客户端组件，提供 fallback
- 使用 dynamic import 加载非关键组件
- 遵循 Next.js 文档中的数据获取、渲染和路由最佳实践

## 常用命令

### 开发命令

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建项目
pnpm build

# 启动生产服务器
pnpm start

# 运行测试
pnpm test
```

### Git 命令

```bash
# 创建新分支
git checkout -b feature/new-feature

# 提交更改
git add .
git commit -m "feat: add new feature"

# 拉取最新代码
git pull origin main

# 推送更改
git push origin feature/new-feature
```

## 项目功能

### 用户控制台功能

- **我的订单**: 查看用户已购买的服务或产品订单
- **我的积分**: 查看和管理用户账户中的积分余额
- **我的邀请**: 邀请好友使用系统并获得奖励
- **API密钥**: 管理用户的API访问密钥

### 管理员功能

- **用户管理**: 查看和管理系统中的所有用户
- **订单管理**: 查看和管理所有用户的订单
- **文章管理**: 管理网站上的博客文章或新闻
- **反馈管理**: 查看和管理用户提交的反馈

## 性能优化指南

- 使用 Tailwind CSS 进行响应式设计，采用移动优先方法
- 优化图片：使用 WebP 格式，包含尺寸数据，实现懒加载
- 优化 Web Vitals (LCP, CLS, FID)
- 使用 `nuqs` 进行 URL 搜索参数状态管理
- 限制 `use client` 的使用:
  - 优先使用服务器组件和 Next.js SSR
  - 仅在需要访问 Web API 的小组件中使用
  - 避免用于数据获取或状态管理

## 国际化

项目使用 `next-intl` 进行国际化，翻译文件位于 `src/i18n/messages` 目录。

支持的语言：
- 英语 (en)
- 中文 (zh)

## 注意事项和已知问题

- 确保在开发过程中遵循 TypeScript 类型定义
- 避免在服务器组件中使用客户端特有的 API
- 注意处理 API 调用中的错误和加载状态
