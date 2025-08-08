#!/usr/bin/env python3
"""
同步产品分析数据并保存到数据库
"""
import os
import sys
import logging
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
        logger.info("=== 开始产品分析数据同步并保存到数据库 ===")
        
        # 导入必要的模块
        from src.auth.saihu_api_client import saihu_api_client
        from src.database.connection import DatabaseManager
        
        # 初始化数据库连接
        db_manager = DatabaseManager()
        
        # 获取昨天的数据
        yesterday = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        logger.info(f"同步日期: {yesterday}")
        
        # 使用API客户端获取数据
        result = saihu_api_client.fetch_product_analytics(
            start_date=yesterday,
            end_date=yesterday,
            page_no=1,
            page_size=200,  # API限制最大200
            currency='USD'
        )
        
        if not result or 'rows' not in result:
            logger.error("未获取到产品分析数据")
            return False
        
        rows = result['rows']
        total_size = result.get('totalSize', len(rows))
        logger.info(f"获取到 {len(rows)} 条数据，总计 {total_size} 条")
        
        # 获取所有数据（如果有多页）
        all_rows = rows[:]
        total_pages = result.get('totalPage', 1)
        
        if total_pages > 1:
            logger.info(f"需要获取 {total_pages} 页数据")
            for page in range(2, total_pages + 1):
                logger.info(f"获取第 {page} 页数据...")
                page_result = saihu_api_client.fetch_product_analytics(
                    start_date=yesterday,
                    end_date=yesterday,
                    page_no=page,
                    page_size=200,
                    currency='USD'
                )
                
                if page_result and 'rows' in page_result:
                    all_rows.extend(page_result['rows'])
                    logger.info(f"第 {page} 页获取到 {len(page_result['rows'])} 条数据")
        
        logger.info(f"总共获取到 {len(all_rows)} 条产品分析数据")
        
        # 转换数据格式并保存到数据库
        saved_count = 0
        batch_size = 100
        
        for i in range(0, len(all_rows), batch_size):
            batch = all_rows[i:i + batch_size]
            batch_data = []
            
            for row in batch:
                # 转换API数据为数据库格式
                db_record = {
                    'asin': row.get('asinList', [''])[0] if row.get('asinList') else '',
                    'sku': row.get('skuList', [''])[0] if row.get('skuList') else '',
                    'sales_amount': float(row.get('salePriceThis', 0) or 0),
                    'sales_quantity': int(row.get('productTotalNumThis', 0) or 0),
                    'impressions': int(row.get('adImpressionsThis', 0) or 0),
                    'clicks': int(row.get('adClicksThis', 0) or 0),
                    'conversion_rate': float(row.get('conversionRateThis', 0) or 0) / 100,  # 转换为小数
                    'acos': float(row.get('acosThis', 0) or 0) / 100,  # 转换为小数
                    'data_date': yesterday,
                    'marketplace_id': row.get('marketplaceIdList', [''])[0] if row.get('marketplaceIdList') else '',
                    'currency': row.get('currency', 'USD'),
                    'ad_sales': float(row.get('adTotalSalesThis', 0) or 0),
                    'cpc': float(row.get('cpcThis', 0) or 0),
                    'cpa': float(row.get('cpaThis', 0) or 0),
                    'ad_orders': int(row.get('adOrderNumThis', 0) or 0),
                    'ad_conversion_rate': float(row.get('adConversionRateThis', 0) or 0) / 100,
                    'order_count': int(row.get('orderNumThis', 0) or 0),
                    'refund_count': int(row.get('refundNumThis', 0) or 0),
                    'refund_rate': float(row.get('refundRateThis', 0) or 0) / 100,
                    'return_count': int(row.get('returnSaleNumThis', 0) or 0),
                    'return_rate': float(row.get('returnSaleRateThis', 0) or 0) / 100,
                    'rating': float(row.get('ratingThis', 0) or 0),
                    'rating_count': int(row.get('ratingCountThis', 0) or 0),
                    'title': row.get('title', ''),
                    'brand_name': row.get('brands', [''])[0] if row.get('brands') else '',
                    'profit_rate': float(row.get('profitRateThis', 0) or 0) / 100,
                    'avg_profit': float(row.get('avgProfitThis', 0) or 0),
                    'available_days': float(row.get('availableDays', 0) or 0),
                    'fba_inventory': int(row.get('fbaInventory', 0) or 0),
                    'total_inventory': int(row.get('inventoryManage', {}).get('totalInventory', 0) or 0),
                    'parent_asin': row.get('parentAsinList', [''])[0] if row.get('parentAsinList') else '',
                    'category': ', '.join(row.get('categoryName', [])) if row.get('categoryName') else '',
                    'brand': row.get('brands', [''])[0] if row.get('brands') else '',
                    'buy_box_price': float(row.get('buyBoxPrice', 0) or 0),
                    'sessions': row.get('sessionsThis'),
                    'page_views': row.get('pageViewThis'),
                    'inventory_status': 'in_stock' if int(row.get('fbaInventory', 0) or 0) > 0 else 'out_of_stock',
                    'spu': row.get('spu', ''),
                    'created_at': datetime.now(),
                    'updated_at': datetime.now()
                }
                batch_data.append(db_record)
            
            # 批量保存到数据库
            try:
                batch_saved = db_manager.batch_save_product_analytics(batch_data)
                saved_count += batch_saved
                logger.info(f"批次 {i//batch_size + 1}: 保存了 {batch_saved} 条记录")
            except Exception as e:
                logger.error(f"批次保存失败: {e}")
                continue
        
        logger.info(f"✅ 产品分析数据同步完成")
        logger.info(f"总获取数据: {len(all_rows)} 条")
        logger.info(f"成功保存: {saved_count} 条")
        
        # 验证数据库中的数据
        try:
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) as count FROM product_analytics WHERE data_date = %s", (yesterday,))
                db_count = cursor.fetchone()['count']
                logger.info(f"数据库验证: {yesterday} 日期的数据共 {db_count} 条")
        except Exception as e:
            logger.error(f"数据库验证失败: {e}")
        
        return True
        
    except Exception as e:
        logger.error(f"同步过程发生异常: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)