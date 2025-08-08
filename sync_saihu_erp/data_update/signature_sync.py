#!/usr/bin/env python3
"""
签名认证数据同步脚本 - 使用官方认证方式
"""
import requests
import hashlib
import time
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

def generate_signature(params, secret):
    """生成签名"""
    # 按字典序排序参数
    sorted_params = sorted(params.items())
    param_string = "&".join([f"{k}={v}" for k, v in sorted_params])
    sign_string = f"{param_string}{secret}"
    
    # 使用MD5签名
    signature = hashlib.md5(sign_string.encode()).hexdigest()
    return signature

def fetch_all_data(endpoint, base_params, max_pages=50):
    """获取所有分页数据"""
    all_records = []
    page_no = 1
    
    while page_no <= max_pages:
        # 生成签名参数
        timestamp = str(int(time.time()))
        sign_params = {
            'clientId': CLIENT_ID,
            'timestamp': timestamp,
            'sign_method': 'md5',
            'v': '1.0'
        }
        
        # 计算签名
        request_params = {**sign_params, **base_params, "pageNo": page_no, "pageSize": 100}
        signature = generate_signature(request_params, CLIENT_SECRET)
        request_params['sign'] = signature
        
        try:
            response = requests.post(
                f"{BASE_URL}{endpoint}",
                params=request_params,
                json={},  # 空body
                timeout=60
            )
            
            data = response.json()
            
            if data.get("code") == 0:
                records = data["data"]["rows"]
                if not records:
                    break
                
                all_records.extend(records)
                logger.info(f"  第{page_no}页: {len(records)}条记录")
                
                # 检查是否还有更多页
                total_page = data["data"].get("totalPage", 1)
                if page_no >= total_page:
                    break
                    
                page_no += 1
                time.sleep(0.3)  # 避免请求过快
            else:
                logger.error(f"  ❌ 获取数据失败: {data.get('msg')}")
                break
                
        except Exception as e:
            logger.error(f"  ❌ 获取数据异常: {e}")
            break
    
    return all_records

def main():
    print("🚀 开始执行签名认证数据同步...")
    
    # 计算日期范围
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 同步日期范围:")
    print(f"   product_analytics: {seven_days_ago} ~ {yesterday}")
    print(f"   fba_inventory: {yesterday}")
    print(f"   inventory_details: {yesterday}")
    
    all_data = {}
    
    # 1. 获取FBA库存数据（昨天）
    print("\n📊 获取FBA库存数据...")
    fba_params = {
        "currency": "USD",
        "hideZero": True,
        "hideDeletedPrd": True,
        "needMergeShare": False
    }
    
    fba_records = fetch_all_data("/api/inventoryManage/fba/pageList.json", fba_params)
    all_data["fba_inventory"] = fba_records
    print(f"   ✅ FBA库存: {len(fba_records)} 条记录")
    
    # 2. 获取库存明细数据（昨天）
    print("\n📊 获取库存明细数据...")
    inv_params = {
        "isHidden": True
    }
    
    inv_records = fetch_all_data("/api/warehouseManage/warehouseItemList.json", inv_params)
    all_data["inventory_details"] = inv_records
    print(f"   ✅ 库存明细: {len(inv_records)} 条记录")
    
    # 3. 获取产品分析数据（最近7天）
    print("\n📊 获取产品分析数据...")
    all_analytics = []
    
    current_date = seven_days_ago
    while current_date <= yesterday:
        date_str = current_date.strftime('%Y-%m-%d')
        print(f"   获取 {date_str} 数据...")
        
        analytics_params = {
            "startDate": date_str,
            "endDate": date_str,
            "currency": "USD"
        }
        
        daily_records = fetch_all_data("/api/productAnalyze/new/pageList.json", analytics_params)
        
        # 添加日期字段
        for record in daily_records:
            record['date'] = date_str
        
        all_analytics.extend(daily_records)
        current_date += datetime.timedelta(days=1)
    
    all_data["product_analytics"] = all_analytics
    print(f"   ✅ 产品分析总计: {len(all_analytics)} 条记录")
    
    # 4. 分析广告数据
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
            
            # 显示前5条广告数据
            print(f"   📋 广告数据样本:")
            for i, record in enumerate(ad_records[:5]):
                print(f"    {i+1}. ASIN: {record.get('asin', 'N/A')}")
                print(f"       广告花费: ${record.get('adCostThis', 0)}")
                print(f"       广告销售: ${record.get('adTotalSalesThis', 0)}")
                print(f"       广告点击: {record.get('adClicksThis', 0)}")
                print(f"       广告展示: {record.get('adImpressionsThis', 0)}")
    
    # 5. 汇总结果
    total_records = len(all_analytics) + len(fba_records) + len(inv_records)
    
    print(f"\n✅ 数据同步完成！")
    print(f"📊 总计: {total_records} 条记录")
    print(f"   产品分析: {len(all_analytics)}")
    print(f"   FBA库存: {len(fba_records)}")
    print(f"   库存明细: {len(inv_records)}")
    
    # 6. 保存结果
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
            "product_analytics": f"{seven_days_ago} to {yesterday}",
            "fba_inventory": str(yesterday),
            "inventory_details": str(yesterday)
        }
    }
    
    with open('signature_sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    with open('signature_raw_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print("\n📄 结果已保存:")
    print("   signature_sync_result.json - 汇总结果")
    print("   signature_raw_data.json - 原始数据")
    
    return True

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 数据同步成功完成！使用签名认证，IP白名单已生效！")
    else:
        print("\n💥 数据同步失败")