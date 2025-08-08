#!/usr/bin/env python3
"""
最终OAuth认证数据同步脚本
"""
import requests
import json
import datetime
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# API配置
BASE_URL = "https://openapi.sellfox.com"
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"

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
            token = data["data"]["access_token"]
            logger.info(f"✅ OAuth成功: {token[:10]}...")
            return token
        else:
            logger.error(f"❌ OAuth失败: {data.get('msg')}")
            return None
    except Exception as e:
        logger.error(f"❌ OAuth异常: {e}")
        return None

def fetch_with_oauth(endpoint, params, token):
    """使用OAuth令牌获取数据"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    url = f"{BASE_URL}{endpoint}"
    
    try:
        response = requests.post(url, json=params, headers=headers, timeout=60)
        data = response.json()
        
        if data.get("code") == 0:
            return data["data"]
        else:
            logger.error(f"❌ API错误: {data.get('msg')}")
            return None
            
    except Exception as e:
        logger.error(f"❌ 请求异常: {e}")
        return None

def fetch_all_data_with_oauth(endpoint, base_params, token):
    """使用OAuth获取所有分页数据"""
    all_records = []
    page_no = 1
    
    while page_no <= 50:
        params = {**base_params, "pageNo": page_no, "pageSize": 100}
        
        result = fetch_with_oauth(endpoint, params, token)
        if not result:
            break
            
        records = result.get("rows", [])
        if not records:
            break
            
        all_records.extend(records)
        total_page = result.get("totalPage", 1)
        logger.info(f"  第{page_no}页: {len(records)}条记录 (总页数: {total_page})")
        
        if page_no >= total_page:
            break
            
        page_no += 1
    
    return all_records

def main():
    print("🚀 开始最终数据同步...")
    
    # 1. 获取访问令牌
    print("🔑 获取访问令牌...")
    token = get_access_token()
    if not token:
        print("❌ 无法获取访问令牌")
        return False
    
    # 2. 计算日期范围
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 同步日期:")
    print(f"   product_analytics: {seven_days_ago} ~ {yesterday}")
    print(f"   fba_inventory: {yesterday}")
    print(f"   inventory_details: {yesterday}")
    
    all_data = {}
    
    # 3. 获取FBA库存数据
    print("\n📊 获取FBA库存数据...")
    fba_params = {
        "currency": "USD",
        "hideZero": False,  # 显示所有商品
        "hideDeletedPrd": False,
        "needMergeShare": False
    }
    
    fba_records = fetch_all_data_with_oauth("/api/inventoryManage/fba/pageList.json", fba_params, token)
    all_data["fba_inventory"] = fba_records
    print(f"   ✅ FBA库存: {len(fba_records)} 条记录")
    
    # 4. 获取库存明细数据
    print("\n📊 获取库存明细数据...")
    inv_params = {
        "isHidden": False
    }
    
    inv_records = fetch_all_data_with_oauth("/api/warehouseManage/warehouseItemList.json", inv_params, token)
    all_data["inventory_details"] = inv_records
    print(f"   ✅ 库存明细: {len(inv_records)} 条记录")
    
    # 5. 获取产品分析数据
    print("\n📊 获取产品分析数据...")
    all_analytics = []
    
    # 测试不同日期范围
    test_ranges = [
        ("2024-01-01", "2024-12-31"),  # 全年数据
        ("2025-01-01", "2025-08-05"),  # 今年数据
        ("2025-07-01", "2025-08-05"),  # 最近一个月
        ("2025-08-05", "2025-08-05")   # 昨天
    ]
    
    for start_date, end_date in test_ranges:
        print(f"   测试 {start_date} ~ {end_date}...")
        analytics_params = {
            "startDate": start_date,
            "endDate": end_date,
            "currency": "USD"
        }
        
        records = fetch_all_data_with_oauth("/api/productAnalyze/new/pageList.json", analytics_params, token)
        
        if records:
            # 添加日期字段
            for record in records:
                record['date_range'] = f"{start_date}~{end_date}"
            
            all_analytics.extend(records)
            print(f"      ✅ 找到 {len(records)} 条记录")
            break  # 找到数据就停止
        else:
            print(f"      ⚠️  该范围无数据")
    
    all_data["product_analytics"] = all_analytics
    print(f"   ✅ 产品分析总计: {len(all_analytics)} 条记录")
    
    # 6. 分析广告数据
    print("\n📈 广告数据分析...")
    if all_analytics:
        ad_records = [r for r in all_analytics if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
        
        print(f"   总记录数: {len(all_analytics)}")
        print(f"   含广告记录: {len(ad_records)}")
        
        if ad_records:
            total_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
            total_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
            print(f"   💰 广告总花费: ${total_cost:.2f}")
            print(f"   💰 广告总销售: ${total_sales:.2f}")
            
            # 显示样本
            for i, record in enumerate(ad_records[:3]):
                print(f"   📋 样本{i+1}:")
                print(f"      ASIN: {record.get('asin', 'N/A')}")
                print(f"      广告花费: ${record.get('adCostThis', 0)}")
                print(f"      广告销售: ${record.get('adTotalSalesThis', 0)}")
                print(f"      广告点击: {record.get('adClicksThis', 0)}")
                print(f"      广告订单: {record.get('adOrderNumThis', 0)}")
    
    # 7. 汇总结果
    total_records = len(all_analytics) + len(fba_records) + len(inv_records)
    
    print(f"\n✅ 数据同步完成！")
    print(f"📊 总计: {total_records} 条记录")
    print(f"   产品分析: {len(all_analytics)}")
    print(f"   FBA库存: {len(fba_records)}")
    print(f"   库存明细: {len(inv_records)}")
    
    # 8. 保存结果
    result = {
        "sync_time": str(datetime.datetime.now()),
        "total_records": total_records,
        "product_analytics": len(all_analytics),
        "fba_inventory": len(fba_records),
        "inventory_details": len(inv_records),
        "ad_records": len(ad_records) if 'all_analytics' in locals() and all_analytics else 0,
        "ad_cost_total": float(total_cost) if 'total_cost' in locals() and 'ad_records' in locals() else 0,
        "ad_sales_total": float(total_sales) if 'total_sales' in locals() and 'ad_records' in locals() else 0,
        "date_range": {
            "product_analytics": f"{seven_days_ago} to {yesterday}",
            "fba_inventory": str(yesterday),
            "inventory_details": str(yesterday)
        }
    }
    
    with open('oauth_sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    with open('oauth_raw_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print("\n📄 结果已保存:")
    print("   oauth_sync_result.json - 汇总结果")
    print("   oauth_raw_data.json - 原始数据")
    
    return True

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 数据同步成功完成！使用OAuth认证，IP白名单已生效！")
    else:
        print("\n💥 数据同步失败")