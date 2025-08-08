#!/usr/bin/env python3
"""
数据同步系统测试运行器
统一执行和管理所有测试用例
"""
import os
import sys
import time
import json
import logging
from datetime import datetime
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 导入测试模块
from tests.integration.test_auth_flow import TestAuthFlow
from tests.integration.test_data_fetch import TestDataFetch
from tests.utils.test_config import TEST_ENV_CONFIG

class TestRunner:
    """测试运行器类"""
    
    def __init__(self):
        """初始化测试运行器"""
        self.setup_logging()
        self.test_results = {}
        self.start_time = None
        self.end_time = None
        
        # 创建输出目录
        self.output_dir = Path(TEST_ENV_CONFIG["test_output_dir"])
        self.output_dir.mkdir(exist_ok=True)
        
        print(f"测试运行器初始化完成")
        print(f"输出目录: {self.output_dir}")
    
    def setup_logging(self):
        """设置测试日志"""
        logging.basicConfig(
            level=getattr(logging, TEST_ENV_CONFIG["log_level"]),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler('tests/test.log', encoding='utf-8')
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def run_auth_tests(self):
        """运行认证测试"""
        print(f"\\n🔐 开始认证测试...")
        
        try:
            auth_tester = TestAuthFlow()
            auth_results = auth_tester.run_comprehensive_auth_test()
            
            self.test_results["auth_tests"] = {
                "status": "completed",
                "results": auth_results,
                "summary": {
                    "total": len(auth_results),
                    "passed": sum(1 for v in auth_results.values() if v),
                    "failed": sum(1 for v in auth_results.values() if not v)
                }
            }
            
            return True
            
        except Exception as e:
            self.logger.error(f"认证测试异常: {e}")
            self.test_results["auth_tests"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    def run_data_fetch_tests(self):
        """运行数据抓取测试"""
        print(f"\\n📊 开始数据抓取测试...")
        
        try:
            fetch_tester = TestDataFetch()
            fetch_results = fetch_tester.run_comprehensive_fetch_test()
            
            self.test_results["data_fetch_tests"] = {
                "status": "completed",
                "results": fetch_results,
                "summary": {
                    "total": len(fetch_results),
                    "passed": sum(1 for v in fetch_results.values() if v),
                    "failed": sum(1 for v in fetch_results.values() if not v)
                }
            }
            
            return True
            
        except Exception as e:
            self.logger.error(f"数据抓取测试异常: {e}")
            self.test_results["data_fetch_tests"] = {
                "status": "error", 
                "error": str(e)
            }
            return False
    
    def run_database_tests(self):
        """运行数据库测试"""
        print(f"\\n💾 开始数据库连接测试...")
        
        try:
            # 简单的数据库连接测试
            from src.database import db_manager
            
            # 测试数据库连接
            connection_success = db_manager.test_connection()
            
            # 测试基本查询
            if connection_success:
                try:
                    result = db_manager.execute_single("SELECT COUNT(*) as count FROM sync_task_logs")
                    task_count = result.get('count', 0) if result else 0
                    print(f"数据库连接成功，当前任务记录数: {task_count}")
                    
                    db_test_results = {
                        "connection": True,
                        "basic_query": True,
                        "task_count": task_count
                    }
                    
                except Exception as e:
                    print(f"数据库查询失败: {e}")
                    db_test_results = {
                        "connection": True,
                        "basic_query": False,
                        "error": str(e)
                    }
            else:
                print(f"数据库连接失败")
                db_test_results = {
                    "connection": False,
                    "basic_query": False
                }
            
            self.test_results["database_tests"] = {
                "status": "completed",
                "results": db_test_results,
                "summary": {
                    "connection_ok": db_test_results.get("connection", False)
                }
            }
            
            return db_test_results.get("connection", False)
            
        except Exception as e:
            self.logger.error(f"数据库测试异常: {e}")
            self.test_results["database_tests"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    def run_configuration_tests(self):
        """运行配置测试"""
        print(f"\\n⚙️ 开始配置验证测试...")
        
        try:
            from src.config import settings
            
            config_results = {}
            
            # 测试配置加载
            try:
                all_config = settings.get_all()
                config_results["config_loaded"] = True
                config_results["config_sections"] = list(all_config.keys())
            except Exception as e:
                config_results["config_loaded"] = False
                config_results["config_error"] = str(e)
            
            # 测试配置验证
            try:
                validation_result = settings.validate_config()
                config_results["config_valid"] = validation_result
            except Exception as e:
                config_results["config_valid"] = False
                config_results["validation_error"] = str(e)
            
            # 测试关键配置项
            key_configs = {
                "database.host": settings.get("database.host"),
                "api.base_url": settings.get("api.base_url"),
                "sync.batch_size": settings.get("sync.batch_size"),
                "scheduler.timezone": settings.get("scheduler.timezone")
            }
            
            config_results["key_configs"] = key_configs
            
            self.test_results["configuration_tests"] = {
                "status": "completed",
                "results": config_results,
                "summary": {
                    "config_loaded": config_results.get("config_loaded", False),
                    "config_valid": config_results.get("config_valid", False)
                }
            }
            
            return config_results.get("config_loaded", False) and config_results.get("config_valid", False)
            
        except Exception as e:
            self.logger.error(f"配置测试异常: {e}")
            self.test_results["configuration_tests"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    def run_integration_test(self):
        """运行集成测试"""
        print(f"\\n🔗 开始集成测试...")
        
        try:
            integration_results = {}
            
            # 测试组件导入
            print("1. 测试组件导入...")
            try:
                from src.scrapers import ProductAnalyticsScraper, FbaInventoryScraper
                from src.processors import ProductAnalyticsProcessor
                from src.scheduler import TaskScheduler
                from src.parsers import MarkdownApiParser
                
                integration_results["component_imports"] = True
                print("✅ 所有组件导入成功")
                
            except Exception as e:
                integration_results["component_imports"] = False
                integration_results["import_error"] = str(e)
                print(f"❌ 组件导入失败: {e}")
            
            # 测试调度器初始化
            print("2. 测试调度器初始化...")
            try:
                scheduler = TaskScheduler(background_mode=True)
                scheduler_status = scheduler.get_scheduler_status()
                integration_results["scheduler_init"] = True
                integration_results["scheduler_status"] = scheduler_status
                print(f"✅ 调度器初始化成功: {scheduler_status}")
                
                # 清理调度器
                scheduler.shutdown(wait=False)
                
            except Exception as e:
                integration_results["scheduler_init"] = False
                integration_results["scheduler_error"] = str(e)
                print(f"❌ 调度器初始化失败: {e}")
            
            # 测试数据模型
            print("3. 测试数据模型...")
            try:
                from src.models import ProductAnalytics, FbaInventory, InventoryDetails
                from datetime import date
                from decimal import Decimal
                
                # 创建测试数据
                test_product = ProductAnalytics(
                    product_id="TEST001",
                    data_date=date.today(),
                    sales_amount=Decimal("100.50"),
                    sales_quantity=10
                )
                
                model_valid = test_product.is_valid()
                integration_results["data_models"] = model_valid
                
                if model_valid:
                    print(f"✅ 数据模型测试通过")
                else:
                    print(f"❌ 数据模型验证失败")
                
            except Exception as e:
                integration_results["data_models"] = False
                integration_results["model_error"] = str(e)
                print(f"❌ 数据模型测试失败: {e}")
            
            self.test_results["integration_tests"] = {
                "status": "completed",
                "results": integration_results,
                "summary": {
                    "components_ok": integration_results.get("component_imports", False),
                    "scheduler_ok": integration_results.get("scheduler_init", False),
                    "models_ok": integration_results.get("data_models", False)
                }
            }
            
            # 判断集成测试是否通过
            passed_items = sum(1 for k, v in integration_results.items() 
                             if isinstance(v, bool) and v)
            total_items = sum(1 for v in integration_results.values() 
                            if isinstance(v, bool))
            
            return passed_items >= total_items * 0.8  # 80%通过率
            
        except Exception as e:
            self.logger.error(f"集成测试异常: {e}")
            self.test_results["integration_tests"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    def generate_test_report(self):
        """生成测试报告"""
        report_data = {
            "test_info": {
                "start_time": self.start_time.isoformat() if self.start_time else None,
                "end_time": self.end_time.isoformat() if self.end_time else None,
                "duration_seconds": (self.end_time - self.start_time).total_seconds() if self.start_time and self.end_time else None,
                "total_test_suites": len(self.test_results)
            },
            "test_results": self.test_results,
            "summary": self._calculate_summary()
        }
        
        # 保存JSON报告
        json_report_path = self.output_dir / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(json_report_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)
        
        # 生成HTML报告
        html_report_path = self.output_dir / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        self._generate_html_report(report_data, html_report_path)
        
        print(f"\\n📄 测试报告已生成:")
        print(f"JSON报告: {json_report_path}")
        print(f"HTML报告: {html_report_path}")
        
        return report_data
    
    def _calculate_summary(self):
        """计算测试总结"""
        total_suites = len(self.test_results)
        passed_suites = 0
        total_tests = 0
        passed_tests = 0
        
        for suite_name, suite_data in self.test_results.items():
            if suite_data.get("status") == "completed":
                passed_suites += 1
                
                if "summary" in suite_data:
                    summary = suite_data["summary"]
                    total_tests += summary.get("total", 0)
                    passed_tests += summary.get("passed", 0)
        
        return {
            "total_suites": total_suites,
            "passed_suites": passed_suites,
            "failed_suites": total_suites - passed_suites,
            "suite_success_rate": passed_suites / total_suites if total_suites > 0 else 0,
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "test_success_rate": passed_tests / total_tests if total_tests > 0 else 0
        }
    
    def _generate_html_report(self, report_data, output_path):
        """生成HTML测试报告"""
        html_content = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>数据同步系统测试报告</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1, h2, h3 {{ color: #333; }}
        .summary {{ background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0; }}
        .test-suite {{ border: 1px solid #ddd; margin: 10px 0; border-radius: 5px; }}
        .suite-header {{ background: #f8f9fa; padding: 10px; font-weight: bold; cursor: pointer; }}
        .suite-content {{ padding: 15px; display: none; }}
        .passed {{ color: #28a745; }}
        .failed {{ color: #dc3545; }}
        .error {{ color: #fd7e14; }}
        .status-badge {{ padding: 3px 8px; border-radius: 12px; font-size: 12px; color: white; }}
        .status-passed {{ background-color: #28a745; }}
        .status-failed {{ background-color: #dc3545; }}
        .status-error {{ background-color: #fd7e14; }}
        table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f8f9fa; }}
        .progress-bar {{ width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; }}
        .progress-fill {{ height: 100%; background-color: #28a745; transition: width 0.3s ease; }}
    </style>
    <script>
        function toggleSuite(id) {{
            var content = document.getElementById(id);
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        }}
    </script>
</head>
<body>
    <div class="container">
        <h1>🧪 数据同步系统测试报告</h1>
        
        <div class="summary">
            <h2>📊 测试概览</h2>
            <p><strong>测试时间:</strong> {report_data['test_info']['start_time']} ~ {report_data['test_info']['end_time']}</p>
            <p><strong>测试耗时:</strong> {report_data['test_info']['duration_seconds']:.1f} 秒</p>
            
            <h3>测试套件结果</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {report_data['summary']['suite_success_rate']*100:.1f}%"></div>
            </div>
            <p>
                总共 {report_data['summary']['total_suites']} 个测试套件，
                <span class="passed">通过 {report_data['summary']['passed_suites']} 个</span>，
                <span class="failed">失败 {report_data['summary']['failed_suites']} 个</span>
                (成功率: {report_data['summary']['suite_success_rate']*100:.1f}%)
            </p>
            
            <h3>测试用例结果</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {report_data['summary']['test_success_rate']*100:.1f}%"></div>
            </div>
            <p>
                总共 {report_data['summary']['total_tests']} 个测试用例，
                <span class="passed">通过 {report_data['summary']['passed_tests']} 个</span>，
                <span class="failed">失败 {report_data['summary']['failed_tests']} 个</span>
                (成功率: {report_data['summary']['test_success_rate']*100:.1f}%)
            </p>
        </div>
        
        <h2>📋 详细测试结果</h2>
        """
        
        # 生成每个测试套件的详细信息
        for suite_name, suite_data in report_data['test_results'].items():
            status = suite_data.get('status', 'unknown')
            
            if status == 'completed':
                status_class = 'status-passed'
                status_text = '✅ 完成'
            elif status == 'error':
                status_class = 'status-error'  
                status_text = '❌ 错误'
            else:
                status_class = 'status-failed'
                status_text = '⚠️ 未知'
            
            html_content += f"""
        <div class="test-suite">
            <div class="suite-header" onclick="toggleSuite('{suite_name}')">
                {suite_name.replace('_', ' ').title()} 
                <span class="status-badge {status_class}">{status_text}</span>
            </div>
            <div class="suite-content" id="{suite_name}">
            """
            
            if status == 'completed' and 'results' in suite_data:
                html_content += "<table><tr><th>测试项</th><th>结果</th></tr>"
                for test_name, result in suite_data['results'].items():
                    result_text = "✅ 通过" if result else "❌ 失败"
                    result_class = "passed" if result else "failed"
                    html_content += f"<tr><td>{test_name}</td><td class='{result_class}'>{result_text}</td></tr>"
                html_content += "</table>"
            elif status == 'error':
                html_content += f"<p class='error'>错误信息: {suite_data.get('error', '未知错误')}</p>"
            
            html_content += "</div></div>"
        
        html_content += """
        </div>
        
        <footer style="margin-top: 40px; text-align: center; color: #666;">
            <p>报告生成时间: """ + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + """</p>
            <p>赛狐ERP数据同步系统 v1.0</p>
        </footer>
    </div>
</body>
</html>"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    
    def run_all_tests(self):
        """运行所有测试"""
        self.start_time = datetime.now()
        
        print(f"\\n{'='*80}")
        print(f"🚀 开始执行数据同步系统完整测试")
        print(f"测试开始时间: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*80}")
        
        # 执行各类测试
        test_sequence = [
            ("配置验证", self.run_configuration_tests),
            ("数据库连接", self.run_database_tests),  
            ("集成测试", self.run_integration_test),
            ("认证功能", self.run_auth_tests),
            ("数据抓取", self.run_data_fetch_tests)
        ]
        
        overall_success = True
        
        for test_name, test_func in test_sequence:
            print(f"\\n{'='*60}")
            print(f"🧪 执行 {test_name} 测试...")
            print(f"{'='*60}")
            
            try:
                success = test_func()
                if not success:
                    overall_success = False
                    print(f"⚠️ {test_name} 测试存在问题")
                else:
                    print(f"✅ {test_name} 测试通过")
                    
            except Exception as e:
                self.logger.error(f"{test_name} 测试异常: {e}")
                overall_success = False
                print(f"❌ {test_name} 测试异常: {e}")
        
        self.end_time = datetime.now()
        
        # 生成测试报告
        report_data = self.generate_test_report()
        
        # 输出最终结果
        print(f"\\n{'='*80}")
        print(f"🏁 测试执行完成")
        print(f"测试结束时间: {self.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"总计耗时: {(self.end_time - self.start_time).total_seconds():.1f} 秒")
        print(f"{'='*80}")
        
        summary = report_data['summary']
        print(f"\\n📊 最终测试结果:")
        print(f"测试套件: {summary['passed_suites']}/{summary['total_suites']} 通过 ({summary['suite_success_rate']*100:.1f}%)")
        print(f"测试用例: {summary['passed_tests']}/{summary['total_tests']} 通过 ({summary['test_success_rate']*100:.1f}%)")
        
        if overall_success and summary['suite_success_rate'] >= 0.8:
            print(f"\\n🎉 恭喜！数据同步系统测试基本通过，可以投入使用！")
        elif summary['suite_success_rate'] >= 0.6:
            print(f"\\n⚠️ 数据同步系统基本可用，但存在一些问题需要关注")
        else:
            print(f"\\n❌ 数据同步系统存在严重问题，请检查配置和环境")
        
        return overall_success


def main():
    """主函数"""
    runner = TestRunner()
    success = runner.run_all_tests()
    
    # 根据测试结果设置退出码
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()