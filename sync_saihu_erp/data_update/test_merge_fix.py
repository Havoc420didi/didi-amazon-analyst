#!/usr/bin/env python3
"""
测试修复后的库存点合并逻辑
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.inventory.merger import InventoryMerger

def test_country_identification():
    """测试国家识别逻辑"""
    merger = InventoryMerger()
    
    # 测试数据 - 包含欧盟和非欧盟店铺
    test_products = [
        # 欧盟店铺 - 同一ASIN不同店铺前缀
        {
            'asin': 'B123456789',
            'product_name': 'Test Product',
            'sku': 'SKU123-FR',
            'category': 'Electronics',
            'store': '03 ZipCozy-FR',
            'marketplace': 'FR',
            'fba_available': 100,
            'fba_inbound': 50,
            'local_available': 200,
            'average_sales': 10,
            'sales_person': '张三',
            'product_tag': 'Hot',
            'dev_name': 'Dev1'
        },
        {
            'asin': 'B123456789',
            'product_name': 'Test Product',
            'sku': 'SKU123-DE',
            'category': 'Electronics',
            'store': '03 ZipCozy-DE',
            'marketplace': 'DE', 
            'fba_available': 80,
            'fba_inbound': 30,
            'local_available': 200,
            'average_sales': 8,
            'sales_person': '张三',
            'product_tag': 'Hot',
            'dev_name': 'Dev1'
        },
        {
            'asin': 'B123456789',
            'product_name': 'Test Product',
            'sku': 'SKU123-FR2',
            'category': 'Electronics',
            'store': '01 VivaJoy-FR',
            'marketplace': 'FR',
            'fba_available': 60,
            'fba_inbound': 20,
            'local_available': 200,
            'average_sales': 5,
            'sales_person': '张三',
            'product_tag': 'Hot',
            'dev_name': 'Dev1'
        },
        
        # 非欧盟店铺 - UK例子
        {
            'asin': 'B987654321',
            'product_name': 'Another Product',
            'sku': 'SKU987-UK1',
            'category': 'Home',
            'store': '03Doit-UK',
            'marketplace': 'UK',
            'fba_available': 150,
            'fba_inbound': 75,
            'local_available': 300,
            'average_sales': 12,
            'sales_person': '李四',
            'product_tag': 'New',
            'dev_name': 'Dev2'
        },
        {
            'asin': 'B987654321',
            'product_name': 'Another Product',
            'sku': 'SKU987-UK2',
            'category': 'Home',
            'store': '01VivaJoy-UK',
            'marketplace': 'UK',
            'fba_available': 120,
            'fba_inbound': 60,
            'local_available': 300,
            'average_sales': 8,
            'sales_person': '李四',
            'product_tag': 'New',
            'dev_name': 'Dev2'
        },
        {
            'asin': 'B987654321',
            'product_name': 'Another Product',
            'sku': 'SKU987-UK3',
            'category': 'Home',
            'store': '01MumEZ-UK', 
            'marketplace': 'UK',
            'fba_available': 90,
            'fba_inbound': 45,
            'local_available': 300,
            'average_sales': 6,
            'sales_person': '李四',
            'product_tag': 'New',
            'dev_name': 'Dev2'
        },
        
        # 美国店铺
        {
            'asin': 'B111222333',
            'product_name': 'US Product',
            'sku': 'SKU111-US',
            'category': 'Sports',
            'store': '03 ZipCozy-US',
            'marketplace': 'US',
            'fba_available': 200,
            'fba_inbound': 100,
            'local_available': 400,
            'average_sales': 15,
            'sales_person': '王五',
            'product_tag': 'Popular',
            'dev_name': 'Dev3'
        }
    ]
    
    print("🧪 开始测试修复后的合并逻辑...")
    print(f"📊 原始产品数量: {len(test_products)}")
    
    # 执行合并
    merged_points = merger.merge_inventory_points(test_products)
    
    print(f"📦 合并后库存点数量: {len(merged_points)}")
    print("\n📋 合并结果详情:")
    
    for i, point in enumerate(merged_points, 1):
        print(f"\n{i}. ASIN: {point.get('asin')}")
        print(f"   产品名: {point.get('product_name')}")
        print(f"   市场: {point.get('marketplace')}")
        print(f"   店铺: {point.get('store')}")
        print(f"   FBA可用: {point.get('fba_available')}")
        print(f"   FBA在途: {point.get('fba_inbound')}")
        print(f"   本地仓: {point.get('local_available')}")
        print(f"   平均销量: {point.get('average_sales')}")
        print(f"   合并类型: {point.get('_merge_type')}")
        if point.get('_merged_stores'):
            print(f"   合并店铺: {point.get('_merged_stores')}")
    
    # 验证合并结果
    print("\n✅ 验证结果:")
    
    # 应该有3个库存点：1个欧盟，1个UK，1个US
    expected_points = 3
    if len(merged_points) == expected_points:
        print(f"✅ 库存点数量正确: {len(merged_points)}")
    else:
        print(f"❌ 库存点数量错误: 期望{expected_points}，实际{len(merged_points)}")
    
    # 检查欧盟合并
    eu_point = next((p for p in merged_points if p.get('marketplace') == '欧盟'), None)
    if eu_point:
        print("✅ 找到欧盟合并点")
        # 欧盟应该选择FBA可用+在途最大的代表进行合并
        # 03 ZipCozy: FR(150) vs DE(110) -> 选FR
        # 01 VivaJoy: 只有FR(80)
        # 所以应该是 FR(100+50) + FR(60+20) = 160+70 = 230, 130
        expected_fba_available = 160  # 100 + 60 (两个店铺的最佳代表)
        expected_fba_inbound = 70     # 50 + 20
        print(f"   FBA可用: {eu_point.get('fba_available')} (期望: {expected_fba_available})")
        print(f"   FBA在途: {eu_point.get('fba_inbound')} (期望: {expected_fba_inbound})")
        print(f"   本地仓: {eu_point.get('local_available')} (期望: 200, 不累加)")
    else:
        print("❌ 未找到欧盟合并点")
    
    # 检查UK合并  
    uk_point = next((p for p in merged_points if p.get('marketplace') == 'UK'), None)
    if uk_point:
        print("✅ 找到UK合并点")
        # UK应该累加所有店铺: 150+120+90=360, 75+60+45=180, 300+300+300=900
        expected_fba_available = 360
        expected_fba_inbound = 180
        expected_local = 900  # 非欧盟地区累加
        print(f"   FBA可用: {uk_point.get('fba_available')} (期望: {expected_fba_available})")
        print(f"   FBA在途: {uk_point.get('fba_inbound')} (期望: {expected_fba_inbound})")
        print(f"   本地仓: {uk_point.get('local_available')} (期望: {expected_local})")
    else:
        print("❌ 未找到UK合并点")
    
    print("\n🎉 测试完成!")
    return merged_points

if __name__ == "__main__":
    test_country_identification()