#!/usr/bin/env python3
"""
7天产品分析数据同步：只同步产品分析数据到product_analytics表
获取过去7天（直到昨天）的完整数据
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

def sync_date_data(api_client, db_manager, target_date_str):
    """同步指定日期的产品分析数据"""
    logger.info(f"开始同步 {target_date_str} 的数据")
    
    # 获取第一页了解总数据量
    result = api_client.fetch_product_analytics(
        start_date=target_date_str,
        end_date=target_date_str,
        page_no=1,
        page_size=200,
        currency='USD'
    )
    
    if not result or 'rows' not in result:
        logger.warning(f"{target_date_str} 未获取到数据")
        return {'status': 'no_data', 'count': 0}
    
    # 获取总数据信息
    total_size = result.get('totalSize', 0)
    total_pages = result.get('totalPage', 1)
    logger.info(f"{target_date_str}: 总数据量 {total_size} 条，共 {total_pages} 页")
    
    # 收集所有数据
    all_rows = []
    all_rows.extend(result['rows'])
    
    # 获取剩余页面数据
    if total_pages > 1:
        for page_no in range(2, total_pages + 1):
            try:
                page_result = api_client.fetch_product_analytics(
                    start_date=target_date_str,
                    end_date=target_date_str,
                    page_no=page_no,
                    page_size=200,
                    currency='USD'
                )
                
                if page_result and 'rows' in page_result:
                    all_rows.extend(page_result['rows'])
                
                # API频率限制延迟
                time.sleep(0.3)
                
            except Exception as e:
                logger.error(f"{target_date_str} 第{page_no}页获取失败: {e}")
                continue
    
    logger.info(f"{target_date_str}: 获取到 {len(all_rows)} 条原始数据")
    
    if not all_rows:
        return {'status': 'no_data', 'count': 0}
    
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
    
    # 准备数据
    params_list = []
    failed_count = 0
    
    for row in all_rows:
        try:
            params = (
                row.get('asinList', [''])[0] if row.get('asinList') else '',
                row.get('skuList', [''])[0] if row.get('skuList') else '',
                float(row.get('salePriceThis', 0) or 0),
                int(row.get('productTotalNumThis', 0) or 0),
                int(row.get('adImpressionsThis', 0) or 0),
                int(row.get('adClicksThis', 0) or 0),
                float(row.get('conversionRateThis', 0) or 0) / 100,
                float(row.get('acosThis', 0) or 0) / 100,
                target_date_str,
                row.get('marketplaceIdList', [''])[0] if row.get('marketplaceIdList') else '',
                row.get('currency', 'USD'),
                float(row.get('adTotalSalesThis', 0) or 0),
                float(row.get('cpcThis', 0) or 0),
                float(row.get('cpaThis', 0) or 0),
                int(row.get('adOrderNumThis', 0) or 0),
                float(row.get('adConversionRateThis', 0) or 0) / 100,
                int(row.get('orderNumThis', 0) or 0),
                int(row.get('refundNumThis', 0) or 0),
                float(row.get('refundRateThis', 0) or 0) / 100,
                int(row.get('returnSaleNumThis', 0) or 0),
                float(row.get('returnSaleRateThis', 0) or 0) / 100,
                float(row.get('ratingThis', 0) or 0) if row.get('ratingThis') else None,
                int(row.get('ratingCountThis', 0) or 0) if row.get('ratingCountThis') else None,
                (row.get('title', '') or '')[:500],
                row.get('brands', [''])[0] if row.get('brands') else '',
                float(row.get('profitRateThis', 0) or 0) / 100,
                float(row.get('avgProfitThis', 0) or 0),
                float(row.get('availableDays', 0) or 0),
                int(row.get('fbaInventory', 0) or 0),
                int(row.get('inventoryManage', {}).get('totalInventory', 0) or 0),
                row.get('parentAsinList', [''])[0] if row.get('parentAsinList') else '',
                row.get('spuName', ''),
                ', '.join(row.get('categoryName', [])) if row.get('categoryName') else '',
                row.get('brands', [''])[0] if row.get('brands') else '',
                float(row.get('buyBoxPrice', 0) or 0),
                row.get('sessionsThis'),
                row.get('pageViewThis'),
                'in_stock' if int(row.get('fbaInventory', 0) or 0) > 0 else 'out_of_stock',
                row.get('spu', '')
            )
            params_list.append(params)
            
        except Exception as e:
            failed_count += 1
            asin = row.get('asinList', ['Unknown'])[0] if row.get('asinList') else 'Unknown'
            logger.error(f"{target_date_str} 转换数据失败: {e}, ASIN: {asin}")
            continue
    
    # 分批保存到数据库
    if params_list:
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
            
            logger.info(f"{target_date_str}: 成功保存 {total_saved} 条数据")
            return {'status': 'success', 'count': total_saved}
            
        except Exception as e:
            logger.error(f"{target_date_str} 保存失败: {e}")
            return {'status': 'error', 'count': 0, 'error': str(e)}
    
    return {'status': 'no_valid_data', 'count': 0}

def main():
    """主函数"""
    try:
        logger.info("=== 7天产品分析数据同步开始 ===")
        logger.info("🎯 专门同步product_analytics表，不操作其他表")
        
        # 导入必要的模块
        from src.auth.saihu_api_client import saihu_api_client
        from src.database.connection import DatabaseManager
        
        # 初始化数据库连接
        db_manager = DatabaseManager()
        
        # 计算过去7天的日期（不包括今天）
        today = date.today()
        date_list = []
        for i in range(1, 8):  # 1-7天前
            target_date = today - timedelta(days=i)
            date_list.append(target_date.strftime('%Y-%m-%d'))
        
        logger.info(f"📅 需要同步的日期: {', '.join(date_list)}")
        
        # 检查每个日期的现有数据
        logger.info("📊 检查现有数据:")
        with db_manager.get_db_connection() as conn:
            with conn.cursor() as cursor:
                for date_str in date_list:
                    cursor.execute("SELECT COUNT(*) as count FROM product_analytics WHERE data_date = %s", (date_str,))
                    existing_count = cursor.fetchone()['count']
                    logger.info(f"  {date_str}: 现有 {existing_count} 条数据")
        
        # 同步每个日期的数据
        total_synced = 0
        sync_results = {}
        
        for i, date_str in enumerate(date_list, 1):
            logger.info(f"🔄 [{i}/7] 同步 {date_str}")
            
            result = sync_date_data(saihu_api_client, db_manager, date_str)
            sync_results[date_str] = result
            
            if result['status'] == 'success':
                total_synced += result['count']
                logger.info(f"✅ {date_str}: 同步成功，{result['count']} 条数据")
            else:
                logger.warning(f"⚠️  {date_str}: {result['status']}")
            
            # 每个日期之间稍作延迟
            if i < len(date_list):
                time.sleep(1)
        
        # 最终统计
        logger.info(f"🎉 7天数据同步完成！总共同步 {total_synced} 条数据")
        
        # 验证最终结果
        logger.info("📈 最终数据统计:")
        with db_manager.get_db_connection() as conn:
            with conn.cursor() as cursor:
                total_records = 0
                for date_str in date_list:
                    cursor.execute("SELECT COUNT(*) as count FROM product_analytics WHERE data_date = %s", (date_str,))
                    final_count = cursor.fetchone()['count']
                    total_records += final_count
                    logger.info(f"  {date_str}: {final_count} 条数据")
                
                logger.info(f"📊 product_analytics表总记录数: {total_records} 条")
                
                # 获取唯一ASIN和总销售额
                cursor.execute(f"""
                    SELECT 
                        COUNT(DISTINCT asin) as unique_asins,
                        SUM(sales_amount) as total_sales
                    FROM product_analytics 
                    WHERE data_date IN ({','.join(['%s'] * len(date_list))})
                """, date_list)
                stats = cursor.fetchone()
                
                logger.info(f"🏷️  唯一产品(ASIN): {stats['unique_asins']} 个")
                logger.info(f"💰 7天总销售额: ${stats['total_sales']:.2f}")
        
        return True
        
    except Exception as e:
        logger.error(f"7天数据同步失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    start_time = datetime.now()
    logger.info(f"⏰ 开始时间: {start_time}")
    
    success = main()
    
    end_time = datetime.now()
    duration = end_time - start_time
    logger.info(f"⏰ 结束时间: {end_time}")
    logger.info(f"⏱️  总耗时: {duration}")
    
    if success:
        logger.info("🎊 7天产品分析数据同步任务完成！")
    else:
        logger.error("❌ 7天产品分析数据同步任务失败！")
    
    sys.exit(0 if success else 1)