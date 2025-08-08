#!/usr/bin/env python3
"""
产品分析数据同步脚本
直接运行产品分析数据同步，不依赖复杂的调度系统
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
        logger.info("=== 开始产品分析数据同步 ===")
        
        # 导入必要的模块
        from src.config.settings import settings
        from src.database.connection import DatabaseConnection
        from src.scrapers.product_analytics_scraper import ProductAnalyticsScraper
        from src.auth.saihu_api_client import SaihuApiClient
        
        # 验证配置
        if not settings.validate_config():
            logger.error("配置验证失败")
            return False
        
        # 初始化数据库连接
        db_config = settings.get('database')
        db_conn = DatabaseConnection(db_config)
        
        # 测试数据库连接
        if not db_conn.test_connection():
            logger.error("数据库连接失败")
            return False
        
        logger.info("数据库连接成功")
        
        # 初始化API客户端
        api_config = settings.get('api')
        api_client = SaihuApiClient(api_config)
        
        # 测试API认证
        if not api_client.test_connection():
            logger.error("API认证失败")
            return False
        
        logger.info("API认证成功")
        
        # 创建API模板 (简化版)
        class SimpleApiTemplate:
            def __init__(self, api_client):
                self.api_client = api_client
                self.method = 'GET'
            
            def build_request_url(self, base_url, params=None):
                endpoint = "/api/v1/analytics/products"
                url = f"{base_url.rstrip('/')}{endpoint}"
                if params:
                    query_params = []
                    for key, value in params.items():
                        if value is not None:
                            query_params.append(f"{key}={value}")
                    if query_params:
                        url += "?" + "&".join(query_params)
                return url
            
            def build_request_headers(self):
                return self.api_client.get_headers()
            
            def build_request_body(self, params):
                return None
            
            def validate_params(self, params):
                return True, []
        
        # 初始化抓取器
        api_template = SimpleApiTemplate(api_client)
        scraper = ProductAnalyticsScraper(api_template)
        
        # 获取昨天的数据 (如果product_analytics表为空，我们尝试同步昨天的数据)
        yesterday = date.today() - timedelta(days=1)
        logger.info(f"开始抓取 {yesterday} 的产品分析数据")
        
        # 构建请求参数
        params = {
            'date': yesterday.strftime('%Y-%m-%d'),
            'type': 'daily'
        }
        
        # 抓取数据
        analytics_data = scraper.fetch_data(params)
        
        if not analytics_data:
            logger.warning("未获取到产品分析数据")
            
            # 尝试获取最近7天的数据
            logger.info("尝试获取最近7天的数据...")
            end_date = date.today() - timedelta(days=1)
            start_date = end_date - timedelta(days=6)
            
            params = {
                'start_date': start_date.strftime('%Y-%m-%d'), 
                'end_date': end_date.strftime('%Y-%m-%d'),
                'type': 'range'
            }
            
            analytics_data = scraper.fetch_data(params)
        
        if analytics_data:
            logger.info(f"成功获取到 {len(analytics_data)} 条产品分析数据")
            
            # 保存到数据库
            saved_count = db_conn.batch_save_product_analytics(analytics_data)
            logger.info(f"成功保存 {saved_count} 条数据到product_analytics表")
            
            # 显示数据摘要
            summary = scraper.get_data_summary(analytics_data)
            logger.info(f"数据摘要: {summary}")
            
            return True
        else:
            logger.error("未能获取到任何产品分析数据")
            return False
            
    except Exception as e:
        logger.error(f"产品分析数据同步失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)