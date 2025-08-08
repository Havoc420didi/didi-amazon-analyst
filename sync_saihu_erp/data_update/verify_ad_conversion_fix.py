#!/usr/bin/env python3
"""
验证广告转化率修复结果
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def verify_ad_conversion_fix():
    """验证广告转化率修复结果"""
    
    print("=" * 80)
    print("🔍 验证广告转化率修复结果")
    print("=" * 80)
    
    db_manager = DatabaseManager()
    
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 检查inventory_points表中的广告转化率数据
            print("1️⃣ 检查inventory_points表中的广告数据:")
            cursor.execute("""
                SELECT 
                    asin,
                    marketplace,
                    ad_impressions,
                    ad_clicks,
                    ad_order_count,
                    ad_cvr as calculated_conversion_rate,
                    CASE 
                        WHEN ad_clicks > 0 THEN ROUND(ad_order_count/ad_clicks, 4)
                        ELSE 0 
                    END as expected_conversion_rate
                FROM inventory_points 
                WHERE data_date = '2025-07-27'
                AND ad_order_count > 0 
                AND ad_clicks > 0
                ORDER BY ad_order_count DESC
                LIMIT 10
            """)
            
            results = cursor.fetchall()
            
            if results:
                print(f"   找到 {len(results)} 条有广告转化数据的记录:")
                print("   ASIN\t\t市场\t广告订单\t点击量\t计算转化率\t期望转化率\t状态")
                print("   " + "-" * 70)
                
                correct_count = 0
                for row in results:
                    calculated = float(row['calculated_conversion_rate'] or 0)
                    expected = float(row['expected_conversion_rate'] or 0)
                    is_correct = abs(calculated - expected) < 0.0001
                    if is_correct:
                        correct_count += 1
                    
                    status = "✅" if is_correct else "❌"
                    print(f"   {row['asin'][:10]}\t{row['marketplace'][:6]}\t{row['ad_order_count']}\t\t{row['ad_clicks']}\t{calculated:.4f}\t\t{expected:.4f}\t\t{status}")
                
                print(f"\n   修复状态: {correct_count}/{len(results)} 条记录计算正确 ({correct_count/len(results)*100:.1f}%)")
                
                if correct_count == len(results):
                    print("   ✅ 广告转化率计算已完全修复!")
                else:
                    print("   ❌ 部分广告转化率计算仍有问题")
            else:
                print("   ❌ 未找到有广告转化数据的记录")
            
            # 对比修复前后的差异
            print("\n2️⃣ 对比原始数据中的转化率差异:")
            cursor.execute("""
                SELECT 
                    pa.asin,
                    pa.order_count as total_orders,
                    pa.ad_orders as ad_orders,
                    pa.clicks as ad_clicks,
                    CASE 
                        WHEN pa.clicks > 0 THEN ROUND(pa.order_count/pa.clicks, 4)
                        ELSE 0 
                    END as old_method,
                    CASE 
                        WHEN pa.clicks > 0 THEN ROUND(pa.ad_orders/pa.clicks, 4)
                        ELSE 0 
                    END as new_method,
                    ip.ad_cvr as inventory_conversion
                FROM product_analytics pa
                LEFT JOIN inventory_points ip ON pa.asin = ip.asin AND ip.data_date = '2025-07-27'
                WHERE pa.data_date = '2025-07-27'
                AND pa.ad_orders > 0 
                AND pa.clicks > 0
                LIMIT 5
            """)
            
            comparison_results = cursor.fetchall()
            
            if comparison_results:
                print("   ASIN\t\t总订单\t广告订单\t点击\t旧方法\t新方法\t库存表值\t改进")
                print("   " + "-" * 75)
                
                for row in comparison_results:
                    old_conv = float(row['old_method'] or 0)
                    new_conv = float(row['new_method'] or 0)
                    inv_conv = float(row['inventory_conversion'] or 0)
                    improvement = "✅" if abs(new_conv - inv_conv) < 0.0001 else "❌"
                    
                    print(f"   {row['asin'][:10]}\t{row['total_orders']}\t{row['ad_orders']}\t\t{row['ad_clicks']}\t{old_conv:.4f}\t{new_conv:.4f}\t{inv_conv:.4f}\t\t{improvement}")
            
            # 统计整体修复效果
            print("\n3️⃣ 整体修复效果统计:")
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_records,
                    SUM(CASE WHEN ad_order_count > 0 THEN 1 ELSE 0 END) as has_ad_orders,
                    SUM(CASE WHEN ad_clicks > 0 THEN 1 ELSE 0 END) as has_ad_clicks,
                    SUM(CASE WHEN ad_cvr > 0 THEN 1 ELSE 0 END) as has_conversion_rate,
                    AVG(ad_cvr) as avg_conversion_rate
                FROM inventory_points 
                WHERE data_date = '2025-07-27'
            """)
            
            stats = cursor.fetchone()
            if stats:
                total = stats['total_records']
                print(f"   总库存点数: {total}")
                print(f"   有广告订单数据: {stats['has_ad_orders']} ({stats['has_ad_orders']/total*100:.1f}%)")
                print(f"   有广告点击数据: {stats['has_ad_clicks']} ({stats['has_ad_clicks']/total*100:.1f}%)")
                print(f"   有转化率数据: {stats['has_conversion_rate']} ({stats['has_conversion_rate']/total*100:.1f}%)")
                print(f"   平均广告转化率: {stats['avg_conversion_rate']:.4f}")
    
    print("\n" + "=" * 80)
    print("📋 修复总结")
    print("=" * 80)
    print("✅ 已完成的修复:")
    print("   - 添加了ad_orders字段的数据读取和聚合")
    print("   - 修正了广告转化率计算公式为 ad_orders/clicks")
    print("   - 更新了欧盟和非欧盟地区的合并逻辑")
    print("   - 修改了数据库插入语句包含ad_order_count字段")
    
    print("\n📊 业务影响:")
    print("   - 广告转化率现在更准确反映广告效果")
    print("   - 避免了使用总订单量导致的转化率高估")
    print("   - 为广告投放优化提供了更可靠的数据基础")

if __name__ == '__main__':
    verify_ad_conversion_fix()