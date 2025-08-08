#!/usr/bin/env python3
"""
订单字段最终分析报告
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def final_analysis():
    """最终分析报告"""
    print("=" * 80)
    print("📊 Product_Analytics表订单字段分析总结")
    print("=" * 80)
    
    db_manager = DatabaseManager()
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 检查数据对比
            cursor.execute("""
                SELECT 
                    asin,
                    order_count,
                    ad_orders,
                    clicks,
                    CASE 
                        WHEN clicks > 0 THEN ROUND(order_count/clicks, 4)
                        ELSE 0 
                    END as current_conversion,
                    CASE 
                        WHEN clicks > 0 THEN ROUND(ad_orders/clicks, 4)
                        ELSE 0 
                    END as correct_conversion
                FROM product_analytics 
                WHERE data_date = '2025-07-27'
                AND ad_orders > 0 
                AND clicks > 0
                LIMIT 3
            """)
            
            results = cursor.fetchall()
            
            print("🔍 字段识别结果:")
            print("   ✅ order_count: 总订单量")
            print("   ✅ ad_orders: 广告订单量") 
            print("   ✅ clicks: 广告点击量")
            
            print(f"\n📈 数据样本对比 (转化率计算差异):")
            if results:
                for i, row in enumerate(results, 1):
                    print(f"   {i}. ASIN: {row['asin']}")
                    print(f"      总订单: {row['order_count']}, 广告订单: {row['ad_orders']}, 点击: {row['clicks']}")
                    print(f"      当前计算: {row['current_conversion']:.4f} (总订单/点击)")
                    print(f"      正确计算: {row['correct_conversion']:.4f} (广告订单/点击)")
                    print()
            
            # 统计覆盖情况
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN order_count > 0 THEN 1 ELSE 0 END) as has_orders,
                    SUM(CASE WHEN ad_orders > 0 THEN 1 ELSE 0 END) as has_ad_orders,
                    SUM(CASE WHEN clicks > 0 THEN 1 ELSE 0 END) as has_clicks
                FROM product_analytics 
                WHERE data_date = '2025-07-27'
            """)
            
            stats = cursor.fetchone()
            total = stats['total']
            
            print("📊 数据覆盖统计:")
            print(f"   总记录数: {total}")
            print(f"   有总订单数据: {stats['has_orders']} ({stats['has_orders']/total*100:.1f}%)")
            print(f"   有广告订单数据: {stats['has_ad_orders']} ({stats['has_ad_orders']/total*100:.1f}%)")
            print(f"   有广告点击数据: {stats['has_clicks']} ({stats['has_clicks']/total*100:.1f}%)")
    
    print("\n" + "=" * 80)
    print("📋 结论")
    print("=" * 80)
    
    print("✅ 字段可用性:")
    print("   - product_analytics表包含所需的所有订单字段")
    print("   - order_count: 总订单量 (20.8%覆盖率)")
    print("   - ad_orders: 广告订单量 (12.9%覆盖率)")
    print("   - clicks: 广告点击量 (可用于计算转化率)")
    
    print("\n❌ 当前实现问题:")
    print("   - 广告转化率计算使用了总订单量(order_count)")
    print("   - 应该使用广告订单量(ad_orders)进行计算")
    print("   - 这导致转化率被高估")
    
    print("\n🔧 修复建议:")
    print("   1. 修改 correct_inventory_merge.py 中的聚合逻辑")
    print("   2. 添加 ad_orders 字段的聚合:")
    print("      total_ad_orders = sum(p['ad_orders'] for p in products)")
    print("   3. 修改广告转化率计算:")
    print("      ad_conversion_rate = total_ad_orders/total_ad_clicks")
    print("   4. 确保使用正确的字段名 'clicks' 而非 'ad_clicks'")

if __name__ == '__main__':
    final_analysis()