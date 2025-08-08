#!/usr/bin/env python3
"""
测试API连接和产品分析数据获取
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
        logger.info("=== 测试API连接和产品分析数据获取 ===")
        
        # 导入API客户端
        from src.auth.saihu_api_client import SaihuApiClient
        
        # 创建API客户端
        api_client = SaihuApiClient()
        
        # 构建产品分析数据请求
        yesterday = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        logger.info(f"尝试获取 {yesterday} 的产品分析数据")
        
        # 构建请求体数据
        body_data = {
            "date": yesterday,
            "type": "daily"
        }
        
        # 发起API请求
        response = api_client.make_signed_request(
            endpoint="/api/v1/analytics/products",
            method="POST",
            body_data=body_data,
            timeout=60
        )
        
        if response:
            logger.info("✅ API请求成功")
            try:
                data = response.json()
                logger.info(f"响应数据类型: {type(data)}")
                if isinstance(data, dict):
                    logger.info(f"响应键: {list(data.keys())}")
                    if 'data' in data:
                        logger.info(f"数据条数: {len(data['data'])}")
                    elif 'items' in data:
                        logger.info(f"数据条数: {len(data['items'])}")
                elif isinstance(data, list):
                    logger.info(f"数据条数: {len(data)}")
                return True
            except Exception as e:
                logger.error(f"解析响应JSON失败: {e}")
                logger.info(f"原始响应: {response.text}")
                return False
        else:
            logger.error("❌ API请求失败")
            return False
            
    except Exception as e:
        logger.error(f"测试过程发生异常: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)