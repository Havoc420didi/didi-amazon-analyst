#!/usr/bin/env python3
"""
更新库存合并数据表的字段和显示顺序
按照要求的表头顺序：ASIN, 品名, 业务员, 库存点, FBA可用, FBA在途, 本地仓, 平均销量, 
日均销售额, 总库存, 广告曝光量, 广告点击量, 广告花费, 广告订单量, 库存周转天数, 
库存状态, 广告点击率, 广告转化率, ACOAS
"""
import sys
sys.path.append('/home/hudi_data/sync_saihu_erp/data_update')
from src.database.connection import DatabaseManager

def update_inventory_status():
    """更新库存状态字段"""
    
    db_manager = DatabaseManager()
    
    print('=' * 80)
    print('🔧 更新库存合并数据表字段和显示')
    print('=' * 80)
    
    # 检查是否需要添加库存状态字段
    print('\n📋 检查表结构...')
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DESCRIBE inventory_points")
            columns = cursor.fetchall()
            
            column_names = [col['Field'] for col in columns]
            has_inventory_status = 'inventory_status' in column_names
            
            print(f'   当前表有 {len(columns)} 个字段')
            print(f'   库存状态字段存在: {"是" if has_inventory_status else "否"}')
    
    # 如果没有库存状态字段，添加它
    if not has_inventory_status:
        print('\n➕ 添加库存状态字段...')
        with db_manager.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute('''
                    ALTER TABLE inventory_points 
                    ADD COLUMN inventory_status VARCHAR(20) DEFAULT NULL 
                    AFTER turnover_days
                ''')
                conn.commit()
                print('   ✅ 库存状态字段添加成功')
    
    # 更新库存状态值
    print('\n🔄 更新库存状态值...')
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 根据业务规则更新库存状态
            cursor.execute('''
                UPDATE inventory_points 
                SET inventory_status = CASE 
                    WHEN turnover_days > 100 THEN '周转超标'
                    WHEN turnover_days < 45 THEN '低库存'
                    WHEN fba_available / CASE WHEN average_sales > 0 THEN average_sales ELSE 1 END < 3 THEN '缺货'
                    ELSE '周转合格'
                END
                WHERE data_date = '2025-07-27'
            ''')
            affected_rows = cursor.rowcount
            conn.commit()
            print(f'   ✅ 更新了 {affected_rows} 条记录的库存状态')
    
    # 按照要求的顺序显示数据
    print('\n📊 按照标准顺序展示库存合并数据:')
    print('=' * 120)
    
    # 表头
    headers = [
        'ASIN', '品名', '业务员', '库存点', 'FBA可用', 'FBA在途', '本地仓', 
        '平均销量', '日均销售额', '总库存', '广告曝光量', '广告点击量', '广告花费', 
        '广告订单量', '库存周转天数', '库存状态', '广告点击率', '广告转化率', 'ACOAS'
    ]
    
    # 打印表头
    print('|'.join(f'{header:^12}' for header in headers))
    print('=' * 120)
    
    # 查询并显示数据（前10条作为示例）
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT 
                    asin,
                    SUBSTRING(product_name, 1, 30) as product_name,
                    IFNULL(sales_person, '-') as sales_person,
                    marketplace as inventory_point,
                    fba_available,
                    fba_inbound,
                    local_available,
                    average_sales,
                    daily_sales_amount,
                    total_inventory,
                    ad_impressions,
                    ad_clicks,
                    ad_spend,
                    IFNULL(ad_order_count, 0) as ad_order_count,
                    turnover_days,
                    inventory_status,
                    ad_ctr,
                    ad_cvr,
                    acoas
                FROM inventory_points 
                WHERE data_date = '2025-07-27' 
                ORDER BY 
                    CASE inventory_status 
                        WHEN '缺货' THEN 1
                        WHEN '低库存' THEN 2  
                        WHEN '周转超标' THEN 3
                        WHEN '周转合格' THEN 4
                        ELSE 5
                    END,
                    daily_sales_amount DESC
                LIMIT 10
            ''')
            
            rows = cursor.fetchall()
            
            for row in rows:
                # 格式化显示每一行数据
                formatted_row = [
                    f"{row['asin'][:10]}",  # ASIN
                    f"{row['product_name'][:10]}...",  # 品名（截断）
                    f"{row['sales_person'][:8]}",  # 业务员
                    f"{row['inventory_point'][:8]}",  # 库存点
                    f"{row['fba_available']:.0f}",  # FBA可用
                    f"{row['fba_inbound']:.0f}",  # FBA在途
                    f"{row['local_available']:.0f}",  # 本地仓
                    f"{row['average_sales']:.1f}",  # 平均销量
                    f"${row['daily_sales_amount']:.1f}",  # 日均销售额
                    f"{row['total_inventory']:.0f}",  # 总库存
                    f"{row['ad_impressions']}",  # 广告曝光量
                    f"{row['ad_clicks']}",  # 广告点击量
                    f"${row['ad_spend']:.1f}",  # 广告花费
                    f"{row['ad_order_count']}",  # 广告订单量
                    f"{row['turnover_days']:.0f}天",  # 库存周转天数
                    f"{row['inventory_status']}",  # 库存状态
                    f"{row['ad_ctr']:.2%}",  # 广告点击率
                    f"{row['ad_cvr']:.2%}",  # 广告转化率
                    f"{row['acoas']:.3f}"  # ACOAS
                ]
                
                print('|'.join(f'{cell:^12}' for cell in formatted_row))
    
    print('=' * 120)
    
    # 统计各种库存状态的数量
    print('\n📈 库存状态统计:')
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT 
                    inventory_status,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM inventory_points WHERE data_date = '2025-07-27'), 1) as percentage
                FROM inventory_points 
                WHERE data_date = '2025-07-27'
                GROUP BY inventory_status
                ORDER BY count DESC
            ''')
            
            status_stats = cursor.fetchall()
            
            for stat in status_stats:
                print(f'   📍 {stat["inventory_status"]}: {stat["count"]} 个 ({stat["percentage"]}%)')
    
    # 生成完整数据展示的SQL查询语句
    print('\n📝 完整数据查询SQL（可用于数据展示）:')
    print('''
SELECT 
    asin AS 'ASIN',
    product_name AS '品名',
    IFNULL(sales_person, '-') AS '业务员',
    marketplace AS '库存点',
    fba_available AS 'FBA可用',
    fba_inbound AS 'FBA在途', 
    local_available AS '本地仓',
    average_sales AS '平均销量',
    daily_sales_amount AS '日均销售额',
    total_inventory AS '总库存',
    ad_impressions AS '广告曝光量',
    ad_clicks AS '广告点击量',
    ad_spend AS '广告花费',
    IFNULL(ad_order_count, 0) AS '广告订单量',
    turnover_days AS '库存周转天数',
    inventory_status AS '库存状态',
    CONCAT(ROUND(ad_ctr * 100, 2), '%') AS '广告点击率',
    CONCAT(ROUND(ad_cvr * 100, 2), '%') AS '广告转化率',
    acoas AS 'ACOAS'
FROM inventory_points 
WHERE data_date = '2025-07-27'
ORDER BY 
    CASE inventory_status 
        WHEN '缺货' THEN 1
        WHEN '低库存' THEN 2  
        WHEN '周转超标' THEN 3
        WHEN '周转合格' THEN 4
        ELSE 5
    END,
    daily_sales_amount DESC;
    ''')
    
    print('\n✅ 库存合并数据表字段和显示更新完成!')

if __name__ == '__main__':
    update_inventory_status()