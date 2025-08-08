#!/usr/bin/env python3
"""
简化版本：产品分析数据同步 - 只保存数据库实际存在的字段
"""
import os
import sys
import logging
from pathlib import Path
from datetime import datetime, date, timedelta
from decimal import Decimal

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """主函数"""
    try:
        logger.info("=== 简化版本：产品分析数据同步 ===")
        
        # 导入必要的模块
        from src.auth.saihu_api_client import saihu_api_client
        from src.database.connection import DatabaseManager
        
        # 初始化数据库连接
        db_manager = DatabaseManager()
        
        # 获取昨天的数据
        yesterday = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        logger.info(f"同步日期: {yesterday}")
        
        # 使用API客户端获取第一页数据（测试用）
        result = saihu_api_client.fetch_product_analytics(
            start_date=yesterday,
            end_date=yesterday,
            page_no=1,
            page_size=50,  # 先获取50条数据测试
            currency='USD'
        )
        
        if not result or 'rows' not in result:
            logger.error("未获取到产品分析数据")
            return False
        
        rows = result['rows']
        logger.info(f"获取到 {len(rows)} 条数据")
        
        # 直接使用SQL插入，避免复杂的对象映射
        sql = """
        INSERT INTO product_analytics 
        (asin, sku, sales_amount, sales_quantity, impressions, clicks, 
         conversion_rate, acos, data_date, marketplace_id, currency,
         ad_sales, cpc, cpa, ad_orders, ad_conversion_rate, order_count,
         refund_count, refund_rate, return_count, return_rate, rating,
         rating_count, title, brand_name, profit_rate, avg_profit,
         available_days, fba_inventory, total_inventory, parent_asin,
         spu_name, category, brand, buy_box_price, sessions, page_views,
         inventory_status, spu, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        sales_amount = VALUES(sales_amount),
        sales_quantity = VALUES(sales_quantity),
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        conversion_rate = VALUES(conversion_rate),
        acos = VALUES(acos),
        ad_sales = VALUES(ad_sales),
        cpc = VALUES(cpc),
        cpa = VALUES(cpa),
        ad_orders = VALUES(ad_orders),
        ad_conversion_rate = VALUES(ad_conversion_rate),
        order_count = VALUES(order_count),
        refund_count = VALUES(refund_count),
        refund_rate = VALUES(refund_rate),
        return_count = VALUES(return_count),
        return_rate = VALUES(return_rate),
        rating = VALUES(rating),
        rating_count = VALUES(rating_count),
        title = VALUES(title),
        brand_name = VALUES(brand_name),
        profit_rate = VALUES(profit_rate),
        avg_profit = VALUES(avg_profit),
        available_days = VALUES(available_days),
        fba_inventory = VALUES(fba_inventory),
        total_inventory = VALUES(total_inventory),
        parent_asin = VALUES(parent_asin),
        spu_name = VALUES(spu_name),
        category = VALUES(category),
        brand = VALUES(brand),
        buy_box_price = VALUES(buy_box_price),
        sessions = VALUES(sessions),
        page_views = VALUES(page_views),
        inventory_status = VALUES(inventory_status),
        spu = VALUES(spu),
        updated_at = NOW()
        """
        
        # 准备数据
        params_list = []
        for row in rows:
            try:
                params = (
                    row.get('asinList', [''])[0] if row.get('asinList') else '',  # asin
                    row.get('skuList', [''])[0] if row.get('skuList') else '',    # sku
                    float(row.get('salePriceThis', 0) or 0),                     # sales_amount
                    int(row.get('productTotalNumThis', 0) or 0),                 # sales_quantity
                    int(row.get('adImpressionsThis', 0) or 0),                   # impressions
                    int(row.get('adClicksThis', 0) or 0),                        # clicks
                    float(row.get('conversionRateThis', 0) or 0) / 100,          # conversion_rate
                    float(row.get('acosThis', 0) or 0) / 100,                    # acos
                    yesterday,                                                   # data_date
                    row.get('marketplaceIdList', [''])[0] if row.get('marketplaceIdList') else '',  # marketplace_id
                    row.get('currency', 'USD'),                                  # currency
                    float(row.get('adTotalSalesThis', 0) or 0),                  # ad_sales
                    float(row.get('cpcThis', 0) or 0),                           # cpc
                    float(row.get('cpaThis', 0) or 0),                           # cpa
                    int(row.get('adOrderNumThis', 0) or 0),                      # ad_orders
                    float(row.get('adConversionRateThis', 0) or 0) / 100,        # ad_conversion_rate
                    int(row.get('orderNumThis', 0) or 0),                        # order_count
                    int(row.get('refundNumThis', 0) or 0),                       # refund_count
                    float(row.get('refundRateThis', 0) or 0) / 100,              # refund_rate
                    int(row.get('returnSaleNumThis', 0) or 0),                   # return_count
                    float(row.get('returnSaleRateThis', 0) or 0) / 100,          # return_rate
                    float(row.get('ratingThis', 0) or 0) if row.get('ratingThis') else None,  # rating
                    int(row.get('ratingCountThis', 0) or 0) if row.get('ratingCountThis') else None,  # rating_count
                    (row.get('title', '') or '')[:500],                          # title (限制长度)
                    row.get('brands', [''])[0] if row.get('brands') else '',     # brand_name
                    float(row.get('profitRateThis', 0) or 0) / 100,              # profit_rate
                    float(row.get('avgProfitThis', 0) or 0),                     # avg_profit
                    float(row.get('availableDays', 0) or 0),                     # available_days
                    int(row.get('fbaInventory', 0) or 0),                        # fba_inventory
                    int(row.get('inventoryManage', {}).get('totalInventory', 0) or 0),  # total_inventory
                    row.get('parentAsinList', [''])[0] if row.get('parentAsinList') else '',  # parent_asin
                    row.get('spuName', ''),                                      # spu_name
                    ', '.join(row.get('categoryName', [])) if row.get('categoryName') else '',  # category
                    row.get('brands', [''])[0] if row.get('brands') else '',     # brand
                    float(row.get('buyBoxPrice', 0) or 0),                       # buy_box_price
                    row.get('sessionsThis'),                                     # sessions
                    row.get('pageViewThis'),                                     # page_views
                    'in_stock' if int(row.get('fbaInventory', 0) or 0) > 0 else 'out_of_stock',  # inventory_status
                    row.get('spu', '')                                           # spu
                )
                params_list.append(params)
                
            except Exception as e:
                logger.error(f"转换数据失败: {e}, ASIN: {row.get('asinList', ['Unknown'])[0]}")
                continue
        
        logger.info(f"成功转换 {len(params_list)} 条数据")
        
        if params_list:
            # 批量保存到数据库
            try:
                with db_manager.get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        affected_rows = cursor.executemany(sql, params_list)
                        conn.commit()
                        logger.info(f"✅ 数据保存成功: {affected_rows} 条")
                
                # 验证数据库中的数据
                with db_manager.get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("SELECT COUNT(*) as count FROM product_analytics WHERE data_date = %s", (yesterday,))
                        db_count = cursor.fetchone()['count']
                        logger.info(f"数据库验证: {yesterday} 日期的数据共 {db_count} 条")
                
                return True
                
            except Exception as e:
                logger.error(f"批量保存失败: {e}")
                import traceback
                traceback.print_exc()
                return False
        else:
            logger.error("没有有效的数据可保存")
            return False
        
    except Exception as e:
        logger.error(f"同步过程发生异常: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)