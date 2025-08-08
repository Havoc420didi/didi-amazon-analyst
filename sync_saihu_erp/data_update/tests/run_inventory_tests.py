#!/usr/bin/env python3
"""
库存合并功能测试运行脚本
"""

import unittest
import sys
import os
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def run_inventory_tests():
    """运行库存合并相关的所有测试"""
    
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加测试模块
    test_modules = [
        'tests.inventory.test_merger',
        'tests.inventory.test_eu_merger', 
        'tests.inventory.test_ad_merger'
    ]
    
    print("=== 库存点合并功能测试 ===")
    print(f"项目根目录: {project_root}")
    print(f"测试模块数量: {len(test_modules)}")
    print()
    
    for module_name in test_modules:
        try:
            # 加载测试模块
            tests = loader.loadTestsFromName(module_name)
            suite.addTests(tests)
            print(f"✅ 加载测试模块: {module_name}")
            
        except Exception as e:
            print(f"❌ 加载测试模块失败: {module_name} - {e}")
    
    print()
    
    # 运行测试
    runner = unittest.TextTestRunner(
        verbosity=2,
        stream=sys.stdout,
        descriptions=True,
        failfast=False
    )
    
    print("开始执行测试...")
    print("=" * 70)
    
    result = runner.run(suite)
    
    print("=" * 70)
    print("测试执行完成")
    print()
    
    # 输出测试结果摘要
    print("=== 测试结果摘要 ===")
    print(f"运行测试数量: {result.testsRun}")
    print(f"成功测试数量: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败测试数量: {len(result.failures)}")
    print(f"错误测试数量: {len(result.errors)}")
    print(f"跳过测试数量: {len(result.skipped) if hasattr(result, 'skipped') else 0}")
    
    success_rate = (result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100 if result.testsRun > 0 else 0
    print(f"测试成功率: {success_rate:.1f}%")
    
    # 详细输出失败和错误信息
    if result.failures:
        print("\n=== 失败的测试 ===")
        for i, (test, traceback) in enumerate(result.failures, 1):
            print(f"{i}. {test}")
            print(f"   错误信息: {traceback.split('AssertionError:')[-1].strip() if 'AssertionError:' in traceback else 'Unknown failure'}")
    
    if result.errors:
        print("\n=== 错误的测试 ===")
        for i, (test, traceback) in enumerate(result.errors, 1):
            print(f"{i}. {test}")
            print(f"   错误信息: {traceback.split('Exception:')[-1].strip() if 'Exception:' in traceback else 'Unknown error'}")
    
    # 返回测试是否全部成功
    return result.wasSuccessful()


def run_specific_test(test_class_name=None):
    """运行特定的测试类"""
    if not test_class_name:
        print("请指定要运行的测试类名称")
        return False
    
    try:
        loader = unittest.TestLoader()
        suite = loader.loadTestsFromName(f'tests.inventory.{test_class_name}')
        
        runner = unittest.TextTestRunner(verbosity=2)
        result = runner.run(suite)
        
        return result.wasSuccessful()
        
    except Exception as e:
        print(f"运行测试失败: {e}")
        return False


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='库存合并功能测试')
    parser.add_argument('--test', '-t', help='运行特定测试类')
    parser.add_argument('--coverage', '-c', action='store_true', help='生成测试覆盖率报告')
    
    args = parser.parse_args()
    
    if args.test:
        # 运行特定测试
        success = run_specific_test(args.test)
    else:
        # 运行所有测试
        success = run_inventory_tests()
    
    # 根据测试结果设置退出码
    sys.exit(0 if success else 1)