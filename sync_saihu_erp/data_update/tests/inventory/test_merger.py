"""
库存合并器核心模块测试
"""

import unittest
from unittest.mock import Mock, patch
import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from src.inventory.merger import InventoryMerger


class TestInventoryMerger(unittest.TestCase):
    """库存合并器测试"""
    
    def setUp(self):
        """测试初始化"""
        self.merger = InventoryMerger()
        
        # 准备测试数据
        self.sample_products = [
            {
                'asin': 'B01TEST001',
                'product_name': 'Test Product 1',
                'store': '01 TestStore-UK',
                'marketplace': 'UK',
                'fba_available': 100,
                'fba_inbound': 50,
                'local_available': 20,
                'average_sales': 10,
                'ad_impressions': 1000,
                'ad_clicks': 50,
                'ad_spend': 25.0
            },
            {
                'asin': 'B01TEST001',
                'product_name': 'Test Product 1',
                'store': '01 TestStore-DE',
                'marketplace': 'DE',
                'fba_available': 80,
                'fba_inbound': 30,
                'local_available': 15,
                'average_sales': 8,
                'ad_impressions': 800,
                'ad_clicks': 40,
                'ad_spend': 20.0
            },
            {
                'asin': 'B01TEST002',
                'product_name': 'Test Product 2',
                'store': '02 AnotherStore-US',
                'marketplace': 'US',
                'fba_available': 200,
                'fba_inbound': 100,
                'local_available': 0,
                'average_sales': 15,
                'ad_impressions': 1500,
                'ad_clicks': 75,
                'ad_spend': 30.0
            }
        ]
    
    def test_merge_inventory_points_empty_input(self):
        """测试空输入处理"""
        result = self.merger.merge_inventory_points([])
        self.assertEqual(result, [])
    
    def test_merge_inventory_points_valid_input(self):
        """测试有效输入的合并"""
        with patch.object(self.merger, '_initialize_sub_mergers'):
            with patch.object(self.merger, 'eu_merger') as mock_eu_merger:
                with patch.object(self.merger, 'non_eu_merger') as mock_non_eu_merger:
                    with patch.object(self.merger, 'ad_merger') as mock_ad_merger:
                        
                        # 设置mock返回值
                        mock_eu_merger.merge.return_value = {'asin': 'B01TEST001', 'marketplace': '欧盟'}
                        mock_non_eu_merger.merge.return_value = [{'asin': 'B01TEST002', 'marketplace': 'US'}]
                        mock_ad_merger.merge_ad_data.side_effect = lambda x: x
                        
                        result = self.merger.merge_inventory_points(self.sample_products)
                        
                        self.assertIsInstance(result, list)
                        self.assertGreater(len(result), 0)
    
    def test_validate_and_clean_products(self):
        """测试产品数据验证和清洗"""
        # 添加一个无效产品
        invalid_product = {'asin': '', 'product_name': 'Invalid'}
        test_data = self.sample_products + [invalid_product]
        
        result = self.merger._validate_and_clean_products(test_data)
        
        # 应该过滤掉无效产品
        self.assertEqual(len(result), 3)
        
        # 检查数据清洗
        for product in result:
            self.assertIsInstance(product['fba_available'], float)
            self.assertIsInstance(product['average_sales'], float)
    
    def test_group_by_asin(self):
        """测试按ASIN分组"""
        result = self.merger._group_by_asin(self.sample_products)
        
        self.assertEqual(len(result), 2)  # 两个不同的ASIN
        self.assertIn('B01TEST001', result)
        self.assertIn('B01TEST002', result)
        self.assertEqual(len(result['B01TEST001']), 2)  # 第一个ASIN有两个产品
        self.assertEqual(len(result['B01TEST002']), 1)  # 第二个ASIN有一个产品
    
    def test_separate_by_region(self):
        """测试地区分离"""
        eu_products, non_eu_products = self.merger._separate_by_region(self.sample_products)
        
        # DE是欧盟国家，UK和US不是（在这个测试中）
        self.assertEqual(len(eu_products), 1)
        self.assertEqual(len(non_eu_products), 2)
        self.assertEqual(eu_products[0]['marketplace'], 'DE')
    
    def test_extract_country_code(self):
        """测试国家代码提取"""
        test_cases = [
            ('01 TestStore-UK', 'UK'),
            ('TestStore-DE', 'DE'),
            ('Store-FR', 'FR'),
            ('InvalidStore', ''),
            ('', '')
        ]
        
        for store_name, expected in test_cases:
            result = self.merger._extract_country_code(store_name)
            self.assertEqual(result, expected)
    
    def test_get_merge_statistics(self):
        """测试合并统计信息"""
        merged_points = [
            {'marketplace': '欧盟'},
            {'marketplace': 'US'},
            {'marketplace': 'UK'}
        ]
        
        result = self.merger.get_merge_statistics(10, merged_points)
        
        self.assertEqual(result['original_count'], 10)
        self.assertEqual(result['merged_count'], 3)
        self.assertEqual(result['eu_points'], 1)
        self.assertEqual(result['non_eu_points'], 2)
        self.assertEqual(result['compression_ratio'], 0.3)


class TestInventoryMergerIntegration(unittest.TestCase):
    """库存合并器集成测试"""
    
    def setUp(self):
        """测试初始化"""
        self.merger = InventoryMerger()
    
    @patch('src.inventory.eu_merger.EUMerger')
    @patch('src.inventory.non_eu_merger.NonEUMerger') 
    @patch('src.inventory.ad_merger.AdMerger')
    def test_full_merge_workflow(self, mock_ad_merger, mock_non_eu_merger, mock_eu_merger):
        """测试完整的合并工作流"""
        # 准备mock
        mock_eu_instance = Mock()
        mock_non_eu_instance = Mock()
        mock_ad_instance = Mock()
        
        mock_eu_merger.return_value = mock_eu_instance
        mock_non_eu_merger.return_value = mock_non_eu_instance
        mock_ad_merger.return_value = mock_ad_instance
        
        # 设置返回值
        mock_eu_instance.merge.return_value = {
            'asin': 'TEST001',
            'marketplace': '欧盟',
            'total_inventory': 200
        }
        
        mock_non_eu_instance.merge.return_value = [{
            'asin': 'TEST002', 
            'marketplace': 'US',
            'total_inventory': 300
        }]
        
        mock_ad_instance.merge_ad_data.side_effect = lambda x: x
        
        # 测试数据
        test_products = [
            {
                'asin': 'TEST001',
                'product_name': 'EU Product',
                'store': 'Store-DE',
                'marketplace': 'DE',
                'fba_available': 100,
                'average_sales': 10
            },
            {
                'asin': 'TEST002',
                'product_name': 'US Product', 
                'store': 'Store-US',
                'marketplace': 'US',
                'fba_available': 200,
                'average_sales': 20
            }
        ]
        
        # 执行合并
        result = self.merger.merge_inventory_points(test_products)
        
        # 验证结果
        self.assertEqual(len(result), 2)
        self.assertTrue(any(p['marketplace'] == '欧盟' for p in result))
        self.assertTrue(any(p['marketplace'] == 'US' for p in result))


if __name__ == '__main__':
    unittest.main()