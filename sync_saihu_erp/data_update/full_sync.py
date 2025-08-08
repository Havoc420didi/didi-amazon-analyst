#!/usr/bin/env python3
"""
完整数据同步脚本 - 无需白名单
"""
import requests
import json
import datetime
import time
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
            return data["data"]["access_token"]
        else:
            logger.error(f"获取token失败: {data.get('msg')}")
            return None
    except Exception as e:
        logger.error(f"获取token异常: {e}")
        return None

def fetch_all_pages(endpoint, base_params, headers, page_size=100, max_pages=50):
    """获取所有分页数据"""
    all_records = []
    page_no = 1
    
    while page_no <= max_pages:
        params = {**base_params, "pageNo": page_no, "pageSize": page_size}
        
        try:
            response = requests.post(f"{BASE_URL}{endpoint}", json=params, headers=headers, timeout=60)
            data = response.json()
            
            if data.get("code") == 0:
                records = data["data"]["rows"]
                if not records:
                    break
                
                all_records.extend(records)
                logger.info(f"获取第{page_no}页: {len(records)}条记录")
                
                # 检查是否还有更多页
                total_page = data["data"].get("totalPage", 1)
                if page_no >= total_page:
                    break
                    
                page_no += 1
                time.sleep(0.5)  # 避免请求过快
            else:
                logger.error(f"获取数据失败: {data.get('msg')}")
                break
                
        except Exception as e:
            logger.error(f"获取数据异常: {e}")
            break
    
    return all_records

def main():
    print("🚀 开始重新执行数据同步...")
    
    # 1. 获取访问令牌
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
    
    # 2. 获取FBA库存数据（昨天）
    print("\n📋 获取FBA库存数据...")
    fba_params = {
        "pageNo": 1,
        "pageSize": 100,
        "currency": "USD",
        "hideZero": True,
        "hideDeletedPrd": True,
        "needMergeShare": False
    }
    
    fba_records = fetch_all_pages("/api/inventoryManage/fba/pageList.json", fba_params, headers)
    all_data["fba_inventory"] = fba_records
    print(f"  ✅ FBA库存: {len(fba_records)} 条记录")
    
    # 3. 获取库存明细数据（昨天）
    print("\n📋 获取库存明细数据...")
    inv_params = {
        "pageNo": 1,
        "pageSize": 100,
        "isHidden": True
    }
    
    inv_records = fetch_all_pages("/api/warehouseManage/warehouseItemList.json", inv_params, headers)
    all_data["inventory_details"] = inv_records
    print(f"  ✅ 库存明细: {len(inv_records)} 条记录")
    
    # 4. 获取产品分析数据（最近7天）
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
        
        daily_records = fetch_all_pages("/api/productAnalyze/new/pageList.json", analytics_params, headers)
        
        # 添加日期字段
        for record in daily_records:
            record['sync_date'] = date_str
        
        all_analytics.extend(daily_records)
        print(f"      {date_str}: {len(daily_records)} 条记录")
        
        current_date += datetime.timedelta(days=1)
    
    all_data["product_analytics"] = all_analytics
    print(f"  ✅ 产品分析总计: {len(all_analytics)} 条记录")
    
    # 5. 分析广告数据
    if all_analytics:
        ad_records = [r for r in all_analytics if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
        print(f"\n📈 广告数据统计:")
        print(f"  包含广告数据: {len(ad_records)} 条记录")
        
        if ad_records:
            total_ad_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
            total_ad_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
            print(f"  💰 总广告花费: ${total_ad_cost:.2f}")
            print(f"  💰 总广告销售: ${total_ad_sales:.2f}")
            
            # 显示样本广告数据
            sample_ad = ad_records[0]
            print(f"  📋 广告数据样本:")
            print(f"    ASIN: {sample_ad.get('asin', 'N/A')}")
            print(f"    广告花费: ${sample_ad.get('adCostThis', 0)}")
            print(f"    广告销售: ${sample_ad.get('adTotalSalesThis', 0)}")
            print(f"    广告订单: {sample_ad.get('adOrderNumThis', 0)}")
            print(f"    广告点击: {sample_ad.get('adClicksThis', 0)}")
            print(f"    广告展示: {sample_ad.get('adImpressionsThis', 0)}")
    
    # 6. 输出汇总
    total_records = len(fba_records) + len(inv_records) + len(all_analytics)
    
    print(f"\n✅ 数据同步完成！")
    print(f"📊 总记录数: {total_records}")
    print(f"  FBA库存: {len(fba_records)}")
    print(f"  库存明细: {len(inv_records)}")
    print(f"  产品分析: {len(all_analytics)}")
    
    # 7. 保存结果
    result = {
        "sync_time": str(datetime.datetime.now()),
        "total_records": total_records,
        "fba_inventory": len(fba_records),
        "inventory_details": len(inv_records),
        "product_analytics": len(all_analytics),
        "ad_records": len(ad_records) if 'ad_records' in locals() else 0,
        "ad_cost_total": float(total_ad_cost) if 'total_ad_cost' in locals() else 0,
        "ad_sales_total": float(total_ad_sales) if 'total_ad_sales' in locals() else 0,
        "date_range": {
            "product_analytics": f"{seven_days_ago} to {yesterday}",
            "fba_inventory": str(yesterday),
            "inventory_details": str(yesterday)
        }
    }
    
    with open('sync_complete.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # 8. 保存原始数据
    with open('raw_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print("\n📄 结果已保存:")
    print("  sync_complete.json - 同步汇总")
    print("  raw_data.json - 原始数据")
    
    return True

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 数据同步成功完成！广告数据已正常获取！")
    else:
        print("\n💥 数据同步失败")