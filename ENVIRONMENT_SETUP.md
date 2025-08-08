# 环境变量配置指南

## 🔧 必需的环境变量

为了正常运行AI分析功能，您需要设置以下环境变量：

### 1. 创建环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# 在 data_all/total_project/ 目录下
touch .env.local
```

### 2. 配置环境变量

将以下内容添加到 `.env.local` 文件中：

```bash
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# NextAuth配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key-here"

# AI服务配置 - 必需
DEEPSEEK_API_KEY="your-deepseek-api-key-here"

# 可选AI服务配置
OPENROUTER_API_KEY="your-openrouter-api-key-here"
SILICONFLOW_API_KEY="your-siliconflow-api-key-here"
SILICONFLOW_BASE_URL="https://api.siliconflow.com/v1"

# 认证配置
NEXT_PUBLIC_AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
NEXT_PUBLIC_AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# 支付配置
STRIPE_PRIVATE_KEY="your-stripe-private-key"
STRIPE_PUBLIC_KEY="your-stripe-public-key"
NEXT_PUBLIC_WEB_URL="http://localhost:3000"
NEXT_PUBLIC_PAY_CANCEL_URL="http://localhost:3000/pay-cancel"

# 应用配置
NEXT_PUBLIC_PROJECT_NAME="库存管理系统"
NEXT_PUBLIC_DEFAULT_THEME="system"
NEXT_PUBLIC_LOCALE_DETECTION="true"

# 开发配置
NODE_ENV="development"
```

## 🔑 获取API密钥

### DeepSeek API密钥（必需）

1. 访问 [DeepSeek官网](https://platform.deepseek.com/)
2. 注册并登录账户
3. 进入API管理页面
4. 创建新的API密钥
5. 复制密钥并添加到 `DEEPSEEK_API_KEY`

### 其他可选API密钥

- **OpenRouter**: 访问 [OpenRouter](https://openrouter.ai/) 获取API密钥
- **SiliconFlow**: 访问 [SiliconFlow](https://siliconflow.com/) 获取API密钥

## 🚀 快速启动

### 1. 最小配置（仅AI分析功能）

如果您只需要AI分析功能，可以只设置以下变量：

```bash
# .env.local
DEEPSEEK_API_KEY="your-deepseek-api-key-here"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="any-random-string-here"
```

### 2. 启动应用

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 3. 验证配置

访问以下URL验证配置是否正确：

```
http://localhost:3000/inventory/analysis/B08XYZ123
```

## 🔍 故障排除

### 错误：DEEPSEEK_API_KEY environment variable is required

**解决方案**：
1. 确保已创建 `.env.local` 文件
2. 确保 `DEEPSEEK_API_KEY` 已正确设置
3. 重启开发服务器

```bash
# 检查环境变量是否正确加载
node -e "console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置')"
```

### 错误：数据库连接失败

**解决方案**：
1. 确保PostgreSQL数据库正在运行
2. 检查 `DATABASE_URL` 格式是否正确
3. 运行数据库迁移

```bash
# 运行数据库迁移
pnpm db:migrate
```

### 错误：NextAuth配置错误

**解决方案**：
1. 确保 `NEXTAUTH_URL` 和 `NEXTAUTH_SECRET` 已设置
2. 生成安全的密钥：

```bash
# 生成随机密钥
openssl rand -base64 32
```

## 📝 注意事项

1. **安全性**: 不要将 `.env.local` 文件提交到版本控制系统
2. **格式**: 环境变量值不需要引号，除非包含空格
3. **重启**: 修改环境变量后需要重启开发服务器
4. **验证**: 使用提供的测试脚本验证配置

## 🧪 测试配置

运行以下命令测试环境变量配置：

```bash
# 测试环境变量
node test-inventory-api-fix.js
```

如果所有测试通过，说明配置正确。 