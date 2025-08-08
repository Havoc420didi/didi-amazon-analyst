#!/usr/bin/env python3
"""
简化版广告数据调试脚本
"""
import json
import requests
from datetime import datetime, date, timedelta

def test_field_mapping():
    """测试字段映射逻辑"""
    print("="*60)
    print("🔍 广告字段映射验证")
    print("="*60)
    
    # 模拟API响应数据
    mock_api_responses = [
        {
            "name": "完整广告数据",
            "data": {
                "asinList": ["B08N5WRWNW"],
                "skuList": ["TEST-SKU-001"],
                "salePriceThis": 1500.00,
                "productTotalNumThis": 25,
                "adImpressionsThis": 5000,
                "adClicksThis": 150,
                "adCostThis": 75.50,
                "adTotalSalesThis": 450.25,
                "cpcThis": 0.5033,
                "cpaThis": 7.55,
                "adOrderNumThis": 10,
                "adConversionRateThis": 0.0667
            }
        },
        {
            "name": "缺失广告数据",
            "data": {
                "asinList": ["B08N5WRWNW"],
                "skuList": ["TEST-SKU-001"],
                "salePriceThis": 1500.00,
                "productTotalNumThis": 25,
                "adImpressionsThis": 0,
                "adClicksThis": 0
                # 注意：缺少广告相关字段
            }
        },
        {
            "name": "零值广告数据",
            "data": {
                "asinList": ["B08N5WRWNW"],
                "skuList": ["TEST-SKU-001"],
                "salePriceThis": 1500.00,
                "productTotalNumThis": 25,
                "adImpressionsThis": 0,
                "adClicksThis": 0,
                "adCostThis": 0.00,
                "adTotalSalesThis": 0.00,
                "cpcThis": 0.0000,
                "cpaThis": 0.0000,
                "adOrderNumThis": 0,
                "adConversionRateThis": 0.0000
            }
        }
    ]
    
    for test_case in mock_api_responses:
        print(f"\n🧪 {test_case['name']}:")
        print("-" * 40)
        
        api_data = test_case['data']
        
        # 模拟ProductAnalytics.from_api_response的逻辑
        field_mapping = {
            'adCostThis': 'ad_cost',
            'adTotalSalesThis': 'ad_sales', 
            'cpcThis': 'cpc',
            'cpaThis': 'cpa',
            'adOrderNumThis': 'ad_orders',
            'adConversionRateThis': 'ad_conversion_rate',
            'adImpressionsThis': 'impressions',
            'adClicksThis': 'clicks',
            'salePriceThis': 'sales_amount',
            'productTotalNumThis': 'sales_quantity'
        }
        
        # 模拟数据转换
        result = {}
        for api_key, model_key in field_mapping.items():
            value = api_data.get(api_key)
            if value is None or value == '':
                # 默认值处理
                if 'rate' in model_key:
                    result[model_key] = 0.0000
                elif any(num_key in model_key for num_key in ['amount', 'sales', 'cost', 'cpc', 'cpa']):
                    result[model_key] = 0.00
                else:
                    result[model_key] = 0
            else:
                result[model_key] = value
        
        print("📊 转换结果:")
        for key, value in result.items():
            if 'ad_' in key or key in ['cpc', 'cpa']:
                print(f"   {key}: {value}")
        
        # 分析是否有广告数据
        ad_values = [result.get(k, 0) for k in ['ad_cost', 'ad_sales', 'ad_orders']]
        has_ad_data = any(v > 0 for v in ad_values if isinstance(v, (int, float)))
        
        print(f"   📈 是否有广告数据: {'✅ 是' if has_ad_data else '❌ 否'}")

def check_advertising_field_usage():
    """检查代码中广告字段的使用情况"""
    print("\n" + "="*60)
    print("🔍 广告字段使用分析")
    print("="*60)
    
    # 分析ProductAnalytics模型中的广告字段
    ad_fields_in_model = [
        'ad_cost', 'ad_sales', 'cpc', 'cpa', 'ad_orders', 'ad_conversion_rate'
    ]
    
    # 分析API响应中的广告字段
    ad_fields_in_api = [
        'adCostThis', 'adTotalSalesThis', 'cpcThis', 'cpaThis', 
        'adOrderNumThis', 'adConversionRateThis'
    ]
    
    print("📋 模型中的广告字段:")
    for field in ad_fields_in_model:
        print(f"   • {field}")
    
    print("\n🔗 API响应中的广告字段:")
    for field in ad_fields_in_api:
        print(f"   • {field}")
    
    print("\n🎯 字段映射关系:")
    mapping = dict(zip(ad_fields_in_api, ad_fields_in_model))
    for api_field, model_field in mapping.items():
        print(f"   {api_field} → {model_field}")

def simulate_missing_data_scenario():
    """模拟缺失数据的场景"""
    print("\n" + "="*60)
    print("🎭 缺失广告数据场景模拟")
    print("="*60)
    
    scenarios = [
        {
            "问题": "API响应中缺少广告字段",
            "解决方案": "联系API提供商确认广告数据接口"
        },
        {
            "问题": "广告字段名称不匹配",
            "解决方案": "更新字段映射配置"
        },
        {
            "问题": "广告数据权限问题",
            "解决方案": "确认API访问权限包含广告数据"
        },
        {
            "问题": "日期范围无广告数据",
            "解决方案": "扩大查询日期范围或确认广告投放时间"
        }
    ]
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n{i}. {scenario['问题']}")
        print(f"   💡 解决方案: {scenario['解决方案']}")

if __name__ == '__main__':
    print("🚀 开始广告数据问题分析...")
    
    # 测试字段映射
    test_field_mapping()
    
    # 检查字段使用情况
    check_advertising_field_usage()
    
    # 模拟缺失数据场景
    simulate_missing_data_scenario()
    
    print("\n✅ 分析完成！")