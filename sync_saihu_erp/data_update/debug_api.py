#!/usr/bin/env python3
"""
API调试脚本 - 检查实际数据
"""
import requests
import hashlib
import time
import json
import datetime

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

def test_single_request(endpoint, params, description):
    """测试单个API请求"""
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
            json={},
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        data = response.json()
        print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
        
        if data.get("code") == 0:
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            total_page = data["data"].get("totalPage", 0)
            print(f"✅ 成功: {len(records)}条记录 (总计: {total}, 总页数: {total_page})")
            return records
        else:
            print(f"❌ 错误: {data.get('msg')}")
            return []
            
    except Exception as e:
        print(f"❌ 异常: {e}")
        return []

def main():
    print("🔍 开始API调试...")
    
    # 计算日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"当前日期: {today}")
    print(f"昨天: {yesterday}")
    print(f"7天前: {seven_days_ago}")
    
    # 1. 测试产品分析 - 不限制日期范围
    print("\n" + "="*60)
    print("1. 测试产品分析 - 大范围查询")
    records1 = test_single_request(
        "/api/productAnalyze/new/pageList.json",
        {
            "startDate": "2024-01-01",
            "endDate": "2025-08-05",
            "pageNo": 1,
            "pageSize": 10,
            "currency": "USD"
        },
        "产品分析 - 2024年至今"
    )
    
    # 2. 测试产品分析 - 小范围查询
    print("\n" + "="*60)
    print("2. 测试产品分析 - 昨天数据")
    records2 = test_single_request(
        "/api/productAnalyze/new/pageList.json",
        {
            "startDate": "2025-08-05",
            "endDate": "2025-08-05",
            "pageNo": 1,
            "pageSize": 10,
            "currency": "USD"
        },
        "产品分析 - 昨天"
    )
    
    # 3. 测试FBA库存 - 无过滤
    print("\n" + "="*60)
    print("3. 测试FBA库存 - 无过滤")
    records3 = test_single_request(
        "/api/inventoryManage/fba/pageList.json",
        {
            "pageNo": 1,
            "pageSize": 10,
            "currency": "USD"
        },
        "FBA库存 - 无过滤"
    )
    
    # 4. 测试FBA库存 - 包含零库存
    print("\n" + "="*60)
    print("4. 测试FBA库存 - 包含零库存")
    records4 = test_single_request(
        "/api/inventoryManage/fba/pageList.json",
        {
            "pageNo": 1,
            "pageSize": 10,
            "currency": "USD",
            "hideZero": False
        },
        "FBA库存 - 包含零库存"
    )
    
    # 5. 测试库存明细
    print("\n" + "="*60)
    print("5. 测试库存明细")
    records5 = test_single_request(
        "/api/warehouseManage/warehouseItemList.json",
        {
            "pageNo": 1,
            "pageSize": 10,
            "isHidden": False
        },
        "库存明细"
    )
    
    # 汇总结果
    all_records = [
        ("产品分析(大范围)", records1),
        ("产品分析(昨天)", records2),
        ("FBA库存(无过滤)", records3),
        ("FBA库存(含零库存)", records4),
        ("库存明细", records5)
    ]
    
    print("\n" + "="*60)
    print("📊 调试结果汇总:")
    total_found = 0
    for name, records in all_records:
        count = len(records)
        total_found += count
        print(f"  {name}: {count} 条记录")
        
        # 显示样本数据
        if count > 0:
            sample = records[0]
            print(f"    样本: {json.dumps(sample, ensure_ascii=False)[:200]}...")
    
    print(f"\n📈 总计找到: {total_found} 条记录")
    
    # 检查广告数据
    all_analytics = records1 + records2
    if all_analytics:
        ad_records = [r for r in all_analytics if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
        print(f"\n💰 广告数据发现: {len(ad_records)} 条记录")
        if ad_records:
            sample = ad_records[0]
            print(f"   广告样本: ASIN={sample.get('asin')} 花费=${sample.get('adCostThis')} 销售=${sample.get('adTotalSalesThis')}")

if __name__ == "__main__":
    main()