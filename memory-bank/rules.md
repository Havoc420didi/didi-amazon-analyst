# 项目规则和约定

## 代码规范

### TypeScript/React规范
- 使用函数式组件，避免class组件
- 优先使用React Server Components (RSC)
- 最小化使用'use client'、useEffect、useState
- 使用描述性变量名 (isLoading, hasError)
- 目录命名使用小写+连字符 (auth-wizard)

### 文件结构规范
```
src/app/[locale]/           # 国际化路由
src/components/blocks/      # 页面区块组件
src/components/ui/          # 可复用UI组件
src/lib/                   # 工具库和函数
src/services/              # 业务逻辑
src/types/                 # TypeScript类型
```

### 数据库规范
- 使用Drizzle ORM进行数据库操作
- 表名使用snake_case命名
- 所有表必须包含created_at和updated_at字段

## 开发流程

### Git工作流
- main分支为生产分支
- 功能开发使用feature分支
- 提交信息使用约定式提交格式

### 数据库迁移
```bash
pnpm db:generate    # 生成迁移文件
pnpm db:migrate     # 应用迁移
pnpm db:studio      # 打开数据库管理界面
```

## 技术约束

### 性能要求
- 页面加载时间 < 3秒
- API响应时间 < 1秒
- 数据库查询优化，使用适当索引

### 安全要求
- 所有API端点必须进行身份验证
- 敏感数据加密存储
- 输入数据验证和清理

### 可维护性
- 代码覆盖率 > 80%
- 组件必须有TypeScript类型定义
- 复杂逻辑必须有注释说明

## UI/UX规范
- 使用Shadcn UI组件库
- 遵循Material Design或类似设计系统
- 支持深色/浅色主题切换
- 移动端优先的响应式设计

## 国际化规范
- 使用next-intl进行国际化
- 支持中文和英文
- 所有用户界面文本必须可翻译
- 日期、时间、货币格式本地化
