#!/usr/bin/env python3
"""
测试产品分析数据同步
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
        logger.info("=== 测试产品分析数据同步 ===")
        
        # 导入同步作业
        from src.scheduler.sync_jobs import SyncJobs
        
        # 创建同步作业实例
        sync_jobs = SyncJobs()
        
        # 直接调用抓取器获取数据
        yesterday = date.today() - timedelta(days=1)
        logger.info(f"开始抓取 {yesterday} 的产品分析数据")
        
        # 使用抓取器直接获取数据
        analytics_data = sync_jobs.product_analytics_scraper.fetch_specific_date_data(yesterday)
        
        if analytics_data:
            logger.info(f"成功获取到 {len(analytics_data)} 条产品分析数据")
            result = {'status': 'success', 'raw_count': len(analytics_data)}
        else:
            logger.warning("未获取到数据，尝试获取最近7天数据")
            analytics_data = sync_jobs.product_analytics_scraper.fetch_last_7_days_data()
            if analytics_data:
                logger.info(f"成功获取到 {len(analytics_data)} 条最近7天数据")
                result = {'status': 'success', 'raw_count': len(analytics_data)}
            else:
                result = {'status': 'failed', 'error': '无法获取任何数据'}
        
        if result.get('status') == 'success':
            logger.info("✅ 产品分析数据同步成功")
            logger.info(f"原始数据: {result.get('raw_count', 0)} 条")
            logger.info(f"处理数据: {result.get('processed_count', 0)} 条")
            logger.info(f"合并后: {result.get('merged_count', 0)} 个库存点")
            logger.info(f"保存数量: {result.get('saved_count', 0)} 条")
        else:
            logger.error("❌ 产品分析数据同步失败")
            logger.error(f"错误信息: {result.get('error', 'Unknown error')}")
            
        return result.get('status') == 'success'
        
    except Exception as e:
        logger.error(f"测试过程发生异常: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)