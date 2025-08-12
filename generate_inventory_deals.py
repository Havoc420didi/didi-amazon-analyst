#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
使用 product_analytics 表数据生成 inventory_deals 库存点快照表
参考 generate_inventory_deals.js 的逻辑，使用Python实现
"""

import psycopg2
import psycopg2.extras
from datetime import datetime, date, timedelta
import sys
import json

# 数据库连接配置
DB_CONFIG = {
    'host': '8.219.185.28',
    'port': 5432,
    'database': 'amazon_analyst',
    'user': 'amazon_analyst',
    'password': 'amazon_analyst_2024',
    'connect_timeout': 10
}

# 时间窗口配置
TIME_WINDOWS = [
    {'code': 'T1', 'days': 1, 'description': 'T-1 (1天)'},
    {'code': 'T3', 'days': 3, 'description': 'T-3到T-1 (3天)'},
    {'code': 'T7', 'days': 7, 'description': 'T-7到T-1 (7天)'},
    {'code': 'T30', 'days': 30, 'description': 'T-30到T-1 (30天)'}
]

def get_db_connection():
    """获取数据库连接"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        print(f"❌ 数据库连接失败: {e.pgerror}")
        return None

def check_table_exists(cursor, table_name):
    """检查表是否存在"""
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = %s
        );
    """, (table_name,))
    
    return cursor.fetchone()[0]

def get_source_data_stats(cursor, start_date, end_date):
    """获取源数据统计信息"""
    cursor.execute("""
        SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT asin) as unique_asins,
            COUNT(DISTINCT COALESCE(marketplace_id, 'default')) as unique_markets,
            COUNT(DISTINCT data_date) as unique_dates,
            MIN(data_date) as earliest_date,
            MAX(data_date) as latest_date
        FROM product_analytics 
        WHERE data_date >= %s 
          AND data_date <= %s
          AND asin IS NOT NULL;
    """, (start_date, end_date))
    
    return cursor.fetchone()

def get_test_asin_data(cursor, start_date, end_date):
    """获取测试ASIN的数据"""
    cursor.execute("""
        SELECT 
            asin, 
            COALESCE(marketplace_id, 'default') as marketplace_id,
            COUNT(*) as record_count,
            MIN(data_date) as earliest_date,
            MAX(data_date) as latest_date
        FROM product_analytics 
        WHERE data_date >= %s 
          AND data_date <= %s
          AND asin IS NOT NULL
        GROUP BY asin, COALESCE(marketplace_id, 'default')
        HAVING COUNT(*) >= 10
        ORDER BY record_count DESC
        LIMIT 1;
    """, (start_date, end_date))
    
    result = cursor.fetchone()
    if result:
        return {
            'asin': result[0],
            'marketplace_id': result[1],
            'record_count': result[2],
            'earliest_date': result[3],
            'latest_date': result[4]
        }
    return None

def get_detailed_asin_data(cursor, start_date, end_date, asin, marketplace_id):
    """获取指定ASIN的详细数据"""
    cursor.execute("""
        SELECT 
            asin,
            data_date,
            COALESCE(marketplace_id, 'default') as marketplace_id,
            COALESCE(dev_name, '') as dev_name,
            COALESCE(spu_name, '') as spu_name,
            COALESCE(fba_inventory, 0) as fba_inventory,
            COALESCE(total_inventory, 0) as total_inventory,
            COALESCE(sales_amount, 0) as sales_amount,
            COALESCE(sales_quantity, 0) as sales_quantity,
            COALESCE(impressions, 0) as impressions,
            COALESCE(clicks, 0) as clicks,
            COALESCE(ad_cost, 0) as ad_cost,
            COALESCE(ad_orders, 0) as ad_orders,
            COALESCE(ad_conversion_rate, 0) as ad_conversion_rate,
            COALESCE(acos, 0) as acos
        FROM product_analytics 
        WHERE data_date >= %s 
          AND data_date <= %s
          AND asin = %s
          AND COALESCE(marketplace_id, 'default') = %s
        ORDER BY data_date;
    """, (start_date, end_date, asin, marketplace_id))
    
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    return [dict(zip(columns, row)) for row in rows]

def aggregate_time_window_data(test_data, time_window, target_date):
    """聚合指定时间窗口的数据"""
    # 计算窗口范围
    window_end_date = target_date
    window_start_date = target_date - timedelta(days=time_window['days'] - 1)
    
    # 过滤窗口内数据
    window_records = [
        record for record in test_data 
        if window_start_date <= record['data_date'] <= window_end_date
    ]
    
    if not window_records:
        return None
    
    # 获取最新记录
    latest_record = max(window_records, key=lambda x: x['data_date'])
    
    # 聚合计算
    total_sales_amount = sum(float(r['sales_amount']) for r in window_records)
    total_sales_quantity = sum(int(r['sales_quantity']) for r in window_records)
    total_ad_impressions = sum(int(r['impressions']) for r in window_records)
    total_ad_clicks = sum(int(r['clicks']) for r in window_records)
    total_ad_spend = sum(float(r['ad_cost']) for r in window_records)
    total_ad_orders = sum(int(r['ad_orders']) for r in window_records)
    
    # 计算衍生指标
    avg_daily_sales = total_sales_amount / time_window['days'] if time_window['days'] > 0 else 0
    avg_daily_revenue = avg_daily_sales
    ad_ctr = total_ad_clicks / total_ad_impressions if total_ad_impressions > 0 else 0
    ad_conversion_rate = total_ad_orders / total_ad_clicks if total_ad_clicks > 0 else 0
    acos = total_ad_spend / total_sales_amount if total_sales_amount > 0 else 0
    inventory_turnover_days = latest_record['total_inventory'] / avg_daily_sales if avg_daily_sales > 0 else 999
    
    # 库存状态判断
    if inventory_turnover_days <= 30:
        inventory_status = '正常'
    elif inventory_turnover_days <= 60:
        inventory_status = '较高'
    else:
        inventory_status = '过高'
    
    return {
        # 基础维度
        'snapshot_date': target_date.strftime('%Y-%m-%d'),
        'asin': latest_record['asin'],
        'product_name': latest_record['spu_name'],
        'sales_person': latest_record['dev_name'],
        'warehouse_location': latest_record['marketplace_id'],
        
        # 时间窗口
        'time_window': time_window['code'],
        'time_window_days': time_window['days'],
        'window_start_date': window_start_date.strftime('%Y-%m-%d'),
        'window_end_date': window_end_date.strftime('%Y-%m-%d'),
        
        # 库存数据 (T-1最新值)
        'fba_available': latest_record['fba_inventory'],
        'fba_in_transit': 0,  # product_analytics表中没有此字段
        'local_warehouse': 0,  # product_analytics表中没有此字段
        'total_inventory': latest_record['total_inventory'],
        
        # 销售数据 (窗口内累加)
        'total_sales_amount': total_sales_amount,
        'total_sales_quantity': total_sales_quantity,
        'avg_daily_sales': avg_daily_sales,
        'avg_daily_revenue': avg_daily_revenue,
        
        # 广告数据 (窗口内累加)
        'total_ad_impressions': total_ad_impressions,
        'total_ad_clicks': total_ad_clicks,
        'total_ad_spend': total_ad_spend,
        'total_ad_orders': total_ad_orders,
        
        # 广告指标 (重新计算)
        'ad_ctr': ad_ctr,
        'ad_conversion_rate': ad_conversion_rate,
        'acos': acos,
        
        # 计算指标
        'inventory_turnover_days': min(inventory_turnover_days, 999),
        'inventory_status': inventory_status,
        
        # 元数据
        'source_records_count': len(window_records),
        'calculation_method': 'sum_aggregate',
        'data_completeness_score': 1.00 if window_records else 0.00
    }

def generate_inventory_deals(target_date):
    """生成inventory_deals库存点快照表的主函数"""
    conn = None
    cursor = None
    
    try:
        print('🚀 开始生成 inventory_deals 库存点快照表\n')
        
        # 连接数据库
        conn = get_db_connection()
        if not conn:
            return False
        
        cursor = conn.cursor()
        
        print(f"📅 目标快照日期 (T-1): {target_date.strftime('%Y-%m-%d')}")

        # 1. 预检查：验证 inventory_deals 表结构
        print('\n📋 1. 检查 inventory_deals 表结构:')
        
        if not check_table_exists(cursor, 'inventory_deals'):
            print('❌ inventory_deals 表不存在，需要先创建表结构')
            return False
        
        print('✅ inventory_deals 表已存在')

        # 2. 检查现有数据，避免重复生成
        print('\n🔍 2. 检查现有快照数据:')
        cursor.execute("""
            SELECT COUNT(*) as count, 
                   COUNT(DISTINCT asin) as unique_asins,
                   COUNT(DISTINCT time_window) as time_windows
            FROM inventory_deals 
            WHERE snapshot_date = %s;
        """, (target_date,))
        
        existing_data = cursor.fetchone()
        existing_count, existing_unique_asins, existing_time_windows = existing_data
        
        print(f"   现有记录数: {existing_count}")
        print(f"   涉及ASIN数: {existing_unique_asins}")  
        print(f"   时间窗口数: {existing_time_windows}")
        
        if existing_count > 0:
            print('⚠️  该日期已有快照数据，是否需要重新生成？')

        # 3. 数据源分析：检查 product_analytics 可用数据
        print('\n📊 3. 分析数据源可用性:')
        
        # 计算数据拉取范围 (T-60 到 T-1)
        data_start_date = target_date - timedelta(days=60)
        
        source_stats = get_source_data_stats(cursor, data_start_date, target_date)
        if not source_stats:
            print('❌ 无法获取源数据统计')
            return False
        
        total_records, unique_asins, unique_markets, unique_dates, earliest_date, latest_date = source_stats
        
        print(f"   时间范围: {data_start_date.strftime('%Y-%m-%d')} 到 {target_date.strftime('%Y-%m-%d')}")
        print(f"   总记录数: {total_records}")
        print(f"   独特ASIN数: {unique_asins}")
        print(f"   独特市场数: {unique_markets}")
        print(f"   实际日期数: {unique_dates}")
        print(f"   数据日期范围: {earliest_date} 到 {latest_date}")

        if total_records == 0:
            print('❌ 没有可用的源数据，无法生成快照')
            return False

        # 4. 预检查：验证一个ASIN是否对应四行不同时段的数据
        print('\n🔍 4. 预检查：验证ASIN时间窗口数据结构')
        
        # 选择一个有充足数据的ASIN进行测试
        test_asin = get_test_asin_data(cursor, data_start_date, target_date)
        if not test_asin:
            print('❌ 没有足够数据的ASIN用于测试')
            return False
        
        print(f"   测试ASIN: {test_asin['asin']} @ {test_asin['marketplace_id']}")
        print(f"   记录数: {test_asin['record_count']} 条")
        print(f"   日期范围: {test_asin['earliest_date']} 到 {test_asin['latest_date']}")

        # 获取测试ASIN的详细数据
        test_data = get_detailed_asin_data(
            cursor, data_start_date, target_date, 
            test_asin['asin'], test_asin['marketplace_id']
        )

        print(f"\n   获取到 {len(test_data)} 条测试数据")

        # 模拟四个时间窗口的聚合
        print('\n📊 5. 模拟时间窗口聚合 (验证逻辑):')
        
        aggregated_results = []
        
        for time_window in TIME_WINDOWS:
            result = aggregate_time_window_data(test_data, time_window, target_date)
            if result:
                aggregated_results.append(result)
                
                print(f"\n   {time_window['code']} ({time_window['days']}天窗口):")
                print(f"     窗口范围: {result['window_start_date']} 到 {result['window_end_date']}")
                print(f"     记录数: {result['source_records_count']}")
                print(f"     总销售额: ${result['total_sales_amount']:.2f}")
                print(f"     总销售量: {result['total_sales_quantity']}")
                print(f"     平均日销: ${result['avg_daily_sales']:.2f}")
                print(f"     总广告费: ${result['total_ad_spend']:.2f}")
                print(f"     库存周转天数: {result['inventory_turnover_days']:.1f}")
                print(f"     库存状态: {result['inventory_status']}")

        # 6. 验证结果：确认一个ASIN对应四行不同时段数据
        print('\n✅ 6. 验证结果总结:')
        print(f"   测试ASIN: {test_asin['asin']}")
        print(f"   生成的快照记录数: {len(aggregated_results)} 行")
        print(f"   时间窗口覆盖: {', '.join(r['time_window'] for r in aggregated_results)}")
        
        if len(aggregated_results) == 4:
            print('✅ 验证通过：一个ASIN对应四行不同时段的数据')
            
            # 显示四行数据的关键差异
            print('\n📊 四个时间窗口数据对比:')
            print(f"{'时间窗口':<8} {'天数':<4} {'源记录数':<8} {'销售额':<12} {'销售量':<8} {'广告费':<12} {'周转天数':<8}")
            print("-" * 70)
            for result in aggregated_results:
                print(f"{result['time_window']:<8} {result['time_window_days']:<4} {result['source_records_count']:<8} "
                      f"${result['total_sales_amount']:<11.2f} {result['total_sales_quantity']:<8} "
                      f"${result['total_ad_spend']:<11.2f} {result['inventory_turnover_days']:<8.1f}")
            
            print('\n🚀 预检查完成，数据结构验证通过！')
            print('💡 可以开始正式生成 inventory_deals 快照数据')
            
        else:
            print('❌ 验证失败：时间窗口数据结构异常')
            return False

        return True

    except Exception as error:
        print(f'❌ 生成过程中发生错误: {error}')
        import traceback
        print('错误详情:')
        print(traceback.format_exc())
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def main():
    """主函数入口"""
    print("=" * 70)
    print("Amazon Analyst - 库存点快照生成器")
    print("=" * 70)

        # 设置目标日期为昨天 (T-1)
    today = date.today()
    end_date = today - timedelta(days=1)

    for i in range(1, 30):
        target_date = end_date - timedelta(days=i)
        success = generate_inventory_deals(target_date)
    if not success:
        print("\n❌ 脚本执行失败")
        sys.exit(1)
    else:
        print("\n✅ 脚本执行成功")

if __name__ == '__main__':
    main()
