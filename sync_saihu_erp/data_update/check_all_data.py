#!/usr/bin/env python3
"""
检查数据库中所有可用的产品数据
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def check_all_available_data():
    """检查所有可用的产品数据"""
    db_manager = DatabaseManager()
    
    print("🔍 检查数据库中所有可用的产品数据...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            
            # 检查product_analytics表的所有数据
            print("\n📊 product_analytics表统计:")
            cursor.execute("SELECT COUNT(*) as total FROM product_analytics")
            total_result = cursor.fetchone()
            print(f"   总记录数: {total_result['total']}")
            
            # 按日期统计
            cursor.execute('''
                SELECT data_date, COUNT(*) as count, 
                       COUNT(DISTINCT asin) as unique_asins,
                       COUNT(DISTINCT marketplace_id) as unique_markets
                FROM product_analytics 
                GROUP BY data_date 
                ORDER BY data_date DESC
            ''')
            date_stats = cursor.fetchall()
            print("   按日期分布:")
            for stat in date_stats:
                print(f"     {stat['data_date']}: {stat['count']}条记录, "
                      f"{stat['unique_asins']}个ASIN, "
                      f"{stat['unique_markets']}个市场")
            
            # 检查最新日期的详细数据
            if date_stats:
                latest_date = date_stats[0]['data_date']
                print(f"\n📋 最新日期 ({latest_date}) 的详细数据:")
                
                cursor.execute('''
                    SELECT asin, title, marketplace_id, fba_inventory, 
                           sales_quantity, sales_amount, dev_name, operator_name
                    FROM product_analytics 
                    WHERE data_date = %s
                    ORDER BY asin
                ''', (latest_date,))
                latest_data = cursor.fetchall()
                
                print(f"   详细记录 ({len(latest_data)} 条):")
                for i, record in enumerate(latest_data):
                    market_name = {
                        'A1F83G8C2ARO7P': 'UK',
                        'ATVPDKIKX0DER': 'US', 
                        'A1PA6795UKMFR9': 'DE',
                        'A13V1IB3VIYZZH': 'FR',
                        'APJ6JRA9NG5V4': 'IT',
                        'A1RKKUPIHCS9HS': 'ES'
                    }.get(record['marketplace_id'], record['marketplace_id'])
                    
                    print(f"     {i+1}. {record['asin']} - {market_name}")
                    print(f"        产品: {(record['title'] or '')[:50]}...")
                    print(f"        库存: {record['fba_inventory']}, 销量: {record['sales_quantity']}")
                    print(f"        负责人: {record['dev_name']} / {record['operator_name']}")
            
            # 检查是否有其他相关表
            print("\n🔍 检查其他可能的数据表:")
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            
            product_related_tables = []
            for table in tables:
                table_name = list(table.values())[0]
                if any(keyword in table_name.lower() for keyword in ['product', 'inventory', 'fba', 'analytics']):
                    product_related_tables.append(table_name)
            
            print("   产品相关表:")
            for table_name in product_related_tables:
                cursor.execute(f"SELECT COUNT(*) as count FROM {table_name}")
                count_result = cursor.fetchone()
                print(f"     {table_name}: {count_result['count']} 条记录")
                
                # 如果是fba_inventory表，显示详细信息
                if 'fba_inventory' in table_name.lower():
                    cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
                    samples = cursor.fetchall()
                    if samples:
                        print(f"       样本字段: {list(samples[0].keys())}")

if __name__ == '__main__':
    check_all_available_data()