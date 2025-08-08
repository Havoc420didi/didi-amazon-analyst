import sys
sys.path.insert(0, '.')
from datetime import date, timedelta
from src.processors.inventory_merge_processor import InventoryMergeProcessor
from src.database.connection import DatabaseManager

processor = InventoryMergeProcessor()
db_manager = DatabaseManager()
target_date = '2025-07-27'  # 使用最新的数据日期

print('🎯 目标日期:', target_date)

# 从product_analytics表获取数据
with db_manager.get_db_connection() as conn:
    with conn.cursor() as cursor:
        cursor.execute('SELECT asin, title, sku, marketplace_id, fba_inventory, sales_quantity, sales_amount FROM product_analytics WHERE data_date = %s LIMIT 10', (target_date,))
        raw_data = cursor.fetchall()

print('📥 获取到', len(raw_data), '条原始数据')

if raw_data:
    # 转换为库存合并格式
    processed_data = []
    for row in raw_data:
        marketplace = 'UK' if 'A1F83G8C2ARO7P' in (row['marketplace_id'] or '') else 'US'
        
        item = {
            'asin': row['asin'] or '',
            'product_name': (row['title'] or '')[:255],
            'sku': (row['sku'] or '')[:100],
            'category': '',
            'sales_person': '',
            'product_tag': '',
            'marketplace': marketplace,
            'store': f'TestStore-{marketplace}',
            'fba_available': float(row['fba_inventory'] or 0),
            'fba_inbound': 0.0,
            'fba_sellable': float(row['fba_inventory'] or 0),
            'fba_unsellable': 0.0,
            'local_available': 0.0,
            'inbound_shipped': 0.0,
            'sales_7days': float(row['sales_quantity'] or 0),
            'total_sales': float(row['sales_quantity'] or 0),
            'average_sales': float(row['sales_quantity'] or 0) / 7.0,
            'order_count': int(row['sales_quantity'] or 0),
            'promotional_orders': 0,
            'average_price': '$10.00',
            'sales_amount': '${:.2f}'.format(float(row['sales_amount'] or 0)),
            'net_sales': '${:.2f}'.format(float(row['sales_amount'] or 0)),
            'refund_rate': '0.00%',
            'ad_impressions': 1000,
            'ad_clicks': 50,
            'ad_spend': 25.0,
            'ad_order_count': 5,
            'ad_sales': 100.0
        }
        processed_data.append(item)
    
    print('🔧 转换了', len(processed_data), '条数据')
    
    # 执行库存点合并
    print('🔀 执行库存点合并...')
    result = processor.process(processed_data, target_date)
    
    print('📊 合并结果:', result.get('status'))
    if result.get('status') == 'success':
        print('  处理数据:', result.get('processed_count'))
        print('  合并数量:', result.get('merged_count'))
        print('  保存数量:', result.get('saved_count'))
    else:
        print('  错误:', result.get('error'))
        
    # 检查最终结果
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) as count FROM inventory_points WHERE data_date = %s', (target_date,))
            final_count = cursor.fetchone()['count']
            print('🎉 inventory_points表现有数据:', final_count, '条')
else:
    print('❌ 没有找到数据')
