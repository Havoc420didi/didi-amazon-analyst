"""
广告数据合并器测试
"""

import unittest
import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from src.inventory.ad_merger import AdMerger


class TestAdMerger(unittest.TestCase):
    """广告数据合并器测试"""
    
    def setUp(self):
        """测试初始化"""
        self.merger = AdMerger()
        
        # 准备测试库存点数据
        self.inventory_point = {
            'asin': 'B01ADTEST1',
            'product_name': 'Ad Test Product',
            'marketplace': 'US',
            'ad_impressions': 10000,
            'ad_clicks': 500,
            'ad_spend': 250.0,
            'ad_order_count': 25,
            'ad_sales': 1000.0,
            'average_sales': 10,
            'average_price': 'US$40.00'
        }
    
    def test_merge_ad_data_basic(self):
        """测试基础广告数据合并"""
        result = self.merger.merge_ad_data(self.inventory_point.copy())
        
        # 验证基础数据保持不变
        self.assertEqual(result['asin'], 'B01ADTEST1')
        self.assertEqual(result['ad_impressions'], 10000)
        self.assertEqual(result['ad_clicks'], 500)
        
        # 验证计算的指标
        self.assertIn('ad_ctr', result)
        self.assertIn('ad_cvr', result)
        self.assertIn('acoas', result)
        self.assertIn('ad_cpc', result)
        self.assertIn('ad_roas', result)
    
    def test_calculate_ad_metrics(self):
        """测试广告指标计算"""
        metrics = self.merger._calculate_ad_metrics(
            ad_impressions=10000,
            ad_clicks=500,
            ad_spend=250.0,
            ad_order_count=25,
            ad_sales=1000.0,
            inventory_point=self.inventory_point
        )
        
        # CTR = 点击量 / 曝光量 = 500 / 10000 = 0.0500
        self.assertEqual(metrics['ad_ctr'], 0.0500)
        
        # CVR = 订单量 / 点击量 = 25 / 500 = 0.0500
        self.assertEqual(metrics['ad_cvr'], 0.0500)
        
        # CPC = 花费 / 点击量 = 250 / 500 = 0.50
        self.assertEqual(metrics['ad_cpc'], 0.50)
        
        # ROAS = 广告销售额 / 广告花费 = 1000 / 250 = 4.00
        self.assertEqual(metrics['ad_roas'], 4.00)
        
        # 验证ACOAS计算
        # 日均销售额 = 平均销量 * 平均价格 = 10 * 40 = 400
        # 周销售额 = 400 * 7 = 2800
        # ACOAS = 广告花费 / 周销售额 = 250 / 2800 ≈ 0.0893
        self.assertAlmostEqual(metrics['acoas'], 0.0893, places=4)
    
    def test_calculate_daily_sales_amount(self):
        """测试日均销售额计算"""
        test_cases = [
            # (平均销量, 平均价格字符串, 期望结果)
            (10, 'US$40.00', 400.0),
            (5, '$25.99', 129.95),
            (0, 'US$20.00', 0.0),
            (10, '', 0.0),
            (8, 'Invalid Price', 0.0)
        ]
        
        for avg_sales, price_str, expected in test_cases:
            inventory_point = {
                'average_sales': avg_sales,
                'average_price': price_str
            }
            
            result = self.merger._calculate_daily_sales_amount(inventory_point)
            self.assertAlmostEqual(result, expected, places=2)
    
    def test_extract_price_from_string(self):
        """测试价格字符串解析"""
        test_cases = [
            ('US$25.99', 25.99),
            ('$40.00', 40.00),
            ('€15.50', 15.50),
            ('£20.99', 20.99),
            ('123.45', 123.45),
            ('Invalid', 0.0),
            ('', 0.0),
            (None, 0.0)
        ]
        
        for price_str, expected in test_cases:
            result = self.merger._extract_price_from_string(price_str)
            self.assertEqual(result, expected)
    
    def test_safe_divide(self):
        """测试安全除法"""
        # 正常除法
        self.assertEqual(self.merger._safe_divide(10, 2), 5.0)
        self.assertEqual(self.merger._safe_divide(10, 3, precision=2), 3.33)
        
        # 除零处理
        self.assertEqual(self.merger._safe_divide(10, 0), 0.0)
        self.assertEqual(self.merger._safe_divide(10, None), 0.0)
        
        # 精度控制
        self.assertEqual(self.merger._safe_divide(1, 3, precision=4), 0.3333)
    
    def test_merge_ad_data_with_zero_values(self):
        """测试零值数据处理"""
        zero_data = {
            'asin': 'B01ZERO001',
            'ad_impressions': 0,
            'ad_clicks': 0,
            'ad_spend': 0,
            'ad_order_count': 0,
            'ad_sales': 0,
            'average_sales': 0,
            'average_price': 'US$0.00'
        }
        
        result = self.merger.merge_ad_data(zero_data)
        
        # 所有计算指标应该为0
        self.assertEqual(result['ad_ctr'], 0.0)
        self.assertEqual(result['ad_cvr'], 0.0)
        self.assertEqual(result['acoas'], 0.0)
        self.assertEqual(result['ad_cpc'], 0.0)
        self.assertEqual(result['ad_roas'], 0.0)
    
    def test_get_ad_summary(self):
        """测试广告数据汇总"""
        inventory_points = [
            {
                'ad_impressions': 1000,
                'ad_clicks': 50,
                'ad_spend': 25.0,
                'ad_order_count': 5,
                'ad_sales': 200.0
            },
            {
                'ad_impressions': 2000,
                'ad_clicks': 100,
                'ad_spend': 50.0,
                'ad_order_count': 10,
                'ad_sales': 400.0
            },
            {
                'ad_impressions': 0,  # 无广告数据
                'ad_clicks': 0,
                'ad_spend': 0,
                'ad_order_count': 0,
                'ad_sales': 0
            }
        ]
        
        result = self.merger.get_ad_summary(inventory_points)
        
        self.assertEqual(result['total_inventory_points'], 3)
        self.assertEqual(result['points_with_ads'], 2)  # 只有两个有广告数据
        self.assertAlmostEqual(result['ad_coverage_rate'], 0.6667, places=4)
        
        # 总计数据
        self.assertEqual(result['total_ad_impressions'], 3000)
        self.assertEqual(result['total_ad_clicks'], 150)
        self.assertEqual(result['total_ad_spend'], 75.0)
        self.assertEqual(result['total_ad_orders'], 15)
        self.assertEqual(result['total_ad_sales'], 600.0)
        
        # 整体指标
        self.assertEqual(result['overall_ctr'], 0.05)    # 150/3000
        self.assertEqual(result['overall_cvr'], 0.1)     # 15/150
        self.assertEqual(result['overall_roas'], 8.0)    # 600/75
        self.assertEqual(result['overall_cpc'], 0.5)     # 75/150
    
    def test_validate_ad_data(self):
        """测试广告数据验证"""
        # 正常数据
        normal_data = {
            'ad_impressions': 1000,
            'ad_clicks': 50,
            'ad_spend': 25.0,
            'ad_ctr': 0.05,
            'ad_cpc': 0.5
        }
        
        warnings = self.merger.validate_ad_data(normal_data)
        self.assertEqual(len(warnings), 0)
        
        # 异常数据
        abnormal_data = {
            'ad_impressions': 1000,
            'ad_clicks': 500,  # 异常高的点击率
            'ad_spend': 50000,  # 异常高的花费
            'ad_ctr': 0.5,     # 50%点击率异常
            'ad_cpc': 150.0    # 异常高的CPC
        }
        
        warnings = self.merger.validate_ad_data(abnormal_data)
        self.assertGreater(len(warnings), 0)
        self.assertIn('ad_ctr', warnings)
        self.assertIn('ad_cpc', warnings)
    
    def test_merge_ad_data_exception_handling(self):
        """测试异常处理"""
        # 测试无效输入
        result = self.merger.merge_ad_data(None)
        self.assertEqual(result, None)
        
        # 测试空字典输入 - 验证函数能正常处理空输入
        empty_dict = {}
        result = self.merger.merge_ad_data(empty_dict)
        self.assertIsInstance(result, dict)  # 应该返回字典类型
        
        # 测试非字典输入
        result = self.merger.merge_ad_data("invalid input")
        self.assertEqual(result, "invalid input")


if __name__ == '__main__':
    unittest.main()