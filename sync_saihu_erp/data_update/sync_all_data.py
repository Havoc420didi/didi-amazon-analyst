#!/usr/bin/env python3
"""
完整版本：获取全部产品分析数据并保存到数据库
获取多少条就保存多少条，不遗漏任何数据
"""
import os
import sys
import logging
import time
from pathlib import Path
from datetime import datetime, date, timedelta

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
        logger.info("=== 完整版本：获取全部产品分析数据 ===")
        
        # 导入必要的模块
        from src.auth.saihu_api_client import saihu_api_client
        from src.database.connection import DatabaseManager
        
        # 初始化数据库连接
        db_manager = DatabaseManager()
        
        # 获取昨天的数据
        yesterday = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        logger.info(f"同步日期: {yesterday}")
        
        # 先获取第一页了解总数据量
        result = saihu_api_client.fetch_product_analytics(
            start_date=yesterday,
            end_date=yesterday,
            page_no=1,
            page_size=200,  # API最大限制200
            currency='USD'
        )
        
        if not result or 'rows' not in result:
            logger.error("未获取到产品分析数据")
            return False
        
        # 获取总数据信息
        total_size = result.get('totalSize', 0)
        total_pages = result.get('totalPage', 1)
        logger.info(f"总数据量: {total_size} 条，共 {total_pages} 页")
        
        # 收集所有数据
        all_rows = []
        all_rows.extend(result['rows'])
        logger.info(f"第1页: 获取到 {len(result['rows'])} 条数据")
        
        # 获取剩余页面数据
        if total_pages > 1:
            for page_no in range(2, total_pages + 1):
                try:
                    logger.info(f"正在获取第 {page_no}/{total_pages} 页数据...")
                    
                    page_result = saihu_api_client.fetch_product_analytics(
                        start_date=yesterday,
                        end_date=yesterday,
                        page_no=page_no,
                        page_size=200,
                        currency='USD'
                    )
                    
                    if page_result and 'rows' in page_result:
                        page_rows = page_result['rows']
                        all_rows.extend(page_rows)
                        logger.info(f"第{page_no}页: 获取到 {len(page_rows)} 条数据")
                    else:
                        logger.warning(f"第{page_no}页获取失败，跳过")
                    
                    # 避免API频率限制，稍作延迟
                    time.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"获取第{page_no}页数据失败: {e}")
                    continue
        
        logger.info(f"✅ 总共获取到 {len(all_rows)} 条原始数据")
        
        # 数据库插入SQL
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
        
        # 准备所有数据
        params_list = []
        failed_count = 0
        
        for i, row in enumerate(all_rows):
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
                
                # 每处理100条记录显示进度
                if (i + 1) % 100 == 0 or (i + 1) == len(all_rows):
                    logger.info(f"数据转换进度: {i + 1}/{len(all_rows)}")
                
            except Exception as e:
                failed_count += 1
                asin = row.get('asinList', ['Unknown'])[0] if row.get('asinList') else 'Unknown'
                logger.error(f"转换数据失败 ({failed_count}): {e}, ASIN: {asin}")
                continue
        
        logger.info(f"✅ 成功转换 {len(params_list)} 条数据，失败 {failed_count} 条")
        
        if params_list:
            # 分批保存到数据库，避免单次事务过大
            batch_size = 100
            total_saved = 0
            
            try:
                for i in range(0, len(params_list), batch_size):
                    batch = params_list[i:i + batch_size]
                    
                    with db_manager.get_db_connection() as conn:
                        with conn.cursor() as cursor:
                            affected_rows = cursor.executemany(sql, batch)
                            conn.commit()
                            total_saved += affected_rows
                            
                            batch_num = (i // batch_size) + 1
                            total_batches = (len(params_list) - 1) // batch_size + 1
                            logger.info(f"批次 {batch_num}/{total_batches}: 保存了 {affected_rows} 条记录")
                
                logger.info(f"🎉 数据保存完成！总共保存 {total_saved} 条记录")
                
                # 最终验证数据库中的数据
                with db_manager.get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("SELECT COUNT(*) as count FROM product_analytics WHERE data_date = %s", (yesterday,))
                        db_count = cursor.fetchone()['count']
                        
                        cursor.execute("SELECT COUNT(DISTINCT asin) as unique_asins FROM product_analytics WHERE data_date = %s", (yesterday,))
                        unique_asins = cursor.fetchone()['unique_asins']
                        
                        cursor.execute("SELECT SUM(sales_amount) as total_sales FROM product_analytics WHERE data_date = %s", (yesterday,))
                        total_sales = cursor.fetchone()['total_sales']
                
                logger.info(f"📊 数据库验证结果:")
                logger.info(f"  - 日期: {yesterday}")
                logger.info(f"  - 总记录数: {db_count} 条")
                logger.info(f"  - 唯一ASIN数: {unique_asins} 个")
                logger.info(f"  - 总销售额: ${total_sales:.2f}")
                
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
    start_time = datetime.now()
    logger.info(f"开始时间: {start_time}")
    
    success = main()
    
    end_time = datetime.now()
    duration = end_time - start_time
    logger.info(f"结束时间: {end_time}")
    logger.info(f"总耗时: {duration}")
    
    sys.exit(0 if success else 1)