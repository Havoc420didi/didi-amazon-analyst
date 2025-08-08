#!/usr/bin/env python3
"""
重新执行库存点合并逻辑
清除现有inventory_points数据并重新合并
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import mysql.connector
except ImportError:
    print("请先安装mysql-connector-python: pip install mysql-connector-python")
    sys.exit(1)

from typing import List, Dict, Any
from collections import defaultdict

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
    'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 'DK', 'SE', 'FI', 'EE', 'HR', 'SI', 'CZ', 'RO', 'BG', 'GR', 'CY', 'MT', 'IS', 'LI', 'MC', 'SM', 'VA'
}

def get_inventory_data():
    """获取库存数据"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 查询原始数据 - 使用inventory_details表的字段名
        query = '''
        SELECT 
            commodity_id as asin,
            commodity_name as product_name,
            commodity_sku as sku,
            '未分类' as category,
            '未知' as sales_person,
            '普通' as product_tag,
            SUBSTRING_INDEX(warehouse_id, '-', -1) as marketplace,
            warehouse_id as store,
            stock_available as fba_available,
            stock_wait as fba_inbound,
            stock_plan as local_available,
            0 as sales_7days,
            0 as average_sales,
            0 as order_count
        FROM inventory_details 
        WHERE warehouse_id REGEXP '(FR|DE|IT|ES|PT|NL|BE|LU|AT|DK|SE|FI|EE|HR|SI|CZ|RO|BG|GR|CY|MT|IS|LI|MC|SM|VA|US|UK|CA|AU)$'
        '''
        
        cursor.execute(query)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

def clear_inventory_points():
    """清除库存点数据"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        cursor.execute('DELETE FROM inventory_points')
        deleted_count = cursor.rowcount
        conn.commit()
        return deleted_count
    finally:
        cursor.close()
        conn.close()

def merge_eu_data(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """合并欧盟数据"""
    if not products:
        return None
    
    # 按店铺前缀分组
    store_groups = defaultdict(list)
    for product in products:
        store_name = product['store']
        store_prefix = store_name.split('-')[0] if '-' in store_name else store_name
        store_groups[store_prefix].append(product)
    
    # 选择最佳代表
    representatives = []
    for store_prefix, products in store_groups.items():
        best = max(products, key=lambda p: (p['fba_available'] or 0) + (p['fba_inbound'] or 0))
        representatives.append(best)
    
    # 合并数据
    base = representatives[0]
    return {
        'asin': base['asin'],
        'product_name': base['product_name'],
        'sku': base['sku'],
        'category': base['category'],
        'sales_person': base['sales_person'],
        'product_tag': base['product_tag'],
        'marketplace': '欧盟',
        'store': '欧盟汇总',
        'fba_available': sum(p['fba_available'] or 0 for p in representatives),
        'fba_inbound': sum(p['fba_inbound'] or 0 for p in representatives),
        'local_available': max(p['local_available'] or 0 for p in representatives),
        'sales_7days': sum(p['sales_7days'] or 0 for p in representatives),
        'average_sales': sum(p['average_sales'] or 0 for p in representatives),
        'order_count': sum(p['order_count'] or 0 for p in representatives)
    }

def merge_non_eu_data(products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """合并非欧盟数据"""
    if not products:
        return []
    
    # 按国家和ASIN分组
    country_groups = defaultdict(list)
    for product in products:
        country = product['store'].split('-')[-1]
        key = f'{country}-{product["asin"]}'
        country_groups[key].append(product)
    
    results = []
    for key, products in country_groups.items():
        country, asin = key.split('-')
        base = products[0]
        
        merged = {
            'asin': asin,
            'product_name': base['product_name'],
            'sku': base['sku'],
            'category': base['category'],
            'sales_person': base['sales_person'],
            'product_tag': base['product_tag'],
            'marketplace': country,
            'store': f'{country}多店铺汇总' if len(products) > 1 else base['store'],
            'fba_available': sum(p['fba_available'] or 0 for p in products),
            'fba_inbound': sum(p['fba_inbound'] or 0 for p in products),
            'local_available': sum(p['local_available'] or 0 for p in products),
            'sales_7days': sum(p['sales_7days'] or 0 for p in products),
            'average_sales': sum(p['average_sales'] or 0 for p in products),
            'order_count': sum(p['order_count'] or 0 for p in products)
        }
        results.append(merged)
    
    return results

def save_merged_data(merged_data: List[Dict[str, Any]]):
    """保存合并后的数据"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        for data in merged_data:
            query = '''
            INSERT INTO inventory_points (
                asin, product_name, sku, category, sales_person, product_tag, dev_name,
                marketplace, store, inventory_point_name, fba_available, fba_inbound, local_available,
                sales_7days, average_sales, order_count, data_date, merge_type, store_count
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURDATE(), %s, %s)
            '''
            
            inventory_point_name = f"{data['asin']}-{data['marketplace']}"
            merge_type = 'eu_merged' if data['marketplace'] == '欧盟' else 'country_merged'
            store_count = 1 if data['marketplace'] != '欧盟' else data.get('_representative_count', 1)
            
            cursor.execute(query, (
                data['asin'], data['product_name'], data['sku'], data['category'],
                data['sales_person'], data['product_tag'], '',
                data['marketplace'], data['store'], inventory_point_name,
                data['fba_available'], data['fba_inbound'], data['local_available'],
                data['sales_7days'], data['average_sales'], data['order_count'],
                merge_type, store_count
            ))
        
        conn.commit()
        return len(merged_data)
    finally:
        cursor.close()
        conn.close()

