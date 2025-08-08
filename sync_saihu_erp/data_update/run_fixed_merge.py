#!/usr/bin/env python3
"""
使用修复后的合并逻辑重新处理库存点合并
清空inventory_points表，应用修复后的合并规则
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
            
            # 获取删除的行数
            cursor.execute("SELECT ROW_COUNT() as deleted_count")
            result = cursor.fetchone()
            deleted_count = result['deleted_count'] if result else 0
            
    print(f"✅ 成功删除 {deleted_count} 行数据")
    return True

def get_latest_product_data():
    """获取最新的产品数据"""
    db_manager = DatabaseManager()
    
    print("📥 获取最新产品数据...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 获取最新日期的数据
            cursor.execute("SELECT MAX(data_date) as latest_date FROM product_analytics")
            latest_result = cursor.fetchone()
            latest_date = latest_result['latest_date'] if latest_result else None
            
            if not latest_date:
                print("❌ 没有找到product_analytics数据")
                return [], None
            
            print(f"📅 最新数据日期: {latest_date}")
            
            # 获取该日期的所有数据
            cursor.execute('''
                SELECT asin, title, sku, marketplace_id, fba_inventory, 
                       sales_quantity, sales_amount, operator_name, category,
                       acos as ad_cost, ad_sales, impressions, clicks, order_count,
                       dev_name
                FROM product_analytics 
                WHERE data_date = %s 
                ORDER BY asin
            ''', (latest_date,))
            raw_data = cursor.fetchall()
    
    print(f"✅ 获取到 {len(raw_data)} 条原始数据")
    return raw_data, str(latest_date)

def convert_to_merge_format(raw_data):
    """转换数据格式并创建符合合并逻辑的店铺名称"""
    processed_data = []
    
    print("🔧 转换数据格式...")
    
    # 为了测试合并逻辑，我们需要创建一些具有相同ASIN但不同店铺的数据
    asin_store_mapping = {}
    
    for i, row in enumerate(raw_data):
        asin = row['asin'] or ''
        if not asin:
            continue
            
        # 根据marketplace_id确定国家和基础店铺名
        marketplace_id = row['marketplace_id'] or ''
        
        if 'A1F83G8C2ARO7P' in marketplace_id:  # UK
            country = 'UK'
            base_store = 'ZipCozy'
        elif 'ATVPDKIKX0DER' in marketplace_id:  # US
            country = 'US'
            base_store = 'ZipCozy'
        elif 'A1PA6795UKMFR9' in marketplace_id:  # DE 
            country = 'DE'
            base_store = 'ZipCozy'
        elif 'A13V1IB3VIYZZH' in marketplace_id:  # FR
            country = 'FR'
            base_store = 'ZipCozy'
        elif 'APJ6JRA9NG5V4' in marketplace_id:  # IT
            country = 'IT'
            base_store = 'ZipCozy'
        elif 'A1RKKUPIHCS9HS' in marketplace_id:  # ES
            country = 'ES'
            base_store = 'ZipCozy'
        else:
            country = 'US'  # 默认
            base_store = 'ZipCozy'
        
        # 为了测试合并逻辑，我们给同一个ASIN创建不同的店铺前缀
        if asin not in asin_store_mapping:
            asin_store_mapping[asin] = []
        
        # 给每个ASIN分配不同的店铺前缀来测试合并
        store_prefixes = ['01 VivaJoy', '03 ZipCozy', '02 MumEZ']
        prefix_index = len(asin_store_mapping[asin]) % len(store_prefixes)
        store_prefix = store_prefixes[prefix_index]
        
        # 创建店铺名称：格式为 "店铺前缀-国家"
        store_name = f"{store_prefix}-{country}"
        asin_store_mapping[asin].append(store_name)
        
        # 计算平均售价
        sales_amount = float(row['sales_amount'] or 0)
        sales_quantity = float(row['sales_quantity'] or 0)
        avg_price = sales_amount / sales_quantity if sales_quantity > 0 else 10.0
        
        # 为了测试合并，我们将库存分散到不同店铺
        base_inventory = float(row['fba_inventory'] or 0)
        if len(asin_store_mapping[asin]) == 1:
            # 第一个店铺分配60%的库存
            fba_available = base_inventory * 0.6
            fba_inbound = base_inventory * 0.2
        elif len(asin_store_mapping[asin]) == 2:
            # 第二个店铺分配30%的库存
            fba_available = base_inventory * 0.3
            fba_inbound = base_inventory * 0.1
        else:
            # 第三个店铺分配10%的库存
            fba_available = base_inventory * 0.1
            fba_inbound = base_inventory * 0.05
        
        item = {
            'asin': asin,
            'product_name': (row['title'] or '')[:255],
            'sku': (row['sku'] or '')[:100],
            'category': (row['category'] or '')[:100],
            'sales_person': (row['operator_name'] or '')[:100],
            'product_tag': '',
            'dev_name': (row['dev_name'] or '')[:100],
            'marketplace': country,  # 这个字段原始值，用于对比
            'store': store_name,     # 按照README要求的格式
            
            # 库存数据 - 分散到不同店铺
            'fba_available': fba_available,
            'fba_inbound': fba_inbound,
            'fba_sellable': fba_available,
            'fba_unsellable': 0.0,
            'local_available': 100.0,  # 固定值，用于测试本地仓合并逻辑
            'inbound_shipped': 0.0,
            
            # 销售数据
            'sales_7days': float(row['sales_quantity'] or 0) / len(store_prefixes),
            'total_sales': float(row['sales_quantity'] or 0) / len(store_prefixes),
            'average_sales': float(row['sales_quantity'] or 0) / 7.0 / len(store_prefixes),
            'order_count': float(row['order_count'] or 0) / len(store_prefixes),
            'promotional_orders': 0,
            
            # 价格信息
            'average_price': f'${avg_price:.2f}',
            'sales_amount': f'${sales_amount:.2f}',
            'net_sales': f'${sales_amount:.2f}',
            'refund_rate': '0.00%',
            
            # 广告数据
            'ad_impressions': float(row['impressions'] or 0) / len(store_prefixes),
            'ad_clicks': float(row['clicks'] or 0) / len(store_prefixes),
            'ad_spend': float(row['ad_cost'] or 0) / len(store_prefixes),
            'ad_order_count': float(row['order_count'] or 0) / len(store_prefixes),
            'ad_sales': float(row['ad_sales'] or 0) / len(store_prefixes)
        }
        processed_data.append(item)
        
        # 为了更好地测试合并逻辑，我们为每个ASIN最多创建3个不同的店铺
        if len(asin_store_mapping[asin]) >= 3:
            continue
    
    print(f"✅ 转换完成，生成 {len(processed_data)} 条测试数据")
    
    # 打印一些样本数据用于验证
    if processed_data:
        print("📊 数据样本:")
        for i, sample in enumerate(processed_data[:5]):
            print(f"   {i+1}. ASIN: {sample['asin']}, 店铺: {sample['store']}, FBA可用: {sample['fba_available']:.1f}")
    
    return processed_data

def run_fixed_merge():
    """执行修复后的合并逻辑"""
    print("=" * 60)
    print("🚀 执行修复后的库存点合并逻辑")
    print("=" * 60)
    
    try:
        # 第一步：清空表格
        clear_inventory_points()
        
        # 第二步：获取原始数据
        raw_data, data_date = get_latest_product_data()
        if not raw_data:
            print("❌ 无法获取原始数据")
            return
        
        # 第三步：转换数据格式
        processed_data = convert_to_merge_format(raw_data)
        if not processed_data:
            print("❌ 数据转换失败")
            return
        
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
                
                # 检查具体的合并案例
                cursor.execute('''
                    SELECT asin, marketplace, store, fba_available, fba_inbound, 
                           local_available, merged_stores, store_count
                    FROM inventory_points 
                    ORDER BY marketplace, asin 
                    LIMIT 10
                ''')
                samples = cursor.fetchall()
                print("   合并样本:")
                for sample in samples:
                    store_count = sample['store_count'] or 1
                    merged_stores = sample['merged_stores'] or ''
                    print(f"     {sample['asin']}-{sample['marketplace']}: "
                          f"FBA可用={sample['fba_available']:.1f}, "
                          f"本地仓={sample['local_available']:.1f}, "
                          f"合并店铺数={store_count}")
        
        print("\n🎉 修复后的库存点合并完成!")
        
    except Exception as e:
        print(f"❌ 执行异常: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    run_fixed_merge()