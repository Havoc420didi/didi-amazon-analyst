#!/usr/bin/env python3
"""
立即执行数据同步脚本
"""
import sys
import os
import datetime
import logging

# 添加路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from auth.saihu_api_client import saihu_api_client
from auth.oauth_client import oauth_client

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    print("🔄 开始重新同步数据...")
    
    # 获取OAuth token
    token = oauth_client.get_access_token()
    if not token:
        print("❌ API认证失败，请检查配置")
        return False
    
    print("✅ API认证成功")
    
    # 计算日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    seven_days_ago = today - datetime.timedelta(days=7)
    
    print(f"📅 同步日期范围:")
    print(f"  product_analytics: {seven_days_ago} ~ {yesterday}")
    print(f"  fba_inventory: {yesterday}")
    print(f"  inventory_details: {yesterday}")
    
    total_records = 0
    
    try:
        # 1. 获取FBA库存数据
        print("\n📋 获取FBA库存数据...")
        fba_data = saihu_api_client.fetch_all_pages(
            saihu_api_client.fetch_fba_inventory,
            page_size=100
        )
        print(f"  ✅ FBA库存: {len(fba_data)} 条记录")
        total_records += len(fba_data)
        
        # 2. 获取库存明细数据
        print("\n📋 获取库存明细数据...")
        inv_data = saihu_api_client.fetch_all_pages(
            saihu_api_client.fetch_warehouse_inventory,
            page_size=100
        )
        print(f"  ✅ 库存明细: {len(inv_data)} 条记录")
        total_records += len(inv_data)
        
        # 3. 获取产品分析数据（最近7天）
        print("\n📋 获取产品分析数据...")
        all_analytics = []
        current_date = seven_days_ago
        
        while current_date <= yesterday:
            date_str = current_date.strftime('%Y-%m-%d')
            print(f"    获取 {date_str} 的数据...")
            
            daily_data = saihu_api_client.fetch_all_pages(
                lambda **kwargs: saihu_api_client.fetch_product_analytics(
                    start_date=date_str,
                    end_date=date_str,
                    **kwargs
                ),
                page_size=100
            )
            all_analytics.extend(daily_data)
            print(f"      {date_str}: {len(daily_data)} 条记录")
            current_date += datetime.timedelta(days=1)
        
        print(f"  ✅ 产品分析总计: {len(all_analytics)} 条记录")
        total_records += len(all_analytics)
        
        # 检查广告数据
        ad_records = [r for r in all_analytics if float(r.get('adCostThis', 0)) > 0]
        print(f"\n📈 广告数据统计:")
        print(f"  包含广告数据: {len(ad_records)} 条记录")
        
        if ad_records:
            total_ad_cost = sum(float(r.get('adCostThis', 0)) for r in ad_records)
            total_ad_sales = sum(float(r.get('adTotalSalesThis', 0)) for r in ad_records)
            print(f"  💰 总广告花费: ${total_ad_cost:.2f}")
            print(f"  💰 总广告销售: ${total_ad_sales:.2f}")
        
        print(f"\n✅ 数据获取完成！总计 {total_records} 条记录")
        return True
        
    except Exception as e:
        print(f"❌ 同步失败: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 数据同步成功完成！")
    else:
        print("\n💥 数据同步失败，请检查配置和网络")