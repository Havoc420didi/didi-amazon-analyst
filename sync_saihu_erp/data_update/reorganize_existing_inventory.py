#!/usr/bin/env python3
"""
重新组织现有库存点数据
根据3.2数据合并规则重新合并欧盟地区
"""

import sys
import os
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

def get_existing_inventory_points():
    """获取现有库存点数据"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    try:
        query = '''
        SELECT 
            asin,
            product_name,
            sku,
            category,
            sales_person,
            product_tag,
            dev_name,
            marketplace,
            store,
            inventory_point_name,
            fba_available,
            fba_inbound,
            fba_sellable,
            fba_unsellable,
            local_available,
            inbound_shipped,
            total_inventory,
            sales_7days,
            total_sales,
            average_sales,
            order_count,
            promotional_orders,
            average_price,
            sales_amount,
            net_sales,
            refund_rate,
            ad_impressions,
            ad_clicks,
            ad_spend,
            ad_order_count,
            ad_sales,
            ad_ctr,
            ad_cvr,
            acoas,
            ad_cpc,
            ad_roas,
            turnover_days,
            inventory_status,
            daily_sales_amount,
            is_turnover_exceeded,
            is_out_of_stock,
            is_zero_sales,
            is_low_inventory,
            is_effective_point,
            data_date
        FROM inventory_points
        '''
        
        cursor.execute(query)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

def clear_inventory_points():
    """清除现有库存点数据"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        cursor.execute('DELETE FROM inventory_points')
        deleted = cursor.rowcount
        conn.commit()
        return deleted
    finally:
        cursor.close()
        conn.close()

def extract_store_prefix(store_name: str) -> str:
    """提取店铺前缀"""
    if '-' in store_name:
        return store_name.split('-')[0].strip()
    return store_name.strip()

def extract_country_code(store_name: str) -> str:
    """从店铺名称提取国家代码"""
    if '-' in store_name:
        return store_name.split('-')[-1].strip().upper()
    return ''

