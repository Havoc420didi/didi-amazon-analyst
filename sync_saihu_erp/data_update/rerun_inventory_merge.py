#!/usr/bin/env python3
"""
重新执行库存点合并逻辑
清空inventory_points表，重新从原始数据进行合并
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import date
from src.processors.inventory_merge_processor import InventoryMergeProcessor
from src.database.connection import db_manager
from src.utils.logging_utils import get_logger

logger = get_logger(__name__)

def clear_inventory_points_table():
    """清空inventory_points表的内容"""
    try:
        logger.info("开始清空inventory_points表...")
        
        # 删除所有数据，保留表结构
        delete_sql = "DELETE FROM inventory_points"
        result = db_manager.execute_update(delete_sql)
        
        # 获取删除的行数
        count_sql = "SELECT ROW_COUNT() as deleted_count"
        count_result = db_manager.execute_single(count_sql)
        deleted_count = count_result.get('deleted_count', 0) if count_result else 0
        
        logger.info(f"✅ inventory_points表清空完成，删除了 {deleted_count} 行数据")
        return True
        
    except Exception as e:
        logger.error(f"❌ 清空inventory_points表失败: {e}")
        return False

def get_source_data():
    """从数据库获取原始产品数据"""
    try:
        logger.info("开始读取原始产品数据...")
        
        # 从product_analytics表读取最新数据
        sql = """
        SELECT 
            asin, product_name, sku, category, sales_person, product_tag, dev_name,
            store, marketplace,
            fba_available, fba_inbound, fba_sellable, fba_unsellable, 
            local_available, inbound_shipped,
            sales_7days, total_sales, average_sales, order_count, promotional_orders,
            average_price, sales_amount, net_sales, refund_rate,
            ad_impressions, ad_clicks, ad_spend, ad_order_count, ad_sales
        FROM product_analytics 
        WHERE data_date = (SELECT MAX(data_date) FROM product_analytics)
        AND asin IS NOT NULL 
        AND asin != ''
        AND product_name IS NOT NULL 
        AND product_name != ''
        AND store IS NOT NULL 
        AND store != ''
        ORDER BY asin, store
        """
        
        results = db_manager.execute_query(sql)
        
        if not results:
            logger.warning("⚠️  没有找到原始产品数据")
            return []
        
        logger.info(f"✅ 成功读取原始产品数据: {len(results)} 条记录")
        
        # 打印数据样本
        if results:
            sample = results[0]
            logger.info(f"📊 数据样本 - ASIN: {sample.get('asin')}, 店铺: {sample.get('store')}, 市场: {sample.get('marketplace')}")
        
        return results
        
    except Exception as e:
        logger.error(f"❌ 读取原始产品数据失败: {e}")
        return []

def run_inventory_merge():
    """执行库存点合并"""
    try:
        logger.info("🚀 开始重新执行库存点合并逻辑...")
        
        # 第一步：清空表格
        if not clear_inventory_points_table():
            return False
        
        # 第二步：获取原始数据
        source_data = get_source_data()
        if not source_data:
            logger.error("❌ 无法获取原始数据，终止合并过程")
            return False
        
        # 第三步：执行合并
        processor = InventoryMergeProcessor()
        data_date = date.today().strftime('%Y-%m-%d')
        
        logger.info(f"🔄 开始处理合并逻辑，数据日期: {data_date}")
        result = processor.process(source_data, data_date)
        
        # 第四步：验证结果
        if result['status'] == 'success':
            logger.info("✅ 库存点合并成功完成")
            logger.info(f"📊 处理统计:")
            logger.info(f"   - 原始数据量: {result['processed_count']}")
            logger.info(f"   - 清洗后数据量: {result['cleaned_count']}")
            logger.info(f"   - 合并后库存点: {result['merged_count']}")
            logger.info(f"   - 保存成功: {result['saved_count']}")
            
            # 显示合并统计
            merge_stats = result.get('merge_statistics', {})
            if merge_stats:
                logger.info(f"📈 合并统计:")
                logger.info(f"   - 欧盟库存点: {merge_stats.get('eu_points', 0)}")
                logger.info(f"   - 非欧盟库存点: {merge_stats.get('non_eu_points', 0)}")
                logger.info(f"   - 压缩比例: {merge_stats.get('compression_ratio', 0)}")
            
            return True
        else:
            logger.error(f"❌ 库存点合并失败: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        logger.error(f"❌ 执行库存点合并异常: {e}")
        return False

def verify_merge_results():
    """验证合并结果"""
    try:
        logger.info("🔍 开始验证合并结果...")
        
        # 基础统计
        total_sql = "SELECT COUNT(*) as total FROM inventory_points"
        total_result = db_manager.execute_single(total_sql)
        total_count = total_result.get('total', 0) if total_result else 0
        
        # 按市场统计
        marketplace_sql = """
        SELECT marketplace, COUNT(*) as count 
        FROM inventory_points 
        GROUP BY marketplace 
        ORDER BY count DESC
        """
        marketplace_results = db_manager.execute_query(marketplace_sql)
        
        # 按合并类型统计
        merge_type_sql = """
        SELECT merge_type, COUNT(*) as count 
        FROM inventory_points 
        GROUP BY merge_type
        """
        merge_type_results = db_manager.execute_query(merge_type_sql)
        
        logger.info(f"📊 验证结果:")
        logger.info(f"   - 总库存点数: {total_count}")
        
        if marketplace_results:
            logger.info(f"   - 按市场分布:")
            for row in marketplace_results:
                logger.info(f"     * {row['marketplace']}: {row['count']} 个")
        
        if merge_type_results:
            logger.info(f"   - 按合并类型:")
            for row in merge_type_results:
                merge_type = row['merge_type'] or 'unknown'
                logger.info(f"     * {merge_type}: {row['count']} 个")
        
        # 检查数据完整性
        validation_sql = """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN fba_available > 0 THEN 1 ELSE 0 END) as with_fba_available,
            SUM(CASE WHEN average_sales > 0 THEN 1 ELSE 0 END) as with_sales,
            SUM(CASE WHEN is_effective_point = 1 THEN 1 ELSE 0 END) as effective_points
        FROM inventory_points
        """
        validation_result = db_manager.execute_single(validation_sql)
        
        if validation_result:
            logger.info(f"   - 数据质量:")
            logger.info(f"     * 有FBA库存: {validation_result['with_fba_available']}/{validation_result['total']}")
            logger.info(f"     * 有销量数据: {validation_result['with_sales']}/{validation_result['total']}")
            logger.info(f"     * 有效库存点: {validation_result['effective_points']}/{validation_result['total']}")
        
        return total_count > 0
        
    except Exception as e:
        logger.error(f"❌ 验证合并结果失败: {e}")
        return False

def main():
    """主函数"""
    logger.info("=" * 60)
    logger.info("🔄 重新执行库存点合并逻辑")
    logger.info("=" * 60)
    
    try:
        # 执行合并
        if run_inventory_merge():
            # 验证结果
            if verify_merge_results():
                logger.info("🎉 库存点合并逻辑重新执行完成！")
            else:
                logger.warning("⚠️  合并完成但验证发现问题")
        else:
            logger.error("❌ 库存点合并执行失败")
            
    except Exception as e:
        logger.error(f"❌ 主程序异常: {e}")
    
    logger.info("=" * 60)

if __name__ == "__main__":
    main()