#!/usr/bin/env python3
"""
PostgreSQL连接测试和验证脚本
用于验证从MySQL到PostgreSQL的迁移是否成功
"""

import os
import sys
import logging
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from src.database.connection import db_manager

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_database_connection():
    """测试数据库连接"""
    print("=" * 50)
    print("🔄 测试PostgreSQL数据库连接")
    print("=" * 50)
    
    try:
        # 测试连接
        if db_manager.test_connection():
            print("✅ 数据库连接测试成功")
            return True
        else:
            print("❌ 数据库连接测试失败")
            return False
    except Exception as e:
        print(f"❌ 连接测试出错: {e}")
        return False

def test_table_existance():
    """测试表存在性"""
    print("\n" + "=" * 50)
    print("🗃️  检查数据库表结构")
    print("=" * 50)
    
    expected_tables = [
        'fba_inventory',
        'inventory_details', 
        'product_analytics',
        'inventory_points',
        'sync_task_log'
    ]
    
    table_status = {}
    for table in expected_tables:
        exists = db_manager.table_exists(table)
        status = "✅" if exists else "❌"
        print(f"{status} {table:20} {'存在' if exists else '不存在'}")
        table_status[table] = exists
    
    return all(table_status.values())

def test_basic_data_operations():
    """测试基本数据操作"""
    print("\n" + "=" * 50)
    print("🔧 测试基本数据操作")
    print("=" * 50)
    
    try:
        # 测试查询操作
        print("1. 测试查询操作...")
        
        # 检查inventory_points默认数据
        results = db_manager.execute_query(
            "SELECT warehouse_code, warehouse_name FROM inventory_points LIMIT 5"
        )
        
        if results:
            print("✅ 成功查询到inventory_points数据:")
            for row in results:
                print(f"   - {row[0]}: {row[1]}")
        else:
            print("⚠️ inventory_points表为空，需要插入初始数据")
            
        # 测试统计查询
        print("\n2. 测试记录统计...")
        counts = db_manager.execute_query("""
            SELECT 
                (SELECT COUNT(*) FROM inventory_points) as total_points,
                (SELECT COUNT(*) FROM fba_inventory) as total_fba,
                (SELECT COUNT(*) FROM product_analytics WHERE data_date >= CURRENT_DATE - INTERVAL '30 days') as recent_analytics
        """)
        
        if counts:
            count_data = counts[0]
            print(f"   📍库存点数量: {count_data[0]}")
            print(f"   📦FBA库存记录: {count_data[1]}")
            print(f"   📊近30天分析记录: {count_data[2]}")
        
        return True
        
    except Exception as e:
        print(f"❌ 数据操作测试失败: {e}")
        return False

def test_upsert_functionality():
    """测试PostgreSQL的UPSERT功能"""
    print("\n" + "=" * 50)
    print("⚡ 测试UPSERT功能")
    print("=" * 50)
    
    try:
        # 创建测试数据
        test_data = {
            'warehouse_code': 'TEST001',
            'warehouse_name': '测试仓库',
            'country_code': 'CN',
            'is_eu': False
        }
        
        # 测试插入
        result = db_manager.execute_update("""
            INSERT INTO inventory_points (warehouse_code, warehouse_name, country_code, is_eu) 
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (warehouse_code) DO UPDATE
            SET warehouse_name = EXCLUDED.warehouse_name,
                country_code = EXCLUDED.country_code,
                is_eu = EXCLUDED.is_eu
        """, (
            test_data['warehouse_code'],
            test_data['warehouse_name'], 
            test_data['country_code'],
            test_data['is_eu']
        ))
        
        print(f"✅ UPSERT操作成功影响行数: {result}")
        
        # 验证数据
        verify = db_manager.execute_single(
            "SELECT warehouse_name FROM inventory_points WHERE warehouse_code = %s",
            (test_data['warehouse_code'],)
        )
        
        if verify and verify[0] == test_data['warehouse_name']:
            print("✅ 数据验证通过")
            return True
        else:
            print("❌ 数据验证失败")
            return False
            
    except Exception as e:
        print(f"❌ UPSERT测试失败: {e}")
        return False

def show_connection_info():
    """显示连接信息"""
    print("\n" + "=" * 50)
    print("ℹ️  连接信息")
    print("=" * 50)
    try:
        info = db_manager.get_connection_info()
        print(f"💾 最大连接数: {info['max_connections']}")
        print(f"🔌 当前连接数: {info['current_connections']}")
        print(f"🎒 连接池大小: {info['pool_size']}")
        print(f"✅ 可用连接数: {info['available_connections']}")
        return True
    except Exception as e:
        print(f"❌ 获取连接信息失败: {e}")
        return False

def run_migration_test():
    """运行完整的迁移验证测试"""
    print("🚀 PostgreSQL迁移验证测试")
    print("=" * 80)
    
    test_results = {}
    
    # 运行所有测试
    test_functions = [
        ("数据库连接", test_database_connection),
        ("表结构验证", test_table_existance),
        ("基本数据操作", test_basic_data_operations),
        ("UPSERT功能", test_upsert_functionality),
        ("连接信息", show_connection_info),
    ]
    
    for test_name, test_func in test_functions:
        try:
            result = test_func()
            test_results[test_name] = result
            print(f"\n{'✅' if result else '❌'} {test_name}: {'通过' if result else '失败'}")
        except Exception as e:
            test_results[test_name] = False
            print(f"\n❌ {test_name}: 异常 - {e}")
    
    # 总结结果
    print("\n" + "=" * 80)
    print("📊 测试结果总结")
    print("=" * 80)
    
    total_tests = len(test_results)
    passed_tests = sum(test_results.values())
    
    print(f"总测试数: {total_tests}")
    print(f"通过数: {passed_tests}")
    print(f"失败数: {total_tests - passed_tests}")
    print(f"成功率: {(passed_tests/total_tests)*100:.1f}%")
    
    if all(test_results.values()):
        print("\n🎉 所有测试通过！PostgreSQL迁移准备完成")
        return True
    else:
        print("\n⚠️  部分测试失败，请检查上述错误信息")
        return False

def main():
    """主函数"""
    # 检查是否安装了PostgreSQL驱动
    try:
        import psycopg2
        print(f"psycopg2版本: {psycopg2.__version__}")
    except ImportError:
        print("❌ psycopg2未安装，请运行:")
        print("   pip install psycopg2-binary")
        sys.exit(1)
    
    # 设置默认环境变量（如果不存在）
    os.environ.setdefault('DB_HOST', 'localhost')
    os.environ.setdefault('DB_PORT', '5432')
    os.environ.setdefault('DB_USER', 'postgres')
    os.environ.setdefault('DB_NAME', 'amazon_analyst')
    
    # 如果设置了环境变量，使用配置的密码
    if not os.getenv('DB_PASSWORD'):
        print("警告：未设置DB_PASSWORD环境变量，可能连接失败")
        print("请设置环境变量 DB_PASSWORD=your_postgres_password")
    
    # 运行测试
    success = run_migration_test()
    
    # 关闭数据库连接
    try:
        db_manager.close_all_connections()
        print("\n🔌 数据库连接已关闭")
    except:
        pass
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()