#!/usr/bin/env python3
"""
正确API数据同步 - 使用官方推荐格式
"""
import requests
import json
import datetime
import hashlib
import time
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

def fetch_data(endpoint, base_params, description):
    """获取数据 - 正确的签名方式"""
    print(f"\n📊 {description}")
    
    all_records = []
    page_no = 1
    max_pages = 10  # 限制页数避免超时
    
    while page_no <= max_pages:
        timestamp = str(int(time.time()))
        
        # 构建完整的参数
        sign_params = {
            'client_id': CLIENT_ID,
            'timestamp': timestamp,
            'sign_method': 'md5',
            'v': '1.0',
            **base_params,
            'pageNo': page_no,
            'pageSize': 100
        }
        
        signature = generate_signature(sign_params, CLIENT_SECRET)
        sign_params['sign'] = signature
        
        try:
            response = requests.post(
                f"{BASE_URL}{endpoint}",
                params=sign_params,
                json={},  # 空body
                timeout=30
            )
            
            data = response.json()
            
            if data.get("code") == 0:
                records = data["data"]["rows"]
                total = data["data"].get("totalCount", 0)
                total_page = data["data"].get("totalPage", 1)
                
                if not records:
                    print(f"   ⚠️  第{page_no}页: 无数据")
                    break
                
                all_records.extend(records)
                print(f"   ✅ 第{page_no}页: {len(records)}条记录 (共{total}条)")
                
                if page_no >= total_page:
                    break
                    
                page_no += 1
                time.sleep(0.5)
            else:
                print(f"   ❌ 错误: {data.get('msg')}")
                break
                
        except Exception as e:
            print(f"   ❌ 异常: {e}")
            break
    
    return all_records

def main():
    print("🚀 开始最终数据同步...")
    print("=" * 60)
    
    # 计算日期范围
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 同步日期:")
    print(f"   产品分析: {seven_days_ago} ~ {yesterday}")
    print(f"   FBA库存: {yesterday}")
    print(f"   库存明细: {yesterday}")
    
    all_data = {}
    
    # 1. 获取产品分析数据
    print("\n📊 获取产品分析数据...")
    analytics_params = {
        "startDate": str(yesterday),
        "endDate": str(yesterday),
        "currency": "USD"
    }
    
    analytics_records = fetch_data(
        "/api/productAnalyze/new/pageList.json", 
        analytics_params,
        "产品分析数据"
    )
    
    # 为每条记录添加日期
    for record in analytics_records:
        record['sync_date'] = str(yesterday)
    
    all_data["product_analytics"] = analytics_records
    
    # 2. 获取FBA库存数据
    print("\n📊 获取FBA库存数据...")
    fba_params = {
        "currency": "USD",
        "hideZero": False,  # 显示所有商品
        "hideDeletedPrd": False,
        "needMergeShare": False
    }
    
    fba_records = fetch_data(
        "/api/inventoryManage/fba/pageList.json",
        fba_params,
        "FBA库存数据"
    )
    all_data["fba_inventory"] = fba_records
    
    # 3. 获取库存明细数据
    print("\n📊 获取库存明细数据...")
    inv_params = {
        "isHidden": False
    }
    
    inv_records = fetch_data(
        "/api/warehouseManage/warehouseItemList.json",
        inv_params,
        "库存明细数据"
    )
    all_data["inventory_details"] = inv_records
    
    # 4. 分析广告数据
    print("\n📈 广告数据分析...")
    if analytics_records:
        ad_records = [r for r in analytics_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
        
        print(f"   总记录数: {len(analytics_records)}")
        print(f"   含广告记录: {len(ad_records)}")
        
        if ad_records:
            total_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
            total_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
            
            print(f"   💰 广告总花费: ${total_cost:.2f}")
            print(f"   💰 广告总销售: ${total_sales:.2f}")
            
            # 显示广告详情
            for i, record in enumerate(ad_records[:5]):
                print(f"   📋 广告{i+1}: ASIN={record.get('asin', 'N/A')} 花费=${record.get('adCostThis', 0)} 销售=${record.get('adTotalSalesThis', 0)}")
        else:
            print("   ⚠️  所有记录广告花费为0")
    else:
        print("   ⚠️  无产品分析数据")
    
    # 5. 汇总结果
    total_records = len(analytics_records) + len(fba_records) + len(inv_records)
    
    print("\n" + "=" * 60)
    print("✅ 数据同步完成！")
    print(f"📊 总计: {total_records} 条记录")
    print(f"   产品分析: {len(analytics_records)}")
    print(f"   FBA库存: {len(fba_records)}")
    print(f"   库存明细: {len(inv_records)}")
    
    # 6. 保存结果
    result = {
        "sync_time": str(datetime.datetime.now()),
        "total_records": total_records,
        "product_analytics": len(analytics_records),
        "fba_inventory": len(fba_records),
        "inventory_details": len(inv_records),
        "ad_records": len(ad_records) if 'analytics_records' in locals() and analytics_records else 0,
        "ad_cost_total": float(total_cost) if 'total_cost' in locals() and 'ad_records' in locals() else 0,
        "ad_sales_total": float(total_sales) if 'total_sales' in locals() and 'ad_records' in locals() else 0,
        "date_range": {
            "product_analytics": f"{seven_days_ago} to {yesterday}",
            "fba_inventory": str(yesterday),
            "inventory_details": str(yesterday)
        }
    }
    
    with open('real_data_sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    with open('real_data_raw.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print("\n📄 结果已保存到:")
    print("   real_data_sync_result.json")
    print("   real_data_raw.json")
    
    return total_records > 0

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 真实数据同步成功完成！")
    else:
        print("\n⚠️  同步完成，但可能无数据或需要调整参数")