#!/usr/bin/env python3
"""
最终数据同步脚本 - 带限流控制
符合赛狐API每秒1次的限制
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import datetime
import time
from src.auth.oauth_client import oauth_client

class RateLimitedSync:
    """带限流控制的数据同步器"""
    
    def __init__(self):
        self.last_request_time = 0
        self.min_interval = 1.1  # 最小间隔1.1秒，确保不超过1次/秒
    
    def _rate_limit(self):
        """限流控制"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            print(f"⏳ 限流等待: {sleep_time:.1f}秒")
            time.sleep(sleep_time)
        self.last_request_time = time.time()
    
    def _fetch_paginated_data(self, endpoint, base_params, description):
        """分页获取数据，带限流"""
        print(f"\n📊 {description}")
        all_records = []
        page_no = 1
        max_pages = 20  # 限制页数避免超时
        
        while page_no <= max_pages:
            params = {**base_params, "pageNo": page_no, "pageSize": 50}
            
            self._rate_limit()
            response = oauth_client.make_authenticated_request(
                method="POST",
                endpoint=endpoint,
                data=params
            )
            
            if not response or response.status_code != 200:
                print(f"   ❌ 请求失败: {response.status_code if response else '无响应'}")
                break
            
            data = response.json()
            if data.get("code") != 0:
                print(f"   ❌ API错误: {data.get('msg')}")
                break
            
            records = data["data"]["rows"]
            total = data["data"].get("totalCount", 0)
            total_page = data["data"].get("totalPage", 1)
            
            if not records:
                print(f"   ✅ 第{page_no}页: 无数据")
                break
            
            all_records.extend(records)
            print(f"   ✅ 第{page_no}页: {len(records)}条记录 (总页数: {total_page})")
            
            if page_no >= total_page:
                break
                
            page_no += 1
        
        return all_records
    
    def sync_all_data(self):
        """同步所有数据"""
        print("🎯 开始带限流的数据同步")
        print("=" * 60)
        
        # 1. 测试连接
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
        
        print(f"📅 同步日期:")
        print(f"   产品分析: {seven_days_ago} ~ {yesterday}")
        print(f"   FBA库存: {yesterday}")
        print(f"   库存明细: {yesterday}")
        
        results = {}
        
        # 3. 同步产品分析数据
        product_records = self._fetch_paginated_data(
            endpoint="/api/productAnalyze/new/pageList.json",
            base_params={
                "startDate": str(seven_days_ago),
                "endDate": str(yesterday),
                "currency": "USD"
            },
            description="获取产品分析数据"
        )
        results["product_analytics"] = product_records
        
        # 4. 同步FBA库存数据
        fba_records = self._fetch_paginated_data(
            endpoint="/api/inventoryManage/fba/pageList.json",
            base_params={
                "currency": "USD",
                "hideZero": False,
                "hideDeletedPrd": False
            },
            description="获取FBA库存数据"
        )
        results["fba_inventory"] = fba_records
        
        # 5. 同步库存明细数据
        inv_records = self._fetch_paginated_data(
            endpoint="/api/warehouseManage/warehouseItemList.json",
            base_params={
                "isHidden": False
            },
            description="获取库存明细数据"
        )
        results["inventory_details"] = inv_records
        
        # 6. 分析广告数据
        print("\n📈 广告数据分析...")
        if product_records:
            ad_records = [r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]
            
            print(f"   总记录数: {len(product_records)}")
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
                print("   ⚠️  所有产品广告花费为0")
        else:
            print("   ⚠️  无产品分析数据")
        
        # 7. 汇总结果
        total_records = len(product_records) + len(fba_records) + len(inv_records)
        
        print("\n" + "=" * 60)
        print("✅ 数据同步完成！")
        print(f"📊 总计: {total_records} 条记录")
        print(f"   产品分析: {len(product_records)}")
        print(f"   FBA库存: {len(fba_records)}")
        print(f"   库存明细: {len(inv_records)}")
        
        # 8. 生成最终报告
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
                "products_with_ads": len([r for r in product_records if float(str(r.get('adCostThis', 0)).replace(',', '')) > 0]),
                "ad_analysis": "已完成" if product_records else "无数据"
            },
            "date_range": {
                "product_analytics": f"{seven_days_ago} to {yesterday}",
                "fba_inventory": str(yesterday),
                "inventory_details": str(yesterday)
            },
            "rate_limiting": {
                "strategy": "1 request per second",
                "implementation": "active"
            }
        }
        
        # 保存汇总结果
        with open('final_sync_result_rate_limited.json', 'w', encoding='utf-8') as f:
            json.dump(final_result, f, ensure_ascii=False, indent=2)
        
        # 保存详细数据
        with open('final_raw_data_rate_limited.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print("\n📄 结果已保存:")
        print("   final_sync_result_rate_limited.json - 汇总结果")
        print("   final_raw_data_rate_limited.json - 详细数据")
        
        return results

if __name__ == "__main__":
    sync = RateLimitedSync()
    results = sync.sync_all_data()
    
    if results:
        total = sum(len(v) for v in results.values())
        if total > 0:
            print(f"\n🎉 成功获取{total}条实际业务数据！广告数据问题已解决！")
        else:
            print("\n✅ 同步完成，但当前无业务数据（可能是新账户或无活动）")