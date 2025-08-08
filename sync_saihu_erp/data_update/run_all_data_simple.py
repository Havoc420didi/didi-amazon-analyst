#!/usr/bin/env python3
"""
简化版：使用数据库全部数据执行库存点合并
"""

import sys
sys.path.insert(0, '.')
from datetime import date
from src.processors.inventory_merge_processor import InventoryMergeProcessor
from src.database.connection import DatabaseManager

def run_with_all_data():
    """使用全部数据执行合并"""
    print("=" * 60)
    print("🚀 使用全部数据执行库存点合并")
    print("=" * 60)
    
    db_manager = DatabaseManager()
    
    # 清空inventory_points表
    print("🧹 清空inventory_points表...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM inventory_points")
            conn.commit()
            print("✅ 表格已清空")
    
    # 获取数据最多的日期
    print("📅 查找数据最多的日期...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT data_date, COUNT(*) as count 
                FROM product_analytics 
                GROUP BY data_date 
                ORDER BY count DESC 
                LIMIT 1
            ''')
            best_date = cursor.fetchone()
            target_date = str(best_date['data_date'])
            data_count = best_date['count']
            
    print(f"✅ 选择日期: {target_date} (共{data_count}条记录)")
    
    # 获取全部数据并转换格式
    print("📥 获取并转换数据...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT asin, title, sku, marketplace_id, fba_inventory, 
                       sales_quantity, sales_amount, operator_name, category_name,
                       acos as ad_cost, ad_sales, impressions, clicks, order_count,
                       dev_name
                FROM product_analytics 
                WHERE data_date = %s 
                ORDER BY asin
            ''', (target_date,))
            raw_data = cursor.fetchall()
    
    print(f"✅ 获取到 {len(raw_data)} 条原始数据")
    
    # 转换为合并器需要的格式
    processed_data = []
    
    for row in raw_data:
        # 根据marketplace_id确定国家和店铺
        marketplace_id = row['marketplace_id'] or ''
        if 'A1F83G8C2ARO7P' in marketplace_id:  # UK
            country = 'UK'
            store = f"03 ZipCozy-UK"  # 简化店铺名
        elif 'ATVPDKIKX0DER' in marketplace_id:  # US
            country = 'US'
            store = f"01 VivaJoy-US"
        elif 'A1PA6795UKMFR9' in marketplace_id:  # DE
            country = 'DE'
            store = f"02 MumEZ-DE"
        elif 'A13V1IB3VIYZZH' in marketplace_id:  # FR
            country = 'FR'
            store = f"03 ZipCozy-FR"
        elif 'APJ6JRA9NG5V4' in marketplace_id:  # IT
            country = 'IT'
            store = f"01 VivaJoy-IT"
        elif 'A1RKKUPIHCS9HS' in marketplace_id:  # ES
            country = 'ES'
            store = f"02 MumEZ-ES"
        else:
            country = 'US'  # 默认
            store = f"01 Default-US"
        
        # 计算平均售价
        sales_amount = float(row['sales_amount'] or 0)
        sales_quantity = float(row['sales_quantity'] or 0)
        avg_price = sales_amount / sales_quantity if sales_quantity > 0 else 10.0
        
        item = {
            'asin': row['asin'] or '',
            'product_name': (row['title'] or '')[:255],
            'sku': (row['sku'] or '')[:100],
            'category': (row['category_name'] or '')[:100],
            'sales_person': (row['operator_name'] or '')[:100],
            'product_tag': '',
            'dev_name': (row['dev_name'] or '')[:100],
            'marketplace': country,
            'store': store,
            
            # 库存数据
            'fba_available': float(row['fba_inventory'] or 0),
            'fba_inbound': 0.0,
            'fba_sellable': float(row['fba_inventory'] or 0),
            'fba_unsellable': 0.0,
            'local_available': 0.0,
            'inbound_shipped': 0.0,
            
            # 销售数据
            'sales_7days': float(row['sales_quantity'] or 0),
            'total_sales': float(row['sales_quantity'] or 0),
            'average_sales': float(row['sales_quantity'] or 0) / 7.0,
            'order_count': int(row['order_count'] or 0),
            'promotional_orders': 0,
            
            # 价格信息
            'average_price': f'${avg_price:.2f}',
            'sales_amount': f'${sales_amount:.2f}',
            'net_sales': f'${sales_amount:.2f}',
            'refund_rate': '0.00%',
            
            # 广告数据
            'ad_impressions': int(row['impressions'] or 0),
            'ad_clicks': int(row['clicks'] or 0),
            'ad_spend': float(row['ad_cost'] or 0),
            'ad_order_count': int(row['order_count'] or 0),
            'ad_sales': float(row['ad_sales'] or 0)
        }
        processed_data.append(item)
    
    print(f"✅ 数据转换完成: {len(processed_data)} 条")
    
    # 执行合并
    print("\n🔀 执行库存点合并...")
    processor = InventoryMergeProcessor()
    result = processor.process(processed_data, target_date)
    
    # 显示结果
    print("\n📊 合并结果:")
    print(f"   状态: {result.get('status')}")
    if result.get('status') == 'success':
        print(f"   原始数据: {result.get('processed_count')}")
        print(f"   合并后库存点: {result.get('merged_count')}")
        print(f"   保存成功: {result.get('saved_count')}")
        
        merge_stats = result.get('merge_statistics', {})
        if merge_stats:
            print(f"   压缩比例: {merge_stats.get('compression_ratio', 0):.2f}")
            print(f"   欧盟库存点: {merge_stats.get('eu_points', 0)}")
            print(f"   非欧盟库存点: {merge_stats.get('non_eu_points', 0)}")
    else:
        print(f"   错误: {result.get('error')}")
        return
    
    # 验证结果
    print("\n🔍 验证结果...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) as total FROM inventory_points')
            total = cursor.fetchone()['total']
            
            cursor.execute('''
                SELECT marketplace, COUNT(*) as count 
                FROM inventory_points 
                GROUP BY marketplace 
                ORDER BY count DESC
            ''')
            market_stats = cursor.fetchall()
            
            cursor.execute('''
                SELECT merge_type, COUNT(*) as count 
                FROM inventory_points 
                GROUP BY merge_type
            ''')
            merge_type_stats = cursor.fetchall()
            
            print(f"   总库存点: {total}")
            print("   按市场分布:")
            for stat in market_stats:
                print(f"     {stat['marketplace']}: {stat['count']} 个")
            print("   按合并类型:")
            for stat in merge_type_stats:
                merge_type = stat['merge_type'] or 'unknown'
                print(f"     {merge_type}: {stat['count']} 个")
    
    print(f"\n🎉 全部数据合并完成!")
    print(f"数据日期: {target_date}")
    print(f"原始数据: {len(raw_data)} 条 → 库存点: {total} 个")

if __name__ == '__main__':
    run_with_all_data()