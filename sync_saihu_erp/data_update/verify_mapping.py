#!/usr/bin/env python3
"""
验证字段映射结果
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def verify_field_mapping():
    """验证字段映射结果"""
    db_manager = DatabaseManager()
    
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            print('验证字段映射结果:')
            
            # 检查sales_person字段的数据来源
            cursor.execute("""
                SELECT 
                    asin, 
                    sales_person,
                    marketplace,
                    product_name
                FROM inventory_points 
                WHERE data_date = '2025-07-27' 
                AND sales_person IS NOT NULL 
                AND sales_person <> ''
                LIMIT 10
            """)
            results = cursor.fetchall()
            
            print(f'inventory_points表中有sales_person数据的记录数量: {len(results)}')
            if results:
                print('\n前10条sales_person数据:')
                for row in results:
                    print(f'  {row["asin"]} - {row["sales_person"]} - {row["marketplace"]}')
            
            # 对比原始数据中的operator_name
            print('\n对比product_analytics原始数据:')
            cursor.execute("""
                SELECT 
                    asin,
                    operator_name,
                    brand_name,
                    marketplace_id
                FROM product_analytics 
                WHERE data_date = '2025-07-27' 
                AND operator_name IS NOT NULL 
                AND operator_name <> ''
                LIMIT 5
            """)
            raw_results = cursor.fetchall()
            
            if raw_results:
                print('product_analytics表中operator_name数据:')
                for row in raw_results:
                    print(f'  {row["asin"]} - operator_name: "{row["operator_name"]}" - brand_name: "{row["brand_name"]}"')
            else:
                print('product_analytics表中没有非空operator_name数据')
                
            # 统计空值情况
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN sales_person IS NULL OR sales_person = '' THEN 1 ELSE 0 END) as empty_sales_person,
                    SUM(CASE WHEN sales_person IS NOT NULL AND sales_person <> '' THEN 1 ELSE 0 END) as has_sales_person
                FROM inventory_points 
                WHERE data_date = '2025-07-27'
            """)
            stats = cursor.fetchone()
            print(f'\n统计信息:')
            print(f'  总记录数: {stats["total"]}')  
            print(f'  sales_person为空: {stats["empty_sales_person"]}')
            print(f'  sales_person有值: {stats["has_sales_person"]}')
            
            # 检查原始数据中operator_name字段的情况
            print('\n检查product_analytics中operator_name字段:')
            cursor.execute("""
                SELECT COUNT(*) as total FROM product_analytics WHERE data_date = '2025-07-27'
            """)
            total_analytics = cursor.fetchone()['total']
            
            cursor.execute("""
                SELECT COUNT(*) as has_operator 
                FROM product_analytics 
                WHERE data_date = '2025-07-27' 
                AND operator_name IS NOT NULL 
                AND operator_name <> ''
            """)
            has_operator = cursor.fetchone()['has_operator']
            
            print(f'  product_analytics总记录数: {total_analytics}')
            print(f'  有operator_name的记录数: {has_operator}')
            print(f'  operator_name覆盖率: {has_operator/total_analytics*100:.1f}%')

if __name__ == '__main__':
    verify_field_mapping()