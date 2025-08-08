#!/usr/bin/env python3
"""
修复版本：同步产品分析数据并保存到数据库
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
        logger.info("=== 修复版本：产品分析数据同步 ===")
        
        # 导入必要的模块
        from src.auth.saihu_api_client import saihu_api_client
        from src.database.connection import DatabaseManager
        from src.models.product_analytics import ProductAnalytics
        
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
            page_size=100,  # 先获取100条数据测试
            currency='USD'
        )
        
        if not result or 'rows' not in result:
            logger.error("未获取到产品分析数据")
            return False
        
        rows = result['rows']
        logger.info(f"获取到 {len(rows)} 条数据")
        
        # 转换为ProductAnalytics对象列表
        analytics_objects = []
        
        for row in rows:
            try:
                # 创建ProductAnalytics对象
                analytics = ProductAnalytics(
                    asin=row.get('asinList', [''])[0] if row.get('asinList') else '',
                    sku=row.get('skuList', [''])[0] if row.get('skuList') else '',
                    parent_asin=row.get('parentAsinList', [''])[0] if row.get('parentAsinList') else '',
                    spu=row.get('spu', ''),
                    msku=row.get('mskuList', [''])[0] if row.get('mskuList') else '',
                    data_date=datetime.strptime(yesterday, '%Y-%m-%d').date(),  # 转换为date对象
                    sales_amount=Decimal(str(row.get('salePriceThis', 0) or 0)),
                    sales_quantity=int(row.get('productTotalNumThis', 0) or 0),
                    impressions=int(row.get('adImpressionsThis', 0) or 0),
                    clicks=int(row.get('adClicksThis', 0) or 0),
                    conversion_rate=Decimal(str(float(row.get('conversionRateThis', 0) or 0) / 100)),  # 转换为小数
                    acos=Decimal(str(float(row.get('acosThis', 0) or 0) / 100)),  # 转换为小数
                    marketplace_id=row.get('marketplaceIdList', [''])[0] if row.get('marketplaceIdList') else '',
                    dev_name=row.get('devNameList', [''])[0] if row.get('devNameList') else '',
                    operator_name=row.get('operatorNameList', [''])[0] if row.get('operatorNameList') else '',
                    currency=row.get('currency', 'USD'),
                    shop_id=row.get('shopIdList', [''])[0] if row.get('shopIdList') else '',
                    dev_id=row.get('devIdList', [''])[0] if row.get('devIdList') else '',
                    operator_id=row.get('operatorIdList', [''])[0] if row.get('operatorIdList') else '',
                    ad_cost=Decimal(str(row.get('adCostThis', 0) or 0)),
                    ad_sales=Decimal(str(row.get('adTotalSalesThis', 0) or 0)),
                    cpc=Decimal(str(row.get('cpcThis', 0) or 0)),
                    cpa=Decimal(str(row.get('cpaThis', 0) or 0)),
                    ad_orders=int(row.get('adOrderNumThis', 0) or 0),
                    ad_conversion_rate=Decimal(str(float(row.get('adConversionRateThis', 0) or 0) / 100)),
                    order_count=int(row.get('orderNumThis', 0) or 0),
                    refund_count=int(row.get('refundNumThis', 0) or 0),
                    refund_rate=Decimal(str(float(row.get('refundRateThis', 0) or 0) / 100)),
                    return_count=int(row.get('returnSaleNumThis', 0) or 0),
                    return_rate=Decimal(str(float(row.get('returnSaleRateThis', 0) or 0) / 100)),
                    rating=Decimal(str(row.get('ratingThis', 0) or 0)) if row.get('ratingThis') else None,
                    rating_count=int(row.get('ratingCountThis', 0) or 0) if row.get('ratingCountThis') else None,
                    title=row.get('title', '')[:500],  # 限制长度
                    brand_name=row.get('brands', [''])[0] if row.get('brands') else '',
                    category_name=', '.join(row.get('categoryName', [])) if row.get('categoryName') else '',
                    profit_rate=Decimal(str(float(row.get('profitRateThis', 0) or 0) / 100)),
                    avg_profit=Decimal(str(row.get('avgProfitThis', 0) or 0)),
                    available_days=Decimal(str(row.get('availableDays', 0) or 0)),
                    fba_inventory=int(row.get('fbaInventory', 0) or 0),
                    total_inventory=int(row.get('inventoryManage', {}).get('totalInventory', 0) or 0),
                    # 将列表转换为JSON字符串
                    shop_ids=str(row.get('shopIdList', [])) if row.get('shopIdList') else None,
                    dev_ids=str(row.get('devIdList', [])) if row.get('devIdList') else None,
                    operator_ids=str(row.get('operatorIdList', [])) if row.get('operatorIdList') else None,
                    marketplace_ids=str(row.get('marketplaceIdList', [])) if row.get('marketplaceIdList') else None,
                    brand_ids=str(row.get('brandIdList', [])) if row.get('brandIdList') else None,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                
                analytics_objects.append(analytics)
                
            except Exception as e:
                logger.error(f"转换数据失败: {e}, 数据: {row.get('asinList', ['Unknown'])[0]}")
                continue
        
        logger.info(f"成功转换 {len(analytics_objects)} 个ProductAnalytics对象")
        
        if analytics_objects:
            # 批量保存到数据库
            try:
                saved_count = db_manager.batch_save_product_analytics(analytics_objects)
                logger.info(f"✅ 数据保存成功: {saved_count} 条")
                
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
            logger.error("没有有效的数据对象可保存")
            return False
        
    except Exception as e:
        logger.error(f"同步过程发生异常: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)