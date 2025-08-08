#!/usr/bin/env python3
"""
调试签名认证 - 查看实际响应
"""
import requests
import json
import datetime
import hashlib
import time

# 赛狐提供的正式参数
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"
BASE_URL = "https://openapi.sellfox.com"

def generate_signature(params, secret):
    """生成签名"""
    # 排除sign参数，按key排序
    filtered_params = [(k, v) for k, v in params.items() if k != 'sign']
    sorted_params = sorted(filtered_params)
    param_string = "&".join([f"{k}={v}" for k, v in sorted_params])
    sign_string = f"{param_string}{secret}"
    signature = hashlib.md5(sign_string.encode()).hexdigest()
    return signature

def debug_api_call(endpoint, params):
    """调试API调用"""
    print(f"\n🔍 调试 {endpoint}")
    print("=" * 50)
    
    timestamp = str(int(time.time()))
    
    # 构建签名参数 - 使用client_id参数名
    sign_params = {
        'client_id': CLIENT_ID,
        'timestamp': timestamp,
        'sign_method': 'md5',
        'v': '1.0',
        **params
    }
    
    signature = generate_signature(sign_params, CLIENT_SECRET)
    sign_params['sign'] = signature
    
    print("📋 请求参数:")
    for key, value in sign_params.items():
        if key == 'sign':
            print(f"   {key}: {value[:16]}...")
        else:
            print(f"   {key}: {value}")
    
    # 构建URL
    url = f"{BASE_URL}{endpoint}"
    print(f"\n🌐 URL: {url}")
    
    # 计算签名字符串
    sorted_params = sorted(sign_params.items())
    param_string = "&".join([f"{k}={v}" for k, v in sorted_params if k != 'sign'])
    sign_string = f"{param_string}{CLIENT_SECRET}"
    print(f"\n🔐 签名字符串: {sign_string}")
    print(f"🔐 签名: {signature}")
    
    try:
        response = requests.post(
            url,
            params=sign_params,
            json={},
            timeout=10
        )
        
        print(f"\n📡 响应:")
        print(f"   状态码: {response.status_code}")
        print(f"   响应头: {dict(response.headers)}")
        print(f"   响应体: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n📊 数据:")
            print(f"   返回码: {data.get('code')}")
            print(f"   消息: {data.get('msg')}")
            if data.get('data'):
                print(f"   总行数: {data['data'].get('totalCount', 'N/A')}")
                print(f"   记录数: {len(data['data'].get('rows', []))}")
                
                records = data['data'].get('rows', [])
                if records:
                    print(f"\n📋 第一条记录:")
                    record = records[0]
                    print(f"   ASIN: {record.get('asin', 'N/A')}")
                    print(f"   标题: {record.get('title', 'N/A')[:50]}...")
                    print(f"   广告花费: {record.get('adCostThis', 'N/A')}")
                    print(f"   广告销售: {record.get('adTotalSalesThis', 'N/A')}")
                    print(f"   广告点击: {record.get('adClicksThis', 'N/A')}")
                    print(f"   广告订单: {record.get('adOrderNumThis', 'N/A')}")
                    
                    # 检查广告数据
                    ad_cost = str(record.get('adCostThis', '0')).replace(',', '')
                    try:
                        ad_cost_float = float(ad_cost)
                        if ad_cost_float > 0:
                            print(f"   🎯 发现广告数据: ${ad_cost_float}")
                        else:
                            print(f"   ⚠️  广告数据为0")
                    except:
                        print(f"   ⚠️  广告数据格式异常: {ad_cost}")
        
        return response
        
    except Exception as e:
        print(f"❌ 异常: {e}")
        return None

def main():
    """主函数"""
    print("🎯 签名认证调试 - 查看实际响应")
    print("=" * 60)
    print(f"clientId: {CLIENT_ID}")
    print(f"clientSecret: {CLIENT_SECRET[:8]}...")
    
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    
    # 测试产品分析
    debug_api_call("/api/productAnalyze/new/pageList.json", {
        "startDate": str(yesterday),
        "endDate": str(yesterday),
        "pageNo": 1,
        "pageSize": 5,
        "currency": "USD"
    })
    
    # 等待避免限流
    time.sleep(2)
    
    # 测试FBA库存
    debug_api_call("/api/inventoryManage/fba/pageList.json", {
        "pageNo": 1,
        "pageSize": 5,
        "currency": "USD"
    })

if __name__ == "__main__":
    main()