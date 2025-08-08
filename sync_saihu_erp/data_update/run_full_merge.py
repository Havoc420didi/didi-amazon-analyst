#!/usr/bin/env python3
"""
完整的库存点合并脚本
处理所有 product_analytics 数据并合并到 inventory_points 表
"""

import sys
sys.path.insert(0, '.')
from datetime import date, timedelta
from src.processors.inventory_merge_processor import InventoryMergeProcessor
from src.database.connection import DatabaseManager

def run_full_inventory_merge():
    """运行完整的库存点合并"""
    
    processor = InventoryMergeProcessor()
    db_manager = DatabaseManager()
    target_date = '2025-07-27'  # 使用数据最多的日期
    
    print('=' * 60)
    print('🚀 开始完整库存点合并')
    print('=' * 60)
    print(f'🎯 目标日期: {target_date}')
    
    # 从product_analytics表获取所有数据
    print('\n📥 获取 product_analytics 数据...')
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT asin, title, sku, marketplace_id, fba_inventory, 
                       sales_quantity, sales_amount, operator_name, category,
                       acos as ad_cost, ad_sales, impressions, clicks, order_count
                FROM product_analytics 
                WHERE data_date = %s 
                ORDER BY asin
            ''', (target_date,))
            raw_data = cursor.fetchall()
    
    print(f'   获取到 {len(raw_data)} 条原始数据')
    
    if not raw_data:
        print('❌ 没有找到数据')
        return
    
    # 转换为库存合并格式
    print('\n🔧 转换数据格式...')
    processed_data = []
    
    for row in raw_data:
        # 根据marketplace_id判断市场
        marketplace_id = row['marketplace_id'] or ''
        if 'A1F83G8C2ARO7P' in marketplace_id:
            marketplace = '英国'
            store = f"Store-UK-{row['asin'][:4]}"
        elif 'ATVPDKIKX0DER' in marketplace_id:
            marketplace = '美国'  
            store = f"Store-US-{row['asin'][:4]}"
        elif 'A1PA6795UKMFR9' in marketplace_id:
            marketplace = '德国'
            store = f"Store-DE-{row['asin'][:4]}"
        elif 'A13V1IB3VIYZZH' in marketplace_id:
            marketplace = '法国'
            store = f"Store-FR-{row['asin'][:4]}"
        elif 'APJ6JRA9NG5V4' in marketplace_id:
            marketplace = '意大利'
            store = f"Store-IT-{row['asin'][:4]}"
        elif 'A1RKKUPIHCS9HS' in marketplace_id:
            marketplace = '西班牙'
            store = f"Store-ES-{row['asin'][:4]}"
        else:
            marketplace = '其他'
            store = f"Store-OTHER-{row['asin'][:4]}"
        
        # 计算平均售价
        sales_amount = float(row['sales_amount'] or 0)
        sales_quantity = float(row['sales_quantity'] or 0)
        avg_price = sales_amount / sales_quantity if sales_quantity > 0 else 10.0
        
        item = {
            'asin': row['asin'] or '',
            'product_name': (row['title'] or '')[:500],
            'sku': (row['sku'] or '')[:100],
            'category': (row['category'] or '')[:200],
            'sales_person': (row['operator_name'] or '')[:100],
            'product_tag': '',
            'marketplace': marketplace,
            'store': store,
            'inventory_point_name': f"{marketplace}-{row['asin']}",
            
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
            'order_count': float(row['order_count'] or 0),
            'promotional_orders': 0,
            
            # 价格信息
            'average_price': f'${avg_price:.2f}',
            'sales_amount': f'${sales_amount:.2f}',
            'net_sales': f'${sales_amount:.2f}',
            'refund_rate': '0.00%',
            
            # 广告数据
            'ad_impressions': float(row['impressions'] or 0),
            'ad_clicks': float(row['clicks'] or 0),
            'ad_spend': float(row['ad_cost'] or 0),
            'ad_order_count': float(row['order_count'] or 0),
            'ad_sales': float(row['ad_sales'] or 0)
        }
        processed_data.append(item)
    
    print(f'   转换了 {len(processed_data)} 条数据')
    
    # 执行库存点合并
    print('\n🔀 执行库存点合并...')
    result = processor.process(processed_data, target_date)
    
    print('\n📊 合并结果:')
    print(f'   状态: {result.get("status")}')
    if result.get('status') == 'success':
        print(f'   处理数据: {result.get("processed_count")}')
        print(f'   清洗数据: {result.get("cleaned_count")}')
        print(f'   合并数量: {result.get("merged_count")}')
        print(f'   保存数量: {result.get("saved_count")}')
        
        # 显示合并统计
        merge_stats = result.get('merge_statistics', {})
        if merge_stats:
            print(f'   压缩比例: {merge_stats.get("compression_ratio", 0):.2f}')
            print(f'   欧盟点数: {merge_stats.get("eu_points", 0)}')
            print(f'   非欧盟点数: {merge_stats.get("non_eu_points", 0)}')
    else:
        print(f'   错误: {result.get("error")}')
        
    # 检查最终结果
    print('\n🔍 验证最终结果...')
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 总数统计
            cursor.execute('SELECT COUNT(*) as count FROM inventory_points WHERE data_date = %s', (target_date,))
            total_count = cursor.fetchone()['count']
            print(f'   inventory_points表总数据: {total_count} 条')
            
            # 按市场统计
            cursor.execute('''
                SELECT marketplace, COUNT(*) as count 
                FROM inventory_points 
                WHERE data_date = %s 
                GROUP BY marketplace 
                ORDER BY count DESC
            ''', (target_date,))
            market_stats = cursor.fetchall()
            print('   按市场分布:')
            for stat in market_stats:
                print(f'     {stat["marketplace"]}: {stat["count"]} 条')
            
            # 有效库存点统计
            cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_effective_point = 1 THEN 1 ELSE 0 END) as effective,
                    SUM(CASE WHEN is_out_of_stock = 1 THEN 1 ELSE 0 END) as out_of_stock,
                    SUM(CASE WHEN is_turnover_exceeded = 1 THEN 1 ELSE 0 END) as turnover_exceeded
                FROM inventory_points 
                WHERE data_date = %s
            ''', (target_date,))
            analysis_stats = cursor.fetchone()
            if analysis_stats:
                total = analysis_stats['total']
                effective = analysis_stats['effective']
                print(f'   分析统计:')
                print(f'     有效库存点: {effective}/{total} ({effective/total*100:.1f}%)')
                print(f'     断货库存点: {analysis_stats["out_of_stock"]}')
                print(f'     周转超标: {analysis_stats["turnover_exceeded"]}')
    
    print('\n✅ 库存点合并完成!')

if __name__ == '__main__':
    run_full_inventory_merge()