#!/bin/bash

# 环境变量快速设置脚本
# 用于解决 DEEPSEEK_API_KEY 缺失问题

echo "🔧 环境变量快速设置脚本"
echo "=========================="

# 检查是否已存在 .env.local 文件
if [ -f ".env.local" ]; then
    echo "⚠️  发现已存在的 .env.local 文件"
    read -p "是否要备份现有文件？(y/n): " backup_choice
    if [ "$backup_choice" = "y" ] || [ "$backup_choice" = "Y" ]; then
        cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
        echo "✅ 已备份到 .env.local.backup.$(date +%Y%m%d_%H%M%S)"
    fi
fi

# 创建最小配置的 .env.local 文件
echo "📝 创建最小配置的 .env.local 文件..."

cat > .env.local << 'EOF'
# 最小配置 - 仅支持AI分析功能
# 请根据实际情况修改以下值

# AI服务配置 - 必需
DEEPSEEK_API_KEY="your-deepseek-api-key-here"

# NextAuth配置 - 必需
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key-here"

# 数据库配置 - 可选（如果不需要数据库功能）
# DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# 开发配置
NODE_ENV="development"
EOF

echo "✅ 已创建 .env.local 文件"

# 生成随机密钥
echo "🔑 生成随机 NextAuth 密钥..."
RANDOM_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "fallback-secret-key-$(date +%s)")

# 更新 .env.local 文件中的密钥
sed -i.bak "s/your-nextauth-secret-key-here/$RANDOM_SECRET/" .env.local
rm -f .env.local.bak

echo "✅ 已生成随机 NextAuth 密钥"

echo ""
echo "📋 下一步操作："
echo "1. 编辑 .env.local 文件，设置您的 DEEPSEEK_API_KEY"
echo "2. 获取 DeepSeek API 密钥：https://platform.deepseek.com/"
echo "3. 重启开发服务器：pnpm dev"
echo ""
echo "🔍 验证配置："
echo "node -e \"console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置')\""
echo ""
echo "📖 详细配置说明请查看：ENVIRONMENT_SETUP.md" 