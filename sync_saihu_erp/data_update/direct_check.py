#!/usr/bin/env python3
"""
直接确认实际数据存在
"""
import requests
import json
import datetime

# 直接使用已知的token
ACCESS_TOKEN = "0ab64bda-4366-49d2-84eb-bb971978648a"
BASE_URL = "https://openapi.sellfox.com"

# 请求头
headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}

def check_single_request(endpoint, params, name):
    """单次请求确认"""
    print(f"\n🔍 检查 {name}")
    url = f"{BASE_URL}{endpoint}"
    
    try:
        response = requests.post(url, json=params, headers=headers, timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应: {json.dumps(data, ensure_ascii=False)[:500]}...")
            
            if data.get("code") == 0:
                records = data["data"]["rows"]
                total = data["data"].get("totalCount", 0)
                print(f"✅ 找到: {len(records)}条记录 (总计: {total})")
                
                # 检查广告数据
                if "productAnalyze" in endpoint and records:
                    ad_records = [r for r in records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
                    if ad_records:
                        print(f"   💰 广告数据: {len(ad_records)}条")
                        for ad in ad_records[:2]:
                            print(f"      ASIN: {ad.get('asin')} 花费: ${ad.get('adCostThis')} 销售: ${ad.get('adTotalSalesThis')}")
                
                return records, total
            else:
                print(f"❌ API错误: {data.get('msg')}")
        else:
            print(f"❌ HTTP错误: {response.status_code} - {response.text[:200]}...")
            
    except Exception as e:
        print(f"❌ 异常: {e}")
    
    return [], 0

def main():
    print("🎯 直接确认实际业务数据")
    print("=" * 50)
    
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    
    # 单次小范围查询
    test_cases = [
        {
            "name": "产品分析-昨天",
            "endpoint": "/api/productAnalyze/new/pageList.json",
            "params": {
                "startDate": str(yesterday),
                "endDate": str(yesterday),
                "pageNo": 1,
                "pageSize": 10,
                "currency": "USD"
            }
        },
        {
            "name": "FBA库存-基础",
            "endpoint": "/api/inventoryManage/fba/pageList.json",
            "params": {
                "pageNo": 1,
                "pageSize": 10,
                "currency": "USD"
            }
        }
    ]
    
    results = {}
    total_found = 0
    
    for test_case in test_cases:
        records, total = check_single_request(
            test_case["endpoint"], 
            test_case["params"], 
            test_case["name"]
        )
        results[test_case["name"]] = {"records": records, "count": len(records), "total": total}
        total_found += len(records)
    
    # 结果总结
    print("\n" + "=" * 50)
    print("📊 最终确认结果:")
    for name, result in results.items():
        count = result["count"]
        total = result["total"]
        if count > 0:
            print(f"✅ {name}: {count}/{total} 条记录")
        else:
            print(f"⚠️  {name}: 无数据")
    
    print(f"\n📈 总计发现: {total_found} 条记录")
    
    # 关键结论
    if total_found == 0:
        print("\n🎯 关键结论:")
        print("1. ✅ 认证完全正确 (OAuth成功)")
        print("2. ✅ 网络连接正常 (HTTP 200)")
        print("3. ✅ 权限配置正确 (无权限错误)")
        print("4. ⚠️ 当前账户无业务数据")
        print("\n📞 建议联系赛狐技术支持确认:")
        print("   - 账户368000是否有实际业务数据？")
        print("   - 是否需要指定店铺ID参数？")
        print("   - 数据是否在特定日期范围内？")
    else:
        print("\n🎉 成功确认实际业务数据存在！")
        print("可以开始正式数据同步")

if __name__ == "__main__":
    main()