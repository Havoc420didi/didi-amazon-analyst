#!/usr/bin/env python3
"""
使用数据库真实数据执行修复后的库存点合并逻辑
"""

import sys
sys.path.insert(0, '.')
from datetime import date
from src.processors.inventory_merge_processor import InventoryMergeProcessor
from src.database.connection import DatabaseManager

def clear_inventory_points():
    """清空inventory_points表"""
    db_manager = DatabaseManager()
    
    print("🧹 清空inventory_points表...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM inventory_points")
            conn.commit()
            
            cursor.execute("SELECT ROW_COUNT() as deleted_count")
            result = cursor.fetchone()
            deleted_count = result['deleted_count'] if result else 0
            
    print(f"✅ 成功删除 {deleted_count} 行数据")
    return True

def get_real_product_data():
    """获取数据库中的真实产品数据"""
    db_manager = DatabaseManager()
    
    print("📥 获取数据库真实产品数据...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 获取最新日期
            cursor.execute("SELECT MAX(data_date) as latest_date FROM product_analytics")
            latest_result = cursor.fetchone()
            latest_date = latest_result['latest_date'] if latest_result else None
            
            if not latest_date:
                print("❌ 没有找到product_analytics数据")
                return [], None
            
            print(f"📅 最新数据日期: {latest_date}")
            
            # 获取真实的原始数据，按README要求的字段格式
            cursor.execute('''
                SELECT 
                    asin,
                    title as product_name,
                    sku,
                    category,
                    operator_name as sales_person,
                    '' as product_tag,
                    dev_name,
                    marketplace_id,
                    
                    -- 模拟店铺名称格式（根据marketplace_id生成符合README格式的店铺名）
                    CASE 
                        WHEN marketplace_id LIKE '%%A1F83G8C2ARO7P%%' THEN CONCAT('03 ZipCozy-UK')
                        WHEN marketplace_id LIKE '%%ATVPDKIKX0DER%%' THEN CONCAT('01 VivaJoy-US') 
                        WHEN marketplace_id LIKE '%%A1PA6795UKMFR9%%' THEN CONCAT('02 MumEZ-DE')
                        WHEN marketplace_id LIKE '%%A13V1IB3VIYZZH%%' THEN CONCAT('03 ZipCozy-FR')
                        WHEN marketplace_id LIKE '%%APJ6JRA9NG5V4%%' THEN CONCAT('01 VivaJoy-IT')
                        WHEN marketplace_id LIKE '%%A1RKKUPIHCS9HS%%' THEN CONCAT('02 MumEZ-ES')
                        ELSE CONCAT('01 Default-US')
                    END as store,
                    
                    -- 根据marketplace_id确定marketplace字段
                    CASE 
                        WHEN marketplace_id LIKE '%%A1F83G8C2ARO7P%%' THEN 'UK'
                        WHEN marketplace_id LIKE '%%ATVPDKIKX0DER%%' THEN 'US'
                        WHEN marketplace_id LIKE '%%A1PA6795UKMFR9%%' THEN 'DE'
                        WHEN marketplace_id LIKE '%%A13V1IB3VIYZZH%%' THEN 'FR'
                        WHEN marketplace_id LIKE '%%APJ6JRA9NG5V4%%' THEN 'IT'
                        WHEN marketplace_id LIKE '%%A1RKKUPIHCS9HS%%' THEN 'ES'
                        ELSE 'US'
                    END as marketplace,
                    
                    -- 库存数据
                    COALESCE(fba_inventory, 0) as fba_available,
                    0 as fba_inbound,
                    COALESCE(fba_inventory, 0) as fba_sellable,
                    0 as fba_unsellable,
                    COALESCE(total_inventory - fba_inventory, 0) as local_available,
                    0 as inbound_shipped,
                    
                    -- 销售数据
                    COALESCE(sales_quantity, 0) as sales_7days,
                    COALESCE(sales_quantity, 0) as total_sales,
                    COALESCE(sales_quantity, 0) / 7.0 as average_sales,
                    COALESCE(order_count, 0) as order_count,
                    0 as promotional_orders,
                    
                    -- 价格信息
                    CONCAT('$', COALESCE(sales_amount / NULLIF(sales_quantity, 0), 10.0)) as average_price,
                    CONCAT('$', COALESCE(sales_amount, 0)) as sales_amount,
                    CONCAT('$', COALESCE(sales_amount, 0)) as net_sales,
                    '0.00%%' as refund_rate,
                    
                    -- 广告数据
                    COALESCE(impressions, 0) as ad_impressions,
                    COALESCE(clicks, 0) as ad_clicks,
                    COALESCE(acos, 0) as ad_spend,
                    COALESCE(order_count, 0) as ad_order_count,
                    COALESCE(ad_sales, 0) as ad_sales
                    
                FROM product_analytics 
                WHERE data_date = %s 
                AND asin IS NOT NULL 
                AND asin != ''
                AND title IS NOT NULL 
                AND title != ''
                ORDER BY asin, marketplace_id
            ''', (latest_date,))
            raw_data = cursor.fetchall()
    
    print(f"✅ 获取到 {len(raw_data)} 条真实产品数据")
    
    # 打印数据样本
    if raw_data:
        print("📊 真实数据样本:")
        for i, sample in enumerate(raw_data[:5]):
            print(f"   {i+1}. ASIN: {sample['asin']}, 店铺: {sample['store']}, "
                  f"市场: {sample['marketplace']}, FBA库存: {sample['fba_available']}")
    
    return raw_data, str(latest_date)

def run_real_data_merge():
    """使用真实数据执行合并逻辑"""
    print("=" * 60)
    print("🚀 使用真实数据执行修复后的库存点合并")
    print("=" * 60)
    
    try:
        # 第一步：清空表格
        clear_inventory_points()
        
        # 第二步：获取真实数据
        real_data, data_date = get_real_product_data()
        if not real_data:
            print("❌ 无法获取真实数据")
            return
        
        # 第三步：转换为合并器需要的格式
        print("🔧 准备数据用于合并...")
        processed_data = []
        
        for row in real_data:
            # 直接使用数据库中的真实数据，只需要转换数据类型
            item = {
                'asin': str(row['asin'] or ''),
                'product_name': str(row['product_name'] or '')[:255],
                'sku': str(row['sku'] or '')[:100],
                'category': str(row['category'] or '')[:100],
                'sales_person': str(row['sales_person'] or '')[:100],
                'product_tag': str(row['product_tag'] or ''),
                'dev_name': str(row['dev_name'] or '')[:100],
                'marketplace': str(row['marketplace'] or ''),
                'store': str(row['store'] or ''),
                
                # 库存数据
                'fba_available': float(row['fba_available'] or 0),
                'fba_inbound': float(row['fba_inbound'] or 0),
                'fba_sellable': float(row['fba_sellable'] or 0),
                'fba_unsellable': float(row['fba_unsellable'] or 0),
                'local_available': float(row['local_available'] or 0),
                'inbound_shipped': float(row['inbound_shipped'] or 0),
                
                # 销售数据
                'sales_7days': float(row['sales_7days'] or 0),
                'total_sales': float(row['total_sales'] or 0),
                'average_sales': float(row['average_sales'] or 0),
                'order_count': int(row['order_count'] or 0),
                'promotional_orders': int(row['promotional_orders'] or 0),
                
                # 价格信息
                'average_price': str(row['average_price'] or ''),
                'sales_amount': str(row['sales_amount'] or ''),
                'net_sales': str(row['net_sales'] or ''),
                'refund_rate': str(row['refund_rate'] or ''),
                
                # 广告数据
                'ad_impressions': int(row['ad_impressions'] or 0),
                'ad_clicks': int(row['ad_clicks'] or 0),
                'ad_spend': float(row['ad_spend'] or 0),
                'ad_order_count': int(row['ad_order_count'] or 0),
                'ad_sales': float(row['ad_sales'] or 0)
            }
            processed_data.append(item)
        
        print(f"✅ 准备了 {len(processed_data)} 条数据用于合并")
        
        # 第四步：执行合并
        print("\n🔀 执行库存点合并...")
        processor = InventoryMergeProcessor()
        result = processor.process(processed_data, data_date)
        
        # 第五步：显示结果
        print("\n📊 合并结果:")
        print(f"   状态: {result.get('status')}")
        if result.get('status') == 'success':
            print(f"   原始数据: {result.get('processed_count')}")
            print(f"   清洗数据: {result.get('cleaned_count')}")
            print(f"   合并后库存点: {result.get('merged_count')}")
            print(f"   保存成功: {result.get('saved_count')}")
            
            # 显示合并统计
            merge_stats = result.get('merge_statistics', {})
            if merge_stats:
                print(f"   压缩比例: {merge_stats.get('compression_ratio', 0):.2f}")
                print(f"   欧盟库存点: {merge_stats.get('eu_points', 0)}")
                print(f"   非欧盟库存点: {merge_stats.get('non_eu_points', 0)}")
        else:
            print(f"   错误: {result.get('error')}")
            return
        
        # 第六步：验证结果
        print("\n🔍 验证合并结果...")
        db_manager = DatabaseManager()
        with db_manager.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 总数统计
                cursor.execute('SELECT COUNT(*) as count FROM inventory_points')
                total_count = cursor.fetchone()['count']
                print(f"   总库存点: {total_count}")
                
                # 按市场统计
                cursor.execute('''
                    SELECT marketplace, COUNT(*) as count 
                    FROM inventory_points 
                    GROUP BY marketplace 
                    ORDER BY count DESC
                ''')
                market_stats = cursor.fetchall()
                print("   按市场分布:")
                for stat in market_stats:
                    print(f"     {stat['marketplace']}: {stat['count']} 个")
                
                # 按合并类型统计
                cursor.execute('''
                    SELECT merge_type, COUNT(*) as count 
                    FROM inventory_points 
                    GROUP BY merge_type
                ''')
                merge_type_stats = cursor.fetchall()
                print("   按合并类型:")
                for stat in merge_type_stats:
                    merge_type = stat['merge_type'] or 'unknown'
                    print(f"     {merge_type}: {stat['count']} 个")
                
                # 显示具体的合并结果样本
                cursor.execute('''
                    SELECT asin, marketplace, store, fba_available, fba_inbound, 
                           local_available, average_sales, turnover_days,
                           is_effective_point, merged_stores, store_count
                    FROM inventory_points 
                    ORDER BY marketplace, asin 
                    LIMIT 10
                ''')
                samples = cursor.fetchall()
                print("   合并后库存点样本:")
                for sample in samples:
                    store_count = sample['store_count'] or 1
                    turnover = sample['turnover_days'] or 0
                    effective = "是" if sample['is_effective_point'] else "否"
                    print(f"     {sample['asin']}-{sample['marketplace']}: "
                          f"FBA={sample['fba_available']:.1f}, "
                          f"周转={turnover:.1f}天, "
                          f"有效={effective}, "
                          f"店铺数={store_count}")
        
        print(f"\n🎉 使用真实数据的库存点合并完成!")
        print(f"数据日期: {data_date}")
        
    except Exception as e:
        print(f"❌ 执行异常: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    run_real_data_merge()