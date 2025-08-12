#!/usr/bin/env python3

"""
30天产品分析数据抓取脚本
自动抓取、处理和保存到product_analytics2表
利用现有sync_saihu_erp系统
"""

import sys
import os
import asyncio
import json
from datetime import datetime, timedelta, date
from decimal import Decimal
import logging
from typing import List, Dict, Any

# 添加到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'sync_saihu_erp', 'data_update', 'src'))

from models.product_analytics import ProductAnalytics
from services.data_sync_service import DataSyncService
from database.postgresql_connection import PostgreSQLManager
from scrapers.product_analytics_scraper import ProductAnalyticsScraper

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ProductAnalytics30DaysGrabber:
    def __init__(self):
        self.db = PostgreSQLManager()
        self.sync_service = DataSyncService()
        self.scraper = ProductAnalyticsScraper()
        
        self.target_date = date.today() - timedelta(days=1)
        self.start_date = self.target_date - timedelta(days=30)
        self.end_date = self.target_date
        
        logger.info(f"📅 准备抓取30天数据范围: {self.start_date} 到 {self.end_date}")
    
    async def grab_product_analytics_30days(self, warehouse_location="欧盟"):
        """抓取30天产品分析数据"""
        try:
            logger.info("🚀 开始30天数据抓取流程...")
            
            # 1. 获取需要抓取的ASIN列表
            asin_list = await self.get_asin_list()
            logger.info(f"📋 获取到 {len(asin_list)} 个需要抓取的ASIN")
            
            all_records = []
            
            # 2. 按日期批量抓取
            current_date = self.start_date
            while current_date <= self.end_date:
                logger.info(f"📈 抓取日期: {current_date}")
                
                try:
                    # 使用现有抓取器获取数据
                    api_response = await self.extract_product_analytics(
                        date_list=[current_date],
                        asin_list=asin_list,
                        warehouse_location=warehouse_location
                    )
                    
                    # 3. 数据转换和验证
                    records = await self.process_api_response(
                        api_response, 
                        current_date
                    )
                    
                    logger.info(f"📊 从 {current_date} 获取了 {len(records)} 条记录")
                    all_records.extend(records)
                    
                except Exception as e:
                    logger.error(f"❌ 抓取 {current_date} 时出错: {e}")
                
                current_date += timedelta(days=1)
            
            # 4. 保存到product_analytics2
            saved_count = await self.save_to_product_analytics2(all_records)
            
            # 5. 数据验证和报告
            await self.validate_data(saved_count)
            
            return {
                'total_records': len(all_records),
                'saved_records': saved_count,
                'date_range': f"{self.start_date} 到 {self.end_date}",
                'status': 'success'
            }
            
        except Exception as e:
            logger.error(f"❌ 30天数据抓取失败: {e}")
            return {
                'total_records': 0,
                'saved_records': 0,
                'error': str(e),
                'status': 'failed'
            }
    
    async def get_asin_list(self) -> List[str]:
        """获取需要抓取的ASIN列表"""
        try:
            with self.db.get_db_connection() as conn:
                cursor = conn.cursor()
                # 从现有的产品数据获取活跃ASIN
                cursor.execute("""
                    SELECT DISTINCT asin 
                    FROM inventory_records 
                    WHERE date >= %s AND date <= %s 
                    AND total_inventory IS NOT NULL
                    AND total_inventory > 0
                """, (self.start_date, self.end_date))
                
                result = cursor.fetchall()
                asin_list = [row[0] for row in result if row[0]]
                
                # 如果没有历史数据，使用默认测试ASIN
                if not asin_list:
                    logger.info("📋 使用默认测试ASIN列表")
                    asin_list = [
                        'B08XYZ123',  # 示例ASIN 1
                        'B09DEF456',  # 示例ASIN 2  
                        'B10GHI789'   # 示例ASIN 3
                    ]
                
                return asin_list
                
        except Exception as e:
            logger.warning(f"⚠️ 无法获取ASIN列表，使用默认值: {e}")
            return ['B08XYZ123', 'B09DEF456', 'B10GHI789']
    
    async def extract_product_analytics(self, date_list: List[date], asin_list: List[str], warehouse_location: str) -> Dict[str, Any]:
        """提取产品分析数据，复用现有逻辑"""
        try:
            # 使用现有的ProductAnalyticsScraper
            sync_data = {
                'date_list': [d.strftime('%Y-%m-%d') for d in date_list],
                'asin_list': asin_list,
                'warehouse_location': warehouse_location,
                'batch_size': len(asin_list) * len(date_list)
            }
            
            logger.info(f"🔍 准备抓取 {len(asin_list)} 个ASIN, {len(date_list)} 天数据")
            
            # 调用现有抓取逻辑
            api_response = self.scraper.scrape_data(
                start_date=min(date_list).strftime('%Y-%m-%d'),
                end_date=max(date_list).strftime('%Y-%m-%d'),
                asin_list=asin_list,
                marketplace_id='EU'  # 假设欧盟地区
            )
            
            return api_response
            
        except Exception as e:
            logger.error(f"❌ 数据提取失败: {e}")
            raise
    
    async def process_api_response(self, api_response: Dict[str, Any], current_date: date) -> List[ProductAnalytics]:
        """处理API响应数据"""
        records = []
        
        if api_response and 'data' in api_response:
            api_data = api_response.get('data', [])
            
            for item in api_data:
                try:
                    # 使用现有模型的from_api_response方法
                    analysis = ProductAnalytics.from_api_response(item, current_date)
                    
                    # 设置额外信息
                    analysis.data_source = 'manual_30day_sync'
                    analysis.created_at = datetime.now()
                    analysis.updated_at = datetime.now()
                    
                    if analysis.is_valid():
                        records.append(analysis)
                        
                except Exception as e:
                    logger.warning(f"⚠️ 处理单条记录失败: {e}")
                    continue
        
        return records
    
    async def save_to_product_analytics2(self, records: List[ProductAnalytics]) -> int:
        """保存数据到product_analytics2表"""
        try:
            saved_count = 0
            batch_size = 1000
            
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                batch_saved = await self.batch_save_records(batch)
                saved_count += batch_saved
                logger.info(f"📊 已保存 {saved_count}/{len(records)} 条记录")
                
            return saved_count
            
        except Exception as e:
            logger.error(f"❌ 数据保存失败: {e}")
            raise
    
    async def batch_save_records(self, records: List[ProductAnalytics]) -> int:
        """批量保存记录"""
        try:
            with self.db.get_db_transaction() as conn:
                cursor = conn.cursor()
                
                insert_query = """
                    INSERT INTO product_analytics2 (
                        product_id, asin, sku, spu, msku, data_date,
                        sales_amount, sales_quantity, impressions, clicks,
                        conversion_rate, acos, marketplace_id, dev_name, operator_name,
                        ad_cost, ad_sales, ad_orders, fba_inventory, total_inventory,
                        currency, created_at, updated_at, data_source, sync_status
                    ) VALUES %s
                    ON CONFLICT (product_id, asin, data_date, marketplace_id) DO UPDATE SET
                        sales_amount = EXCLUDED.sales_amount,
                        sales_quantity = EXCLUDED.sales_quantity,
                        impressions = EXCLUDED.impressions,
                        clicks = EXCLUDED.clicks,
                        conversion_rate = EXCLUDED.conversion_rate,
                        acos = EXCLUDED.acos,
                        ad_cost = EXCLUDED.ad_cost,
        
                        ad_sales = EXCLUDED.ad_sales,
                        ad_orders = EXCLUDED.ad_orders,
                        fba_inventory = EXCLUDED.fba_inventory,
                        total_inventory = EXCLUDED.total_inventory,
                        updated_at = EXCLUDED.updated_at,
                        sync_status = 'updated'
                """
                
                values = []
                for record in records:
                    values.append((
                        record.product_id,
                        record.asin,
                        record.sku,
                        record.spu,
                        record.msku,
                        record.data_date,
                        record.sales_amount,
                        record.sales_quantity,
                        record.impressions,
                        record.clicks,
                        record.conversion_rate,
                        record.acos,
                        record.marketplace_id,
                        record.dev_name,
                        record.operator_name,
                        record.ad_cost if hasattr(record, 'ad_cost') else 0,
                        record.ad_sales if hasattr(record, 'ad_sales') else 0,
                        record.ad_orders if hasattr(record, 'ad_orders') else 0, 
                        record.fba_inventory if hasattr(record, 'fba_inventory') else 0,
                        record.total_inventory if hasattr(record, 'total_inventory') else 0,
                        'USD',
                        record.created_at,
                        record.updated_at
                    ))
                
                from psycopg2.extras import execute_values
                execute_values(cursor, insert_query, values)
                
                return len(records)
                
        except Exception as e:
            logger.error(f"❌ 批量保存失败: {e}")
            conn.rollback()
            return 0
    
    async def validate_data(self, saved_count: int):
        """验证数据完整性"""
        try:
            with self.db.get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_records,
                        COUNT(DISTINCT asin) as unique_asins,
                        MIN(data_date) as earliest_date,
                        MAX(data_date) as latest_date,
                        SUM(sales_amount) as total_sales,
                        SUM(impressions) as total_impressions
                    FROM product_analytics2 
                    WHERE data_date BETWEEN %s AND %s
                """, (self.start_date, self.end_date))
                
                validation = cursor.fetchone()
                
                logger.info("✅ 数据验证完成:")
                logger.info(f"📊 总记录数: {validation[0]}")
                logger.info(f"🏷️  唯一ASIN数: {validation[1]}")
                logger.info(f"📅 数据范围: {validation[2]} 到 {validation[3]}")
                logger.info(f"💰 总销售额: {validation[4]}")
                logger.info(f"👁️  总曝光量: {validation[5]}")
                
        except Exception as e:
            logger.error(f"❌ 数据验证失败: {e}")

def main():
    """主函数"""
    import asyncio
    
    async def run():
        grabber = ProductAnalytics30DaysGrabber()
        result = await grabber.grab_product_analytics_30days()
        
        logger.info("=" * 50)
        logger.info("🎯 30天数据抓取完成") 
        logger.info(f"总计: {result}")
        logger.info("=" * 50)
        
        return result
    
    return asyncio.run(run())

if __name__ == "__main__":
    result = main()
    print(json.dumps(result, indent=2, default=str))