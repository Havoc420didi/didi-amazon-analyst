#!/usr/bin/env python3
"""
最终正确测试 - 使用官方API文档参数格式
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

# API配置 - 使用官方文档格式
BASE_URL = "https://openapi.sellfox.com"
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"

def generate_signature(params, secret):
    """生成签名 - 使用官方文档格式"""
    sorted_params = sorted(params.items())
    param_string = "&".join([f"{k}={v}" for k, v in sorted_params])
    sign_string = f"{param_string}{secret}"
    signature = hashlib.md5(sign_string.encode()).hexdigest()
    return signature

def test_signature_auth(endpoint, params, description):
    """使用签名认证"""
    print(f"\n🧪 {description}")
    print("-" * 50)
    
    timestamp = str(int(time.time()))
    sign_params = {
        'clientId': CLIENT_ID,
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
        print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
        
        if data.get("code") == 0:
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            print(f"✅ 成功: {len(records)}条记录 (总计: {total})")
            return records, total
        else:
            print(f"❌ 错误: {data.get('msg')}")
            return [], 0
            
    except Exception as e:
        print(f"❌ 异常: {e}")
        return [], 0

def test_oauth_auth(endpoint, params, description):
    """使用OAuth认证"""
    print(f"\n🔑 {description}")
    print("-" * 50)
    
    # 1. 获取OAuth令牌
    token_url = f"{BASE_URL}/api/oauth/v2/token.json"
    token_params = {
        "clientId": CLIENT_ID,
        "clientSecret": CLIENT_SECRET,
        "grantType": "client_credentials"
    }
    
    try:
        token_response = requests.get(token_url, params=token_params, timeout=30)
        token_data = token_response.json()
        
        if token_data.get("code") != 0:
            print(f"❌ OAuth失败: {token_data.get('msg')}")
            return [], 0
            
        token = token_data["data"]["accessToken"]
        print(f"✅ OAuth成功: {token[:20]}...")
        
        # 2. 使用令牌调用API
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=params,
            headers=headers,
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        data = response.json()
        print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
        
        if data.get("code") == 0:
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            print(f"✅ 成功: {len(records)}条记录 (总计: {total})")
            return records, total
        else:
            print(f"❌ 错误: {data.get('msg')}")
            return [], 0
            
    except Exception as e:
        print(f"❌ 异常: {e}")
        return [], 0

def main():
    print("🎯 最终正确测试 - 使用官方参数格式")
    print("=" * 60)
    
    # 计算日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 测试日期:")
    print(f"   昨天: {yesterday}")
    print(f"   7天前: {seven_days_ago}")
    
    # 测试用例
    test_cases = [
        {
            "name": "产品分析 - 签名认证",
            "method": "signature",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "startDate": str(yesterday),
                "endDate": str(yesterday),
                "pageNo": 1,
                "pageSize": 50,
                "currency": "USD"
            }
        },
        {
            "name": "产品分析 - OAuth认证",
            "method": "oauth",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "startDate": str(yesterday),
                "endDate": str(yesterday),
                "pageNo": 1,
                "pageSize": 50,
                "currency": "USD"
            }
        },
        {
            "name": "FBA库存 - 签名认证",
            "method": "signature",
            "endpoint": "/api/inventoryManage/fba/pageList.json",
            "params": {
                "pageNo": 1,
                "pageSize": 50,
                "currency": "USD",
                "hideZero": False
            }
        },
        {
            "name": "库存明细 - 签名认证",
            "method": "signature",
            "endpoint": "/api/warehouseManage/warehouseItemList.json",
            "params": {
                "pageNo": 1,
                "pageSize": 50,
                "isHidden": False
            }
        }
    ]
    
    results = {}
    total_found = 0
    
    for test_case in test_cases:
        if test_case["method"] == "signature":
            records, total = test_signature_auth(
                test_case["endpoint"],
                test_case["params"],
                test_case["name"]
            )
        else:
            records, total = test_oauth_auth(
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
            
            # 显示广告数据
            if "产品分析" in name:
                ad_records = [r for r in result["records"] if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
                if ad_records:
                    print(f"   💰 广告数据: {len(ad_records)} 条")
                    for ad in ad_records[:3]:
                        print(f"      ASIN: {ad.get('asin', 'N/A')} 花费: ${ad.get('adCostThis', 0)} 销售: ${ad.get('adTotalSalesThis', 0)}")
        else:
            print(f"⚠️  {name}: 无数据")
    
    print(f"\n📈 总计发现: {total_found} 条记录")
    
    # 生成最终报告
    report = {
        "final_test_time": str(datetime.datetime.now()),
        "total_found": total_found,
        "has_business_data": has_data,
        "parameters_used": {
            "clientId": CLIENT_ID,
            "clientSecret": CLIENT_SECRET[:10] + "...",
            "authentication": ["signature", "oauth"]
        },
        "results": results
    }
    
    with open('final_correct_test.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 最终测试报告已保存: final_correct_test.json")
    
    if has_data:
        print("\n🎉 恭喜！找到实际业务数据，可以开始正式同步！")
    else:
        print("\n🔍 建议:")
        print("1. 联系赛狐技术支持确认账户数据状态")
        print("2. 检查是否需要店铺ID参数")
        print("3. 确认API权限配置")

if __name__ == "__main__":
    main()