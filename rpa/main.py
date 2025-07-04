#!/usr/bin/env python
"""
Pipiads RPA系统主启动脚本
整合所有模块，实现完整的自动化工作流程
"""

import schedule
import time
import logging
import argparse
import sys
import signal
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import json

# 导入自定义模块
from data_collector import PipiadsCollector
from data_processor import DataProcessor
from report_generator import ReportGenerator
from human_collaboration import HumanCollaborationManager
from config import *

class PipiadsRPASystem:
    """Pipiads RPA系统主控制器"""
    
    def __init__(self):
        self.logger = self._setup_logger()
        self.running = False
        self.components = {}
        self.session_stats = {
            'start_time': None,
            'tasks_completed': 0,
            'errors_encountered': 0,
            'last_successful_run': None
        }
        
        # 注册信号处理器
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        # 初始化组件
        self._initialize_components()
        
    def _setup_logger(self) -> logging.Logger:
        """设置主系统日志记录器"""
        logger = logging.getLogger('PipiadsRPASystem')
        logger.setLevel(logging.INFO)
        
        # 确保日志目录存在
        os.makedirs(os.path.dirname(get_output_path(PATHS['activity_log'])), exist_ok=True)
        
        # 文件处理器
        log_file = get_output_path(PATHS['activity_log'])
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.INFO)
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # 格式器
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        return logger
    
    def _initialize_components(self):
        """初始化系统组件"""
        try:
            self.logger.info("初始化RPA系统组件...")
            
            # 初始化各个模块
            self.components['collector'] = PipiadsCollector()
            self.components['processor'] = DataProcessor()
            self.components['reporter'] = ReportGenerator()
            self.components['collaboration'] = HumanCollaborationManager()
            
            # 注册人机协作回调
            self._register_collaboration_callbacks()
            
            self.logger.info("系统组件初始化完成")
            
        except Exception as e:
            self.logger.error(f"组件初始化失败: {e}")
            raise
    
    def _register_collaboration_callbacks(self):
        """注册人机协作回调函数"""
        def handle_high_potential_product(item, result, comments):
            """处理高潜力产品审核结果"""
            if result == 'approved':
                self.logger.info(f"A级产品已批准开发: {item['item_data'].get('product_name')}")
                # 这里可以触发开发流程
            elif result == 'rejected':
                self.logger.info(f"A级产品已拒绝: {comments}")
        
        def handle_data_anomaly(item, result, comments):
            """处理数据异常审核结果"""
            if result == 'accepted':
                self.logger.info("数据异常已接受，继续处理")
            else:
                self.logger.warning(f"数据异常需要关注: {comments}")
        
        # 注册回调函数
        collaboration = self.components['collaboration']
        collaboration.register_callback('high_potential_product', handle_high_potential_product)
        collaboration.register_callback('data_anomaly', handle_data_anomaly)
    
    def _signal_handler(self, signum, frame):
        """信号处理器"""
        self.logger.info(f"接收到信号 {signum}，正在优雅关闭...")
        self.running = False
    
    def daily_workflow(self):
        """每日完整工作流程"""
        try:
            self.logger.info("🚀 开始每日工作流程")
            workflow_start = datetime.now()
            
            # 步骤1: 数据采集
            self.logger.info("📊 步骤1: 开始数据采集")
            collected_data = self._execute_data_collection()
            
            if not collected_data:
                self.logger.error("数据采集失败，终止工作流程")
                return False
            
            # 步骤2: 数据处理和分析
            self.logger.info("🔬 步骤2: 开始数据处理和分析")
            analysis_results = self._execute_data_processing(collected_data)
            
            if not analysis_results:
                self.logger.error("数据处理失败，终止工作流程")
                return False
            
            # 步骤3: 生成报告
            self.logger.info("📈 步骤3: 开始生成报告")
            report_files = self._execute_report_generation(analysis_results)
            
            # 步骤4: 人机协作处理
            self.logger.info("🤝 步骤4: 处理人机协作任务")
            self._handle_collaboration_tasks()
            
            # 记录成功完成
            workflow_duration = datetime.now() - workflow_start
            self.session_stats['tasks_completed'] += 1
            self.session_stats['last_successful_run'] = datetime.now().isoformat()
            
            self.logger.info(f"✅ 每日工作流程完成，耗时: {workflow_duration}")
            
            # 发送完成通知
            self._send_completion_notification(analysis_results, report_files, workflow_duration)
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ 每日工作流程失败: {e}")
            self.session_stats['errors_encountered'] += 1
            self._send_error_notification(str(e))
            return False
    
    def _execute_data_collection(self) -> Optional[str]:
        """执行数据采集"""
        try:
            collector = self.components['collector']
            
            # 启动采集会话
            if not collector.start_session():
                raise Exception("采集会话启动失败")
            
            try:
                # 登录
                if not collector.login():
                    raise Exception("登录失败")
                
                # 设置筛选器
                if not collector.setup_search_filters():
                    raise Exception("筛选器设置失败")
                
                # 获取今日关键词并搜索
                today_keywords = get_today_keywords()
                self.logger.info(f"今日搜索关键词: {today_keywords}")
                
                if not collector.search_products(today_keywords):
                    raise Exception("产品搜索失败")
                
                # 监控竞品（如果配置了竞品列表）
                competitor_products = self._get_competitor_products()
                if competitor_products:
                    collector.monitor_competitors(competitor_products)
                
                # 保存数据
                if not collector.save_data():
                    raise Exception("数据保存失败")
                
                # 生成会话总结
                session_summary = collector.generate_session_summary()
                self.logger.info(f"采集总结: {session_summary}")
                
                return get_output_path(PATHS['daily_scan_file'])
                
            finally:
                collector.close_session()
                
        except Exception as e:
            self.logger.error(f"数据采集执行失败: {e}")
            return None
    
    def _execute_data_processing(self, data_file: str) -> Optional[Dict[str, Any]]:
        """执行数据处理和分析"""
        try:
            processor = self.components['processor']
            
            # 处理数据
            analysis_results = processor.process_data(data_file)
            
            if not analysis_results:
                raise Exception("数据处理返回空结果")
            
            # 检查是否有需要人工审核的项目
            self._check_for_human_review_items(processor)
            
            return analysis_results
            
        except Exception as e:
            self.logger.error(f"数据处理执行失败: {e}")
            return None
    
    def _execute_report_generation(self, analysis_results: Dict[str, Any]) -> Dict[str, str]:
        """执行报告生成"""
        try:
            reporter = self.components['reporter']
            processor = self.components['processor']
            
            # 生成完整报告
            report_files = reporter.generate_full_report(
                processor.processed_data,
                analysis_results,
                processor.alerts
            )
            
            if report_files:
                self.logger.info(f"报告生成完成: {list(report_files.keys())}")
            
            return report_files
            
        except Exception as e:
            self.logger.error(f"报告生成执行失败: {e}")
            return {}
    
    def _handle_collaboration_tasks(self):
        """处理人机协作任务"""
        try:
            collaboration = self.components['collaboration']
            
            # 运行维护任务
            collaboration.run_maintenance_tasks()
            
            # 检查逾期项目
            overdue_items = collaboration.check_overdue_items()
            if overdue_items:
                self.logger.warning(f"发现 {len(overdue_items)} 个逾期审核项目")
            
            # 生成审核仪表板
            dashboard_file = collaboration.generate_review_dashboard()
            if dashboard_file:
                self.logger.info(f"审核仪表板已更新: {dashboard_file}")
                
        except Exception as e:
            self.logger.error(f"人机协作任务处理失败: {e}")
    
    def _check_for_human_review_items(self, processor: DataProcessor):
        """检查是否有需要人工审核的项目"""
        try:
            if not processor.processed_data is None and len(processor.processed_data) > 0:
                collaboration = self.components['collaboration']
                
                # 检查A级产品
                a_level_products = processor.processed_data[
                    processor.processed_data.get('recommendation_level', '') == 'A'
                ]
                
                for _, product in a_level_products.iterrows():
                    collaboration.add_review_item(
                        item_type='high_potential_product',
                        item_data=product.to_dict(),
                        reason=f'A级高潜力产品需要开发可行性评估',
                        priority=Priority.HIGH,
                        due_hours=8
                    )
                
                # 检查数据异常
                if processor.alerts:
                    for alert in processor.alerts:
                        if alert.get('level') == 'warning':
                            collaboration.add_review_item(
                                item_type='data_anomaly',
                                item_data=alert,
                                reason=f'数据异常需要人工确认: {alert.get("message")}',
                                priority=Priority.MEDIUM,
                                due_hours=24
                            )
                            
        except Exception as e:
            self.logger.error(f"检查人工审核项目失败: {e}")
    
    def _get_competitor_products(self) -> List[str]:
        """获取竞品产品列表"""
        # 这里可以从配置文件或数据库读取竞品列表
        return [
            "LED面膜仪",
            "维C精华液",
            "玻尿酸面膜",
            "胶原蛋白粉"
        ]
    
    def competitor_monitoring(self):
        """竞品专项监控"""
        try:
            self.logger.info("🔍 开始竞品专项监控")
            
            collector = self.components['collector']
            
            if not collector.start_session():
                raise Exception("采集会话启动失败")
            
            try:
                if not collector.login():
                    raise Exception("登录失败")
                
                competitor_products = self._get_competitor_products()
                competitor_data = collector.monitor_competitors(competitor_products)
                
                if competitor_data:
                    # 保存竞品数据
                    competitor_file = get_output_path(PATHS['competitor_monitor_file'])
                    competitor_df = pd.DataFrame(competitor_data).T
                    competitor_df.to_csv(competitor_file, index=False, encoding='utf-8')
                    
                    self.logger.info(f"竞品监控完成，数据已保存: {competitor_file}")
                
            finally:
                collector.close_session()
                
        except Exception as e:
            self.logger.error(f"竞品监控失败: {e}")
    
    def system_maintenance(self):
        """系统维护任务"""
        try:
            self.logger.info("🛠️ 开始系统维护")
            
            # 清理临时文件
            self._cleanup_temp_files()
            
            # 压缩旧日志
            self._compress_old_logs()
            
            # 优化数据库
            self._optimize_database()
            
            # 检查系统健康状态
            health_status = self._check_system_health()
            
            # 生成维护报告
            self._generate_maintenance_report(health_status)
            
            self.logger.info("系统维护完成")
            
        except Exception as e:
            self.logger.error(f"系统维护失败: {e}")
    
    def _cleanup_temp_files(self):
        """清理临时文件"""
        import glob
        
        temp_patterns = [
            'downloads/*.tmp',
            'outputs/*.tmp',
            '*.pyc',
            '__pycache__/*'
        ]
        
        for pattern in temp_patterns:
            files = glob.glob(pattern)
            for file in files:
                try:
                    os.remove(file)
                except:
                    pass
    
    def _compress_old_logs(self):
        """压缩旧日志文件"""
        import glob
        import gzip
        
        # 压缩7天前的日志
        cutoff_date = datetime.now() - timedelta(days=7)
        log_files = glob.glob('logs/*.log')
        
        for log_file in log_files:
            if os.path.getmtime(log_file) < cutoff_date.timestamp():
                try:
                    with open(log_file, 'rb') as f_in:
                        with gzip.open(f"{log_file}.gz", 'wb') as f_out:
                            f_out.writelines(f_in)
                    os.remove(log_file)
                except:
                    pass
    
    def _optimize_database(self):
        """优化数据库"""
        try:
            collaboration = self.components['collaboration']
            
            import sqlite3
            conn = sqlite3.connect(collaboration.db_path)
            conn.execute('VACUUM')
            conn.close()
            
        except Exception as e:
            self.logger.warning(f"数据库优化失败: {e}")
    
    def _check_system_health(self) -> Dict[str, Any]:
        """检查系统健康状态"""
        try:
            import psutil
            
            health_status = {
                'timestamp': datetime.now().isoformat(),
                'cpu_usage': psutil.cpu_percent(interval=1),
                'memory_usage': psutil.virtual_memory().percent,
                'disk_usage': psutil.disk_usage('.').percent,
                'system_uptime': time.time() - psutil.boot_time(),
                'rpa_session_stats': self.session_stats
            }
            
            return health_status
            
        except Exception as e:
            self.logger.error(f"系统健康检查失败: {e}")
            return {}
    
    def _generate_maintenance_report(self, health_status: Dict[str, Any]):
        """生成维护报告"""
        try:
            report_content = f"""# 系统维护报告

**维护时间：** {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}

## 系统状态
- **CPU使用率：** {health_status.get('cpu_usage', 0):.1f}%
- **内存使用率：** {health_status.get('memory_usage', 0):.1f}%
- **磁盘使用率：** {health_status.get('disk_usage', 0):.1f}%

## RPA会话统计
- **启动时间：** {self.session_stats.get('start_time', 'N/A')}
- **完成任务数：** {self.session_stats.get('tasks_completed', 0)}
- **遇到错误数：** {self.session_stats.get('errors_encountered', 0)}
- **最后成功运行：** {self.session_stats.get('last_successful_run', 'N/A')}

## 维护操作
- ✅ 临时文件清理
- ✅ 日志文件压缩
- ✅ 数据库优化
- ✅ 系统健康检查

---
*自动生成的维护报告*
"""
            
            report_file = get_output_path('./outputs/maintenance_report_{date}.md')
            with open(report_file, 'w', encoding='utf-8') as f:
                f.write(report_content)
            
            self.logger.info(f"维护报告已生成: {report_file}")
            
        except Exception as e:
            self.logger.error(f"维护报告生成失败: {e}")
    
    def _send_completion_notification(self, analysis_results: Dict[str, Any], 
                                    report_files: Dict[str, str], 
                                    duration: timedelta):
        """发送完成通知"""
        try:
            notification = {
                'type': 'workflow_completed',
                'timestamp': datetime.now().isoformat(),
                'duration': str(duration),
                'summary': {
                    'total_products': analysis_results.get('total_products', 0),
                    'high_potential_products': analysis_results.get('high_potential_count', 0),
                    'reports_generated': len(report_files)
                },
                'files': report_files
            }
            
            if NOTIFICATION_CONFIG['console_log_enabled']:
                print(f"✅ 工作流程完成通知:")
                print(f"   处理产品: {notification['summary']['total_products']} 个")
                print(f"   高潜力产品: {notification['summary']['high_potential_products']} 个")
                print(f"   耗时: {duration}")
                
        except Exception as e:
            self.logger.error(f"发送完成通知失败: {e}")
    
    def _send_error_notification(self, error_message: str):
        """发送错误通知"""
        try:
            if NOTIFICATION_CONFIG['console_log_enabled']:
                print(f"❌ 工作流程错误通知: {error_message}")
                
        except Exception as e:
            self.logger.error(f"发送错误通知失败: {e}")
    
    def start_scheduler(self):
        """启动任务调度器"""
        try:
            self.logger.info("🕐 启动任务调度器")
            self.session_stats['start_time'] = datetime.now().isoformat()
            self.running = True
            
            # 清除所有现有任务
            schedule.clear()
            
            # 安排每日任务
            schedule.every().day.at(SCHEDULE_CONFIG['daily_scan_time']).do(self.daily_workflow)
            schedule.every().day.at(SCHEDULE_CONFIG['competitor_monitor_time']).do(self.competitor_monitoring)
            
            # 安排维护任务
            schedule.every().day.at("02:00").do(self.system_maintenance)
            schedule.every().hour.do(lambda: self.components['collaboration'].check_overdue_items())
            
            self.logger.info("📅 已安排的任务:")
            self.logger.info(f"   - 每日扫描: {SCHEDULE_CONFIG['daily_scan_time']}")
            self.logger.info(f"   - 竞品监控: {SCHEDULE_CONFIG['competitor_monitor_time']}")
            self.logger.info(f"   - 系统维护: 02:00")
            self.logger.info(f"   - 审核检查: 每小时")
            
            # 主循环
            while self.running:
                schedule.run_pending()
                time.sleep(60)  # 每分钟检查一次
                
        except KeyboardInterrupt:
            self.logger.info("收到中断信号，正在关闭...")
        except Exception as e:
            self.logger.error(f"调度器运行失败: {e}")
        finally:
            self.shutdown()
    
    def run_once(self, task_name: str = 'daily'):
        """运行单次任务"""
        try:
            self.logger.info(f"🎯 运行单次任务: {task_name}")
            self.session_stats['start_time'] = datetime.now().isoformat()
            
            if task_name == 'daily':
                return self.daily_workflow()
            elif task_name == 'competitor':
                self.competitor_monitoring()
                return True
            elif task_name == 'maintenance':
                self.system_maintenance()
                return True
            else:
                self.logger.error(f"未知任务: {task_name}")
                return False
                
        except Exception as e:
            self.logger.error(f"单次任务运行失败: {e}")
            return False
    
    def shutdown(self):
        """关闭系统"""
        self.logger.info("🛑 正在关闭RPA系统...")
        self.running = False
        
        # 生成最终报告
        final_stats = self.session_stats.copy()
        final_stats['end_time'] = datetime.now().isoformat()
        
        self.logger.info(f"📊 会话统计: {final_stats}")
        self.logger.info("RPA系统已关闭")

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='Pipiads RPA系统')
    parser.add_argument('--mode', choices=['scheduler', 'once'], default='scheduler',
                       help='运行模式: scheduler(调度模式) 或 once(单次运行)')
    parser.add_argument('--task', choices=['daily', 'competitor', 'maintenance'], 
                       default='daily', help='单次运行的任务类型')
    parser.add_argument('--config-check', action='store_true', 
                       help='仅检查配置并退出')
    
    args = parser.parse_args()
    
    # 配置检查
    if args.config_check:
        try:
            validate_config()
            print("✅ 配置检查通过")
            return 0
        except Exception as e:
            print(f"❌ 配置检查失败: {e}")
            return 1
    
    # 创建RPA系统实例
    rpa_system = PipiadsRPASystem()
    
    try:
        if args.mode == 'scheduler':
            # 调度模式 - 持续运行
            rpa_system.start_scheduler()
        else:
            # 单次运行模式
            success = rpa_system.run_once(args.task)
            return 0 if success else 1
            
    except Exception as e:
        rpa_system.logger.error(f"系统运行失败: {e}")
        return 1
    finally:
        rpa_system.shutdown()

if __name__ == "__main__":
    sys.exit(main())