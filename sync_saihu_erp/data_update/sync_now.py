#!/usr/bin/env python3
"""
立即执行数据同步 - 独立版本
"""
import requests
import json
import datetime
import logging

# 禁用urllib3警告
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 配置
BASE_URL = "https://openapi.sellfox.com"
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_access_token():
    """获取OAuth访问令牌"""
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
            logger.error(f"获取token失败: {data.get('msg')}")
            return None
    except Exception as e:
        logger.error(f"获取token异常: {e}")
        return None

def fetch_data(endpoint, params, headers):
    """获取API数据"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        response = requests.post(url, json=params, headers=headers, timeout=60)
        return response.json()
    except Exception as e:
        logger.error(f"获取数据异常: {e}")
        return None

def main():
    print("🔄 开始重新同步数据...")
    
    # 获取访问令牌
    print("🔑 获取访问令牌...")
    token = get_access_token()
    if not token:
        print("❌ 无法获取访问令牌")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("✅ 访问令牌获取成功")
    
    # 计算日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 同步日期范围:")
    print(f"  product_analytics: {seven_days_ago} ~ {yesterday}")
    print(f"  fba_inventory: {yesterday}")
    print(f"  inventory_details: {yesterday}")
    
    all_data = {}
    
    # 1. 获取FBA库存数据
    print("\n📋 获取FBA库存数据...")
    fba_params = {
        "pageNo": 1,
        "pageSize": 100,
        "currency": "USD",
        "hideZero": True,
        "hideDeletedPrd": True,
        "needMergeShare": False
    }
    
    fba_result = fetch_data("/api/inventoryManage/fba/pageList.json", fba_params, headers)
    if fba_result and fba_result.get("code") == 0:
        fba_data = fba_result.get("data", {})
        fba_rows = fba_data.get("rows", [])
        all_data["fba_inventory"] = fba_rows
        print(f"  ✅ FBA库存: {len(fba_rows)} 条记录")
    else:
        print(f"  ❌ FBA库存获取失败: {fba_result.get('msg') if fba_result else '未知错误'}")
    
    # 2. 获取库存明细数据
    print("\n📋 获取库存明细数据...")
    inv_params = {
        "pageNo": 1,
        "pageSize": 100,
        "isHidden": True
    }
    
    inv_result = fetch_data("/api/warehouseManage/warehouseItemList.json", inv_params, headers)
    if inv_result and inv_result.get("code") == 0:
        inv_data = inv_result.get("data", {})
        inv_rows = inv_data.get("rows", [])
        all_data["inventory_details"] = inv_rows
        print(f"  ✅ 库存明细: {len(inv_rows)} 条记录")
    else:
        print(f"  ❌ 库存明细获取失败: {inv_result.get('msg') if inv_result else '未知错误'}")
    
    # 3. 获取产品分析数据（最近7天）
    print("\n📋 获取产品分析数据...")
    all_analytics = []
    current_date = seven_days_ago
    
    while current_date <= yesterday:
        date_str = current_date.strftime('%Y-%m-%d')
        print(f"    获取 {date_str} 的数据...")
        
        analytics_params = {
            "startDate": date_str,
            "endDate": date_str,
            "pageNo": 1,
            "pageSize": 100,
            "currency": "USD"
        }
        
        analytics_result = fetch_data("/api/productAnalyze/new/pageList.json", analytics_params, headers)
        if analytics_result and analytics_result.get("code") == 0:
            analytics_data = analytics_result.get("data", {})
            analytics_rows = analytics_data.get("rows", [])
            all_analytics.extend(analytics_rows)
            print(f"      {date_str}: {len(analytics_rows)} 条记录")
        else:
            print(f"      {date_str}: 获取失败")
        
        current_date += datetime.timedelta(days=1)
    
    all_data["product_analytics"] = all_analytics
    print(f"  ✅ 产品分析总计: {len(all_analytics)} 条记录")
    
    # 4. 分析广告数据
    if all_analytics:
        ad_records = [r for r in all_analytics if float(r.get('adCostThis', 0)) > 0]
        print(f"\n📈 广告数据统计:")
        print(f"  包含广告数据: {len(ad_records)} 条记录")
        
        if ad_records:
            total_ad_cost = sum(float(r.get('adCostThis', 0)) for r in ad_records)
            total_ad_sales = sum(float(r.get('adTotalSalesThis', 0)) for r in ad_records)
            print(f"  💰 总广告花费: ${total_ad_cost:.2f}")
            print(f"  💰 总广告销售: ${total_ad_sales:.2f}")
    
    # 5. 输出汇总
    total_records = len(all_data.get("fba_inventory", [])) + \
                   len(all_data.get("inventory_details", [])) + \
                   len(all_data.get("product_analytics", []))
    
    print(f"\n✅ 数据获取完成！")
    print(f"📊 总记录数: {total_records}")
    print(f"  FBA库存: {len(all_data.get('fba_inventory', []))}")
    print(f"  库存明细: {len(all_data.get('inventory_details', []))}")
    print(f"  产品分析: {len(all_data.get('product_analytics', []))}")
    
    # 保存结果摘要
    summary = {
        "sync_time": datetime.datetime.now().isoformat(),
        "total_records": total_records,
        "fba_inventory_count": len(all_data.get("fba_inventory", [])),
        "inventory_details_count": len(all_data.get("inventory_details", [])),
        "product_analytics_count": len(all_data.get("product_analytics", [])),
        "ad_records_count": len(ad_records) if 'all_analytics' in locals() else 0
    }
    
    with open('sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    print("\n📄 结果已保存到 sync_result.json")
    return True

if __name__ == "__main__":
    main()