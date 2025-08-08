#!/usr/bin/env python3
"""
赛狐ERP数据同步系统主程序
"""
import os
import sys
import logging
import signal
from pathlib import Path
from datetime import datetime

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from src.config import settings
from src.scheduler import TaskScheduler, SyncJobs
from src.parsers import MarkdownApiParser
from src.utils import setup_logging

logger = logging.getLogger(__name__)

class DataSyncApp:
    """数据同步应用主类"""
    
    def __init__(self):
        """初始化应用"""
        self.scheduler = None
        self.sync_jobs = None
        self.running = False
        
        # 设置信号处理
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def initialize(self):
        """初始化应用组件"""
        try:
            logger.info("=== 赛狐ERP数据同步系统启动 ===")
            logger.info(f"启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"工作目录: {project_root}")
            
            # 验证配置
            if not settings.validate_config():
                raise Exception("配置验证失败")
            
            # 初始化调度器
            self.scheduler = TaskScheduler(background_mode=True)
            
            # 初始化同步作业
            self.sync_jobs = SyncJobs()
            
            # 解析API文档
            self._parse_api_documentation()
            
            # 注册定时任务
            self._register_scheduled_jobs()
            
            logger.info("应用初始化完成")
            return True
            
        except Exception as e:
            logger.error(f"应用初始化失败: {e}")
            return False
    
    def _parse_api_documentation(self):
        """解析API文档"""
        try:
            # 查找API文档文件
            api_doc_path = self._find_api_document()
            if not api_doc_path:
                logger.warning("未找到API文档文件，将使用默认配置")
                return
            
            logger.info(f"解析API文档: {api_doc_path}")
            
            # 解析MD文档
            parser = MarkdownApiParser(api_doc_path)
            apis = parser.parse_all_apis()
            
            if apis:
                # 更新同步作业的API配置
                self.sync_jobs.update_api_templates(apis)
                logger.info(f"成功解析 {len(apis)} 个API接口")
            else:
                logger.warning("API文档解析结果为空")
                
        except Exception as e:
            logger.error(f"API文档解析失败: {e}")
    
    def _find_api_document(self):
        """查找API文档文件"""
        # 可能的文档路径
        possible_paths = [
            project_root.parent / "赛狐ERP_API接口文档.md",
            project_root / "docs" / "api.md",
            project_root / "docs" / "接口文档.md",
            project_root / "api_doc.md"
        ]
        
        for path in possible_paths:
            if path.exists():
                return str(path)
        
        return None
    
    def _register_scheduled_jobs(self):
        """注册定时任务"""
        try:
            # 产品分析数据同步 - 每日01:00
            daily_time = settings.get('sync.product_analytics.daily_sync_time', '01:00')
            hour, minute = map(int, daily_time.split(':'))
            
            self.scheduler.add_cron_job(
                func=self.sync_jobs.sync_product_analytics_yesterday,
                hour=hour,
                minute=minute,
                job_id='product_analytics_daily'
            )
            
            # 产品分析历史数据更新 - 每日02:00
            history_time = settings.get('sync.product_analytics.history_update_time', '02:00')
            hour, minute = map(int, history_time.split(':'))
            
            self.scheduler.add_cron_job(
                func=self.sync_jobs.sync_product_analytics_history,
                hour=hour,
                minute=minute,
                job_id='product_analytics_history'
            )
            
            # FBA库存同步 - 每日06:00
            fba_time = settings.get('sync.fba_inventory.daily_sync_time', '06:00')
            hour, minute = map(int, fba_time.split(':'))
            
            self.scheduler.add_cron_job(
                func=self.sync_jobs.sync_fba_inventory,
                hour=hour,
                minute=minute,
                job_id='fba_inventory_daily'
            )
            
            # 库存明细同步 - 每日06:30
            inventory_time = settings.get('sync.inventory_details.daily_sync_time', '06:30')
            hour, minute = map(int, inventory_time.split(':'))
            
            self.scheduler.add_cron_job(
                func=self.sync_jobs.sync_inventory_details,
                hour=hour,
                minute=minute,
                job_id='inventory_details_daily'
            )
            
            # 数据清理任务 - 每周日凌晨03:00
            self.scheduler.add_cron_job(
                func=self.sync_jobs.cleanup_old_data,
                hour=3,
                minute=0,
                day_of_week=0,  # 周日
                job_id='data_cleanup_weekly'
            )
            
            logger.info("定时任务注册完成")
            
        except Exception as e:
            logger.error(f"注册定时任务失败: {e}")
            raise
    
    def start(self):
        """启动应用"""
        try:
            if not self.initialize():
                return False
            
            # 启动调度器
            self.scheduler.start()
            self.running = True
            
            logger.info("=== 数据同步系统启动成功 ===")
            self._print_job_summary()
            
            return True
            
        except Exception as e:
            logger.error(f"应用启动失败: {e}")
            return False
    
    def stop(self):
        """停止应用"""
        try:
            logger.info("=== 正在关闭数据同步系统 ===")
            self.running = False
            
            if self.scheduler:
                self.scheduler.shutdown(wait=True)
            
            logger.info("=== 数据同步系统已安全关闭 ===")
            
        except Exception as e:
            logger.error(f"应用关闭异常: {e}")
    
    def _signal_handler(self, signum, frame):
        """信号处理函数"""
        logger.info(f"收到信号 {signum}，正在优雅关闭...")
        self.stop()
        sys.exit(0)
    
    def _print_job_summary(self):
        """打印任务摘要"""
        if not self.scheduler:
            return
        
        jobs = self.scheduler.list_jobs()
        logger.info(f"已注册 {len(jobs)} 个定时任务:")
        
        for job in jobs:
            next_run = job.get('next_run_time', 'N/A')
            logger.info(f"  - {job['id']}: {next_run}")
    
    def run_interactive(self):
        """交互式运行模式"""
        if not self.start():
            return
        
        try:
            while self.running:
                print("\n=== 赛狐ERP数据同步系统控制台 ===")
                print("1. 查看任务状态")
                print("2. 立即执行产品分析数据同步")
                print("3. 立即执行FBA库存同步") 
                print("4. 立即执行库存明细同步")
                print("5. 查看库存合并统计")
                print("6. 立即执行库存点合并")
                print("7. 查看系统状态")
                print("8. 退出系统")
                
                choice = input("请选择操作 (1-8): ").strip()
                
                if choice == '1':
                    self._show_job_status()
                elif choice == '2':
                    self._run_job('product_analytics_daily')
                elif choice == '3':
                    self._run_job('fba_inventory_daily')
                elif choice == '4':
                    self._run_job('inventory_details_daily')
                elif choice == '5':
                    self._show_merge_statistics()
                elif choice == '6':
                    self._run_inventory_merge()
                elif choice == '7':
                    self._show_system_status()
                elif choice == '8':
                    break
                else:
                    print("无效选择，请重试")
                
                input("按回车键继续...")
        
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()
    
    def _show_job_status(self):
        """显示任务状态"""
        jobs = self.scheduler.list_jobs()
        print(f"\n当前共有 {len(jobs)} 个定时任务:")
        
        for job in jobs:
            print(f"  任务ID: {job['id']}")
            print(f"  下次执行: {job.get('next_run_time', 'N/A')}")
            print(f"  状态: {'等待中' if job.get('pending') else '就绪'}")
            print("-" * 40)
    
    def _run_job(self, job_id: str):
        """立即执行指定任务"""
        print(f"正在执行任务: {job_id}")
        success = self.scheduler.run_job_now(job_id)
        
        if success:
            print("任务已添加到执行队列")
        else:
            print("任务执行失败")
    
    def _show_merge_statistics(self):
        """显示库存合并统计"""
        try:
            from datetime import date
            today = date.today().strftime('%Y-%m-%d')
            
            # 获取同步状态
            sync_status = self.sync_jobs.get_sync_status(today)
            merge_summary = sync_status.get('merge_summary', {})
            
            print(f"\n=== 库存合并统计 (数据日期: {today}) ===")
            print(f"  库存点总数: {merge_summary.get('total_points', 0)}")
            print(f"  欧盟库存点: {merge_summary.get('eu_points', 0)}")
            print(f"  非欧盟库存点: {merge_summary.get('non_eu_points', 0)}")
            print(f"  周转超标: {merge_summary.get('turnover_exceeded', 0)}")
            print(f"  断货情况: {merge_summary.get('out_of_stock', 0)}")
            print(f"  有效库存点: {merge_summary.get('effective_points', 0)}")
            print(f"  有效率: {merge_summary.get('effectiveness_rate', 0)*100:.2f}%")
            
            # 显示最近任务
            recent_tasks = sync_status.get('recent_tasks', [])
            if recent_tasks:
                print(f"\n=== 最近任务执行记录 ===")
                for task in recent_tasks[:5]:
                    print(f"  {task['created_at'][:19]} - {task['task_type']} - {task['status']}")
            
        except Exception as e:
            print(f"获取合并统计失败: {e}")
    
    def _run_inventory_merge(self):
        """立即执行库存点合并"""
        try:
            from datetime import date
            
            data_date = input("请输入数据日期 (YYYY-MM-DD, 回车使用今天): ").strip()
            if not data_date:
                data_date = date.today().strftime('%Y-%m-%d')
            
            print(f"开始执行库存点合并，数据日期: {data_date}")
            
            # 执行合并任务
            result = self.sync_jobs.sync_product_analytics_by_date(data_date)
            
            if result.get('status') == 'success':
                print("✅ 库存点合并执行成功")
                print(f"  原始数据: {result.get('raw_count', 0)} 条")
                print(f"  处理数据: {result.get('processed_count', 0)} 条")
                print(f"  合并后: {result.get('merged_count', 0)} 个库存点")
                print(f"  保存数量: {result.get('saved_count', 0)} 条")
            else:
                print("❌ 库存点合并执行失败")
                print(f"  错误信息: {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"执行库存点合并异常: {e}")
    
    def _show_system_status(self):
        """显示系统状态"""
        status = self.scheduler.get_scheduler_status()
        print(f"\n系统状态:")
        print(f"  调度器运行状态: {'运行中' if status.get('running') else '停止'}")
        print(f"  时区: {status.get('timezone')}")
        print(f"  任务数量: {status.get('job_count')}")
        print(f"  调度器状态: {status.get('state')}")


def main():
    """主函数"""
    try:
        # 设置日志
        setup_logging()
        
        # 创建应用实例
        app = DataSyncApp()
        
        # 检查命令行参数
        if len(sys.argv) > 1:
            command = sys.argv[1].lower()
            
            if command == 'start':
                # 后台模式启动
                if app.start():
                    try:
                        # 保持程序运行
                        while app.running:
                            import time
                            time.sleep(1)
                    except KeyboardInterrupt:
                        pass
                    finally:
                        app.stop()
            
            elif command == 'interactive':
                # 交互模式
                app.run_interactive()
            
            elif command == 'test':
                # 测试模式
                logger.info("测试模式 - 仅初始化组件")
                if app.initialize():
                    logger.info("组件初始化成功")
                    app.stop()
                else:
                    logger.error("组件初始化失败")
                    sys.exit(1)
            
            else:
                print("使用方法:")
                print("  python main.py start      # 启动数据同步服务")
                print("  python main.py interactive # 交互模式")
                print("  python main.py test       # 测试模式")
        
        else:
            # 默认交互模式
            app.run_interactive()
    
    except Exception as e:
        logger.error(f"程序异常退出: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()