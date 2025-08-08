#!/usr/bin/env python3
"""
真实数据调试脚本 - 使用更精确的参数
"""
import requests
import json
import datetime
import hashlib
import time

# API配置
BASE_URL = "https://openapi.sellfox.com"
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"

def generate_signature(params, secret):
    """生成签名"""
    sorted_params = sorted(params.items())
    param_string = "&".join([f"{k}={v}" for k, v in sorted_params])
    sign_string = f"{param_string}{secret}"
    signature = hashlib.md5(sign_string.encode()).hexdigest()
    return signature

def fetch_single_page(endpoint, params, description):
    """获取单页数据"""
    print(f"\n🧪 {description}")
    print("-" * 50)
    
    timestamp = str(int(time.time()))
    sign_params = {
        'client_id': CLIENT_ID,
        'timestamp': timestamp,
        'sign_method': 'md5',
        'v': '1.0',
        **params
    }
    
    signature = generate_signature(sign_params, CLIENT_SECRET)
    sign_params['sign'] = signature
    
    try:
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            params=sign_params,
            json={},  # 空body
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        data = response.json()
        
        if data.get("code") == 0:
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            print(f"✅ 成功: {len(records)}条记录 (总计: {total})")
            
            if records:
                print("📋 前3条样本数据:")
                for i, record in enumerate(records[:3]):
                    print(f"  {i+1}. {json.dumps(record, ensure_ascii=False)[:300]}...")
            
            return records, total
        else:
            print(f"❌ 错误: {data.get('msg')}")
            return [], 0
            
    except Exception as e:
        print(f"❌ 异常: {e}")
        return [], 0

def test_all_scenarios():
    """测试所有可能场景"""
    print("🔍 开始全面数据测试...")
    print("=" * 60)
    
    results = {}
    
    # 1. 产品分析 - 不同参数组合
    test_cases = [
        # 产品分析测试
        {
            "name": "产品分析-无日期",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {"pageNo": 1, "pageSize": 10}
        },
        {
            "name": "产品分析-2024年",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "startDate": "2024-01-01",
                "endDate": "2024-12-31",
                "pageNo": 1,
                "pageSize": 10
            }
        },
        {
            "name": "产品分析-2025年",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "startDate": "2025-01-01",
                "endDate": "2025-08-05",
                "pageNo": 1,
                "pageSize": 10
            }
        },
        {
            "name": "产品分析-最近7天",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "startDate": "2025-08-01",
                "endDate": "2025-08-05",
                "pageNo": 1,
                "pageSize": 10
            }
        },
        
        # FBA库存测试
        {
            "name": "FBA库存-无过滤",
            "endpoint": "/api/inventoryManage/fba/pageList.json",
            "params": {"pageNo": 1, "pageSize": 10}
        },
        {
            "name": "FBA库存-包含零",
            "endpoint": "/api/inventoryManage/fba/pageList.json",
            "params": {
                "pageNo": 1,
                "pageSize": 10,
                "hideZero": False
            }
        },
        
        # 库存明细测试
        {
            "name": "库存明细-默认",
            "endpoint": "/api/warehouseManage/warehouseItemList.json",
            "params": {"pageNo": 1, "pageSize": 10}
        },
        {
            "name": "库存明细-显示隐藏",
            "endpoint": "/api/warehouseManage/warehouseItemList.json",
            "params": {
                "pageNo": 1,
                "pageSize": 10,
                "isHidden": False
            }
        }
    ]
    
    total_found = 0
    for test_case in test_cases:
        records, total = fetch_single_page(
            test_case["endpoint"],
            test_case["params"],
            test_case["name"]
        )
        
        results[test_case["name"]] = {
            "records": records,
            "count": len(records),
            "total": total
        }
        total_found += len(records)
    
    # 汇总分析
    print("\n" + "=" * 60)
    print("📊 完整测试结果汇总:")
    print("-" * 60)
    
    has_data = False
    for name, result in results.items():
        count = result["count"]
        total = result["total"]
        if count > 0:
            has_data = True
            print(f"✅ {name}: {count}/{total} 条记录")
            
            # 显示广告数据
            ad_records = [r for r in result["records"] if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
            if ad_records:
                print(f"   💰 广告数据: {len(ad_records)} 条")
                for ad in ad_records[:2]:
                    print(f"      ASIN: {ad.get('asin', 'N/A')} 花费: ${ad.get('adCostThis', 0)} 销售: ${ad.get('adTotalSalesThis', 0)}")
        else:
            print(f"⚠️  {name}: 无数据")
    
    print(f"\n🎯 总体发现: {total_found} 条记录")
    
    if not has_data:
        print("\n🔍 建议检查:")
        print("1. 确认API账户是否有业务数据")
        print("2. 检查是否需要特定的筛选条件")
        print("3. 联系赛狐技术支持确认数据权限")
        print("4. 确认是否需要特定的日期范围或店铺ID")
    
    return results

if __name__ == "__main__":
    results = test_all_scenarios()