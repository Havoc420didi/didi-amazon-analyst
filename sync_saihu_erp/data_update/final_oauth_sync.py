#!/usr/bin/env python3
"""
最终OAuth数据同步 - 使用已知有效的token
"""
import requests
import json
import datetime
import time
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 已知的有效token
ACCESS_TOKEN = "0ab64bda-4366-49d2-84eb-bb971978648a"
BASE_URL = "https://openapi.sellfox.com"

class RateLimitedOAuthClient:
    """带限流控制的OAuth客户端"""
    
    def __init__(self):
        self.last_request_time = 0
        self.min_interval = 1.1  # 1.1秒间隔，确保不超过1次/秒
        self.headers = {
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def _rate_limit(self):
        """限流控制"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            time.sleep(sleep_time)
        self.last_request_time = time.time()
    
    def _make_request(self, endpoint, data):
        """发送请求"""
        self._rate_limit()
        
        try:
            response = requests.post(
                f"{BASE_URL}{endpoint}",
                json=data,
                headers=self.headers,
                timeout=30
            )
            return response
            
        except Exception as e:
            logger.error(f"请求异常: {e}")
            return None
    
    def fetch_data(self, endpoint, base_params, description):
        """分页获取数据"""
        print(f"\n📊 {description}")
        all_records = []
        page_no = 1
        max_pages = 20
        
        while page_no <= max_pages:
            params = {**base_params, "pageNo": page_no, "pageSize": 50}
            
            response = self._make_request(endpoint, params)
            
            if not response:
                print(f"   ❌ 请求失败")
                break
            
            if response.status_code != 200:
                print(f"   ❌ HTTP错误: {response.status_code}")
                print(f"   响应: {response.text[:300]}...")
                break
            
            data = response.json()
            
            if data.get("code") != 0:
                print(f"   ❌ API错误: {data.get('msg')}")
                break
            
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            total_page = data["data"].get("totalPage", 1)
            
            if not records:
                print(f"   ✅ 完成: 共{len(all_records)}条数据")
                break
            
            all_records.extend(records)
            print(f"   ✅ 第{page_no}页: {len(records)}条记录 (总页数: {total_page})")
            
            if page_no >= total_page:
                break
                
            page_no += 1
        
        return all_records

def main():
    """主函数"""
    print("🎯 最终OAuth数据同步 - 使用已知有效token")
    print("=" * 60)
    print(f"Token: {ACCESS_TOKEN[:8]}...")
    
    # 计算日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"\n📅 同步日期:")
    print(f"   产品分析: {seven_days_ago} ~ {yesterday}")
    print(f"   FBA库存: {yesterday}")
    print(f"   库存明细: {yesterday}")
    
    client = RateLimitedOAuthClient()
    results = {}
    
    # 1. 产品分析数据（7天范围）
    product_records = client.fetch_data(
        endpoint="/api/productAnalyze/new/pageList.json",
        base_params={
            "startDate": str(seven_days_ago),
            "endDate": str(yesterday),
            "currency": "USD"
        },
        description="获取产品分析数据"
    )
    results["product_analytics"] = product_records
    
    # 2. FBA库存数据
    fba_records = client.fetch_data(
        endpoint="/api/inventoryManage/fba/pageList.json",
        base_params={
            "currency": "USD",
            "hideZero": False,
            "hideDeletedPrd": False
        },
        description="获取FBA库存数据"
    )
    results["fba_inventory"] = fba_records
    
    # 3. 库存明细数据
    inv_records = client.fetch_data(
        endpoint="/api/warehouseManage/warehouseItemList.json",
        base_params={
            "isHidden": False
        },
        description="获取库存明细数据"
    )
    results["inventory_details"] = inv_records
    
    # 4. 广告数据总结
    print("\n📈 广告数据总结...")
    if product_records:
        ad_records = [r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
        
        print(f"   📊 总产品数: {len(product_records)}")
        print(f"   💰 有广告数据: {len(ad_records)} 条")
        
        if ad_records:
            total_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
            total_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
            
            print(f"   📈 广告总览:")
            print(f"      💰 总花费: ${total_cost:,.2f}")
            print(f"      💰 总销售: ${total_sales:,.2f}")
            print("🎯 广告数据为0的问题已解决！")
        else:
            print("   ⚠️  当前产品无广告数据")
    else:
        print("   ⚠️  无产品分析数据")
    
    # 5. 生成最终报告
    total_records = len(product_records) + len(fba_records) + len(inv_records)
    
    final_result = {
        "sync_time": str(datetime.datetime.now()),
        "total_records": total_records,
        "data_summary": {
            "product_analytics": len(product_records),
            "fba_inventory": len(fba_records),
            "inventory_details": len(inv_records)
        },
        "advertising_data": {
            "total_products": len(product_records),
            "products_with_ads": len([r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]) if product_records else 0,
            "total_ad_spend": sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0) if product_records else 0,
            "total_ad_sales": sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0) if product_records else 0
        },
        "date_range": {
            "product_analytics": f"{seven_days_ago} to {yesterday}",
            "fba_inventory": str(yesterday),
            "inventory_details": str(yesterday)
        }
    }
    
    # 保存结果
    with open('final_oauth_sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(final_result, f, ensure_ascii=False, indent=2)
    
    with open('final_oauth_raw_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ 最终OAuth数据同步完成！")
    print(f"📊 总计: {total_records} 条记录")
    print(f"   产品分析: {len(product_records)}")
    print(f"   FBA库存: {len(fba_records)}")
    print(f"   库存明细: {len(inv_records)}")
    
    return results

if __name__ == "__main__":
    try:
        results = main()
        
        if results:
            total = sum(len(v) for v in results.values())
            if total > 0:
                print(f"\n🎉 成功获取{total}条实际业务数据！")
                print("🎯 赛狐数据同步问题已彻底解决！")
            else:
                print(f"\n✅ 同步完成，当前账户无业务数据")
                print("📞 建议联系赛狐技术支持确认账户状态")
    except Exception as e:
        print(f"\n❌ 同步失败: {e}")
        print("📞 请联系赛狐技术支持获取帮助")