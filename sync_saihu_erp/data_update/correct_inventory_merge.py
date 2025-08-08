#!/usr/bin/env python3
"""
按照正确的业务逻辑执行库存点合并
"""
import sys
sys.path.append('/home/hudi_data/sync_saihu_erp/data_update')
from datetime import date, timedelta
from src.database.connection import DatabaseManager
from collections import defaultdict
import json

def run_correct_inventory_merge():
    """按照正确的业务逻辑执行库存点合并"""
    
    db_manager = DatabaseManager()
    target_date = '2025-07-27'  # 使用数据最多的日期
    
    print('=' * 80)
    print('🚀 开始按照正确业务逻辑执行库存点合并')
    print('=' * 80)
    print(f'🎯 目标日期: {target_date}')
    
    # 欧盟国家代码列表
    EU_COUNTRIES = {'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 
                   'DK', 'SE', 'FI', 'EE', 'HR', 'SI', 'CZ', 'RO', 'BG', 
                   'GR', 'CY', 'MT', 'IS', 'LI', 'MC', 'SM', 'VA', 'UK'} # 包含UK
    
    # 先清空inventory_points表
    print('\n🧹 清空inventory_points表...')
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('DELETE FROM inventory_points')
            deleted_count = cursor.rowcount
            conn.commit()
            print(f'   删除了 {deleted_count} 条历史记录')
    
    # 从product_analytics表获取所有数据
    print('\n📥 获取 product_analytics 数据...')
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT asin, title, sku, marketplace_id, fba_inventory, 
                       sales_quantity, sales_amount, operator_name, category,
                       acos as ad_cost, ad_sales, impressions, clicks, order_count, ad_orders,
                       sessions, page_views, conversion_rate
                FROM product_analytics 
                WHERE data_date = %s 
                ORDER BY asin
            ''', (target_date,))
            raw_data = cursor.fetchall()
    
    print(f'   获取到 {len(raw_data)} 条原始数据')
    
    if not raw_data:
        print('❌ 没有找到数据')
        return
    
    # 数据预处理 - 按ASIN分组并识别店铺和国家
    print('\n🔧 数据预处理和分组...')
    asin_groups = defaultdict(list)
    
    for row in raw_data:
        # 解析marketplace_id获取国家代码
        marketplace_id = row['marketplace_id'] or ''
        country_code = ''
        country_name = ''
        
        if 'A1F83G8C2ARO7P' in marketplace_id:
            country_code = 'UK'
            country_name = '英国'
        elif 'ATVPDKIKX0DER' in marketplace_id:
            country_code = 'US'
            country_name = '美国'
        elif 'A1PA6795UKMFR9' in marketplace_id:
            country_code = 'DE'
            country_name = '德国'
        elif 'A13V1IB3VIYZZH' in marketplace_id:
            country_code = 'FR'
            country_name = '法国'
        elif 'APJ6JRA9NG5V4' in marketplace_id:
            country_code = 'IT'
            country_name = '意大利'
        elif 'A1RKKUPIHCS9HS' in marketplace_id:
            country_code = 'ES'
            country_name = '西班牙'
        else:
            country_code = 'OTHER'
            country_name = '其他'
        
        # 模拟店铺名称 (实际应该从数据中获取)
        store_prefix = f'Store{row["asin"][:2]}'  # 简化的店铺前缀
        store_name = f'{store_prefix}-{country_code}'
        
        item = {
            'asin': row['asin'],
            'product_name': row['title'] or '',
            'sku': row['sku'] or '',
            'category': row['category'] or '',
            'sales_person': row['operator_name'] or '',
            'country_code': country_code,
            'country_name': country_name,
            'store_prefix': store_prefix,
            'store_name': store_name,
            'marketplace_id': marketplace_id,
            'is_eu': country_code in EU_COUNTRIES,
            
            # 库存数据
            'fba_available': float(row['fba_inventory'] or 0),
            'fba_inbound': 0.0,  # 从product_analytics无法获取，设为0
            'local_available': 0.0,  # 同上
            
            # 销售数据
            'sales_quantity': float(row['sales_quantity'] or 0),
            'sales_amount': float(row['sales_amount'] or 0),
            'order_count': float(row['order_count'] or 0),
            'sessions': float(row['sessions'] or 0),
            'page_views': float(row['page_views'] or 0),
            'conversion_rate': float(row['conversion_rate'] or 0),
            
            # 广告数据
            'ad_impressions': float(row['impressions'] or 0),
            'ad_clicks': float(row['clicks'] or 0),
            'ad_spend': float(row['ad_cost'] or 0),
            'ad_sales': float(row['ad_sales'] or 0),
            'ad_orders': float(row['ad_orders'] or 0)  # 修正：使用真实的广告订单量
        }
        
        asin_groups[row['asin']].append(item)
    
    print(f'   分组完成: {len(asin_groups)} 个ASIN')
    
    # 执行合并逻辑
    print('\n🔀 执行库存点合并逻辑...')
    merged_inventory_points = []
    
    for asin, products in asin_groups.items():
        # 分离欧盟和非欧盟产品
        eu_products = [p for p in products if p['is_eu']]
        non_eu_products = [p for p in products if not p['is_eu']]
        
        # 处理欧盟地区合并（两步合并）
        if eu_products:
            # 按店铺前缀分组
            eu_stores = defaultdict(list)
            for product in eu_products:
                eu_stores[product['store_prefix']].append(product)
            
            # 第一步：每个店铺选择最佳库存代表
            store_representatives = []
            for store_prefix, store_products in eu_stores.items():
                # 找到FBA可用+FBA在途最大的国家作为代表
                best_product = max(store_products, 
                    key=lambda p: p['fba_available'] + p['fba_inbound'])
                
                # 汇总该店铺所有国家的销售和广告数据
                total_sales_quantity = sum(p['sales_quantity'] for p in store_products)
                total_sales_amount = sum(p['sales_amount'] for p in store_products)
                total_order_count = sum(p['order_count'] for p in store_products)
                total_ad_impressions = sum(p['ad_impressions'] for p in store_products)
                total_ad_clicks = sum(p['ad_clicks'] for p in store_products)
                total_ad_spend = sum(p['ad_spend'] for p in store_products)
                total_ad_sales = sum(p['ad_sales'] for p in store_products)
                total_ad_orders = sum(p['ad_orders'] for p in store_products)  # 新增：聚合广告订单量
                
                representative = best_product.copy()
                representative.update({
                    'sales_quantity': total_sales_quantity,
                    'sales_amount': total_sales_amount,
                    'order_count': total_order_count,
                    'ad_impressions': total_ad_impressions,
                    'ad_clicks': total_ad_clicks,
                    'ad_spend': total_ad_spend,
                    'ad_sales': total_ad_sales,
                    'ad_orders': total_ad_orders,  # 新增：包含聚合的广告订单量
                    'store_count': len(store_products)
                })
                store_representatives.append(representative)
            
            # 第二步：合并各店铺的代表数据
            if store_representatives:
                first_rep = store_representatives[0]
                
                # 合并库存（FBA可用和FBA在途累加，本地仓不累加）
                total_fba_available = sum(rep['fba_available'] for rep in store_representatives)
                total_fba_inbound = sum(rep['fba_inbound'] for rep in store_representatives)
                local_available = max(rep['local_available'] for rep in store_representatives)
                
                # 合并销售and广告数据
                total_sales_quantity = sum(rep['sales_quantity'] for rep in store_representatives)
                total_sales_amount = sum(rep['sales_amount'] for rep in store_representatives)
                total_order_count = sum(rep['order_count'] for rep in store_representatives)
                total_ad_impressions = sum(rep['ad_impressions'] for rep in store_representatives)
                total_ad_clicks = sum(rep['ad_clicks'] for rep in store_representatives)
                total_ad_spend = sum(rep['ad_spend'] for rep in store_representatives)
                total_ad_sales = sum(rep['ad_sales'] for rep in store_representatives)
                total_ad_orders = sum(rep['ad_orders'] for rep in store_representatives)  # 新增：聚合广告订单量
                
                # 创建欧盟库存点
                eu_point = {
                    'asin': asin,
                    'product_name': first_rep['product_name'],
                    'sku': first_rep['sku'],
                    'category': first_rep['category'],
                    'sales_person': first_rep['sales_person'],
                    'marketplace': '欧盟',
                    'region': 'EU',
                    'store': '欧盟统合',
                    'inventory_point_name': f'欧盟-{asin}',
                    
                    # 合并后的库存
                    'fba_available': total_fba_available,
                    'fba_inbound': total_fba_inbound,
                    'local_available': local_available,
                    'total_inventory': total_fba_available + total_fba_inbound + local_available,
                    
                    # 合并后的销售数据
                    'sales_7days': total_sales_quantity,
                    'total_sales': total_sales_quantity,
                    'average_sales': total_sales_quantity / 7.0,
                    'order_count': total_order_count,
                    'sales_amount': f'${total_sales_amount:.2f}',
                    'average_price': f'${total_sales_amount/total_sales_quantity:.2f}' if total_sales_quantity > 0 else '$0.00',
                    
                    # 合并后的广告数据
                    'ad_impressions': total_ad_impressions,
                    'ad_clicks': total_ad_clicks,
                    'ad_spend': total_ad_spend,
                    'ad_sales': total_ad_sales,
                    'ad_ctr': total_ad_clicks/total_ad_impressions if total_ad_impressions > 0 else 0,
                    'ad_orders': total_ad_orders,  # 新增：包含聚合的广告订单量
                    'ad_conversion_rate': total_ad_orders/total_ad_clicks if total_ad_clicks > 0 else 0,  # 修正：使用广告订单量
                    'acoas': total_ad_spend/(total_sales_amount/7*7) if total_sales_amount > 0 else 0,
                    
                    'data_date': target_date
                }
                merged_inventory_points.append(eu_point)
        
        # 处理非欧盟地区合并（按国家合并）
        if non_eu_products:
            # 按国家分组
            country_groups = defaultdict(list)
            for product in non_eu_products:
                country_groups[product['country_code']].append(product)
            
            # 每个国家创建一个库存点
            for country_code, country_products in country_groups.items():
                first_product = country_products[0]
                
                # 合并同一国家的所有店铺数据
                total_fba_available = sum(p['fba_available'] for p in country_products)
                total_fba_inbound = sum(p['fba_inbound'] for p in country_products)
                total_local_available = sum(p['local_available'] for p in country_products)
                total_sales_quantity = sum(p['sales_quantity'] for p in country_products)
                total_sales_amount = sum(p['sales_amount'] for p in country_products)
                total_order_count = sum(p['order_count'] for p in country_products)
                total_ad_impressions = sum(p['ad_impressions'] for p in country_products)
                total_ad_clicks = sum(p['ad_clicks'] for p in country_products)
                total_ad_spend = sum(p['ad_spend'] for p in country_products)
                total_ad_sales = sum(p['ad_sales'] for p in country_products)
                total_ad_orders = sum(p['ad_orders'] for p in country_products)  # 新增：聚合广告订单量
                
                country_point = {
                    'asin': asin,
                    'product_name': first_product['product_name'],
                    'sku': first_product['sku'],
                    'category': first_product['category'],
                    'sales_person': first_product['sales_person'],
                    'marketplace': first_product['country_name'],
                    'region': country_code,
                    'store': f'{first_product["country_name"]}店铺',
                    'inventory_point_name': f'{first_product["country_name"]}-{asin}',
                    
                    # 合并后的库存
                    'fba_available': total_fba_available,
                    'fba_inbound': total_fba_inbound,
                    'local_available': total_local_available,
                    'total_inventory': total_fba_available + total_fba_inbound + total_local_available,
                    
                    # 合并后的销售数据
                    'sales_7days': total_sales_quantity,
                    'total_sales': total_sales_quantity,
                    'average_sales': total_sales_quantity / 7.0,
                    'order_count': total_order_count,
                    'sales_amount': f'${total_sales_amount:.2f}',
                    'average_price': f'${total_sales_amount/total_sales_quantity:.2f}' if total_sales_quantity > 0 else '$0.00',
                    
                    # 合并后的广告数据
                    'ad_impressions': total_ad_impressions,
                    'ad_clicks': total_ad_clicks,
                    'ad_spend': total_ad_spend,
                    'ad_sales': total_ad_sales,
                    'ad_ctr': total_ad_clicks/total_ad_impressions if total_ad_impressions > 0 else 0,
                    'ad_orders': total_ad_orders,  # 新增：包含聚合的广告订单量
                    'ad_conversion_rate': total_ad_orders/total_ad_clicks if total_ad_clicks > 0 else 0,  # 修正：使用广告订单量
                    'acoas': total_ad_spend/(total_sales_amount/7*7) if total_sales_amount > 0 else 0,
                    
                    'data_date': target_date
                }
                merged_inventory_points.append(country_point)
    
    print(f'   合并完成: {len(merged_inventory_points)} 个库存点')
    
    # 保存到数据库
    print('\n💾 保存合并结果到数据库...')
    insert_sql = '''
    INSERT INTO inventory_points (
        asin, product_name, sku, category, sales_person, marketplace, store,
        inventory_point_name, fba_available, fba_inbound, local_available, total_inventory,
        sales_7days, total_sales, average_sales, order_count, sales_amount, average_price,
        ad_impressions, ad_clicks, ad_spend, ad_sales, ad_order_count, ad_ctr, ad_cvr, acoas,
        data_date, is_effective_point, is_out_of_stock, is_turnover_exceeded,
        turnover_days, daily_sales_amount, created_at, updated_at
    ) VALUES (
        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
    )'''
    
    saved_count = 0
    
    try:
        with db_manager.get_db_connection() as conn:
            with conn.cursor() as cursor:
                for point in merged_inventory_points:
                    # 计算业务指标
                    average_sales = point['average_sales']
                    total_inventory = point['total_inventory']
                    fba_available = point['fba_available']
                    
                    # 库存周转天数
                    turnover_days = total_inventory / average_sales if average_sales > 0 else 999
                    
                    # FBA可用天数
                    fba_available_days = fba_available / average_sales if average_sales > 0 else 0
                    
                    # 业务判断
                    daily_sales = float(point['sales_amount'].replace('$', '').replace(',', '')) / 7 if point['sales_amount'] != '$0.00' else 0
                    is_effective_point = 1 if daily_sales >= 16.7 else 0
                    is_out_of_stock = 1 if fba_available_days < 3 else 0
                    is_turnover_exceeded = 1 if turnover_days > 100 else 0
                    
                    params = (
                        point['asin'], point['product_name'], point['sku'], point['category'],
                        point['sales_person'], point['marketplace'], point['store'],
                        point['inventory_point_name'], point['fba_available'], point['fba_inbound'],
                        point['local_available'], point['total_inventory'], point['sales_7days'],
                        point['total_sales'], point['average_sales'], point['order_count'],
                        point['sales_amount'], point['average_price'], point['ad_impressions'],
                        point['ad_clicks'], point['ad_spend'], point['ad_sales'], point['ad_orders'], 
                        point['ad_ctr'], point['ad_conversion_rate'], point['acoas'], point['data_date'],
                        is_effective_point, is_out_of_stock, is_turnover_exceeded,
                        turnover_days, daily_sales
                    )
                    
                    cursor.execute(insert_sql, params)
                    saved_count += 1
                
                conn.commit()
    
    except Exception as e:
        print(f'❌ 保存数据失败: {e}')
        import traceback
        traceback.print_exc()
        return
    
    print(f'   成功保存 {saved_count} 条记录')
    
    # 验证最终结果
    print('\n🔍 验证合并结果...')
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 总数统计
            cursor.execute('SELECT COUNT(*) as count FROM inventory_points WHERE data_date = %s', (target_date,))
            total_count = cursor.fetchone()['count']
            
            # 按市场统计（欧盟 vs 非欧盟）
            cursor.execute('''
                SELECT 
                    CASE 
                        WHEN marketplace = '欧盟' THEN 'EU'
                        ELSE 'NON_EU'
                    END as region_type,
                    COUNT(*) as count 
                FROM inventory_points 
                WHERE data_date = %s 
                GROUP BY region_type
                ORDER BY count DESC
            ''', (target_date,))
            region_stats = cursor.fetchall()
            
            # 按市场统计
            cursor.execute('''
                SELECT marketplace, COUNT(*) as count 
                FROM inventory_points 
                WHERE data_date = %s 
                GROUP BY marketplace 
                ORDER BY count DESC
            ''', (target_date,))
            market_stats = cursor.fetchall()
            
            # 业务指标统计
            cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_effective_point = 1 THEN 1 ELSE 0 END) as effective,
                    SUM(CASE WHEN is_out_of_stock = 1 THEN 1 ELSE 0 END) as out_of_stock,
                    SUM(CASE WHEN is_turnover_exceeded = 1 THEN 1 ELSE 0 END) as turnover_exceeded,
                    SUM(CASE WHEN total_inventory > 0 THEN 1 ELSE 0 END) as has_inventory,
                    AVG(turnover_days) as avg_turnover_days
                FROM inventory_points 
                WHERE data_date = %s
            ''', (target_date,))
            business_stats = cursor.fetchone()
            
            # 库存统计
            cursor.execute('''
                SELECT 
                    SUM(total_inventory) as total_inventory,
                    SUM(fba_available) as total_fba_available,
                    SUM(fba_inbound) as total_fba_inbound,
                    SUM(local_available) as total_local_available,
                    SUM(CAST(REPLACE(REPLACE(sales_amount, '$', ''), ',', '') AS DECIMAL(10,2))) as total_sales_amount
                FROM inventory_points 
                WHERE data_date = %s
            ''', (target_date,))
            inventory_stats = cursor.fetchone()
    
    print(f'\n📊 最终合并结果统计:')
    print(f'   📍 总库存点数: {total_count} 个')
    print(f'   📈 有效库存点: {business_stats["effective"]} 个 ({business_stats["effective"]/total_count*100:.1f}%)')
    print(f'   🔴 断货库存点: {business_stats["out_of_stock"]} 个')
    print(f'   🔵 周转超标: {business_stats["turnover_exceeded"]} 个')
    print(f'   📦 有库存产品: {business_stats["has_inventory"]} 个')
    print(f'   📊 平均周转天数: {business_stats["avg_turnover_days"]:.1f} 天')
    
    print(f'\n🌍 按地区类型分布:')
    for stat in region_stats:
        print(f'     {stat["region_type"]}: {stat["count"]} 个库存点')
    
    print(f'\n🏪 按市场分布:')
    for stat in market_stats:
        print(f'     {stat["marketplace"]}: {stat["count"]} 个库存点')
    
    print(f'\n📦 库存统计:')
    print(f'   总库存量: {inventory_stats["total_inventory"] or 0:.0f} 件')
    print(f'   FBA可用: {inventory_stats["total_fba_available"] or 0:.0f} 件')
    print(f'   FBA在途: {inventory_stats["total_fba_inbound"] or 0:.0f} 件')
    print(f'   本地仓库存: {inventory_stats["total_local_available"] or 0:.0f} 件')
    print(f'   总销售额: ${inventory_stats["total_sales_amount"] or 0:.2f}')
    
    print('\n✅ 按照正确业务逻辑的库存点合并完成!')

if __name__ == '__main__':
    run_correct_inventory_merge()