def main():
    try:
        print("🔄 开始重新执行库存点合并逻辑...")
        
        # 1. 获取原始数据
        print("1. 获取原始库存数据...")
        raw_data = get_inventory_data()
        print(f"   获取到 {len(raw_data)} 条原始数据")
        
        if len(raw_data) == 0:
            print("   ⚠️  没有找到需要合并的数据")
            return
        
        # 2. 清除现有库存点数据
        print("2. 清除现有inventory_points数据...")
        deleted = clear_inventory_points()
        print(f"   已删除 {deleted} 条记录")
        
        # 3. 按地区分离数据
        eu_products = [p for p in raw_data if p['marketplace'] in eu_countries]
        non_eu_products = [p for p in raw_data if p['marketplace'] not in eu_countries]
        
        print(f"3. 数据分离完成:")
        print(f"   欧盟数据: {len(eu_products)} 条")
        print(f"   非欧盟数据: {len(non_eu_products)} 条")
        
        # 4. 执行合并
        print("4. 执行库存点合并...")
        merged_results = []
        
        # 合并欧盟数据
        if eu_products:
            eu_result = merge_eu_data(eu_products)
            if eu_result:
                merged_results.append(eu_result)
                print("   ✅ 欧盟数据合并完成")
        
        # 合并非欧盟数据
        if non_eu_products:
            non_eu_results = merge_non_eu_data(non_eu_products)
            merged_results.extend(non_eu_results)
            print("   ✅ 非欧盟数据合并完成")
        
        # 5. 保存合并结果
        print("5. 保存合并结果...")
        saved_count = save_merged_data(merged_results)
        print(f"   已保存 {saved_count} 个合并后的库存点")
        
        # 6. 显示结果
        print("\n=== 合并结果预览 ===")
        for i, result in enumerate(merged_results, 1):
            print(f"{i}. {result['asin']} - {result['marketplace']} - {result['store']}")
            print(f"   FBA可用: {result['fba_available']}, FBA在途: {result['fba_inbound']}, 7天销量: {result['sales_7days']}")
        
        print("\n✅ 库存点合并逻辑重新执行完成！")
        
    except Exception as e:
        print(f"❌ 执行过程中出现错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()