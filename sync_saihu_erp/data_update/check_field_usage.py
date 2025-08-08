#!/usr/bin/env python3
"""
检查当前合并逻辑中订单字段的使用情况
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def check_field_usage():
    """检查字段使用情况"""
    print("=" * 80)
    print("🔍 订单字段使用情况分析")
    print("=" * 80)
    
    print("📊 product_analytics表中的订单相关字段:")
    print("   📦 order_count: 总订单量 (覆盖率: 20.8%)")
    print("   📢 ad_orders: 广告订单量 (覆盖率: 12.9%)")
    print("   🔄 ad_conversion_rate: 广告转化率 (覆盖率: 12.9%)")
    
    print("\n🔧 当前合并逻辑分析:")
    print("根据 correct_inventory_merge.py 代码:")
    
    # 检查当前合并逻辑中使用的字段
    print("\n1️⃣ 欧盟合并中使用的订单字段:")
    print("   ✅ total_order_count = sum(rep['order_count'] for rep in store_representatives)")
    print("   📝 说明: 使用了 order_count (总订单量)")
    
    print("\n2️⃣ 广告转化率计算:")
    print("   当前实现: ad_conversion_rate = total_order_count/total_ad_clicks")
    print("   业务需求: ad_conversion_rate = ad_orders/total_ad_clicks")
    print("   ❌ 问题: 使用了总订单量而非广告订单量")
    
    print("\n3️⃣ 数据对比示例:")
    
    db_manager = DatabaseManager()
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    asin,
                    order_count,
                    ad_orders,
                    ad_clicks,
                    CASE 
                        WHEN ad_clicks > 0 THEN ROUND(order_count/ad_clicks, 4)
                        ELSE 0 
                    END as current_calc,
                    CASE 
                        WHEN ad_clicks > 0 THEN ROUND(ad_orders/ad_clicks, 4)
                        ELSE 0 
                    END as correct_calc
                FROM product_analytics 
                WHERE data_date = '2025-07-27'
                AND ad_orders > 0 
                AND ad_clicks > 0
                LIMIT 5
            """)
            
            results = cursor.fetchall()
            
            if results:
                print("   产品对比 (当前计算 vs 正确计算):")
                for row in results:
                    print(f"   ASIN: {row['asin']}")
                    print(f"     总订单: {row['order_count']}, 广告订单: {row['ad_orders']}, 广告点击: {row['ad_clicks']}")
                    print(f"     当前转化率: {row['current_calc']:.4f} (总订单/点击)")
                    print(f"     正确转化率: {row['correct_calc']:.4f} (广告订单/点击)")
                    print()
    
    print("📋 结论:")
    print("✅ product_analytics表包含所需的字段:")
    print("   - order_count: 总订单量")
    print("   - ad_orders: 广告订单量") 
    print("   - ad_conversion_rate: 现有的广告转化率")
    
    print("\n❌ 当前合并逻辑问题:")
    print("   - 广告转化率计算使用了总订单量(order_count)")
    print("   - 应该使用广告订单量(ad_orders)")
    
    print("\n🔧 建议修改:")
    print("   1. 将 correct_inventory_merge.py 中的广告转化率计算改为:")
    print("      ad_conversion_rate = total_ad_orders/total_ad_clicks")
    print("   2. 同时需要聚合 ad_orders 字段")

if __name__ == '__main__':
    check_field_usage()