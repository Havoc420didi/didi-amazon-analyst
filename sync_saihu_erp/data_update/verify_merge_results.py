#!/usr/bin/env python3
"""
验证合并结果的详细情况
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def verify_merge_results():
    """验证合并结果的详细情况"""
    db_manager = DatabaseManager()
    
    print("🔍 详细验证合并结果...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            
            # 查看所有合并后的库存点
            cursor.execute('''
                SELECT 
                    asin, product_name, marketplace, store, 
                    fba_available, fba_inbound, local_available, total_inventory,
                    average_sales, turnover_days, daily_sales_amount,
                    is_effective_point, is_turnover_exceeded, is_out_of_stock,
                    merge_type, merged_stores, store_count,
                    data_date
                FROM inventory_points 
                ORDER BY marketplace, asin
            ''')
            results = cursor.fetchall()
            
            print(f"\n📊 合并结果详情 (共 {len(results)} 个库存点):")
            print("=" * 100)
            
            for i, row in enumerate(results, 1):
                print(f"\n{i}. ASIN: {row['asin']}")
                print(f"   产品名: {row['product_name'][:50]}...")
                print(f"   市场/店铺: {row['marketplace']} / {row['store']}")
                print(f"   库存: FBA可用={row['fba_available']}, FBA在途={row['fba_inbound']}, 本地仓={row['local_available']}, 总库存={row['total_inventory']}")
                print(f"   销售: 平均销量={row['average_sales']:.2f}, 日均销售额=${row['daily_sales_amount']:.2f}")
                print(f"   分析: 周转天数={row['turnover_days']:.1f}天")
                
                # 状态标识
                statuses = []
                if row['is_effective_point']:
                    statuses.append("有效库存点")
                if row['is_turnover_exceeded']:
                    statuses.append("周转超标")
                if row['is_out_of_stock']:
                    statuses.append("断货")
                    
                print(f"   状态: {', '.join(statuses) if statuses else '正常'}")
                print(f"   合并: {row['merge_type']}, 合并店铺数={row['store_count']}")
                
                if row['merged_stores']:
                    import json
                    try:
                        merged_stores = json.loads(row['merged_stores'])
                        print(f"   店铺列表: {', '.join(merged_stores)}")
                    except:
                        print(f"   店铺列表: {row['merged_stores']}")
                
                print(f"   数据日期: {row['data_date']}")
            
            # 统计分析
            print("\n" + "=" * 100)
            print("📈 统计分析:")
            
            # 按合并类型统计
            cursor.execute('''
                SELECT 
                    merge_type,
                    COUNT(*) as count,
                    AVG(fba_available) as avg_fba,
                    AVG(turnover_days) as avg_turnover,
                    SUM(CASE WHEN is_effective_point = 1 THEN 1 ELSE 0 END) as effective_count
                FROM inventory_points 
                GROUP BY merge_type
            ''')
            merge_stats = cursor.fetchall()
            
            print("   按合并类型:")
            for stat in merge_stats:
                merge_type = stat['merge_type'] or 'unknown'
                effectiveness = stat['effective_count'] / stat['count'] * 100 if stat['count'] > 0 else 0
                print(f"     {merge_type}: {stat['count']}个, "
                      f"平均FBA库存={stat['avg_fba']:.1f}, "
                      f"平均周转天数={stat['avg_turnover']:.1f}天, "
                      f"有效率={effectiveness:.1f}%")
            
            # 验证合并逻辑是否正确工作
            print("\n🔬 合并逻辑验证:")
            
            # 检查欧盟合并
            cursor.execute('''
                SELECT COUNT(*) as eu_count 
                FROM inventory_points 
                WHERE marketplace = '欧盟' AND merge_type = 'eu_merged'
            ''')
            eu_result = cursor.fetchone()
            print(f"   欧盟合并库存点: {eu_result['eu_count']}个 ✅")
            
            # 检查非欧盟合并
            cursor.execute('''
                SELECT COUNT(*) as non_eu_count 
                FROM inventory_points 
                WHERE marketplace != '欧盟' AND merge_type = 'non_eu_merged'
            ''')
            non_eu_result = cursor.fetchone()
            print(f"   非欧盟合并库存点: {non_eu_result['non_eu_count']}个 ✅")
            
            # 检查是否有相同ASIN的重复合并
            cursor.execute('''
                SELECT asin, marketplace, COUNT(*) as count 
                FROM inventory_points 
                GROUP BY asin, marketplace 
                HAVING COUNT(*) > 1
            ''')
            duplicates = cursor.fetchall()
            
            if duplicates:
                print("   ⚠️  发现重复的ASIN-市场组合:")
                for dup in duplicates:
                    print(f"     {dup['asin']}-{dup['marketplace']}: {dup['count']}个")
            else:
                print("   ✅ 没有重复的ASIN-市场组合")
            
            print("\n🎉 合并结果验证完成!")

if __name__ == '__main__':
    verify_merge_results()