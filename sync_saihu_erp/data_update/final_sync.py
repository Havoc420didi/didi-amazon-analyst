#!/usr/bin/env python3
"""
最终数据同步脚本 - 使用OAuth认证
"""
import requests
import json
import datetime
import time

# API配置
BASE_URL = "https://openapi.sellfox.com"
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"

def get_access_token():
    """获取OAuth访问令牌"""
    response = requests.get(
        f"{BASE_URL}/api/oauth/v2/token.json",
        params={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "client_credentials"
        },
        timeout=30
    )
    return response.json()

def fetch_all_data(endpoint, data_params, headers, description):
    """获取所有分页数据"""
    print(f"📋 {description}")
    
    all_records = []
    page_no = 1
    
    while True:
        params = {**data_params, "pageNo": page_no, "pageSize": 100}
        
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=params,
            headers=headers,
            timeout=60
        )
        
        result = response.json()
        
        if result.get("code") == 0:
            records = result["data"]["rows"]
            if not records:
                break
            
            all_records.extend(records)
            print(f"   第{page_no}页: {len(records)}条记录")
            
            # 检查是否还有更多页
            total_page = result["data"].get("totalPage", 1)
            if page_no >= total_page:
                break
                
            page_no += 1
            time.sleep(1)
        else:
            print(f"   ❌ 错误: {result.get('msg', '未知错误')}")
            break
    
    return all_records

def main():
    print("🚀 开始最终数据同步...")
    
    # 1. 获取访问令牌
    print("🔑 获取访问令牌...")
    token_result = get_access_token()
    
    if token_result.get("code") != 0:
        print(f"❌ 获取token失败: {token_result.get('msg')}")
        return False
    
    access_token = token_result["data"]["access_token"]
    print(f"   ✅ Token获取成功")
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # 2. 计算日期范围
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 同步日期:")
    print(f"   product_analytics: {seven_days_ago} ~ {yesterday}")
    print(f"   fba_inventory: {yesterday}")
    print(f"   inventory_details: {yesterday}")
    
    all_data = {}
    
    # 3. 获取产品分析数据（最近7天）
    print("\n📊 获取产品分析数据...")
    all_analytics = []
    
    current_date = seven_days_ago
    while current_date <= yesterday:
        date_str = current_date.strftime('%Y-%m-%d')
        
        data = {
            "startDate": date_str,
            "endDate": date_str,
            "pageNo": 1,
            "pageSize": 100,
            "currency": "USD"
        }
        
        records = fetch_all_data(
            "/api/productAnalyze/new/pageList.json", 
            data, 
            headers, 
            f"获取 {date_str} 数据"
        )
        
        # 添加日期字段
        for record in records:
            record['date'] = date_str
        
        all_analytics.extend(records)
        current_date += datetime.timedelta(days=1)
    
    all_data["product_analytics"] = all_analytics
    
    # 4. 获取FBA库存数据（昨天）
    print("\n📊 获取FBA库存数据...")
    fba_data = {
        "pageNo": 1,
        "pageSize": 100,
        "currency": "USD",
        "hideZero": True,
        "hideDeletedPrd": True,
        "needMergeShare": False
    }
    
    fba_records = fetch_all_data(
        "/api/inventoryManage/fba/pageList.json",
        fba_data,
        headers,
        "获取FBA库存"
    )
    all_data["fba_inventory"] = fba_records
    
    # 5. 获取库存明细数据（昨天）
    print("\n📊 获取库存明细数据...")
    inv_data = {
        "pageNo": 1,
        "pageSize": 100,
        "isHidden": True
    }
    
    inv_records = fetch_all_data(
        "/api/warehouseManage/warehouseItemList.json",
        inv_data,
        headers,
        "获取库存明细"
    )
    all_data["inventory_details"] = inv_records
    
    # 6. 分析广告数据
    print("\n📈 分析广告数据...")
    if all_analytics:
        ad_records = [r for r in all_analytics if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
        
        print(f"   总记录数: {len(all_analytics)}")
        print(f"   广告记录数: {len(ad_records)}")
        
        if ad_records:
            total_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
            total_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
            print(f"   总广告花费: ${total_cost:.2f}")
            print(f"   总广告销售: ${total_sales:.2f}")
            
            # 显示样本
            sample = ad_records[0]
            print(f"   样本ASIN: {sample.get('asin', 'N/A')}")
            print(f"   样本广告花费: ${sample.get('adCostThis', 0)}")
            print(f"   样本广告销售: ${sample.get('adTotalSalesThis', 0)}")
    
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
        "ad_records": len(ad_records) if 'ad_records' in locals() else 0,
        "ad_cost_total": float(total_cost) if 'total_cost' in locals() else 0,
        "ad_sales_total": float(total_sales) if 'total_sales' in locals() else 0,
        "date_range": {
            "start": str(seven_days_ago),
            "end": str(yesterday)
        }
    }
    
    with open('final_sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # 9. 保存原始数据
    with open('sync_raw_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print("\n📄 结果已保存:")
    print("   final_sync_result.json - 汇总结果")
    print("   sync_raw_data.json - 原始数据")
    
    return True

if __name__ == "__main__":
    main()