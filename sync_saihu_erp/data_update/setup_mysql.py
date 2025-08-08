#!/usr/bin/env python3
"""
MySQL数据库初始化脚本
"""
import sys
import os
import mysql.connector
import logging
from pathlib import Path

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_mysql_database():
    """设置MySQL数据库"""
    try:
        print("🔧 开始设置MySQL数据库...")
        
        # 数据库配置
        config = {
            'host': 'localhost',
            'port': 3306,
            'user': 'root',  # 先用root用户创建数据库和用户
            'password': '123456',  # 请输入你的MySQL root密码
            'charset': 'utf8mb4'
        }
        
        print(f"🔌 连接到MySQL服务器...")
        
        # 连接到MySQL服务器
        connection = mysql.connector.connect(**config)
        cursor = connection.cursor()
        
        print("✅ MySQL服务器连接成功")
        
        # 创建数据库
        print("📋 创建数据库 saihu_erp_sync...")
        cursor.execute("CREATE DATABASE IF NOT EXISTS saihu_erp_sync DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        
        # 创建用户并授权
        print("👤 创建用户 hudi...")
        cursor.execute("CREATE USER IF NOT EXISTS 'hudi'@'localhost' IDENTIFIED BY '123456'")
        cursor.execute("GRANT ALL PRIVILEGES ON saihu_erp_sync.* TO 'hudi'@'localhost'")
        cursor.execute("FLUSH PRIVILEGES")
        
        print("✅ 数据库和用户创建成功")
        
        # 切换到目标数据库
        cursor.execute("USE saihu_erp_sync")
        
        # 读取并执行初始化SQL脚本
        sql_file_path = Path(__file__).parent / "sql" / "init.sql"
        
        if sql_file_path.exists():
            print("📜 执行初始化SQL脚本...")
            
            with open(sql_file_path, 'r', encoding='utf-8') as file:
                sql_content = file.read()
            
            # 分割SQL语句
            sql_statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
            
            for statement in sql_statements:
                if statement and not statement.startswith('--'):
                    try:
                        cursor.execute(statement)
                        print(f"✅ 执行SQL: {statement[:50]}...")
                    except mysql.connector.Error as e:
                        print(f"⚠️ SQL执行警告: {e}")
                        continue
            
            connection.commit()
            print("✅ 初始化SQL脚本执行完成")
        else:
            print("⚠️ 未找到初始化SQL脚本，手动创建FBA库存表...")
            
            # 手动创建FBA库存表
            fba_table_sql = """
            CREATE TABLE IF NOT EXISTS fba_inventory (
                id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
                sku VARCHAR(128) NOT NULL COMMENT 'SKU编码',
                asin VARCHAR(32) DEFAULT NULL COMMENT 'ASIN码',
                marketplace_id VARCHAR(32) NOT NULL COMMENT '市场ID',
                marketplace_name VARCHAR(64) DEFAULT NULL COMMENT '市场名称',
                available_quantity INT DEFAULT 0 COMMENT '可用库存数量',
                reserved_quantity INT DEFAULT 0 COMMENT '预留库存数量',
                inbound_quantity INT DEFAULT 0 COMMENT '入库中数量',
                researching_quantity INT DEFAULT 0 COMMENT '研究中数量',
                unfulfillable_quantity INT DEFAULT 0 COMMENT '不可履约数量',
                total_quantity INT DEFAULT 0 COMMENT '总库存数量',
                snapshot_date DATE NOT NULL COMMENT '快照日期',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                PRIMARY KEY (id),
                UNIQUE KEY uk_sku_marketplace_date (sku, marketplace_id, snapshot_date),
                INDEX idx_sku (sku),
                INDEX idx_marketplace_id (marketplace_id),
                INDEX idx_snapshot_date (snapshot_date),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='FBA库存表'
            """
            
            cursor.execute(fba_table_sql)
            connection.commit()
            print("✅ FBA库存表创建成功")
        
        # 验证表创建
        cursor.execute("SHOW TABLES LIKE 'fba_inventory'")
        result = cursor.fetchone()
        
        if result:
            print("✅ FBA库存表验证成功")
            
            # 显示表结构
            cursor.execute("DESCRIBE fba_inventory")
            columns = cursor.fetchall()
            
            print("📋 FBA库存表结构:")
            for column in columns:
                print(f"   {column[0]}: {column[1]} {column[2]} {column[3]}")
        else:
            print("❌ FBA库存表创建失败")
            return False
        
        cursor.close()
        connection.close()
        
        print("\n🎉 MySQL数据库设置完成！")
        print("现在可以运行FBA库存同步测试了")
        return True
        
    except mysql.connector.Error as e:
        print(f"❌ MySQL数据库设置失败: {e}")
        return False
    except Exception as e:
        print(f"❌ 设置过程异常: {e}")
        return False

def test_database_connection():
    """测试数据库连接"""
    try:
        print("\n🔍 测试数据库连接...")
        
        config = {
            'host': 'localhost',
            'port': 3306,
            'user': 'hudi',
            'password': '123456',
            'database': 'saihu_erp_sync',
            'charset': 'utf8mb4'
        }
        
        connection = mysql.connector.connect(**config)
        cursor = connection.cursor()
        
        # 测试查询
        cursor.execute("SELECT COUNT(*) FROM fba_inventory")
        result = cursor.fetchone()
        
        print(f"✅ 数据库连接成功，FBA库存表当前有 {result[0]} 条记录")
        
        cursor.close()
        connection.close()
        
        return True
        
    except Exception as e:
        print(f"❌ 数据库连接测试失败: {e}")
        return False

if __name__ == "__main__":
    print("🚀 MySQL数据库初始化工具")
    print("=" * 60)
    
    # 设置数据库
    setup_success = setup_mysql_database()
    
    if setup_success:
        # 测试连接
        test_success = test_database_connection()
        
        print("\n" + "=" * 60)
        if test_success:
            print("🎉 MySQL数据库设置完成并测试通过！")
            print("现在可以运行以下命令测试FBA库存同步:")
            print("python3 test_fba_mysql_sync.py")
        else:
            print("⚠️ 数据库设置完成，但连接测试失败")
    else:
        print("❌ MySQL数据库设置失败")
        print("\n💡 请检查:")
        print("   1. MySQL服务是否正在运行")
        print("   2. root用户密码是否正确")
        print("   3. 用户是否有足够的权限")
    
    print("=" * 60)