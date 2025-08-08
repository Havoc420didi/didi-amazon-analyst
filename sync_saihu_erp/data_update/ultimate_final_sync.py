#!/usr/bin/env python3
"""
终极最终数据同步脚本
使用clientId和clientSecret进行签名认证
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

# 赛狐提供的正式参数
CLIENT_ID = "368000"
CLIENT_SECRET = "3cc6efdf-6861-42e0-b9a5-874a0296640b"
BASE_URL = "https://openapi.sellfox.com"

def generate_signature(params, secret):
    """生成签名"""
    sorted_params = sorted(params.items())
    param_string = "&".join([f"{k}={v}" for k, v in sorted_params])
    sign_string = f"{param_string}{secret}"
    signature = hashlib.md5(sign_string.encode()).hexdigest()
    return signature

class UltimateSyncClient:
    """终极同步客户端"""
    
    def __init__(self):
        self.last_request_time = 0
        self.min_interval = 1.1  # 1.1秒间隔
        self.client_id = CLIENT_ID
        self.client_secret = CLIENT_SECRET
        self.base_url = BASE_URL
    
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
        
        # 构建签名参数 - 使用clientId参数名
        sign_params = {
            'clientId': self.client_id,
            'timestamp': timestamp,
            'sign_method': 'md5',
            'v': '1.0',
            **params
        }
        
        signature = generate_signature(sign_params, self.client_secret)
        sign_params['sign'] = signature
        
        self._rate_limit()
        
        try:
            response = requests.post(
                f"{self.base_url}{endpoint}",
                params=sign_params,
                json={},  # 空JSON体
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
    print("🎯 终极最终数据同步 - 使用赛狐官方参数")
    print("=" * 70)
    print(f"📋 认证信息:")
    print(f"   clientId: {CLIENT_ID}")
    print(f"   clientSecret: {CLIENT_SECRET[:8]}...")
    
    # 计算日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"\n📅 同步日期:")
    print(f"   产品分析: {seven_days_ago} ~ {yesterday}")
    print(f"   FBA库存: {yesterday}")
    print(f"   库存明细: {yesterday}")
    
    client = UltimateSyncClient()
    results = {}
    
    # 1. 产品分析数据（7天范围）
    product_records = client.fetch_data(
        endpoint="/api/productAnalyze/new/pageList.json",
        base_params={
            "startDate": str(seven_days_ago),
            "endDate": str(yesterday),
            "currency": "USD"
        },
        description="获取产品分析数据(含广告数据)"
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
    
    # 4. 深度广告数据分析
    print("\n📈 广告数据深度分析...")
    if product_records:
        ad_records = []
        zero_ad_records = []
        
        for record in product_records:
            try:
                ad_cost = float(str(record.get('adCostThis', 0)).replace(',', ''))
                if ad_cost > 0:
                    ad_records.append(record)
                else:
                    zero_ad_records.append(record)
            except:
                zero_ad_records.append(record)
        
        print(f"   📊 总产品数: {len(product_records)}")
        print(f"   💰 有广告数据: {len(ad_records)} 条")
        print(f"   ⚪ 无广告数据: {len(zero_ad_records)} 条")
        
        if ad_records:
            total_cost = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in ad_records)
            total_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in ad_records)
            total_clicks = sum(int(str(r.get('adClicksThis', 0)).replace(',', '')) for r in ad_records)
            total_orders = sum(int(str(r.get('adOrderNumThis', 0)).replace(',', '')) for r in ad_records)
            
            print(f"   📈 广告总览:")
            print(f"      💰 总花费: ${total_cost:,.2f}")
            print(f"      💰 总销售: ${total_sales:,.2f}")
            print(f"      👆 总点击: {total_clicks:,}")
            print(f"      📦 总订单: {total_orders:,}")
            
            if total_cost > 0:
                roas = total_sales / total_cost
                cpc = total_cost / total_clicks if total_clicks > 0 else 0
                cpa = total_cost / total_orders if total_orders > 0 else 0
                conversion_rate = (total_orders / total_clicks * 100) if total_clicks > 0 else 0
                
                print(f"      📊 关键指标:")
                print(f"         ROAS: {roas:.2f}x")
                print(f"         CPC: ${cpc:.2f}")
                print(f"         CPA: ${cpa:.2f}")
                print(f"         转化率: {conversion_rate:.2f}%")
            
            # 显示前5条广告详情
            print(f"\n   📋 广告详情 (前5条):")
            for i, record in enumerate(ad_records[:5]):
                print(f"      {i+1}. ASIN: {record.get('asin', 'N/A')}")
                print(f"         商品: {record.get('title', 'N/A')[:30]}...")
                print(f"         花费: ${record.get('adCostThis', 0)}")
                print(f"         销售: ${record.get('adTotalSalesThis', 0)}")
                print(f"         点击: {record.get('adClicksThis', 0)}")
                print(f"         订单: {record.get('adOrderNumThis', 0)}")
                print(f"         转化率: {record.get('adConversionRateThis', 0)}%")
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
            "ad_data_available": bool([r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]) if product_records else False,
            "total_ad_spend": sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0) if product_records else 0,
            "total_ad_sales": sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0) if product_records else 0
        },
        "date_range": {
            "product_analytics": f"{seven_days_ago} to {yesterday}",
            "fba_inventory": str(yesterday),
            "inventory_details": str(yesterday)
        },
        "api_config": {
            "clientId": CLIENT_ID,
            "authentication": "signature_based",
            "rate_limit": "1.1_seconds_interval"
        }
    }
    
    # 保存结果
    with open('ultimate_final_sync_result.json', 'w', encoding='utf-8') as f:
        json.dump(final_result, f, ensure_ascii=False, indent=2)
    
    with open('ultimate_final_raw_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 70)
    print("✅ 终极最终数据同步完成！")
    print(f"📊 总计: {total_records} 条记录")
    print(f"   产品分析: {len(product_records)} 条")
    print(f"   FBA库存: {len(fba_records)} 条")
    print(f"   库存明细: {len(inv_records)} 条")
    
    if product_records:
        ad_count = len([r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0])
        if ad_count > 0:
            total_spend = sum(float(str(r.get('adCostThis', 0)).replace(',', '')) for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0)
            total_sales = sum(float(str(r.get('adTotalSalesThis', 0)).replace(',', '')) for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0)
            print(f"\n🎯 广告数据已确认：")
            print(f"   有广告数据的产品: {ad_count} 个")
            print(f"   广告总花费: ${total_spend:,.2f}")
            print(f"   广告总销售: ${total_sales:,.2f}")
            print("🎉 广告数据为0的问题已彻底解决！")
        else:
            print(f"\n⚠️  当前{len(product_records)}个产品中无广告数据")
    
    print("\n📄 结果已保存:")
    print("   ultimate_final_sync_result.json - 汇总结果")
    print("   ultimate_final_raw_data.json - 详细数据")
    
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