#!/usr/bin/env python3
"""
重新构建库存点数据
从inventory_details表生成符合3.2规则的库存点
"""

import mysql.connector
from typing import List, Dict, Any
from collections import defaultdict
import json

# 数据库配置
DB_CONFIG = {
    'host': '47.79.123.234',
    'port': 3306,
    'user': 'saihu_erp_sync',
    'password': '123456',
    'database': 'saihu_erp_sync',
    'charset': 'utf8mb4'
}

# 欧盟国家列表
eu_countries = {
    'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 'DK', 'SE', 'FI', 
    'EE', 'HR', 'SI', 'CZ', 'RO', 'BG', 'GR', 'CY', 'MT', 'IS', 'LI', 'MC', 'SM', 'VA'
}

def get_source_data():
    """获取源数据"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 从product_analytics获取数据
        query = '''
        SELECT 
            asin,
            sku,
            title as product_name,
            marketplace_id,
            CASE marketplace_id
                WHEN 'A1F83G8C2ARO7P' THEN 'UK'
                WHEN 'A1PA6795UKMFR9' THEN 'DE'
                WHEN 'A13V1IB3VIYZZH' THEN 'FR'
                WHEN 'A1RKKUPIHCS9HS' THEN 'ES'
                WHEN 'APJ6JRA9NG5V4' THEN 'IT'
                WHEN 'A2EUQ1WTGCTBG2' THEN 'US'
                WHEN 'A39IBJ37TRP1C6' THEN 'CA'
                WHEN 'A39IBJ37TRP1C6' THEN 'CA'
                ELSE marketplace_id
            END as marketplace,
            brand_name as store,
            fba_inventory as fba_available,
            total_inventory as fba_inbound,
            0 as local_available,
            total_inventory,
            sales_quantity as sales_7days,
            order_count,
            ad_sales,
            impressions as ad_impressions,
            clicks as ad_clicks,
            ad_cost as ad_spend,
            ad_orders as ad_order_count,
            CURDATE() as data_date
        FROM product_analytics 
        WHERE marketplace_id IN ('A1F83G8C2ARO7P', 'A1PA6795UKMFR9', 'A13V1IB3VIYZZH', 'A1RKKUPIHCS9HS', 'APJ6JRA9NG5V4', 'A2EUQ1WTGCTBG2')
        '''
        
        cursor.execute(query)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

def extract_store_prefix(store_name: str) -> str:
    """提取店铺前缀"""
    if not store_name:
        return '未知'
    if '-' in str(store_name):
        return str(store_name).split('-')[0].strip()
    return str(store_name).strip()

def merge_inventory_points(products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """合并库存点数据"""
    # 按ASIN分组
    asin_groups = defaultdict(list)
    for product in products:
        asin_groups[product['asin']].append(product)
    
    results = []
    
    for asin, products in asin_groups.items():
        # 分离欧盟和非欧盟
        eu_products = [p for p in products if p['marketplace'] in eu_countries]
        non_eu_products = [p for p in products if p['marketplace'] not in eu_countries]
        
        # 处理欧盟数据
        if eu_products:
            # 按店铺前缀分组
            store_groups = defaultdict(list)
            for product in eu_products:
                store_prefix = extract_store_prefix(product['store'])
                store_groups[store_prefix].append(product)
            
            # 选择最佳代表并合并
            representatives = []
            for store_prefix, store_products in store_groups.items():
                best = max(store_products, key=lambda p: (float(p['fba_available'] or 0) + float(p['fba_inbound'] or 0)))
                representatives.append(best)
            
            # 合并为欧盟库存点
            if representatives:
                base = representatives[0]
                eu_merged = {
                    'asin': asin,
                    'product_name': base['product_name'],
                    'sku': base['sku'],
                    'category': '未分类',
                    'sales_person': '未知',
                    'product_tag': '普通',
                    'dev_name': '',
                    'marketplace': '欧盟',
                    'store': '欧盟汇总',
                    'inventory_point_name': f'{asin}-欧盟',
                    'fba_available': sum(float(p['fba_available'] or 0) for p in representatives),
                    'fba_inbound': sum(float(p['fba_inbound'] or 0) for p in representatives),
                    'fba_sellable': 0,
                    'fba_unsellable': 0,
                    'local_available': max(float(p['local_available'] or 0) for p in representatives),
                    'inbound_shipped': 0,
                    'total_inventory': sum(float(p['total_inventory'] or 0) for p in representatives),
                    'sales_7days': 0,
                    'total_sales': 0,
                    'average_sales': 0,
                    'order_count': 0,
                    'promotional_orders': 0,
                    'average_price': '0',
                    'sales_amount': '0',
                    'net_sales': '0',
                    'refund_rate': '0',
                    'ad_impressions': 0,
                    'ad_clicks': 0,
                    'ad_spend': 0,
                    'ad_order_count': 0,
                    'ad_sales': 0,
                    'ad_ctr': 0,
                    'ad_cvr': 0,
                    'acoas': 0,
                    'ad_cpc': 0,
                    'ad_roas': 0,
                    'turnover_days': 0,
                    'daily_sales_amount': 0,
                    'is_turnover_exceeded': 0,
                    'is_out_of_stock': 0,
                    'is_zero_sales': 1,
                    'is_low_inventory': 0,
                    'is_effective_point': 0,
                    'merge_type': 'eu_merged',
                    'store_count': len(representatives),
                    'data_date': base['data_date']
                }
                results.append(eu_merged)
        
        # 处理非欧盟数据
        if non_eu_products:
            # 按国家分组
            country_groups = defaultdict(list)
            for product in non_eu_products:
                country = product['marketplace']
                country_groups[country].append(product)
            
            # 按国家合并
            for country, products in country_groups.items():
                # 按店铺前缀分组
                store_groups = defaultdict(list)
                for product in products:
                    store_prefix = extract_store_prefix(product['store'])
                    store_groups[store_prefix].append(product)
                
                # 合并每个国家的数据
                merged = {
                    'asin': asin,
                    'product_name': products[0]['product_name'],
                    'sku': products[0]['sku'],
                    'category': '未分类',
                    'sales_person': '未知',
                    'product_tag': '普通',
                    'dev_name': '',
                    'marketplace': country,
                    'store': f'{country}汇总',
                    'inventory_point_name': f'{asin}-{country}',
                    'fba_available': sum(float(p['fba_available'] or 0) for p in products),
                    'fba_inbound': sum(float(p['fba_inbound'] or 0) for p in products),
                    'fba_sellable': 0,
                    'fba_unsellable': 0,
                    'local_available': max(float(p['local_available'] or 0) for p in products),
                    'inbound_shipped': 0,
                    'total_inventory': sum(float(p['total_inventory'] or 0) for p in products),
                    'sales_7days': 0,
                    'total_sales': 0,
                    'average_sales': 0,
                    'order_count': 0,
                    'promotional_orders': 0,
                    'average_price': '0',
                    'sales_amount': '0',
                    'net_sales': '0',
                    'refund_rate': '0',
                    'ad_impressions': 0,
                    'ad_clicks': 0,
                    'ad_spend': 0,
                    'ad_order_count': 0,
                    'ad_sales': 0,
                    'ad_ctr': 0,
                    'ad_cvr': 0,
                    'acoas': 0,
                    'ad_cpc': 0,
                    'ad_roas': 0,
                    'turnover_days': 0,
                    'daily_sales_amount': 0,
                    'is_turnover_exceeded': 0,
                    'is_out_of_stock': 0,
                    'is_zero_sales': 1,
                    'is_low_inventory': 0,
                    'is_effective_point': 0,
                    'merge_type': 'country_merged',
                    'store_count': len(products),
                    'data_date': products[0]['data_date']
                }
                results.append(merged)
    
    return results

def save_merged_data(merged_data: List[Dict[str, Any]]) -> int:
    """保存合并后的数据"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        # 清除现有数据
        cursor.execute('DELETE FROM inventory_points')
        
        # 插入新数据
        fields = [
            'asin', 'product_name', 'sku', 'category', 'sales_person', 'product_tag', 'dev_name',
            'marketplace', 'store', 'inventory_point_name', 'fba_available', 'fba_inbound', 'fba_sellable',
            'fba_unsellable', 'local_available', 'inbound_shipped', 'total_inventory', 'sales_7days',
            'total_sales', 'average_sales', 'order_count', 'promotional_orders', 'average_price',
            'sales_amount', 'net_sales', 'refund_rate', 'ad_impressions', 'ad_clicks', 'ad_spend',
            'ad_order_count', 'ad_sales', 'ad_ctr', 'ad_cvr', 'acoas', 'ad_cpc', 'ad_roas',
            'turnover_days', 'daily_sales_amount', 'is_turnover_exceeded', 'is_out_of_stock',
            'is_zero_sales', 'is_low_inventory', 'is_effective_point', 'data_date', 'merge_type',
            'store_count'
        ]
        
        placeholders = ', '.join(['%s'] * len(fields))
        query = f'''INSERT INTO inventory_points ({', '.join(fields)}) VALUES ({placeholders})'''
        
        params_list = []
        for data in merged_data:
            params = tuple(data.get(field, None) for field in fields)
            params_list.append(params)
        
        cursor.executemany(query, params_list)
        conn.commit()
        return cursor.rowcount
    finally:
        cursor.close()
        conn.close()

def main():
    try:
        print("🔄 开始重新构建库存点数据...")
        
        # 1. 获取源数据
        print("1. 获取源数据...")
        source_data = get_source_data()
        print(f"   获取到 {len(source_data)} 条原始数据")
        
        if len(source_data) == 0:
            print("   ⚠️  没有找到源数据")
            return
        
        # 2. 执行合并
        print("2. 执行库存点合并...")
        merged_results = merge_inventory_points(source_data)
        print(f"   合并完成，生成 {len(merged_results)} 个库存点")
        
        # 3. 保存结果
        print("3. 保存合并结果...")
        saved_count = save_merged_data(merged_results)
        print(f"   已保存 {saved_count} 个库存点")
        
        # 4. 显示结果统计
        print("\n=== 合并结果统计 ===")
        
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT marketplace, COUNT(*) as count 
            FROM inventory_points 
            GROUP BY marketplace 
            ORDER BY count DESC
        ''')
        
        stats = cursor.fetchall()
        for stat in stats:
            print(f"   {stat['marketplace']}: {stat['count']} 条")
        
        cursor.close()
        conn.close()
        
        print("\n✅ 库存点数据重新构建完成！")
        
    except Exception as e:
        print(f"❌ 执行过程中出现错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()