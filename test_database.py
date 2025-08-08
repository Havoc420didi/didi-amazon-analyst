#!/usr/bin/env python3
"""
数据库连接测试脚本
测试Amazon Analyst项目数据库连接
"""
import psycopg2
import sys

def test_connection(db_config, system_name):
    """测试数据库连接"""
    try:
        conn = psycopg2.connect(
            host=db_config['host'],
            port=db_config['port'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database']
        )
        
        # 获取PostgreSQL版本
        with conn.cursor() as cursor:
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            
        conn.close()
        print(f"✅ {system_name}数据库连接成功")
        print(f"   数据库: {db_config['database']}")
        print(f"   版本: {version.split(' ')[1]}")
        return True
        
    except Exception as e:
        print(f"❌ {system_name}数据库连接失败: {e}")
        return False

def test_postgresql_setup():
    """测试完整的PostgreSQL设置"""
    print("🚀 开始测试PostgreSQL配置...")
    print("=" * 50)
    
    # 测试配置
    configs = [
        {
            'name': 'Next.js主系统',
            'config': {
                'host': 'localhost',
                'port': 5432,
                'user': 'amazon_analyst',
                'password': 'amazon_analyst_2024',
                'database': 'amazon_analyst'
            }
        },
        {
            'name': 'Python赛狐同步系统',
            'config': {
                'host': 'localhost',
                'port': 5432,
                'user': 'amazon_analyst',
                'password': 'amazon_analyst_2024',
                'database': 'amazon_analyst'
            }
        }
    ]
    
    results = []
    for system in configs:
        success = test_connection(system['config'], system['name'])
        results.append((system['name'], success))
        print()
    
    print("📊 测试结果汇总:")
    print("-" * 30)
    total_tests = len(results)
    successful_tests = sum(1 for _, success in results if success)
    
    for name, success in results:
        status = "✅ 正常" if success else "❌ 失败"
        print(f"{name}: {status}")
    
    print(f"\n总结: {successful_tests}/{total_tests} 个测试通过")
    
    if successful_tests == total_tests:
        print("🎉 所有数据库配置正常！系统可正常使用")
        return True
    else:
        print("⚠️  部分配置有问题，请检查连接设置")
        return False

if __name__ == "__main__":
    success = test_postgresql_setup()
    sys.exit(0 if success else 1)