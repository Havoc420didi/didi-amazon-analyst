"""
同步任务作业定义

包含所有定时任务的具体实现，集成库存点合并逻辑
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List

from ..scrapers import ProductAnalyticsScraper, FbaInventoryScraper, InventoryDetailsScraper
from ..processors import ProductAnalyticsProcessor, InventoryMergeProcessor
from ..models import SyncTaskLog, InventoryPoint
from ..database import get_db_session
from ..utils.logging_utils import get_logger

logger = get_logger(__name__)


class SyncJobs:
    """同步任务作业类"""
    
    def __init__(self):
        """初始化同步作业"""
        self.logger = logger
        self.api_templates = {}
        
        # 初始化处理器
        self.product_analytics_processor = ProductAnalyticsProcessor()
        self.inventory_merge_processor = InventoryMergeProcessor()
        
        # 初始化抓取器
        from ..auth.saihu_api_client import saihu_api_client
        self.product_analytics_scraper = ProductAnalyticsScraper(saihu_api_client)
        self.fba_inventory_scraper = FbaInventoryScraper(saihu_api_client)
        self.inventory_details_scraper = InventoryDetailsScraper(saihu_api_client)
    
    def update_api_templates(self, api_templates: Dict[str, Any]):
        """更新API模板配置"""
        self.api_templates = api_templates
        self.logger.info(f"更新API模板配置，数量: {len(api_templates)}")
    
    def sync_product_analytics_yesterday(self) -> Dict[str, Any]:
        """同步昨天的产品分析数据"""
        yesterday = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        return self.sync_product_analytics_by_date(yesterday)
    
    def sync_product_analytics_by_date(self, data_date: str) -> Dict[str, Any]:
        """
        同步指定日期的产品分析数据并执行库存点合并
        
        Args:
            data_date: 数据日期，格式YYYY-MM-DD
            
        Returns:
            同步结果
        """
        task_id = f"product_analytics_{data_date}_{int(datetime.now().timestamp())}"
        
        try:
            self.logger.info(f"开始同步产品分析数据: {data_date}")
            
            # 记录任务开始
            self._log_task_start(task_id, 'product_analytics', data_date)
            
            # 第一步：抓取产品分析数据
            scrape_result = self.product_analytics_scraper.scrape_by_date(data_date)
            
            if scrape_result.get('status') != 'success':
                raise Exception(f"数据抓取失败: {scrape_result.get('error', 'Unknown error')}")
            
            raw_data = scrape_result.get('data', [])
            self.logger.info(f"抓取到原始数据: {len(raw_data)} 条")
            
            # 第二步：基础数据处理
            process_result = self.product_analytics_processor.process(raw_data)
            
            if process_result.get('status') != 'success':
                raise Exception(f"数据处理失败: {process_result.get('error', 'Unknown error')}")
            
            processed_data = process_result.get('processed_data', [])
            self.logger.info(f"处理后数据: {len(processed_data)} 条")
            
            # 第三步：执行库存点合并
            merge_result = self.inventory_merge_processor.process(processed_data, data_date)
            
            if merge_result.get('status') != 'success':
                raise Exception(f"库存合并失败: {merge_result.get('error', 'Unknown error')}")
            
            # 第四步：生成合并统计
            merge_summary = self.inventory_merge_processor.get_merge_summary(data_date)
            
            result = {
                'status': 'success',
                'task_id': task_id,
                'data_date': data_date,
                'raw_count': len(raw_data),
                'processed_count': len(processed_data),
                'merged_count': merge_result.get('merged_count', 0),
                'saved_count': merge_result.get('saved_count', 0),
                'merge_summary': merge_summary,
                'execution_time': datetime.utcnow().isoformat()
            }
            
            # 记录任务成功
            self._log_task_success(task_id, result)
            
            self.logger.info(f"产品分析数据同步完成: {result}")
            return result
            
        except Exception as e:
            error_msg = f"产品分析数据同步失败: {e}"
            self.logger.error(error_msg)
            
            # 记录任务失败
            error_result = {
                'status': 'error',
                'task_id': task_id,
                'data_date': data_date,
                'error': str(e),
                'execution_time': datetime.utcnow().isoformat()
            }
            
            self._log_task_failure(task_id, error_result)
            return error_result
    
    def sync_product_analytics_history(self, days: int = 7) -> Dict[str, Any]:
        """
        同步历史产品分析数据（前N天）
        
        Args:
            days: 历史天数，默认7天
            
        Returns:
            同步结果汇总
        """
        task_id = f"product_analytics_history_{days}days_{int(datetime.now().timestamp())}"
        
        try:
            self.logger.info(f"开始同步历史产品分析数据，天数: {days}")
            
            results = []
            success_count = 0
            
            # 逐天同步历史数据
            for i in range(1, days + 1):
                sync_date = (date.today() - timedelta(days=i)).strftime('%Y-%m-%d')
                
                try:
                    result = self.sync_product_analytics_by_date(sync_date)
                    results.append(result)
                    
                    if result.get('status') == 'success':
                        success_count += 1
                        
                except Exception as e:
                    self.logger.warning(f"同步历史数据失败，日期: {sync_date}, 错误: {e}")
                    results.append({
                        'status': 'error',
                        'data_date': sync_date,
                        'error': str(e)
                    })
            
            summary = {
                'status': 'completed',
                'task_id': task_id,
                'sync_days': days,
                'success_count': success_count,
                'failure_count': days - success_count,
                'results': results,
                'execution_time': datetime.utcnow().isoformat()
            }
            
            self.logger.info(f"历史数据同步完成: 成功 {success_count}/{days}")
            return summary
            
        except Exception as e:
            error_msg = f"历史数据同步异常: {e}"
            self.logger.error(error_msg)
            
            return {
                'status': 'error',
                'task_id': task_id,
                'error': str(e),
                'execution_time': datetime.utcnow().isoformat()
            }
    
    def sync_fba_inventory(self) -> Dict[str, Any]:
        """同步FBA库存数据"""
        task_id = f"fba_inventory_{int(datetime.now().timestamp())}"
        
        try:
            self.logger.info("开始同步FBA库存数据")
            
            # 记录任务开始
            self._log_task_start(task_id, 'fba_inventory')
            
            # 抓取FBA库存数据
            scrape_result = self.fba_inventory_scraper.scrape()
            
            if scrape_result.get('status') != 'success':
                raise Exception(f"FBA库存抓取失败: {scrape_result.get('error', 'Unknown error')}")
            
            result = {
                'status': 'success',
                'task_id': task_id,
                'data_count': scrape_result.get('data_count', 0),
                'execution_time': datetime.utcnow().isoformat()
            }
            
            # 记录任务成功
            self._log_task_success(task_id, result)
            
            self.logger.info(f"FBA库存同步完成: {result}")
            return result
            
        except Exception as e:
            error_msg = f"FBA库存同步失败: {e}"
            self.logger.error(error_msg)
            
            error_result = {
                'status': 'error',
                'task_id': task_id,
                'error': str(e),
                'execution_time': datetime.utcnow().isoformat()
            }
            
            self._log_task_failure(task_id, error_result)
            return error_result
    
    def sync_inventory_details(self) -> Dict[str, Any]:
        """同步库存明细数据"""
        task_id = f"inventory_details_{int(datetime.now().timestamp())}"
        
        try:
            self.logger.info("开始同步库存明细数据")
            
            # 记录任务开始
            self._log_task_start(task_id, 'inventory_details')
            
            # 抓取库存明细数据
            scrape_result = self.inventory_details_scraper.scrape()
            
            if scrape_result.get('status') != 'success':
                raise Exception(f"库存明细抓取失败: {scrape_result.get('error', 'Unknown error')}")
            
            result = {
                'status': 'success',
                'task_id': task_id,
                'data_count': scrape_result.get('data_count', 0),
                'execution_time': datetime.utcnow().isoformat()
            }
            
            # 记录任务成功
            self._log_task_success(task_id, result)
            
            self.logger.info(f"库存明细同步完成: {result}")
            return result
            
        except Exception as e:
            error_msg = f"库存明细同步失败: {e}"
            self.logger.error(error_msg)
            
            error_result = {
                'status': 'error',
                'task_id': task_id,
                'error': str(e),
                'execution_time': datetime.utcnow().isoformat()
            }
            
            self._log_task_failure(task_id, error_result)
            return error_result
    
    def cleanup_old_data(self, keep_days: int = 30) -> Dict[str, Any]:
        """
        清理旧数据
        
        Args:
            keep_days: 保留天数，默认30天
            
        Returns:
            清理结果
        """
        task_id = f"cleanup_{int(datetime.now().timestamp())}"
        
        try:
            self.logger.info(f"开始清理旧数据，保留天数: {keep_days}")
            
            cutoff_date = (date.today() - timedelta(days=keep_days)).strftime('%Y-%m-%d')
            
            with get_db_session() as session:
                # 清理旧的库存点数据
                deleted_points = session.query(InventoryPoint).filter(
                    InventoryPoint.data_date < cutoff_date
                ).delete()
                
                # 清理同步任务日志（保留更长时间，60天）
                log_cutoff_date = (date.today() - timedelta(days=60)).strftime('%Y-%m-%d')
                deleted_logs = session.query(SyncTaskLog).filter(
                    SyncTaskLog.created_at < log_cutoff_date
                ).delete()
                
                session.commit()
            
            result = {
                'status': 'success',
                'task_id': task_id,
                'cutoff_date': cutoff_date,
                'deleted_inventory_points': deleted_points,
                'deleted_task_logs': deleted_logs,
                'execution_time': datetime.utcnow().isoformat()
            }
            
            self.logger.info(f"数据清理完成: {result}")
            return result
            
        except Exception as e:
            error_msg = f"数据清理失败: {e}"
            self.logger.error(error_msg)
            
            return {
                'status': 'error',
                'task_id': task_id,
                'error': str(e),
                'execution_time': datetime.utcnow().isoformat()
            }
    
    def get_sync_status(self, data_date: str = None) -> Dict[str, Any]:
        """
        获取同步状态
        
        Args:
            data_date: 数据日期，默认为当天
            
        Returns:
            同步状态信息
        """
        if not data_date:
            data_date = date.today().strftime('%Y-%m-%d')
        
        try:
            # 获取库存点合并统计
            merge_summary = self.inventory_merge_processor.get_merge_summary(data_date)
            
            # 获取最近的任务执行记录
            with get_db_session() as session:
                recent_tasks = session.query(SyncTaskLog).filter(
                    SyncTaskLog.created_at >= datetime.utcnow() - timedelta(hours=24)
                ).order_by(SyncTaskLog.created_at.desc()).limit(10).all()
                
                task_summary = []
                for task in recent_tasks:
                    task_summary.append({
                        'task_id': task.task_id,
                        'task_type': task.task_type,
                        'status': task.status,
                        'created_at': task.created_at.isoformat(),
                        'data_date': task.data_date
                    })
            
            return {
                'data_date': data_date,
                'merge_summary': merge_summary,
                'recent_tasks': task_summary,
                'status_time': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"获取同步状态失败: {e}")
            return {
                'error': str(e),
                'status_time': datetime.utcnow().isoformat()
            }
    
    def _log_task_start(self, task_id: str, task_type: str, data_date: str = None):
        """记录任务开始"""
        try:
            with get_db_session() as session:
                task_log = SyncTaskLog(
                    task_id=task_id,
                    task_type=task_type,
                    status='running',
                    data_date=data_date or date.today().strftime('%Y-%m-%d'),
                    started_at=datetime.utcnow()
                )
                session.add(task_log)
                session.commit()
        except Exception as e:
            self.logger.warning(f"任务日志记录失败: {e}")
    
    def _log_task_success(self, task_id: str, result: Dict[str, Any]):
        """记录任务成功"""
        try:
            with get_db_session() as session:
                task_log = session.query(SyncTaskLog).filter(
                    SyncTaskLog.task_id == task_id
                ).first()
                
                if task_log:
                    task_log.status = 'success'
                    task_log.completed_at = datetime.utcnow()
                    task_log.result_data = str(result)
                    session.commit()
        except Exception as e:
            self.logger.warning(f"任务成功日志记录失败: {e}")
    
    def _log_task_failure(self, task_id: str, error_result: Dict[str, Any]):
        """记录任务失败"""
        try:
            with get_db_session() as session:
                task_log = session.query(SyncTaskLog).filter(
                    SyncTaskLog.task_id == task_id
                ).first()
                
                if task_log:
                    task_log.status = 'failed'
                    task_log.completed_at = datetime.utcnow()
                    task_log.error_message = error_result.get('error', '')
                    session.commit()
        except Exception as e:
            self.logger.warning(f"任务失败日志记录失败: {e}")