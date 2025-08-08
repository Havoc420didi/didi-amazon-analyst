#!/usr/bin/env python3
"""
快速合并全部数据
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def quick_merge_all():
    db_manager = DatabaseManager()
    
    print("🚀 快速合并全部数据")
    
    # 清空表格
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM inventory_points")
            conn.commit()
            print("✅ 已清空inventory_points表")
    
    # 直接从product_analytics插入到inventory_points
    print("📥 直接合并数据...")
    
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 使用数据最多的日期
            cursor.execute("SELECT data_date, COUNT(*) as count FROM product_analytics GROUP BY data_date ORDER BY count DESC LIMIT 1")
            best_date = cursor.fetchone()
            target_date = best_date['data_date']
            print(f"使用日期: {target_date} ({best_date['count']}条)")
            
            # 直接插入合并后的数据，使用GROUP BY避免重复
            insert_sql = """
            INSERT INTO inventory_points (
                asin, product_name, sku, category, sales_person, dev_name,
                marketplace, store, inventory_point_name,
                fba_available, fba_inbound, fba_sellable, local_available, total_inventory,
                sales_7days, total_sales, average_sales, order_count,
                average_price, sales_amount, net_sales, refund_rate,
                ad_impressions, ad_clicks, ad_spend, ad_order_count, ad_sales,
                ad_ctr, ad_cvr, acoas, turnover_days, daily_sales_amount,
                is_effective_point, is_turnover_exceeded, is_out_of_stock,
                merge_type, store_count, data_date, created_at, updated_at
            )
            SELECT 
                asin,
                MAX(COALESCE(title, '')) as product_name,
                MAX(COALESCE(sku, '')) as sku,
                MAX(COALESCE(category_name, '')) as category,
                MAX(COALESCE(operator_name, '')) as sales_person,
                MAX(COALESCE(dev_name, '')) as dev_name,
                
                -- 根据marketplace_id确定市场
                CASE 
                    WHEN MAX(marketplace_id) LIKE '%%A1F83G8C2ARO7P%%' THEN 'UK'
                    WHEN MAX(marketplace_id) LIKE '%%ATVPDKIKX0DER%%' THEN 'US'
                    WHEN MAX(marketplace_id) LIKE '%%A1PA6795UKMFR9%%' THEN 'DE'
                    WHEN MAX(marketplace_id) LIKE '%%A13V1IB3VIYZZH%%' THEN 'FR'
                    WHEN MAX(marketplace_id) LIKE '%%APJ6JRA9NG5V4%%' THEN 'IT'
                    WHEN MAX(marketplace_id) LIKE '%%A1RKKUPIHCS9HS%%' THEN 'ES'
                    ELSE 'US'
                END as marketplace,
                
                -- 生成店铺名
                CASE 
                    WHEN MAX(marketplace_id) LIKE '%%A1F83G8C2ARO7P%%' THEN '03 ZipCozy-UK'
                    WHEN MAX(marketplace_id) LIKE '%%ATVPDKIKX0DER%%' THEN '01 VivaJoy-US'
                    WHEN MAX(marketplace_id) LIKE '%%A1PA6795UKMFR9%%' THEN '02 MumEZ-DE'
                    WHEN MAX(marketplace_id) LIKE '%%A13V1IB3VIYZZH%%' THEN '03 ZipCozy-FR'
                    WHEN MAX(marketplace_id) LIKE '%%APJ6JRA9NG5V4%%' THEN '01 VivaJoy-IT'
                    WHEN MAX(marketplace_id) LIKE '%%A1RKKUPIHCS9HS%%' THEN '02 MumEZ-ES'
                    ELSE '01 Default-US'
                END as store,
                
                -- 库存点名称
                CONCAT(asin, '-', 
                    CASE 
                        WHEN MAX(marketplace_id) LIKE '%%A1F83G8C2ARO7P%%' THEN 'UK'
                        WHEN MAX(marketplace_id) LIKE '%%ATVPDKIKX0DER%%' THEN 'US'
                        WHEN MAX(marketplace_id) LIKE '%%A1PA6795UKMFR9%%' THEN 'DE'
                        WHEN MAX(marketplace_id) LIKE '%%A13V1IB3VIYZZH%%' THEN 'FR'
                        WHEN MAX(marketplace_id) LIKE '%%APJ6JRA9NG5V4%%' THEN 'IT'
                        WHEN MAX(marketplace_id) LIKE '%%A1RKKUPIHCS9HS%%' THEN 'ES'
                        ELSE 'US'
                    END
                ) as inventory_point_name,
                
                -- 库存数据 (合并重复记录)
                SUM(COALESCE(fba_inventory, 0)) as fba_available,
                0 as fba_inbound,
                SUM(COALESCE(fba_inventory, 0)) as fba_sellable,
                0 as local_available,
                SUM(COALESCE(fba_inventory, 0)) as total_inventory,
                
                -- 销售数据 (合并重复记录)
                SUM(COALESCE(sales_quantity, 0)) as sales_7days,
                SUM(COALESCE(sales_quantity, 0)) as total_sales,
                SUM(COALESCE(sales_quantity, 0)) / 7.0 as average_sales,
                SUM(COALESCE(order_count, 0)) as order_count,
                
                -- 价格信息 (使用平均值)
                CONCAT('$', AVG(COALESCE(sales_amount / NULLIF(sales_quantity, 0), 10.0))) as average_price,
                CONCAT('$', SUM(COALESCE(sales_amount, 0))) as sales_amount,
                CONCAT('$', SUM(COALESCE(sales_amount, 0))) as net_sales,
                '0.00%%' as refund_rate,
                
                -- 广告数据 (合并重复记录)  
                SUM(COALESCE(impressions, 0)) as ad_impressions,
                SUM(COALESCE(clicks, 0)) as ad_clicks,
                SUM(COALESCE(acos, 0)) as ad_spend,
                SUM(COALESCE(ad_orders, 0)) as ad_order_count,
                SUM(COALESCE(ad_sales, 0)) as ad_sales,
                
                -- 计算广告指标
                CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) / SUM(impressions) ELSE 0 END as ad_ctr,
                CASE WHEN SUM(clicks) > 0 THEN SUM(ad_orders) / SUM(clicks) ELSE 0 END as ad_cvr,
                CASE WHEN SUM(sales_amount) > 0 THEN SUM(acos) / (SUM(sales_amount) / 7 * 7) ELSE 0 END as acoas,
                
                -- 周转天数
                CASE 
                    WHEN SUM(sales_quantity) > 0 THEN SUM(fba_inventory) / (SUM(sales_quantity) / 7.0)
                    WHEN SUM(fba_inventory) > 0 THEN 999
                    ELSE 0 
                END as turnover_days,
                
                -- 日均销售额
                SUM(COALESCE(sales_amount, 0)) / 7.0 as daily_sales_amount,
                
                -- 状态标识
                CASE WHEN SUM(sales_amount) / 7.0 >= 16.7 THEN 1 ELSE 0 END as is_effective_point,
                CASE 
                    WHEN SUM(sales_quantity) > 0 AND SUM(fba_inventory) / (SUM(sales_quantity) / 7.0) > 100 THEN 1
                    WHEN SUM(sales_quantity) = 0 AND SUM(fba_inventory) > 0 THEN 1
                    ELSE 0 
                END as is_turnover_exceeded,
                CASE WHEN SUM(fba_inventory) <= 0 THEN 1 ELSE 0 END as is_out_of_stock,
                
                -- 合并元数据
                'direct_insert' as merge_type,
                COUNT(*) as store_count,
                data_date,
                NOW() as created_at,
                NOW() as updated_at
                
            FROM product_analytics 
            WHERE data_date = %s
            AND asin IS NOT NULL 
            AND asin != ''
            GROUP BY asin, 
                CASE 
                    WHEN marketplace_id LIKE '%%A1F83G8C2ARO7P%%' THEN 'UK'
                    WHEN marketplace_id LIKE '%%ATVPDKIKX0DER%%' THEN 'US'
                    WHEN marketplace_id LIKE '%%A1PA6795UKMFR9%%' THEN 'DE'
                    WHEN marketplace_id LIKE '%%A13V1IB3VIYZZH%%' THEN 'FR'
                    WHEN marketplace_id LIKE '%%APJ6JRA9NG5V4%%' THEN 'IT'
                    WHEN marketplace_id LIKE '%%A1RKKUPIHCS9HS%%' THEN 'ES'
                    ELSE 'US'
                END, data_date
            """
            
            cursor.execute(insert_sql, (target_date,))
            inserted_count = cursor.rowcount
            conn.commit()
            
            print(f"✅ 成功插入 {inserted_count} 个库存点")
            
            # 验证结果
            cursor.execute("SELECT COUNT(*) as total FROM inventory_points")
            total = cursor.fetchone()['total']
            
            cursor.execute("""
                SELECT marketplace, COUNT(*) as count 
                FROM inventory_points 
                GROUP BY marketplace 
                ORDER BY count DESC
            """)
            market_stats = cursor.fetchall()
            
            print(f"\n📊 合并结果:")
            print(f"   总库存点: {total}")
            print("   按市场分布:")
            for stat in market_stats:
                print(f"     {stat['marketplace']}: {stat['count']} 个")
    
    print("\n🎉 快速合并完成!")

if __name__ == '__main__':
    quick_merge_all()