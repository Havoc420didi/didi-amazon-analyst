#!/bin/bash
# PostgreSQL管理脚本是用于Amazon Analyst项目

echo "=== Amazon Analyst PostgreSQL管理工具 ==="
echo

# 常用变量
DB_USER="amazon_analyst"
DB_PASSWORD="amazon_analyst_2024"
DB_MAIN="amazon_analyst"
DB_SYNC="saihu_erp_sync"

# 函数定义
show_status() {
    echo "📊 数据库状态："
    echo "- PostgreSQL服务状态："
    systemctl is-active postgresql
    echo
    echo "- 数据库列表："
    sudo -u postgres psql -c "\l+ amazon_analyst saihu_erp_sync"
    echo
    echo "- 用户权限检查："
    sudo -u postgres psql -c "\du amazon_analyst"
}

create_backup() {
    local backup_dir="/var/backups/postgresql"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    echo "💾 创建数据库备份..."
    sudo mkdir -p "$backup_dir"
    
    for db in $DB_MAIN $DB_SYNC; do
        echo "备份数据库: $db"
        sudo -u postgres pg_dump "$db" > "$backup_dir/${db}_${timestamp}.sql"
    done
    
    echo "✅ 备份完成：/var/backups/postgresql/"
}

restore_backup() {
    local backup_file="$1"
    if [[ -z "$backup_file" ]]; then
        echo "使用方法: $0 restore /path/to/backup.sql"
        return 1
    fi
    
    echo "♻️  恢复数据库备份: $backup_file"
    local db_name=$(basename "$backup_file" | cut -d_ -f1)
    sudo -u postgres psql -d "$db_name" < "$backup_file"
    echo "✅ 恢复完成"
}

reset_databases() {
    echo "⚠️  重置数据库将删除所有数据！"
    read -p "确定要继续吗？(输入 'YES' 确认): " confirm
    
    if [[ "$confirm" == "YES" ]]; then
        echo "🔄 重置数据库..."
        
        for db in $DB_MAIN $DB_SYNC; do
            echo "重新创建数据库: $db"
            sudo -u postgres psql -c "DROP DATABASE IF EXISTS $db;"
            sudo -u postgres psql -c "CREATE DATABASE $db OWNER $DB_USER;"
            sudo -u postgres psql -d "$db" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
        done
        
        echo "✅ 数据库重置完成"
    else
        echo "❌ 操作已取消"
    fi
}

show_help() {
    echo "用法: $0 <命令>"
    echo
    echo "命令："
    echo "  status        - 显示数据库状态"
    echo "  backup        - 创建数据库备份"
    echo "  restore BACKUP_FILE - 恢复数据库备份"
    echo "  reset         - 重置数据库（删除所有数据）"
    echo "  help          - 显示此帮助信息"
    echo
    echo "示例："
    echo "  $0 status"
    echo "  $0 backup"
    echo "  $0 restore /var/backups/postgresql/amazon_analyst_20241201_143000.sql"
}

# 主程序
case "$1" in
    "status")
        show_status
        ;;
    "backup")
        create_backup
        ;;
    "restore")
        restore_backup "$2"
        ;;
    "reset")
        reset_databases
        ;;
    "help"|"-h"|"--help"|"")
        show_help
        ;;
    *)
        echo "未知命令: $1"
        show_help
        exit 1
        ;;
esac