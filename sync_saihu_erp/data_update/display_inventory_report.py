#!/usr/bin/env python3
"""
库存合并数据完整报表显示
按照标准19个指标顺序展示所有库存点数据
"""
import sys
sys.path.append('/home/hudi_data/sync_saihu_erp/data_update')
from src.database.connection import DatabaseManager
import pandas as pd

def generate_inventory_report():
    """生成完整的库存合并数据报表"""
    
    db_manager = DatabaseManager()
    target_date = '2025-07-27'
    
    print('=' * 150)
    print('📊 库存合并数据完整报表')
    print('=' * 150)
    print(f'📅 数据日期: {target_date}')
    
    # 按照要求的19个指标顺序查询数据
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('''
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
                    ROUND(ad_ctr * 100, 2) AS '广告点击率',
                    ROUND(ad_cvr * 100, 2) AS '广告转化率',
                    acoas AS 'ACOAS'
                FROM inventory_points 
                WHERE data_date = %s
                ORDER BY 
                    CASE inventory_status 
                        WHEN '缺货' THEN 1
                        WHEN '低库存' THEN 2  
                        WHEN '周转超标' THEN 3
                        WHEN '周转合格' THEN 4
                        ELSE 5
                    END,
                    daily_sales_amount DESC
            ''', (target_date,))
            
            # 获取所有数据
            data = cursor.fetchall()
            total_records = len(data)
    
    print(f'📋 总记录数: {total_records} 条')
    
    # 转换为DataFrame便于处理和显示
    df = pd.DataFrame(data)
    
    # 显示数据统计摘要
    print('\n📈 数据统计摘要:')
    print('-' * 80)
    
    # 库存状态分布
    status_counts = df['库存状态'].value_counts()
    print('🏷️ 库存状态分布:')
    for status, count in status_counts.items():
        percentage = count / total_records * 100
        print(f'   {status}: {count} 个 ({percentage:.1f}%)')
    
    # 库存点分布
    print('\n🌍 库存点分布:')
    point_counts = df['库存点'].value_counts()
    for point, count in point_counts.items():
        percentage = count / total_records * 100
        print(f'   {point}: {count} 个 ({percentage:.1f}%)')
    
    # 关键指标统计
    print('\n💰 销售和库存统计:')
    print(f'   总库存量: {df["总库存"].sum():.0f} 件')
    print(f'   FBA可用总量: {df["FBA可用"].sum():.0f} 件')
    print(f'   日均销售额总计: ${df["日均销售额"].sum():.2f}')
    print(f'   广告总花费: ${df["广告花费"].sum():.2f}')
    print(f'   平均库存周转天数: {df["库存周转天数"].mean():.1f} 天')
    
    # 显示前20条详细数据
    print('\n📊 前20条库存点详细数据:')
    print('=' * 200)
    
    # 打印表头
    headers = ['ASIN', '品名', '业务员', '库存点', 'FBA可用', 'FBA在途', '本地仓', 
               '平均销量', '日均销售额', '总库存', '广告曝光量', '广告点击量', '广告花费', 
               '广告订单量', '库存周转天数', '库存状态', '广告点击率%', '广告转化率%', 'ACOAS']
    
    print('|'.join(f'{header:^15}' for header in headers))
    print('=' * 200)
    
    # 显示前20条数据
    for i, row in enumerate(data[:20]):
        formatted_row = [
            f"{row['ASIN'][:12]}",  # ASIN
            f"{row['品名'][:12]}...",  # 品名（截断）
            f"{row['业务员'][:8]}",  # 业务员
            f"{row['库存点'][:8]}",  # 库存点
            f"{row['FBA可用']:.0f}",  # FBA可用
            f"{row['FBA在途']:.0f}",  # FBA在途
            f"{row['本地仓']:.0f}",  # 本地仓
            f"{row['平均销量']:.1f}",  # 平均销量
            f"${row['日均销售额']:.1f}",  # 日均销售额
            f"{row['总库存']:.0f}",  # 总库存
            f"{row['广告曝光量']}",  # 广告曝光量
            f"{row['广告点击量']}",  # 广告点击量
            f"${row['广告花费']:.1f}",  # 广告花费
            f"{row['广告订单量']}",  # 广告订单量
            f"{row['库存周转天数']:.0f}天",  # 库存周转天数
            f"{row['库存状态']}",  # 库存状态
            f"{row['广告点击率']:.1f}%",  # 广告点击率
            f"{row['广告转化率']:.1f}%",  # 广告转化率
            f"{row['ACOAS']:.3f}"  # ACOAS
        ]
        
        print('|'.join(f'{cell:^15}' for cell in formatted_row))
    
    print('=' * 200)
    print(f'... 还有 {total_records - 20} 条记录')
    
    # 导出为CSV文件
    csv_filename = f'/home/hudi_data/sync_saihu_erp/data_update/inventory_report_{target_date}.csv'
    df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
    print(f'\n📁 完整数据已导出到: {csv_filename}')
    
    # 生成各种筛选报表
    print('\n📋 生成分类报表:')
    
    # 缺货产品报表
    out_of_stock = df[df['库存状态'] == '缺货']
    if len(out_of_stock) > 0:
        out_of_stock_file = f'/home/hudi_data/sync_saihu_erp/data_update/out_of_stock_report_{target_date}.csv'
        out_of_stock.to_csv(out_of_stock_file, index=False, encoding='utf-8-sig')
        print(f'   🔴 缺货产品报表 ({len(out_of_stock)} 条): {out_of_stock_file}')
    
    # 低库存产品报表
    low_inventory = df[df['库存状态'] == '低库存']
    if len(low_inventory) > 0:
        low_inventory_file = f'/home/hudi_data/sync_saihu_erp/data_update/low_inventory_report_{target_date}.csv'
        low_inventory.to_csv(low_inventory_file, index=False, encoding='utf-8-sig')
        print(f'   🟡 低库存产品报表 ({len(low_inventory)} 条): {low_inventory_file}')
    
    # 周转超标产品报表
    turnover_exceeded = df[df['库存状态'] == '周转超标']
    if len(turnover_exceeded) > 0:
        turnover_file = f'/home/hudi_data/sync_saihu_erp/data_update/turnover_exceeded_report_{target_date}.csv'
        turnover_exceeded.to_csv(turnover_file, index=False, encoding='utf-8-sig')
        print(f'   🔵 周转超标产品报表 ({len(turnover_exceeded)} 条): {turnover_file}')
    
    # 有效库存点报表（日均销售额>=16.7美元）
    effective_points = df[df['日均销售额'] >= 16.7]
    if len(effective_points) > 0:
        effective_file = f'/home/hudi_data/sync_saihu_erp/data_update/effective_points_report_{target_date}.csv'
        effective_points.to_csv(effective_file, index=False, encoding='utf-8-sig')
        print(f'   ✅ 有效库存点报表 ({len(effective_points)} 条): {effective_file}')
    
    # 欧盟地区报表
    eu_report = df[df['库存点'] == '欧盟']
    if len(eu_report) > 0:
        eu_file = f'/home/hudi_data/sync_saihu_erp/data_update/eu_inventory_report_{target_date}.csv'
        eu_report.to_csv(eu_file, index=False, encoding='utf-8-sig')
        print(f'   🇪🇺 欧盟地区报表 ({len(eu_report)} 条): {eu_file}')
    
    print('\n✅ 库存合并数据报表生成完成!')
    print('📋 所有数据已按照标准19个指标顺序排列并导出')

if __name__ == '__main__':
    generate_inventory_report()