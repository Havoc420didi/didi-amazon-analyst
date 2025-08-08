#!/usr/bin/env python3
"""
测试签名认证API
"""
import requests
import hashlib
import time
import json

# API配置
BASE_URL = "https://openapi.sellfox.com"
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"

def generate_signature(params, secret):
    """生成签名"""
    # 按字典序排序参数
    sorted_params = sorted(params.items())
    param_string = "&".join([f"{k}={v}" for k, v in sorted_params])
    sign_string = f"{param_string}{secret}"
    
    # 使用MD5签名
    signature = hashlib.md5(sign_string.encode()).hexdigest()
    return signature

def test_api(endpoint, data_params, description):
    """测试API接口"""
    print(f"\n{description}")
    print("-" * 50)
    
    # 生成签名参数
    timestamp = str(int(time.time()))
    sign_params = {
        'client_id': CLIENT_ID,
        'timestamp': timestamp,
        'sign_method': 'md5',
        'v': '1.0'
    }
    
    # 计算签名
    all_params = {**sign_params}
    signature = generate_signature(all_params, CLIENT_SECRET)
    sign_params['sign'] = signature
    
    try:
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            params=sign_params,
            json=data_params,
            timeout=30
        )
        
        result = response.json()
        print(f"✅ 状态码: {response.status_code}")
        print(f"✅ 响应: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}...")
        
        if result.get('code') == 0:
            records = result['data']['rows']
            print(f"✅ 成功获取: {len(records)} 条记录")
            return records
        else:
            print(f"❌ 错误: {result.get('msg', '未知错误')}")
            return []
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")
        return []

def main():
    print("🚀 开始测试签名认证API...")
    
    # 测试FBA库存
    fba_data = {
        "pageNo": 1,
        "pageSize": 20,
        "currency": "USD",
        "hideZero": True,
        "hideDeletedPrd": True,
        "needMergeShare": False
    }
    
    fba_records = test_api(
        "/api/inventoryManage/fba/pageList.json",
        fba_data,
        "1. 测试FBA库存接口"
    )
    
    # 测试库存明细
    inv_data = {
        "pageNo": 1,
        "pageSize": 20,
        "isHidden": True
    }
    
    inv_records = test_api(
        "/api/warehouseManage/warehouseItemList.json",
        inv_data,
        "2. 测试库存明细接口"
    )
    
    # 测试产品分析
    analytics_data = {
        "startDate": "2024-08-05",
        "endDate": "2024-08-05",
        "pageNo": 1,
        "pageSize": 20,
        "currency": "USD"
    }
    
    analytics_records = test_api(
        "/api/productAnalyze/new/pageList.json",
        analytics_data,
        "3. 测试产品分析接口"
    )
    
    # 分析广告数据
    if analytics_records:
        ad_records = [r for r in analytics_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
        print(f"\n📈 广告数据分析:")
        print(f"   总记录数: {len(analytics_records)}")
        print(f"   广告记录数: {len(ad_records)}")
        
        if ad_records:
            total_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
            total_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
            print(f"   总广告花费: ${total_cost:.2f}")
            print(f"   总广告销售: ${total_sales:.2f}")
    
    # 汇总结果
    total_records = len(fba_records) + len(inv_records) + len(analytics_records)
    
    print(f"\n📊 测试完成汇总:")
    print(f"   FBA库存: {len(fba_records)} 条记录")
    print(f"   库存明细: {len(inv_records)} 条记录")
    print(f"   产品分析: {len(analytics_records)} 条记录")
    print(f"   总计: {total_records} 条记录")
    
    return True

if __name__ == "__main__":
    main()