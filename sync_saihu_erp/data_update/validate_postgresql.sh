#!/bin/bash
# PostgreSQL迁移验证和快速启动脚本

echo "=========================================="
echo " PostgreSQL迁移验证和快速启动脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查PostgreSQL是否安装
check_postgresql() {
    echo "🔍 检查PostgreSQL安装状态..."
    
    if command -v pg_config &> /dev/null; then
        pg_version=$(pg_config --version)
        echo -e "${GREEN}✅ PostgreSQL已安装: $pg_version${NC}"
    else
        echo -e "${RED}❌ PostgreSQL未安装或未添加到PATH${NC}"
        echo "请安装PostgreSQL:"
        echo "  macOS: brew install postgresql"
        echo "  Ubuntu: sudo apt install postgresql postgresql-contrib"
        echo "  CentOS: sudo yum install postgresql-server"
        exit 1
    fi
}

# 检查Python依赖
check_python_deps() {
    echo ""
    echo "🔍 检查Python依赖..."
    
    # 检查psycopg2
    if python3 -c "import psycopg2" 2>/dev/null; then
        echo -e "${GREEN}✅ psycopg2已安装${NC}"
    else
        echo -e "${RED}❌ psycopg2未安装${NC}"
        echo "正在安装..."
        pip3 install psycopg2-binary
        
        if python3 -c "import psycopg2" 2>/dev/null; then
            echo -e "${GREEN}✅ psycopg2安装成功${NC}"
        else
            echo -e "${RED}❌ psycopg2安装失败${NC}"
            exit 1
        fi
    fi
}

# 创建数据库
create_database() {
    echo ""
    echo "🗄️  创建PostgreSQL数据库..."
    
    # 检查数据库是否存在
    if psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'amazon_analyst'" | grep -q 1; then
        echo -e "${YELLOW}⚠️  数据库amazon_analyst已存在${NC}"
        read -p "是否继续？(跳过创建) [y/N]: " continue_anyway
        if [[ $continue_anyway != [yY] ]]; then
            return 0
        fi
    else
        # 创建数据库
        if createdb -U postgres amazon_analyst 2>/dev/null; then
            echo -e "${GREEN}✅ 数据库amazon_analyst创建成功${NC}"
        else
            echo -e "${RED}❌ 数据库创建失败${NC}"
            echo "可能的解决方案："
            echo "1. 确保PostgreSQL服务正在运行: sudo systemctl start postgresql"
            echo "2. 检查postgres用户权限"
            echo "3. 检查PostgreSQL配置文件pg_hba.conf"
            return 1
        fi
    fi
}

# 初始化数据库结构
initialize_database() {
    echo ""
    echo "📊 初始化数据库结构..."
    
    if psql -U postgres -d amazon_analyst -f sql/postgresql_init.sql > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库结构初始化成功${NC}"
    else
        echo -e "${RED}❌ 数据库结构初始化失败${NC}"
        return 1
    fi
}

# 验证数据库连接
validate_connection() {
    echo ""
    echo "🔗 验证数据库连接..."
    
    # 检查环境变量
    if [[ -z "$DB_PASSWORD" ]]; then
        echo -e "${YELLOW}⚠️  未设置DB_PASSWORD环境变量${NC}"
        echo "请设置: export DB_PASSWORD=your_postgres_password"
        read -p "是否继续(y/N): " continue_test
        if [[ $continue_test != [yY] ]]; then
            return 0
        fi
    fi
    
    # 运行Python验证脚本
    if python3 test_postgresql.py; then
        echo -e "${GREEN}✅ PostgreSQL连接验证通过${NC}"
        return 0
    else
        echo -e "${RED}❌ PostgreSQL连接验证失败${NC}"
        return 1
    fi
}

# 显示状态信息
show_status() {
    echo ""
    echo "📋 当前配置状态"
    echo "=================="
    echo "数据库主机: ${DB_HOST:-localhost}"
    echo "数据库端口: ${DB_PORT:-5432}"
    echo "数据库用户: ${DB_USER:-postgres}"
    echo "数据库名称: ${DB_NAME:-amazon_analyst}"
    echo ""
    echo "环境变量设置示例:"
    echo 'export DB_PASSWORD="your_postgres_password"'
    echo 'export DB_HOST="localhost"'
    echo 'export DB_PORT="5432"'
    echo 'export DB_USER="postgres"'
    echo 'export DB_NAME="amazon_analyst"'
    echo ""
}

# 主函数
main() {
    echo "开始PostgreSQL迁移验证..."
    
    # 设置默认环境变量
    export DB_HOST=${DB_HOST:-localhost}
    export DB_PORT=${DB_PORT:-5432}
    export DB_USER=${DB_USER:-amazon_analyst}
    export DB_PASSWORD=${DB_PASSWORD:-amazon_analyst_2024}
    export DB_NAME=${DB_NAME:-amazon_analyst}
    
    check_postgresql
    check_python_deps
    
    # 询问是否自动创建数据库
    read -p "是否自动创建并初始化数据库？[y/N]: " auto_create
    if [[ $auto_create == [yY] ]]; then
        create_database
        initialize_database
    else
        echo -e "${YELLOW}⚠️  跳过数据库创建步骤${NC}"
        echo "请手动创建数据库并执行: psql -U postgres -d amazon_analyst -f sql/postgresql_init.sql"
    fi
    
    show_status
    validate_connection
    
    echo ""
    echo "=========================================="
    echo " PostgreSQL迁移验证完成！"
    echo "=========================================="
    echo ""
    echo "下一步操作:"
    echo "1. 运行数据同步测试: python3 sync_simple.py"
    echo "2. 查看完整文档: docs/postgresql_migration_guide.md"
    echo "3. 启动定时任务: python3 continuous_sync_4hours.py"
    echo ""
}

# 获取脚本参数，支持跳过某些步骤
case "${1:-}" in
    "--no-create")
        check_postgresql
        check_python_deps
        show_status
        validate_connection
        ;;
    "--help"|-h)
        echo "用法: $0 [选项]"
        echo ""
        echo "选项:"
        echo "  --no-create  跳过数据库创建和初始化"
        echo "  --help       显示此帮助信息"
        ;;
    *)
        main
        ;;
esac