#!/usr/bin/env python3
"""
最终修正版本 - 使用client_id参数名
"""
import requests
import json
import datetime
import hashlib
import time
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

def test_api_with_correct_params():
    """使用正确参数测试所有API"""
    print("🎯 使用client_id参数的最终测试")
    print("=" * 60)
    
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    
    test_cases = [
        {
            "name": "产品分析",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "client_id": CLIENT_ID,
                "timestamp": str(int(time.time())),
                "sign_method": "md5",
                "v": "1.0",
                "startDate": str(yesterday),
                "endDate": str(yesterday),
                "pageNo": 1,
                "pageSize": 50,
                "currency": "USD"
            }
        },
        {
            "name": "FBA库存",
            "endpoint": "/api/inventoryManage/fba/pageList.json",
            "params": {
                "client_id": CLIENT_ID,
                "timestamp": str(int(time.time())),
                "sign_method": "md5",
                "v": "1.0",
                "pageNo": 1,
                "pageSize": 50,
                "currency": "USD",
                "hideZero": False
            }
        },
        {
            "name": "库存明细",
            "endpoint": "/api/warehouseManage/warehouseItemList.json",
            "params": {
                "client_id": CLIENT_ID,
                "timestamp": str(int(time.time())),
                "sign_method": "md5",
                "v": "1.0",
                "pageNo": 1,
                "pageSize": 50,
                "isHidden": False
            }
        }
    ]
    
    results = {}
    total_found = 0
    
    for test_case in test_cases:
        print(f"\n🧪 {test_case['name']}")
        print("-" * 50)
        
        params = test_case["params"]
        signature = generate_signature(params, CLIENT_SECRET)
        params['sign'] = signature
        
        try:
            response = requests.post(
                f"{BASE_URL}{test_case['endpoint']}",
                params=params,
                json={},
                timeout=30
            )
            
            print(f"状态码: {response.status_code}")
            data = response.json()
            print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
            
            if data.get("code") == 0:
                records = data["data"]["rows"]
                total = data["data"].get("totalCount", 0)
                print(f"✅ 成功: {len(records)}条记录 (总计: {total})")
                
                # 显示广告数据
                if test_case['name'] == "产品分析" and records:
                    ad_records = [r for r in records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
                    if ad_records:
                        print(f"   💰 广告数据: {len(ad_records)} 条")
                        for ad in ad_records[:2]:
                            print(f"      ASIN: {ad.get('asin', 'N/A')} 花费: ${ad.get('adCostThis', 0)} 销售: ${ad.get('adTotalSalesThis', 0)}")
                
                results[test_case['name']] = {
                    "records": records,
                    "count": len(records),
                    "total": total
                }
                total_found += len(records)
            else:
                print(f"❌ 错误: {data.get('msg')}")
                results[test_case['name']] = {"records": [], "count": 0, "total": 0}
                
        except Exception as e:
            print(f"❌ 异常: {e}")
            results[test_case['name']] = {"records": [], "count": 0, "total": 0}
    
    # 汇总结果
    print("\n" + "=" * 60)
    print("📊 最终测试结果汇总:")
    print("-" * 60)
    
    has_data = False
    for name, result in results.items():
        count = result["count"]
        total = result["total"]
        if count > 0:
            has_data = True
            print(f"✅ {name}: {count}/{total} 条记录")
        else:
            print(f"⚠️  {name}: 无数据")
    
    print(f"\n📈 总计发现: {total_found} 条记录")
    
    # 生成最终报告
    report = {
        "final_test_time": str(datetime.datetime.now()),
        "total_found": total_found,
        "has_business_data": has_data,
        "parameters_used": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET[:10] + "...",
            "authentication_method": "signature with client_id"
        },
        "test_date": str(yesterday),
        "results": results
    }
    
    with open('correct_final_result.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 最终测试报告已保存: correct_final_result.json")
    
    if has_data:
        print("\n🎉 恭喜！成功获取到实际业务数据！")
        print("可以立即开始正式的数据同步！")
    else:
        print("\n🔍 建议联系赛狐技术支持确认账户数据状态")
    
    return has_data, total_found

if __name__ == "__main__":
    success, total = test_api_with_correct_params()