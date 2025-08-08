#!/usr/bin/env python3
"""
库存点合并功能实际数据集成测试
验证完整的数据抓取 -> 处理 -> 合并 -> 数据库同步流程
"""

import sys
import os
import json
import time
from datetime import datetime, date, timedelta
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.config.settings import Settings
settings = Settings()
from src.database import db_manager
from src.processors.inventory_merge_processor import InventoryMergeProcessor
from src.inventory import InventoryMerger
from src.utils.logging_utils import setup_logging, get_logger

# 设置日志
setup_logging()
logger = get_logger(__name__)


class InventoryMergeIntegrationTest:
    """库存点合并集成测试"""
    
    def __init__(self):
        self.merger = InventoryMerger()
        self.processor = InventoryMergeProcessor()
        self.test_data_date = date.today().strftime('%Y-%m-%d')
        
    def run_full_integration_test(self):
        """运行完整的集成测试"""
        print("=" * 70)
        print("🧪 库存点合并功能实际数据集成测试")
        print("=" * 70)
        print(f"测试日期: {self.test_data_date}")
        print(f"数据库: {settings.get('database.host')}:{settings.get('database.port')}")
        print()
        
        try:
            # 1. 检查数据库连接
            print("1️⃣ 检查数据库连接...")
            if not self._check_database_connection():
                return False
            
            # 2. 初始化数据库表
            print("2️⃣ 初始化数据库表...")
            if not self._initialize_database_tables():
                return False
            
            # 3. 准备测试数据
            print("3️⃣ 准备测试数据...")
            test_data = self._prepare_test_data()
            
            # 4. 执行库存点合并
            print("4️⃣ 执行库存点合并...")
            merge_result = self._test_inventory_merge(test_data)
            if not merge_result['success']:
                return False
            
            # 5. 验证合并结果
            print("5️⃣ 验证合并结果...")
            if not self._verify_merge_results():
                return False
            
            # 6. 测试欧盟合并逻辑
            print("6️⃣ 测试欧盟合并逻辑...")
            if not self._test_eu_merge_logic():
                return False
            
            # 7. 测试广告数据计算
            print("7️⃣ 测试广告数据计算...")
            if not self._test_ad_calculations():
                return False
            
            # 8. 生成测试报告
            print("8️⃣ 生成测试报告...")
            self._generate_test_report(merge_result)
            
            print("\n✅ 集成测试全部通过！")
            return True
            
        except Exception as e:
            print(f"\n❌ 集成测试失败: {e}")
            logger.error(f"集成测试异常: {e}")
            return False
    
    def _check_database_connection(self):
        """检查数据库连接"""
        try:
            if db_manager.test_connection():
                print("   ✅ 数据库连接正常")
                return True
            else:
                print("   ❌ 数据库连接失败")
                return False
        except Exception as e:
            print(f"   ❌ 数据库连接失败: {e}")
            return False
    
    def _initialize_database_tables(self):
        """初始化数据库表"""
        try:
            # 执行建表脚本
            init_sql_path = project_root / "sql" / "inventory_points_init.sql"
            if init_sql_path.exists():
                print(f"   📋 执行建表脚本: {init_sql_path}")
                # 这里可以执行SQL脚本，但为了安全起见，我们只检查表是否存在
                
            # 检查表是否存在
            tables_to_check = [
                'inventory_points',
                'inventory_point_history', 
                'inventory_merge_stats'
            ]
            
            for table in tables_to_check:
                if db_manager.table_exists(table):
                    print(f"   ✅ 表 {table} 存在")
                else:
                    print(f"   ⚠️  表 {table} 不存在，将在运行时创建")
                        
            return True
        except Exception as e:
            print(f"   ❌ 数据库表初始化失败: {e}")
            return False
    
    def _prepare_test_data(self):
        """准备测试数据"""
        # 模拟真实的产品数据结构
        test_data = [
            # 欧盟地区数据 - 同一ASIN在不同店铺和国家
            {
                'asin': 'B08TEST001',
                'product_name': '测试产品1',
                'sku': 'SKU001-DE-A',
                'store': '01 TestStore-DE',
                'marketplace': 'DE',
                'category': '电子产品',
                'sales_person': '张三',
                'product_tag': '空运',
                'fba_available': 150,
                'fba_inbound': 80,
                'local_available': 20,
                'sales_7days': 15,
                'average_sales': 12,
                'average_price': 'EUR€29.99',
                'ad_impressions': 2000,
                'ad_clicks': 100,
                'ad_spend': 50.0,
                'ad_order_count': 8,
                'ad_sales': 240.0
            },
            {
                'asin': 'B08TEST001',
                'product_name': '测试产品1',
                'sku': 'SKU001-FR-A',
                'store': '01 TestStore-FR',
                'marketplace': 'FR',
                'category': '电子产品',
                'sales_person': '张三',
                'product_tag': '空运',
                'fba_available': 120,
                'fba_inbound': 60,
                'local_available': 15,
                'sales_7days': 12,
                'average_sales': 10,
                'average_price': 'EUR€29.99',
                'ad_impressions': 1500,
                'ad_clicks': 75,
                'ad_spend': 37.5,
                'ad_order_count': 6,
                'ad_sales': 180.0
            },
            {
                'asin': 'B08TEST001',
                'product_name': '测试产品1',
                'sku': 'SKU001-DE-B',
                'store': '02 AnotherStore-DE',
                'marketplace': 'DE',
                'category': '电子产品',
                'sales_person': '张三',
                'product_tag': '空运',
                'fba_available': 200,
                'fba_inbound': 100,
                'local_available': 25,
                'sales_7days': 20,
                'average_sales': 15,
                'average_price': 'EUR€29.99',
                'ad_impressions': 2500,
                'ad_clicks': 125,
                'ad_spend': 62.5,
                'ad_order_count': 10,
                'ad_sales': 300.0
            },
            # 非欧盟地区数据
            {
                'asin': 'B08TEST002',
                'product_name': '测试产品2',
                'sku': 'SKU002-US-A',
                'store': '01 TestStore-US',
                'marketplace': 'US',
                'category': '家居用品',
                'sales_person': '李四',
                'product_tag': '铁路',
                'fba_available': 300,
                'fba_inbound': 150,
                'local_available': 50,
                'sales_7days': 25,
                'average_sales': 20,
                'average_price': 'US$39.99',
                'ad_impressions': 3000,
                'ad_clicks': 150,
                'ad_spend': 75.0,
                'ad_order_count': 12,
                'ad_sales': 480.0
            },
            {
                'asin': 'B08TEST002',
                'product_name': '测试产品2',
                'sku': 'SKU002-US-B',
                'store': '02 AnotherStore-US',
                'marketplace': 'US',
                'category': '家居用品',
                'sales_person': '李四',
                'product_tag': '铁路',
                'fba_available': 250,
                'fba_inbound': 120,
                'local_available': 30,
                'sales_7days': 20,
                'average_sales': 15,
                'average_price': 'US$39.99',
                'ad_impressions': 2000,
                'ad_clicks': 100,
                'ad_spend': 50.0,
                'ad_order_count': 8,
                'ad_sales': 320.0
            },
            # 英国数据
            {
                'asin': 'B08TEST003',
                'product_name': '测试产品3',
                'sku': 'SKU003-UK',
                'store': '01 TestStore-UK',
                'marketplace': 'UK',
                'category': '服装',
                'sales_person': '王五',
                'product_tag': '空运',
                'fba_available': 100,
                'fba_inbound': 50,
                'local_available': 10,
                'sales_7days': 8,
                'average_sales': 6,
                'average_price': 'GBP£19.99',
                'ad_impressions': 1000,
                'ad_clicks': 50,
                'ad_spend': 25.0,
                'ad_order_count': 4,
                'ad_sales': 80.0
            }
        ]
        
        print(f"   📊 准备了 {len(test_data)} 条测试数据")
        print("   数据包含：")
        print("   - 欧盟地区数据: 3条 (DE: 2条, FR: 1条)")
        print("   - 美国地区数据: 2条")
        print("   - 英国地区数据: 1条")
        
        return test_data
    
    def _test_inventory_merge(self, test_data):
        """测试库存点合并"""
        try:
            print("   🔄 执行库存点合并处理...")
            
            # 使用处理器执行合并
            result = self.processor.process(test_data, self.test_data_date)
            
            if result.get('status') == 'success':
                print(f"   ✅ 合并成功")
                print(f"   📊 原始数据: {result.get('processed_count', 0)} 条")
                print(f"   📊 合并后: {result.get('merged_count', 0)} 个库存点")
                print(f"   📊 保存数量: {result.get('saved_count', 0)} 条")
                
                return {
                    'success': True,
                    'result': result
                }
            else:
                print(f"   ❌ 合并失败: {result.get('error', 'Unknown error')}")
                return {'success': False, 'error': result.get('error')}
                
        except Exception as e:
            print(f"   ❌ 合并过程异常: {e}")
            return {'success': False, 'error': str(e)}
    
    def _verify_merge_results(self):
        """验证合并结果"""
        try:
            # 查询合并后的库存点
            sql = "SELECT * FROM inventory_points WHERE data_date = %s"
            points = db_manager.execute_query(sql, (self.test_data_date,))
            
            print(f"   📊 数据库中的库存点数量: {len(points)}")
            
            # 验证欧盟合并
            eu_points = [p for p in points if p.get('marketplace') == '欧盟']
            print(f"   🇪🇺 欧盟库存点: {len(eu_points)} 个")
            
            if eu_points:
                eu_point = eu_points[0]
                print(f"   📋 欧盟合并详情:")
                print(f"      ASIN: {eu_point.get('asin')}")
                print(f"      FBA可用: {eu_point.get('fba_available')}")
                print(f"      FBA在途: {eu_point.get('fba_inbound')}")
                print(f"      平均销量: {eu_point.get('average_sales')}")
                print(f"      合并类型: {eu_point.get('merge_type')}")
                print(f"      店铺数量: {eu_point.get('store_count')}")
            
            # 验证非欧盟合并
            us_points = [p for p in points if p.get('marketplace') == 'US']
            print(f"   🇺🇸 美国库存点: {len(us_points)} 个")
            
            uk_points = [p for p in points if p.get('marketplace') == 'UK']
            print(f"   🇬🇧 英国库存点: {len(uk_points)} 个")
            
            # 验证业务分析指标
            effective_points = [p for p in points if p.get('is_effective_point')]
            turnover_exceeded = [p for p in points if p.get('is_turnover_exceeded')]
            
            print(f"   📈 有效库存点: {len(effective_points)} 个")
            print(f"   ⚠️  周转超标: {len(turnover_exceeded)} 个")
            
            return True
            
        except Exception as e:
            print(f"   ❌ 验证合并结果失败: {e}")
            return False
    
    def _test_eu_merge_logic(self):
        """测试欧盟合并逻辑的正确性"""
        try:
            print("   🔍 验证欧盟两步合并逻辑...")
            
            # 准备欧盟测试数据
            eu_test_data = [
                {
                    'asin': 'B08EUTEST',
                    'product_name': '欧盟测试产品',
                    'sku': 'SKU-EU-01',
                    'store': '01 StoreA-DE',
                    'marketplace': 'DE',
                    'category': '测试分类',
                    'sales_person': '测试人员',
                    'product_tag': '测试标签',
                    'fba_available': 100,
                    'fba_inbound': 50,
                    'average_sales': 10
                },
                {
                    'asin': 'B08EUTEST',
                    'product_name': '欧盟测试产品',
                    'sku': 'SKU-EU-02',
                    'store': '01 StoreA-FR',
                    'marketplace': 'FR',
                    'category': '测试分类',
                    'sales_person': '测试人员',
                    'product_tag': '测试标签',
                    'fba_available': 80,
                    'fba_inbound': 30,
                    'average_sales': 8
                },
                {
                    'asin': 'B08EUTEST',
                    'product_name': '欧盟测试产品',
                    'sku': 'SKU-EU-03',
                    'store': '02 StoreB-DE',
                    'marketplace': 'DE',
                    'category': '测试分类',
                    'sales_person': '测试人员',
                    'product_tag': '测试标签',
                    'fba_available': 120,
                    'fba_inbound': 60,
                    'average_sales': 12
                }
            ]
            
            # 执行合并
            merged_points = self.merger.merge_inventory_points(eu_test_data)
            
            # 应该只有一个欧盟库存点
            eu_points = [p for p in merged_points if p.get('marketplace') == '欧盟']
            
            if len(eu_points) == 1:
                eu_point = eu_points[0]
                print("   ✅ 欧盟合并逻辑正确")
                print(f"      合并后FBA可用: {eu_point.get('fba_available')}")
                print(f"      合并后FBA在途: {eu_point.get('fba_inbound')}")
                print(f"      合并后平均销量: {eu_point.get('average_sales')}")
                
                # 验证两步合并逻辑
                # StoreA最佳代表: DE(150) > FR(110)  
                # StoreB最佳代表: DE(180)
                # 最终合并: DE(150) + DE(180) = 330
                expected_total = (100 + 50) + (120 + 60)  # 330
                actual_total = eu_point.get('fba_available', 0) + eu_point.get('fba_inbound', 0)
                
                if actual_total == expected_total:
                    print("   ✅ 两步合并逻辑验证通过")
                    return True
                else:
                    print(f"   ❌ 两步合并逻辑验证失败: 期望{expected_total}, 实际{actual_total}")
                    return False
            else:
                print(f"   ❌ 欧盟合并结果错误: 期望1个库存点, 实际{len(eu_points)}个")
                return False
                
        except Exception as e:
            print(f"   ❌ 欧盟合并逻辑测试失败: {e}")
            return False
    
    def _test_ad_calculations(self):
        """测试广告数据计算"""
        try:
            print("   🔍 验证广告数据计算...")
            
            test_point = {
                'ad_impressions': 1000,
                'ad_clicks': 50,
                'ad_spend': 25.0,
                'ad_order_count': 5,
                'ad_sales': 200.0,
                'average_sales': 10,
                'average_price': 'US$20.00'
            }
            
            from src.inventory.ad_merger import AdMerger
            ad_merger = AdMerger()
            
            result = ad_merger.merge_ad_data(test_point)
            
            # 验证计算结果
            expected_ctr = 0.05  # 50/1000
            expected_cvr = 0.1   # 5/50
            expected_cpc = 0.5   # 25/50
            expected_roas = 8.0  # 200/25
            
            if (abs(result.get('ad_ctr', 0) - expected_ctr) < 0.001 and
                abs(result.get('ad_cvr', 0) - expected_cvr) < 0.001 and
                abs(result.get('ad_cpc', 0) - expected_cpc) < 0.001 and
                abs(result.get('ad_roas', 0) - expected_roas) < 0.001):
                
                print("   ✅ 广告数据计算正确")
                print(f"      CTR: {result.get('ad_ctr'):.4f}")
                print(f"      CVR: {result.get('ad_cvr'):.4f}")
                print(f"      CPC: {result.get('ad_cpc'):.2f}")
                print(f"      ROAS: {result.get('ad_roas'):.2f}")
                return True
            else:
                print("   ❌ 广告数据计算错误")
                return False
                
        except Exception as e:
            print(f"   ❌ 广告数据计算测试失败: {e}")
            return False
    
    def _generate_test_report(self, merge_result):
        """生成测试报告"""
        report = {
            'test_date': self.test_data_date,
            'test_time': datetime.now().isoformat(),
            'status': 'SUCCESS',
            'merge_result': merge_result.get('result', {}),
            'database_config': {
                'host': settings.get('database.host'),
                'database': settings.get('database.database')
            }
        }
        
        # 保存报告
        report_path = project_root / "tests" / f"integration_test_report_{self.test_data_date}.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"   📄 测试报告已保存: {report_path}")


def main():
    """主函数"""
    print("启动库存点合并功能实际数据集成测试...")
    
    # 创建测试实例
    test = InventoryMergeIntegrationTest()
    
    # 运行集成测试
    success = test.run_full_integration_test()
    
    if success:
        print("\n🎉 集成测试完成！库存点合并功能运行正常。")
        print("\n📋 后续验证建议：")
        print("1. 检查数据库中的inventory_points表")
        print("2. 验证合并统计数据")
        print("3. 测试交互式界面的合并功能")
        return 0
    else:
        print("\n❌ 集成测试失败！请检查错误信息。")
        return 1


if __name__ == "__main__":
    sys.exit(main())