def merge_eu_data_by_asin(products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """按ASIN合并欧盟数据"""
    # 按ASIN分组
    asin_groups = defaultdict(list)
    for product in products:
        asin_groups[product['asin']].append(product)
    
    results = []
    for asin, products in asin_groups.items():
        # 只保留欧盟数据
        eu_products = [p for p in products if p['marketplace'] in eu_countries]
        if not eu_products:
            continue
            
        # 按店铺前缀分组
        store_groups = defaultdict(list)
        for product in eu_products:
            store_prefix = extract_store_prefix(product['store'])
            store_groups[store_prefix].append(product)
        
        # 每个店铺选择最佳代表（FBA可用+FBA在途最大）
        representatives = []
        for store_prefix, store_products in store_groups.items():
            best = max(store_products, key=lambda p: (float(p['fba_available'] or 0) + float(p['fba_inbound'] or 0)))
            representatives.append(best)
        
        # 合并所有代表
        if representatives:
            base = representatives[0]
            
            merged = {
                'asin': asin,
                'product_name': base['product_name'],
                'sku': base['sku'],
                'category': base['category'],
                'sales_person': base['sales_person'],
                'product_tag': base['product_tag'],
                'dev_name': base['dev_name'],
                'marketplace': '欧盟',
                'store': '欧盟汇总',
                'inventory_point_name': f'{asin}-欧盟',
                'fba_available': sum(float(p['fba_available'] or 0) for p in representatives),
                'fba_inbound': sum(float(p['fba_inbound'] or 0) for p in representatives),
                'fba_sellable': sum(float(p['fba_sellable'] or 0) for p in representatives),
                'fba_unsellable': sum(float(p['fba_unsellable'] or 0) for p in representatives),
                'local_available': max(float(p['local_available'] or 0) for p in representatives),
                'inbound_shipped': sum(float(p['inbound_shipped'] or 0) for p in representatives),
                'total_inventory': sum(float(p['total_inventory'] or 0) for p in representatives),
                'sales_7days': sum(float(p['sales_7days'] or 0) for p in representatives),
                'total_sales': sum(float(p['total_sales'] or 0) for p in representatives),
                'average_sales': sum(float(p['average_sales'] or 0) for p in representatives),
                'order_count': sum(p['order_count'] or 0 for p in representatives),
                'promotional_orders': sum(p['promotional_orders'] or 0 for p in representatives),
                'average_price': base['average_price'],
                'sales_amount': base['sales_amount'],
                'net_sales': base['net_sales'],
                'refund_rate': base['refund_rate'],
                'ad_impressions': sum(p['ad_impressions'] or 0 for p in representatives),
                'ad_clicks': sum(p['ad_clicks'] or 0 for p in representatives),
                'ad_spend': sum(float(p['ad_spend'] or 0) for p in representatives),
                'ad_order_count': sum(p['ad_order_count'] or 0 for p in representatives),
                'ad_sales': sum(float(p['ad_sales'] or 0) for p in representatives),
                'ad_ctr': base['ad_ctr'],
                'ad_cvr': base['ad_cvr'],
                'acoas': base['acoas'],
                'ad_cpc': base['ad_cpc'],
                'ad_roas': base['ad_roas'],
                'turnover_days': base['turnover_days'],
                'inventory_status': base['inventory_status'],
                'daily_sales_amount': sum(float(p['daily_sales_amount'] or 0) for p in representatives),
                'is_turnover_exceeded': max(p['is_turnover_exceeded'] or 0 for p in representatives),
                'is_out_of_stock': max(p['is_out_of_stock'] or 0 for p in representatives),
                'is_zero_sales': max(p['is_zero_sales'] or 0 for p in representatives),
                'is_low_inventory': max(p['is_low_inventory'] or 0 for p in representatives),
                'is_effective_point': max(p['is_effective_point'] or 0 for p in representatives),
                'data_date': base['data_date'],
                'merge_type': 'eu_merged',
                'store_count': len(representatives),
                'merged_stores': json.dumps([extract_store_prefix(p['store']) for p in representatives])
            }
            
            results.append(merged)
    
    return results

def process_non_eu_data(products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """处理非欧盟数据 - 保持按国家显示"""
    return [p for p in products if p['marketplace'] not in eu_countries]

def save_merged_data(merged_data: List[Dict[str, Any]]) -> int:
    """保存合并后的数据"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        fields = [
            'asin', 'product_name', 'sku', 'category', 'sales_person', 'product_tag', 'dev_name',
            'marketplace', 'store', 'inventory_point_name', 'fba_available', 'fba_inbound', 'fba_sellable',
            'fba_unsellable', 'local_available', 'inbound_shipped', 'total_inventory', 'sales_7days',
            'total_sales', 'average_sales', 'order_count', 'promotional_orders', 'average_price',
            'sales_amount', 'net_sales', 'refund_rate', 'ad_impressions', 'ad_clicks', 'ad_spend',
            'ad_order_count', 'ad_sales', 'ad_ctr', 'ad_cvr', 'acoas', 'ad_cpc', 'ad_roas',
            'turnover_days', 'daily_sales_amount', 'is_turnover_exceeded', 'is_out_of_stock',
            'is_zero_sales', 'is_low_inventory', 'is_effective_point', 'data_date', 'merge_type',
            'store_count', 'merged_stores'
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
        print("🔄 开始重新组织库存点数据...")
        
        # 1. 获取现有库存点数据
        print("1. 获取现有库存点数据...")
        existing_data = get_existing_inventory_points()
        print(f"   获取到 {len(existing_data)} 条现有数据")
        
        if len(existing_data) == 0:
            print("   ⚠️  没有找到现有数据")
            return
        
        # 2. 清除现有库存点数据
        print("2. 清除现有inventory_points数据...")
        deleted = clear_inventory_points()
        print(f"   已删除 {deleted} 条记录")
        
        # 3. 分离欧盟和非欧盟数据
        eu_products = [p for p in existing_data if p['marketplace'] in eu_countries]
        non_eu_products = [p for p in existing_data if p['marketplace'] not in eu_countries]
        
        print(f"3. 数据分离完成:")
        print(f"   欧盟数据: {len(eu_products)} 条")
        print(f"   非欧盟数据: {len(non_eu_products)} 条")
        
        # 4. 执行合并
        print("4. 执行库存点合并...")
        merged_results = []
        
        # 合并欧盟数据
        if eu_products:
            eu_merged = merge_eu_data_by_asin(eu_products)
            merged_results.extend(eu_merged)
            print(f"   ✅ 欧盟数据合并完成，生成 {len(eu_merged)} 个欧盟库存点")
        
        # 处理非欧盟数据（保持原样）
        if non_eu_products:
            non_eu_processed = process_non_eu_data(non_eu_products)
            merged_results.extend(non_eu_processed)
            print(f"   ✅ 非欧盟数据保持原样，共 {len(non_eu_processed)} 条")
        
        # 5. 保存合并结果
        print("5. 保存合并结果...")
        saved_count = save_merged_data(merged_results)
        print(f"   已保存 {saved_count} 个库存点")
        
        # 6. 显示结果统计
        print("\n=== 合并结果统计 ===")
        
        # 重新查询统计
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
        
        print("\n✅ 库存点合并逻辑重新执行完成！")
        
    except Exception as e:
        print(f"❌ 执行过程中出现错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()