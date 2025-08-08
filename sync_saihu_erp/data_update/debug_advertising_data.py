#!/usr/bin/env python3
"""
调试广告数据问题的脚本
用于验证API响应中是否包含广告数据
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

def test_api_response():
    """测试API响应结构"""
    try:
        # 尝试导入必要的模块
        from src.config.settings import settings
        from src.auth.saihu_api_client import SaihuApiClient
        import requests
        
        # 初始化配置
        if not settings.validate_config():
            logger.error("配置验证失败")
            return None
            
        # 初始化API客户端
        api_config = settings.get('api')
        api_client = SaihuApiClient(api_config)
        
        # 测试API连接
        if not api_client.test_connection():
            logger.error("API连接失败")
            return None
            
        logger.info("✅ API连接成功")
        
        # 构建测试请求
        yesterday = date.today() - timedelta(days=1)
        params = {
            'date': yesterday.strftime('%Y-%m-%d'),
            'type': 'daily'
        }
        
        # 获取完整的API响应
        base_url = api_config.get('base_url', 'https://api.saihu-erp.com')
        endpoint = '/api/v1/analytics/products'
        url = f"{base_url.rstrip('/')}{endpoint}"
        
        headers = api_client.get_headers()
        
        logger.info(f"🔍 测试API: {url}")
        logger.info(f"📅 测试日期: {yesterday}")
        logger.info(f"🔧 请求参数: {params}")
        
        # 发送请求
        response = requests.get(url, params=params, headers=headers, timeout=30)
        
        if response.status_code == 200:
            response_data = response.json()
            logger.info(f"✅ API响应成功，状态码: {response.status_code}")
            
            # 分析响应结构
            analyze_response_structure(response_data)
            
            return response_data
        else:
            logger.error(f"❌ API请求失败，状态码: {response.status_code}")
            logger.error(f"响应内容: {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return None

def analyze_response_structure(response_data):
    """分析API响应结构"""
    logger.info("\n" + "="*50)
    logger.info("📊 API响应结构分析")
    logger.info("="*50)
    
    if isinstance(response_data, dict):
        logger.info(f"🔑 顶层键: {list(response_data.keys())}")
        
        # 检查data字段
        if 'data' in response_data:
            data = response_data['data']
            if isinstance(data, list) and data:
                logger.info(f"📋 数据条数: {len(data)}")
                
                # 分析第一条记录的结构
                first_item = data[0]
                logger.info(f"🔍 第一条记录的所有字段:")
                for key, value in first_item.items():
                    logger.info(f"   {key}: {type(value).__name__} = {value}")
                
                # 检查广告相关字段
                check_advertising_fields(first_item)
                
                # 统计所有记录的广告数据
                summarize_advertising_data(data)
            else:
                logger.warning("⚠️ data字段为空或格式不正确")
        else:
            logger.warning("⚠️ 响应中没有data字段")
    elif isinstance(response_data, list) and response_data:
        logger.info(f"📋 直接返回列表，条数: {len(response_data)}")
        check_advertising_fields(response_data[0])
        summarize_advertising_data(response_data)
    else:
        logger.error("❌ 无法识别的响应格式")

def check_advertising_fields(item):
    """检查广告相关字段"""
    logger.info("\n" + "-"*40)
    logger.info("🎯 广告字段检查")
    logger.info("-"*40)
    
    # 广告字段映射
    ad_fields = [
        'adCostThis', 'adTotalSalesThis', 'cpcThis', 'cpaThis', 
        'adOrderNumThis', 'adConversionRateThis', 'adImpressionsThis', 'adClicksThis'
    ]
    
    found_ad_fields = []
    missing_ad_fields = []
    
    for field in ad_fields:
        if field in item:
            value = item[field]
            logger.info(f"✅ {field}: {value} (类型: {type(value).__name__})")
            found_ad_fields.append(field)
        else:
            logger.info(f"❌ {field}: 缺失")
            missing_ad_fields.append(field)
    
    logger.info(f"\n📈 找到的广告字段: {len(found_ad_fields)} 个")
    logger.info(f"🚫 缺失的广告字段: {len(missing_ad_fields)} 个")
    
    return found_ad_fields, missing_ad_fields

def summarize_advertising_data(data):
    """统计广告数据"""
    logger.info("\n" + "-"*40)
    logger.info("📊 广告数据统计")
    logger.info("-"*40)
    
    total_records = len(data)
    ad_cost_sum = 0
    ad_sales_sum = 0
    records_with_ad_data = 0
    
    for item in data:
        has_ad_data = False
        
        # 检查是否有任何广告数据
        ad_fields = ['adCostThis', 'adTotalSalesThis', 'cpcThis', 'cpaThis', 'adOrderNumThis']
        for field in ad_fields:
            if field in item and item[field] and item[field] != 0:
                has_ad_data = True
                break
        
        if has_ad_data:
            records_with_ad_data += 1
            if 'adCostThis' in item and item['adCostThis']:
                ad_cost_sum += float(item['adCostThis'])
            if 'adTotalSalesThis' in item and item['adTotalSalesThis']:
                ad_sales_sum += float(item['adTotalSalesThis'])
    
    logger.info(f"📊 总记录数: {total_records}")
    logger.info(f"💰 有广告数据的记录: {records_with_ad_data}")
    logger.info(f"💵 总广告花费: {ad_cost_sum:.2f}")
    logger.info(f"💲 总广告销售额: {ad_sales_sum:.2f}")
    logger.info(f"📈 广告数据覆盖率: {(records_with_ad_data/total_records)*100:.1f}%")

def test_field_mapping():
    """测试字段映射是否正确"""
    logger.info("\n" + "="*50)
    logger.info("🔗 字段映射验证")
    logger.info("="*50)
    
    # 模拟API响应
    mock_response = {
        "adCostThis": 125.50,
        "adTotalSalesThis": 850.25,
        "cpcThis": 1.25,
        "cpaThis": 12.50,
        "adOrderNumThis": 10,
        "adConversionRateThis": 0.05,
        "adImpressionsThis": 1000,
        "adClicksThis": 100,
        "salePriceThis": 2000.00,
        "productTotalNumThis": 50
    }
    
    logger.info("🧪 模拟API响应数据:")
    for key, value in mock_response.items():
        logger.info(f"   {key}: {value}")
    
    # 测试映射逻辑
    from src.models.product_analytics import ProductAnalytics
    
    try:
        analytics = ProductAnalytics.from_api_response(mock_response)
        
        logger.info("\n🔄 映射结果:")
        logger.info(f"   ad_cost: {analytics.ad_cost}")
        logger.info(f"   ad_sales: {analytics.ad_sales}")
        logger.info(f"   cpc: {analytics.cpc}")
        logger.info(f"   cpa: {analytics.cpa}")
        logger.info(f"   ad_orders: {analytics.ad_orders}")
        logger.info(f"   impressions: {analytics.impressions}")
        logger.info(f"   clicks: {analytics.clicks}")
        
    except Exception as e:
        logger.error(f"❌ 映射测试失败: {e}")

if __name__ == '__main__':
    logger.info("🚀 开始广告数据调试分析...")
    
    # 测试API响应
    api_data = test_api_response()
    
    if api_data:
        # 保存响应数据用于分析
        with open('debug_api_response.json', 'w', encoding='utf-8') as f:
            json.dump(api_data, f, ensure_ascii=False, indent=2)
        logger.info("📁 API响应已保存到 debug_api_response.json")
    
    # 测试字段映射
    test_field_mapping()
    
    logger.info("✅ 调试分析完成")