#!/usr/bin/env python3
"""
检查product_analytics表中的订单量相关字段
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def check_order_fields():
    """检查订单量相关字段"""
    db_manager = DatabaseManager()
    
    print("=" * 80)
    print("🔍 检查product_analytics表中的订单量相关字段")
    print("=" * 80)
    
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 1. 首先查看表结构，寻找订单相关字段
            print("1️⃣ 表结构中的订单相关字段:")
            cursor.execute("DESC product_analytics")
            columns = cursor.fetchall()
            
            order_related_fields = []
            for col in columns:
                field_name = col['Field'] if 'Field' in col else col[0]
                field_type = col['Type'] if 'Type' in col else col[1]
                
                if 'order' in field_name.lower():
                    order_related_fields.append((field_name, field_type))
                    print(f"   📦 {field_name} - {field_type}")
            
            if not order_related_fields:
                print("   ❌ 未找到包含'order'的字段名")
            
            # 2. 查看实际数据中的订单字段值
            print(f"\n2️⃣ 订单相关字段的数据样本 (最新日期: 2025-07-27):")
            
            if order_related_fields:
                field_names = [field[0] for field in order_related_fields]
                field_list = ', '.join(field_names)
                
                cursor.execute(f"""
                    SELECT asin, {field_list}
                    FROM product_analytics 
                    WHERE data_date = '2025-07-27'
                    AND ({' > 0 OR '.join(field_names)} > 0)
                    LIMIT 10
                """)
                
                results = cursor.fetchall()
                
                if results:
                    print("   订单字段数据样本:")
                    for i, row in enumerate(results[:5], 1):
                        print(f"   {i}. ASIN: {row['asin']}")
                        for field_name in field_names:
                            value = row.get(field_name, 0)
                            print(f"      {field_name}: {value}")
                        print()
                else:
                    print("   ❌ 未找到有订单数据的记录")
            
            # 3. 统计各订单字段的数据分布
            print("3️⃣ 订单字段数据统计:")
            
            if order_related_fields:
                for field_name, _ in order_related_fields:
                    cursor.execute(f"""
                        SELECT 
                            COUNT(*) as total_records,
                            COUNT(CASE WHEN {field_name} > 0 THEN 1 END) as non_zero_records,
                            AVG({field_name}) as avg_value,
                            MAX({field_name}) as max_value,
                            MIN({field_name}) as min_value
                        FROM product_analytics 
                        WHERE data_date = '2025-07-27'
                    """)
                    
                    stats = cursor.fetchone()
                    if stats:
                        total = stats['total_records']
                        non_zero = stats['non_zero_records']
                        coverage = (non_zero / total * 100) if total > 0 else 0
                        
                        print(f"   📊 {field_name}:")
                        print(f"      总记录数: {total}")
                        print(f"      有数据记录: {non_zero} ({coverage:.1f}%)")
                        print(f"      平均值: {stats['avg_value']:.2f}")
                        print(f"      最大值: {stats['max_value']}")
                        print(f"      最小值: {stats['min_value']}")
                        print()
            
            # 4. 检查广告相关的订单字段
            print("4️⃣ 广告相关字段检查:")
            ad_fields = []
            for col in columns:
                field_name = col['Field'] if 'Field' in col else col[0]
                if 'ad' in field_name.lower() and ('order' in field_name.lower() or 'conversion' in field_name.lower()):
                    ad_fields.append(field_name)
            
            if ad_fields:
                print("   找到广告相关字段:")
                for field in ad_fields:
                    print(f"   📢 {field}")
                    
                    cursor.execute(f"""
                        SELECT 
                            COUNT(CASE WHEN {field} > 0 THEN 1 END) as non_zero_count,
                            AVG({field}) as avg_val
                        FROM product_analytics 
                        WHERE data_date = '2025-07-27'
                    """)
                    
                    result = cursor.fetchone()
                    if result:
                        print(f"      有数据记录: {result['non_zero_count']}, 平均值: {result['avg_val']:.3f}")
            else:
                print("   ❌ 未找到广告订单相关字段")
            
            # 5. 查看所有可能相关的字段
            print("\n5️⃣ 其他可能相关的字段:")
            conversion_fields = []
            sales_fields = []
            
            for col in columns:
                field_name = col['Field'] if 'Field' in col else col[0]
                field_lower = field_name.lower()
                
                if 'conversion' in field_lower or 'convert' in field_lower:
                    conversion_fields.append(field_name)
                elif 'sales' in field_lower and 'order' not in field_lower:
                    sales_fields.append(field_name)
            
            if conversion_fields:
                print("   转化相关字段:")
                for field in conversion_fields:
                    print(f"   🔄 {field}")
            
            if sales_fields:
                print("   销售相关字段:")
                for field in sales_fields[:5]:  # 只显示前5个
                    print(f"   💰 {field}")

if __name__ == '__main__':
    check_order_fields()