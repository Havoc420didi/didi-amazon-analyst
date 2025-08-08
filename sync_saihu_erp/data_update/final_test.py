#!/usr/bin/env python3
"""
最终API测试 - 验证IP白名单和认证
"""
import requests
import json
import datetime
import hashlib
import time

# 配置信息
BASE_URL = "https://openapi.sellfox.com"
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"

def test_basic_connection():
    """测试基本连接"""
    print("🔍 测试基本连接...")
    
    # 测试1: 直接访问
    try:
        response = requests.get(BASE_URL, timeout=10)
        print(f"✅ 网站可访问: {response.status_code}")
    except Exception as e:
        print(f"❌ 网站不可访问: {e}")
        return False
    
    return True

def test_oauth_token():
    """测试OAuth令牌获取"""
    print("\n🔑 测试OAuth令牌...")
    
    url = f"{BASE_URL}/api/oauth/v2/token.json"
    params = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "client_credentials"
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"响应状态: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"OAuth响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
            
            if data.get("code") == 0:
                token = data["data"]["access_token"]
                print(f"✅ OAuth成功: {token[:10]}...")
                return token
            else:
                print(f"❌ OAuth失败: {data.get('msg')}")
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            print(f"响应: {response.text}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")
    
    return None

def test_signature_auth():
    """测试签名认证"""
    print("\n📝 测试签名认证...")
    
    def generate_signature(params, secret):
        sorted_params = sorted(params.items())
        param_string = "&".join([f"{k}={v}" for k, v in sorted_params])
        sign_string = f"{param_string}{secret}"
        return hashlib.md5(sign_string.encode()).hexdigest()
    
    # 测试FBA库存
    timestamp = str(int(time.time()))
    params = {
        'client_id': CLIENT_ID,
        'timestamp': timestamp,
        'sign_method': 'md5',
        'v': '1.0',
        'pageNo': 1,
        'pageSize': 10
    }
    
    signature = generate_signature(params, CLIENT_SECRET)
    params['sign'] = signature
    
    url = f"{BASE_URL}/api/inventoryManage/fba/pageList.json"
    
    try:
        response = requests.post(url, params=params, json={}, timeout=10)
        print(f"签名认证响应: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"签名响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
            
            if data.get("code") == 0:
                records = data["data"]["rows"]
                print(f"✅ 签名认证成功: {len(records)}条记录")
                return records
            else:
                print(f"❌ 签名认证失败: {data.get('msg')}")
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            print(f"响应: {response.text}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")
    
    return None

def check_ip_status():
    """检查IP状态"""
    print("\n🌐 检查IP状态...")
    
    try:
        ip_response = requests.get("https://httpbin.org/ip", timeout=5)
        ip_data = ip_response.json()
        current_ip = ip_data.get("origin", "未知")
        print(f"当前IP: {current_ip}")
        return current_ip
    except Exception as e:
        print(f"❌ 无法获取IP: {e}")
        return None

def main():
    print("🧪 最终API测试开始")
    print("=" * 50)
    
    # 1. 检查IP
    current_ip = check_ip_status()
    
    # 2. 测试基本连接
    basic_ok = test_basic_connection()
    
    # 3. 测试OAuth
    oauth_token = test_oauth_token()
    
    # 4. 测试签名认证
    sig_records = test_signature_auth()
    
    # 5. 总结
    print("\n" + "=" * 50)
    print("📋 测试结果总结:")
    print(f"  当前IP: {current_ip}")
    print(f"  基本连接: {'✅ 正常' if basic_ok else '❌ 失败'}")
    print(f"  OAuth令牌: {'✅ 成功' if oauth_token else '❌ 失败'}")
    print(f"  签名认证: {'✅ 成功' if sig_records else '❌ 失败'}")
    
    if sig_records and len(sig_records) > 0:
        print(f"  实际数据: {len(sig_records)}条记录")
        print(f"  样本: {json.dumps(sig_records[0], ensure_ascii=False)[:200]}...")
    
    print("\n💡 建议:")
    print("1. 确认IP白名单是否包含: {}", current_ip)
    print("2. 联系赛狐技术支持确认白名单状态")
    print("3. 检查API文档确认正确的认证方式")
    print("4. 确认客户端是否有实际业务数据")

if __name__ == "__main__":
    main()