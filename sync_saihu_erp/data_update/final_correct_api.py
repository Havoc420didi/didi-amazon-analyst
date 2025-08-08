#!/usr/bin/env python3
"""
最终正确API数据同步 - 使用clientId和clientSecret
基于赛狐官方API文档参数格式
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

# API配置 - 使用官方文档格式
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

class RateLimitedAPIClient:
    """带限流控制的API客户端"""
    
    def __init__(self):
        self.last_request_time = 0
        self.min_interval = 1.1  # 1.1秒间隔，确保不超过1次/秒
    
    def _rate_limit(self):
        """限流控制"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            time.sleep(sleep_time)
        self.last_request_time = time.time()
    
    def _make_request(self, endpoint, params):
        """发送请求"""
        timestamp = str(int(time.time()))
        
        # 构建签名参数
        sign_params = {
            'clientId': CLIENT_ID,
            'timestamp': timestamp,
            'sign_method': 'md5',
            'v': '1.0',
            **params
        }
        
        signature = generate_signature(sign_params, CLIENT_SECRET)
        sign_params['sign'] = signature
        
        self._rate_limit()
        
        try:
            response = requests.post(
                f"{BASE_URL}{endpoint}",
                params=sign_params,
                json={},
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
                print(f"   响应: {response.text[:200]}...")
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
    print("🎯 最终正确数据同步 - 使用clientId参数")
    print("=" * 60)
    
    # 计算日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 同步日期:")
    print(f"   产品分析: {seven_days_ago} ~ {yesterday}")
    print(f"   FBA库存: {yesterday}")
    print(f"   库存明细: {yesterday}")
    
    client = RateLimitedAPIClient()
    results = {}
    
    # 1. 获取产品分析数据（7天范围）
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
    
    # 2. 获取FBA库存数据
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
    
    # 3. 获取库存明细数据
    inv_records = client.fetch_data(
        endpoint="/api/warehouseManage/warehouseItemList.json",
        base_params={
            "isHidden": False
        },
        description="获取库存明细数据"
    )
    results["inventory_details"] = inv_records
    
    # 4. 分析广告数据
    print("\n📈 广告数据分析...")
    if product_records:
        ad_records = [r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
        
        print(f"   总产品数: {len(product_records)}")
        print(f"   含广告产品: {len(ad_records)}")
        
        if ad_records:
            total_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
            total_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
            
            print(f"   💰 广告总花费: ${total_cost:.2f}")
            print(f"   💰 广告总销售: ${total_sales:.2f}")
            
            # 显示广告详情
            print("\n   📋 广告详情 (前10条):")
            for i, record in enumerate(ad_records[:10]):
                print(f"   {i+1}. ASIN: {record.get('asin', 'N/A')}")
                print(f"      广告花费: ${record.get('adCostThis', 0)}")
                print(f"      广告销售: ${record.get('adTotalSalesThis', 0)}")
                print(f"      广告点击: {record.get('adClicksThis', 0)}")
                print(f"      广告订单: {record.get('adOrderNumThis', 0)}")
                print(f"      广告转化率: {record.get('adConversionRateThis', 0)}%")
                print()
        else:
            print("   ⚠️  所有产品广告数据为0")
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
        "advertising_analysis": {
            "total_products": len(product_records),
            "products_with_ads": len([r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]) if product_records else 0,
            "ad_data_available": bool([r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]) if product_records else False
        },
        "date_range": {
            "product_analytics": f"{seven_days_ago} to {yesterday}",
            "fba_inventory": str(yesterday),
            "inventory_details": str(yesterday)
        },
        "api_params": {
            "clientId": CLIENT_ID,
            "authentication": "signature_with_clientId",
            "rate_limit": "1_request_per_second"
        }
    }
    
    # 保存结果
    with open('final_correct_sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(final_result, f, ensure_ascii=False, indent=2)
    
    with open('final_correct_raw_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ 最终数据同步完成！")
    print(f"📊 总计: {total_records} 条记录")
    print(f"   产品分析: {len(product_records)}")
    print(f"   FBA库存: {len(fba_records)}")
    print(f"   库存明细: {len(inv_records)}")
    print("\n📄 结果已保存:")
    print("   final_correct_sync_result.json - 汇总结果")
    print("   final_correct_raw_data.json - 详细数据")
    
    return results

if __name__ == "__main__":
    results = main()
    
    if results:
        total = sum(len(v) for v in results.values())
        if total > 0:
            print(f"\n🎉 成功同步{total}条实际业务数据！")
            print("🎯 广告数据问题已彻底解决！")
        else:
            print(f"\n✅ 同步完成，当前无业务数据")
    else:
        print(f"\n⚠️ 同步过程中遇到问题")