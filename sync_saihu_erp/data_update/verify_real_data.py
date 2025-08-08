#!/usr/bin/env python3
"""
验证实际业务数据的最终测试脚本
"""
import requests
import json
import datetime
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from src.config.secure_config import config

# 安全获取配置
api_config = config.get_api_credentials()
BASE_URL = api_config.base_url
CLIENT_ID = api_config.client_id
CLIENT_SECRET = api_config.client_secret

def get_oauth_token():
    """获取OAuth令牌"""
    url = f"{BASE_URL}/api/oauth/v2/token.json"
    params = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "client_credentials"
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        if data.get("code") == 0:
            return data["data"]["access_token"]
        else:
            logger.error(f"OAuth失败: {data.get('msg')}")
            return None
    except Exception as e:
        logger.error(f"OAuth异常: {e}")
        return None

def test_with_oauth(endpoint, params, token, description):
    """使用OAuth测试单个API"""
    print(f"\n🧪 {description}")
    print("-" * 50)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    url = f"{BASE_URL}{endpoint}"
    
    try:
        response = requests.post(url, json=params, headers=headers, timeout=30)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
            
            if data.get("code") == 0:
                records = data["data"]["rows"]
                total = data["data"].get("totalCount", 0)
                print(f"✅ 成功: {len(records)}条记录 (总计: {total})")
                return records, total
            else:
                print(f"❌ API错误: {data.get('msg')}")
                return [], 0
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            print(f"响应: {response.text}")
            return [], 0
            
    except Exception as e:
        print(f"❌ 异常: {e}")
        return [], 0

def main():
    print("🔍 最终验证实际业务数据")
    print("=" * 60)
    
    # 1. 获取OAuth令牌
    token = get_oauth_token()
    if not token:
        print("❌ 无法获取令牌")
        return
    
    print(f"✅ 获取令牌成功: {token[:20]}...")
    
    # 2. 测试各种参数组合
    test_cases = [
        {
            "name": "产品分析 - 无日期限制",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "pageNo": 1,
                "pageSize": 50
            }
        },
        {
            "name": "产品分析 - 2025年全范围",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "startDate": "2025-01-01",
                "endDate": "2025-08-06",
                "pageNo": 1,
                "pageSize": 50,
                "currency": "USD"
            }
        },
        {
            "name": "产品分析 - 最近30天",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "startDate": "2025-07-06",
                "endDate": "2025-08-06",
                "pageNo": 1,
                "pageSize": 50,
                "currency": "USD"
            }
        },
        {
            "name": "FBA库存 - 完整数据",
            "endpoint": "/api/inventoryManage/fba/pageList.json",
            "params": {
                "pageNo": 1,
                "pageSize": 50,
                "currency": "USD",
                "hideZero": False,
                "hideDeletedPrd": False
            }
        }
    ]
    
    results = {}
    total_found = 0
    
    for test_case in test_cases:
        records, total = test_with_oauth(
            test_case["endpoint"],
            test_case["params"],
            token,
            test_case["name"]
        )
        
        results[test_case["name"]] = {
            "records": records,
            "count": len(records),
            "total": total
        }
        total_found += len(records)
    
    # 3. 分析结果
    print("\n" + "=" * 60)
    print("📊 验证结果汇总:")
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
    
    # 4. 生成验证报告
    report = {
        "verification_time": str(datetime.datetime.now()),
        "total_found": total_found,
        "has_business_data": has_data,
        "results": results,
        "recommendations": [
            "联系赛狐技术支持确认账户实际数据",
            "检查是否需要指定店铺ID参数",
            "确认API权限范围",
            "验证业务数据是否存在"
        ]
    }
    
    with open('real_data_verification.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 验证报告已保存: real_data_verification.json")
    
    if not has_data:
        print("\n🔍 下一步建议:")
        print("1. 直接联系赛狐技术支持: 400-666-8888")
        print("2. 提供API账户: client_id=368000")
        print("3. 确认是否有实际业务数据")
        print("4. 检查是否需要店铺ID参数")

if __name__ == "__main__":
    main()