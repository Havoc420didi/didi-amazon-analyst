#!/usr/bin/env python3
"""
使用OAuth客户端获取实际业务数据
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import datetime
from src.auth.oauth_client import oauth_client

def fetch_all_data():
    """使用OAuth客户端获取所有数据"""
    print("🎯 使用OAuth客户端获取实际业务数据")
    print("=" * 60)
    
    # 1. 测试连接和获取token
    print("🔑 测试OAuth连接...")
    if not oauth_client.test_connection():
        print("❌ OAuth连接失败")
        return None
    
    token_info = oauth_client.get_token_info()
    print(f"✅ OAuth连接成功: {token_info['token_preview']}")
    
    # 2. 计算日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 数据日期:")
    print(f"   产品分析: {seven_days_ago} ~ {yesterday}")
    print(f"   FBA库存: {yesterday}")
    print(f"   库存明细: {yesterday}")
    
    results = {}
    total_found = 0
    
    # 3. 获取产品分析数据
    print("\n📊 获取产品分析数据...")
    response = oauth_client.make_authenticated_request(
        method="POST",
        endpoint="/api/productAnalyze/new/pageList.json",
        data={
            "startDate": str(yesterday),
            "endDate": str(yesterday),
            "pageNo": 1,
            "pageSize": 100,
            "currency": "USD"
        }
    )
    
    if response and response.status_code == 200:
        data = response.json()
        if data.get("code") == 0:
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            results["product_analytics"] = records
            total_found += len(records)
            print(f"   ✅ 产品分析: {len(records)}条记录 (总计: {total})")
            
            # 分析广告数据
            ad_records = [r for r in records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
            if ad_records:
                print(f"   💰 广告数据: {len(ad_records)}条")
                total_ad_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
                total_ad_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
                print(f"   💰 广告总花费: ${total_ad_cost:.2f}")
                print(f"   💰 广告总销售: ${total_ad_sales:.2f}")
                
                # 显示前3条广告数据
                for i, ad in enumerate(ad_records[:3]):
                    print(f"   📋 广告{i+1}: ASIN={ad.get('asin', 'N/A')} 花费=${ad.get('adCostThis', 0)} 销售=${ad.get('adTotalSalesThis', 0)}")
        else:
            print(f"   ❌ API错误: {data.get('msg')}")
            results["product_analytics"] = []
    else:
        print(f"   ❌ 请求失败: {response.status_code if response else '无响应'}")
        results["product_analytics"] = []
    
    # 4. 获取FBA库存数据
    print("\n📊 获取FBA库存数据...")
    response = oauth_client.make_authenticated_request(
        method="POST",
        endpoint="/api/inventoryManage/fba/pageList.json",
        data={
            "pageNo": 1,
            "pageSize": 100,
            "currency": "USD",
            "hideZero": False
        }
    )
    
    if response and response.status_code == 200:
        data = response.json()
        if data.get("code") == 0:
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            results["fba_inventory"] = records
            total_found += len(records)
            print(f"   ✅ FBA库存: {len(records)}条记录 (总计: {total})")
        else:
            print(f"   ❌ API错误: {data.get('msg')}")
            results["fba_inventory"] = []
    else:
        print(f"   ❌ 请求失败: {response.status_code if response else '无响应'}")
        results["fba_inventory"] = []
    
    # 5. 获取库存明细数据
    print("\n📊 获取库存明细数据...")
    response = oauth_client.make_authenticated_request(
        method="POST",
        endpoint="/api/warehouseManage/warehouseItemList.json",
        data={
            "pageNo": 1,
            "pageSize": 100,
            "isHidden": False
        }
    )
    
    if response and response.status_code == 200:
        data = response.json()
        if data.get("code") == 0:
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            results["inventory_details"] = records
            total_found += len(records)
            print(f"   ✅ 库存明细: {len(records)}条记录 (总计: {total})")
        else:
            print(f"   ❌ API错误: {data.get('msg')}")
            results["inventory_details"] = []
    else:
        print(f"   ❌ 请求失败: {response.status_code if response else '无响应'}")
        results["inventory_details"] = []
    
    # 6. 汇总结果
    print("\n" + "=" * 60)
    print("✅ 数据获取完成！")
    print(f"📊 总计: {total_found} 条记录")
    print(f"   产品分析: {len(results.get('product_analytics', []))}")
    print(f"   FBA库存: {len(results.get('fba_inventory', []))}")
    print(f"   库存明细: {len(results.get('inventory_details', []))}")
    
    # 7. 保存结果
    final_result = {
        "sync_time": str(datetime.datetime.now()),
        "total_records": total_found,
        "data_summary": {
            "product_analytics": len(results.get('product_analytics', [])),
            "fba_inventory": len(results.get('fba_inventory', [])),
            "inventory_details": len(results.get('inventory_details', []))
        },
        "date_range": {
            "product_analytics": f"{seven_days_ago} to {yesterday}",
            "fba_inventory": str(yesterday),
            "inventory_details": str(yesterday)
        }
    }
    
    # 保存汇总结果
    with open('final_sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(final_result, f, ensure_ascii=False, indent=2)
    
    # 保存详细数据
    with open('final_raw_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("\n📄 结果已保存:")
    print("   final_sync_result.json - 汇总结果")
    print("   final_raw_data.json - 详细数据")
    
    return results

if __name__ == "__main__":
    results = fetch_all_data()
    if results:
        total = sum(len(v) for v in results.values())
        if total > 0:
            print(f"\n🎉 成功获取到{total}条实际业务数据！")
        else:
            print("\n⚠️ 获取成功但无数据，建议联系赛狐技术支持")
    else:
        print("\n💥 数据获取失败")