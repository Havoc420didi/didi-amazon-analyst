"""
欧盟地区合并器测试
"""

import unittest
import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from src.inventory.eu_merger import EUMerger


class TestEUMerger(unittest.TestCase):
    """欧盟合并器测试"""
    
    def setUp(self):
        """测试初始化"""
        self.merger = EUMerger()
        
        # 准备测试数据 - 同一ASIN在不同欧盟店铺的数据
        self.eu_products = [
            # Store A 在德国和法国
            {
                'asin': 'B01EUTEST1',
                'product_name': 'EU Test Product',
                'sku': 'SKU001-DE',
                'store': '01 StoreA-DE',
                'marketplace': 'DE',
                'fba_available': 100,
                'fba_inbound': 50,
                'sales_7days': 10,
                'average_sales': 5,
                'ad_impressions': 1000
            },
            {
                'asin': 'B01EUTEST1',
                'product_name': 'EU Test Product',
                'sku': 'SKU001-FR',
                'store': '01 StoreA-FR',
                'marketplace': 'FR', 
                'fba_available': 80,
                'fba_inbound': 30,
                'sales_7days': 8,
                'average_sales': 4,
                'ad_impressions': 800
            },
            # Store B 在德国和意大利
            {
                'asin': 'B01EUTEST1',
                'product_name': 'EU Test Product',
                'sku': 'SKU001-DE-B',
                'store': '02 StoreB-DE',
                'marketplace': 'DE',
                'fba_available': 120,
                'fba_inbound': 60,
                'sales_7days': 12,
                'average_sales': 6,
                'ad_impressions': 1200
            },
            {
                'asin': 'B01EUTEST1',
                'product_name': 'EU Test Product',
                'sku': 'SKU001-IT',
                'store': '02 StoreB-IT',
                'marketplace': 'IT',
                'fba_available': 90,
                'fba_inbound': 40,
                'sales_7days': 9,
                'average_sales': 4.5,
                'ad_impressions': 900
            }
        ]
    
    def test_merge_empty_input(self):
        """测试空输入"""
        result = self.merger.merge([])
        self.assertIsNone(result)
    
    def test_extract_store_prefix(self):
        """测试店铺前缀提取"""
        test_cases = [
            ('01 StoreA-DE', '01 StoreA'),
            ('02 StoreB-FR', '02 StoreB'),
            ('SimpleStore-IT', 'SimpleStore'),
            ('NoCountry', 'NoCountry'),
            ('', '')
        ]
        
        for store_name, expected in test_cases:
            result = self.merger._extract_store_prefix(store_name)
            self.assertEqual(result, expected)
    
    def test_group_by_store_prefix(self):
        """测试按店铺前缀分组"""
        result = self.merger._group_by_store_prefix(self.eu_products)
        
        self.assertEqual(len(result), 2)  # 两个店铺前缀
        self.assertIn('01 StoreA', result)
        self.assertIn('02 StoreB', result)
        self.assertEqual(len(result['01 StoreA']), 2)  # StoreA在两个国家
        self.assertEqual(len(result['02 StoreB']), 2)  # StoreB在两个国家
    
    def test_select_best_inventory_representative(self):
        """测试选择最佳库存代表"""
        # StoreA的产品：DE(150总库存), FR(110总库存)
        store_a_products = [p for p in self.eu_products if 'StoreA' in p['store']]
        
        result = self.merger._select_best_inventory_representative(store_a_products, '01 StoreA')
        
        self.assertIsNotNone(result)
        self.assertEqual(result['marketplace'], 'DE')  # DE有更高的库存
        self.assertEqual(result['_store_prefix'], '01 StoreA')
        self.assertEqual(result['_selected_inventory'], 150)  # 100+50
    
    def test_merge_store_representatives(self):
        """测试合并店铺代表"""
        # 准备两个店铺代表
        representatives = [
            {
                'asin': 'B01EUTEST1',
                'product_name': 'EU Test Product',
                'sku': 'SKU001-A',
                'category': 'Test Category',
                'sales_person': 'Test Person',
                'product_tag': 'Test Tag',
                'fba_available': 100,
                'fba_inbound': 50,
                'local_available': 10,
                'sales_7days': 10,
                'average_sales': 5,
                'ad_impressions': 1000,
                '_store_prefix': '01 StoreA'
            },
            {
                'asin': 'B01EUTEST1',
                'product_name': 'EU Test Product',
                'sku': 'SKU001-B',
                'category': 'Test Category',
                'sales_person': 'Test Person',
                'product_tag': 'Test Tag',
                'fba_available': 120,
                'fba_inbound': 60,
                'local_available': 15,
                'sales_7days': 12,
                'average_sales': 6,
                'ad_impressions': 1200,
                '_store_prefix': '02 StoreB'
            }
        ]
        
        result = self.merger._merge_store_representatives(representatives)
        
        # 验证基础信息
        self.assertEqual(result['asin'], 'B01EUTEST1')
        self.assertEqual(result['marketplace'], '欧盟')
        self.assertEqual(result['store'], '欧盟汇总')
        
        # 验证库存数据累加
        self.assertEqual(result['fba_available'], 220)  # 100+120
        self.assertEqual(result['fba_inbound'], 110)    # 50+60
        self.assertEqual(result['local_available'], 15) # max(10,15)，不累加
        
        # 验证销售数据累加
        self.assertEqual(result['sales_7days'], 22)     # 10+12
        self.assertEqual(result['average_sales'], 11)   # 5+6
        
        # 验证广告数据累加
        self.assertEqual(result['ad_impressions'], 2200) # 1000+1200
        
        # 验证元数据
        self.assertEqual(result['_merge_type'], 'eu_merged')
        self.assertEqual(result['_representative_count'], 2)
        self.assertIn('01 StoreA', result['_merged_stores'])
        self.assertIn('02 StoreB', result['_merged_stores'])
    
    def test_full_eu_merge_workflow(self):
        """测试完整的欧盟合并工作流"""
        result = self.merger.merge(self.eu_products)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['asin'], 'B01EUTEST1')
        self.assertEqual(result['marketplace'], '欧盟')
        
        # 验证两步合并逻辑正确执行
        # 第一步：每个店铺选择最佳代表
        # 第二步：合并所有代表
        
        # StoreA最佳代表：DE(150) > FR(110)
        # StoreB最佳代表：DE(180) > IT(130)
        # 最终合并：DE(150) + DE(180) = 330总库存
        
        expected_total_inventory = (100 + 50) + (120 + 60)  # 两个最佳代表的FBA库存
        actual_total_inventory = result['fba_available'] + result['fba_inbound']
        self.assertEqual(actual_total_inventory, expected_total_inventory)
    
    def test_get_merge_info(self):
        """测试获取合并信息"""
        representatives = [
            {'_store_prefix': '01 StoreA', '_selected_inventory': 150, 'fba_available': 100, 'fba_inbound': 50},
            {'_store_prefix': '02 StoreB', '_selected_inventory': 180, 'fba_available': 120, 'fba_inbound': 60}
        ]
        
        result = self.merger.get_merge_info(representatives)
        
        self.assertEqual(result['store_count'], 2)
        self.assertEqual(result['total_fba_inventory'], 330)
        self.assertIn('01 StoreA', result['store_prefixes'])
        self.assertIn('02 StoreB', result['store_prefixes'])
        self.assertEqual(result['representative_inventories'], [150, 180])
    
    def test_format_inventory_point_name(self):
        """测试库存点名称格式化"""
        merged_data = {
            'asin': 'B01EUTEST1',
            'marketplace': '欧盟'
        }
        
        result = self.merger._format_inventory_point_name(merged_data)
        self.assertEqual(result, 'B01EUTEST1-欧盟')


if __name__ == '__main__':
    unittest.main()