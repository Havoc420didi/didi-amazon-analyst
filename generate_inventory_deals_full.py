#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
完整的 inventory_deals 库存点快照表生成器
从 product_analytics 表数据生成库存点快照，包含四个时间窗口的聚合数据
"""

import psycopg2
import psycopg2.extras
from datetime import datetime, date, timedelta
import sys
import json
from typing import List, Dict, Any, Optional

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

class InventoryDealsGenerator:
    """库存点快照生成器"""
    
    def __init__(self):
        self.conn = None
        self.cursor = None
        
    def connect_db(self) -> bool:
        """连接数据库"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.cursor = self.conn.cursor()
            print("✅ 数据库连接成功")
            return True
        except psycopg2.Error as e:
            print(f"❌ 数据库连接失败: {e.pgerror}")
            return False
    
    def close_db(self):
        """关闭数据库连接"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            print("🔌 数据库连接已关闭")
    
    def check_table_exists(self, table_name: str) -> bool:
        """检查表是否存在"""
        self.cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = %s
            );
        """, (table_name,))
        return self.cursor.fetchone()[0]
    
    def get_all_asins(self, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """获取所有需要处理的ASIN列表"""
        self.cursor.execute("""
            SELECT DISTINCT 
                asin, 
                COALESCE(marketplace_id, 'default') as marketplace_id,
                COUNT(*) as record_count
            FROM product_analytics 
            WHERE data_date >= %s 
              AND data_date <= %s
              AND asin IS NOT NULL
            GROUP BY asin, COALESCE(marketplace_id, 'default')
            HAVING COUNT(*) >= 5  -- 至少需要5条记录
            ORDER BY asin, marketplace_id;
        """, (start_date, end_date))
        
        columns = [desc[0] for desc in self.cursor.description]
        rows = self.cursor.fetchall()
        
        return [dict(zip(columns, row)) for row in rows]
    
    def get_asin_detailed_data(self, start_date: date, end_date: date, asin: str, marketplace_id: str) -> List[Dict[str, Any]]:
        """获取指定ASIN的详细数据"""
        self.cursor.execute("""
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
        
        columns = [desc[0] for desc in self.cursor.description]
        rows = self.cursor.fetchall()
        
        return [dict(zip(columns, row)) for row in rows]
    
    def aggregate_time_window(self, asin_data: List[Dict[str, Any]], time_window: Dict[str, Any], target_date: date) -> Optional[Dict[str, Any]]:
        """聚合指定时间窗口的数据"""
        # 计算窗口范围
        window_end_date = target_date
        window_start_date = target_date - timedelta(days=time_window['days'] - 1)
        
        # 过滤窗口内数据
        window_records = [
            record for record in asin_data 
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
    
    def clear_existing_data(self, target_date: date) -> int:
        """清除指定日期的现有数据"""
        self.cursor.execute("""
            DELETE FROM inventory_deals 
            WHERE snapshot_date = %s;
        """, (target_date,))
        
        deleted_count = self.cursor.rowcount
        self.conn.commit()
        
        if deleted_count > 0:
            print(f"🗑️  已清除 {deleted_count} 条现有数据")
        
        return deleted_count
    
    def insert_inventory_deals(self, deals_data: List[Dict[str, Any]]) -> int:
        """批量插入库存点快照数据"""
        if not deals_data:
            return 0
        
        # 准备插入语句
        insert_sql = """
            INSERT INTO inventory_deals (
                snapshot_date, asin, product_name, sales_person, warehouse_location,
                time_window, time_window_days, window_start_date, window_end_date,
                fba_available, fba_in_transit, local_warehouse, total_inventory,
                total_sales_amount, total_sales_quantity, avg_daily_sales, avg_daily_revenue,
                total_ad_impressions, total_ad_clicks, total_ad_spend, total_ad_orders,
                ad_ctr, ad_conversion_rate, acos, inventory_turnover_days, inventory_status,
                source_records_count, calculation_method, data_completeness_score
            ) VALUES (
                %(snapshot_date)s, %(asin)s, %(product_name)s, %(sales_person)s, %(warehouse_location)s,
                %(time_window)s, %(time_window_days)s, %(window_start_date)s, %(window_end_date)s,
                %(fba_available)s, %(fba_in_transit)s, %(local_warehouse)s, %(total_inventory)s,
                %(total_sales_amount)s, %(total_sales_quantity)s, %(avg_daily_sales)s, %(avg_daily_revenue)s,
                %(total_ad_impressions)s, %(total_ad_clicks)s, %(total_ad_spend)s, %(total_ad_orders)s,
                %(ad_ctr)s, %(ad_conversion_rate)s, %(acos)s, %(inventory_turnover_days)s, %(inventory_status)s,
                %(source_records_count)s, %(calculation_method)s, %(data_completeness_score)s
            );
        """
        
        # 批量插入
        psycopg2.extras.execute_batch(self.cursor, insert_sql, deals_data)
        self.conn.commit()
        
        return len(deals_data)
    
    def generate_inventory_deals(self, target_date: Optional[date] = None) -> bool:
        """生成库存点快照表数据"""
        try:
            print('🚀 开始生成 inventory_deals 库存点快照表\n')
            
            # 连接数据库
            if not self.connect_db():
                return False
            
            # 设置目标日期
            if target_date is None:
                today = date.today()
                target_date = today - timedelta(days=1)
            
            print(f"📅 目标快照日期: {target_date.strftime('%Y-%m-%d')}")
            
            # 检查表是否存在
            if not self.check_table_exists('inventory_deals'):
                print('❌ inventory_deals 表不存在，需要先创建表结构')
                return False
            
            print('✅ inventory_deals 表已存在')
            
            # 清除现有数据
            self.clear_existing_data(target_date)
            
            # 计算数据拉取范围 (T-60 到 T-1)
            data_start_date = target_date - timedelta(days=60)
            print(f"📊 数据拉取范围: {data_start_date.strftime('%Y-%m-%d')} 到 {target_date.strftime('%Y-%m-%d')}")
            
            # 获取所有需要处理的ASIN
            print("\n🔍 获取需要处理的ASIN列表...")
            asins = self.get_all_asins(data_start_date, target_date)
            print(f"✅ 找到 {len(asins)} 个ASIN需要处理")
            
            if not asins:
                print("❌ 没有找到可处理的ASIN")
                return False
            
            # 生成所有ASIN的快照数据
            all_deals_data = []
            processed_asins = 0
            
            print(f"\n🔄 开始生成快照数据...")
            for i, asin_info in enumerate(asins, 1):
                asin = asin_info['asin']
                marketplace_id = asin_info['marketplace_id']
                record_count = asin_info['record_count']
                
                print(f"   处理 {i}/{len(asins)}: {asin} @ {marketplace_id} ({record_count} 条记录)")
                
                # 获取ASIN详细数据
                asin_data = self.get_asin_detailed_data(data_start_date, target_date, asin, marketplace_id)
                
                if not asin_data:
                    print(f"     ⚠️  跳过 {asin}: 无数据")
                    continue
                
                # 为每个时间窗口生成快照
                asin_deals = []
                for time_window in TIME_WINDOWS:
                    deal = self.aggregate_time_window(asin_data, time_window, target_date)
                    if deal:
                        asin_deals.append(deal)
                
                if len(asin_deals) == 4:  # 应该有4个时间窗口
                    all_deals_data.extend(asin_deals)
                    processed_asins += 1
                    print(f"     ✅ 生成 {len(asin_deals)} 条快照记录")
                else:
                    print(f"     ⚠️  跳过 {asin}: 只生成 {len(asin_deals)} 条记录")
            
            # 插入数据到数据库
            if all_deals_data:
                print(f"\n💾 插入 {len(all_deals_data)} 条快照记录到数据库...")
                inserted_count = self.insert_inventory_deals(all_deals_data)
                print(f"✅ 成功插入 {inserted_count} 条记录")
                
                # 验证插入结果
                self.cursor.execute("""
                    SELECT COUNT(*) FROM inventory_deals WHERE snapshot_date = %s;
                """, (target_date,))
                
                final_count = self.cursor.fetchone()[0]
                print(f"📊 最终验证: 表中 {target_date.strftime('%Y-%m-%d')} 日期共有 {final_count} 条记录")
                
                return True
            else:
                print("❌ 没有生成任何快照数据")
                return False
                
        except Exception as error:
            print(f'❌ 生成过程中发生错误: {error}')
            import traceback
            print('错误详情:')
            print(traceback.format_exc())
            return False
        finally:
            self.close_db()

def main():
    """主函数入口"""
    print("=" * 70)
    print("Amazon Analyst - 库存点快照生成器 (生产版本)")
    print("=" * 70)
    
    # 创建生成器实例
    generator = InventoryDealsGenerator()
    
    # 生成快照数据
    today = date.today()
    end_date = today - timedelta(days=1)
    for i in range(1, 30):
        target_date = end_date - timedelta(days=i)
        success = generator.generate_inventory_deals(target_date)
        if not success:
            print(f"❌ 生成 {target_date.strftime('%Y-%m-%d')} 的库存点快照数据失败")
            sys.exit(1)
        else:
            print(f"✅ 生成 {target_date.strftime('%Y-%m-%d')} 的库存点快照数据成功")

if __name__ == '__main__':
    main()
