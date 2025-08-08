#!/usr/bin/env python3
"""
测试新API接口的脚本
验证广告数据字段是否正确获取
"""
import sys
import json
import logging
from datetime import datetime, date, timedelta
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_new_api():
    """测试新的API接口"""
    try:
        # 导入配置
        from src.config.settings import settings
        from src.auth.saihu_api_client_v2 import SaihuApiClientV2
        
        # 初始化配置
        if not settings.validate_config():
            logger.error("配置验证失败")
            return None
            
        # 初始化新的API客户端
        api_config = settings.get('api')
        api_client = SaihuApiClientV2(api_config)
        
        # 测试API连接
        if not api_client.test_connection():
            logger.error("API连接失败")
            return None
            
        logger.info("✅ 新API连接成功")
        
        # 测试获取产品分析数据
        test_date = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        logger.info(f"📅 测试日期: {test_date}")
        
        # 获取产品分析数据
        response = api_client.get_product_analytics(
            date_str=test_date,
            page=1,
            page_size=10
        )
        
        if response:
            # 验证广告字段
            validation = api_client.validate_advertising_fields(response)
            
            logger.info("\n" + "="*60)
            logger.info("📊 新API响应分析结果")
            logger.info("="*60)
            
            logger.info(f"🎯 是否有广告数据: {'✅ 是' if validation['has_ad_data'] else '❌ 否'}")
            logger.info(f"📈 找到的广告字段: {len(validation['ad_fields_found'])} 个")
            logger.info(f"   字段列表: {validation['ad_fields_found']}")
            
            if validation['ad_fields_missing']:
                logger.info(f"🚫 缺失的广告字段: {len(validation['ad_fields_missing'])} 个")
                logger.info(f"   字段列表: {validation['ad_fields_missing']}")
            
            # 获取广告数据汇总
            summary = api_client.get_advertising_summary(test_date)
            logger.info("\n📊 广告数据汇总:")
            for key, value in summary.items():
                logger.info(f"   {key}: {value}")
            
            # 保存响应数据
            with open('test_new_api_response.json', 'w', encoding='utf-8') as f:
                json.dump(response, f, ensure_ascii=False, indent=2)
            logger.info("📁 响应数据已保存到 test_new_api_response.json")
            
            return response
        else:
            logger.error("❌ 无法获取API响应")
            return None
            
    except Exception as e:
        logger.error(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_field_mapping():
    """测试字段映射逻辑"""
    try:
        from src.models.product_analytics import ProductAnalytics
        
        # 模拟新的API响应数据
        mock_response = {
            "code": "200",
            "message": "success",
            "data": [
                {
                    "asinList": ["B08N5WRWNW"],
                    "skuList": ["TEST-SKU-001"],
                    "spu": "TEST-SPU-001",
                    "mskuList": ["TEST-MSKU-001"],
                    "salePriceThis": 1500.00,
                    "productTotalNumThis": 25,
                    "adImpressionsThis": 5000,
                    "adClicksThis": 150,
                    "adCostThis": 75.50,
                    "adTotalSalesThis": 450.25,
                    "cpcThis": 0.5033,
                    "cpaThis": 7.55,
                    "adOrderNumThis": 10,
                    "adConversionRateThis": 0.0667,
                    "marketplaceIdList": ["ATVPDKIKX0DER"],
                    "devNameList": ["测试开发者"],
                    "operatorNameList": ["测试操作员"],
                    "currency": "USD",
                    "shopIdList": ["shop_001"],
                    "devIdList": ["dev_001"],
                    "operatorIdList": ["op_001"],
                    "title": "测试产品标题",
                    "brands": ["测试品牌"],
                    "profitPriceThis": 200.00,
                    "profitRateThis": 0.1333,
                    "avgProfitThis": 8.00,
                    "availableDays": 30.5,
                    "fbaInventory": 100,
                    "totalInventory": 150,
                    "sessionsThis": 1000,
                    "pageViewThis": 2500,
                    "buyBoxPrice": 59.99,
                    "spuName": "测试SPU名称"
                }
            ]
        }
        
        logger.info("\n" + "="*60)
        logger.info("🧪 字段映射测试")
        logger.info("="*60)
        
        # 测试从API响应创建实例
        product_data = mock_response["data"][0]
        analytics = ProductAnalytics.from_api_response(product_data)
        
        # 验证广告字段映射
        ad_fields_to_check = [
            'ad_cost', 'ad_sales', 'cpc', 'cpa', 'ad_orders', 'ad_conversion_rate'
        ]
        
        logger.info("📊 映射结果验证:")
        for field in ad_fields_to_check:
            value = getattr(analytics, field)
            logger.info(f"   {field}: {value}")
        
        # 验证非零广告数据
        has_ad_data = any(
            getattr(analytics, field) > 0 
            for field in ad_fields_to_check 
            if isinstance(getattr(analytics, field), (int, float)) or str(getattr(analytics, field)).isdigit()
        )
        
        logger.info(f"\n🎯 是否有广告数据: {'✅ 是' if has_ad_data else '❌ 否'}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 字段映射测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    logger.info("🚀 开始测试新的API接口和字段映射...")
    
    # 测试字段映射
    mapping_success = test_field_mapping()
    
    # 测试API连接
    api_success = test_new_api()
    
    logger.info("\n" + "="*60)
    logger.info("📋 测试结果总结")
    logger.info("="*60)
    logger.info(f"✅ 字段映射测试: {'通过' if mapping_success else '失败'}")
    logger.info(f"✅ API连接测试: {'通过' if api_success else '失败'}")
    
    if mapping_success and api_success:
        logger.info("🎉 所有测试通过！新的API集成准备就绪")
    else:
        logger.warning("⚠️ 部分测试失败，请检查配置和代码")