"""
任务调度器
使用APScheduler管理定时同步任务
"""
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
import pytz
from ..config import settings, DatabaseConfig

logger = logging.getLogger(__name__)

class TaskScheduler:
    """任务调度器类"""
    
    def __init__(self, background_mode: bool = True):
        """初始化调度器"""
        self.background_mode = background_mode
        self.scheduler = None
        self.timezone = pytz.timezone(settings.get('scheduler.timezone', 'Asia/Shanghai'))
        self._setup_scheduler()
        logger.info(f"任务调度器初始化完成 (模式: {'后台' if background_mode else '阻塞'})")
    
    def _setup_scheduler(self):
        """设置调度器配置"""
        # 配置作业存储
        jobstores = {
            'default': SQLAlchemyJobStore(url=DatabaseConfig.get_connection_url())
        }
        
        # 配置执行器
        executors = {
            'default': ThreadPoolExecutor(max_workers=settings.get('sync.parallel_workers', 4))
        }
        
        # 调度器配置
        job_defaults = {
            'coalesce': settings.get('scheduler.coalesce', True),
            'max_instances': settings.get('scheduler.max_instances', 1),
            'misfire_grace_time': settings.get('scheduler.misfire_grace_time', 300)
        }
        
        # 创建调度器
        if self.background_mode:
            self.scheduler = BackgroundScheduler(
                jobstores=jobstores,
                executors=executors,
                job_defaults=job_defaults,
                timezone=self.timezone
            )
        else:
            self.scheduler = BlockingScheduler(
                jobstores=jobstores,
                executors=executors,
                job_defaults=job_defaults,
                timezone=self.timezone
            )
        
        # 添加事件监听器
        self.scheduler.add_listener(self._job_executed, EVENT_JOB_EXECUTED)
        self.scheduler.add_listener(self._job_error, EVENT_JOB_ERROR)
    
    def add_job(self, 
                func,
                trigger_type: str = 'cron',
                job_id: str = None,
                **trigger_args) -> str:
        """添加定时任务"""
        try:
            job = self.scheduler.add_job(
                func=func,
                trigger=trigger_type,
                id=job_id,
                replace_existing=True,
                **trigger_args
            )
            
            logger.info(f"添加定时任务成功: {job.id}")
            return job.id
            
        except Exception as e:
            logger.error(f"添加定时任务失败: {e}")
            raise
    
    def add_cron_job(self,
                    func,
                    hour: int,
                    minute: int = 0,
                    second: int = 0,
                    job_id: str = None,
                    **kwargs) -> str:
        """添加cron定时任务"""
        return self.add_job(
            func=func,
            trigger_type='cron',
            job_id=job_id,
            hour=hour,
            minute=minute,
            second=second,
            **kwargs
        )
    
    def add_interval_job(self,
                        func,
                        minutes: int = None,
                        hours: int = None,
                        seconds: int = None,
                        job_id: str = None,
                        **kwargs) -> str:
        """添加间隔定时任务"""
        return self.add_job(
            func=func,
            trigger_type='interval',
            job_id=job_id,
            minutes=minutes,
            hours=hours,
            seconds=seconds,
            **kwargs
        )
    
    def remove_job(self, job_id: str) -> bool:
        """移除定时任务"""
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"移除定时任务成功: {job_id}")
            return True
        except Exception as e:
            logger.error(f"移除定时任务失败: {e}")
            return False
    
    def pause_job(self, job_id: str) -> bool:
        """暂停定时任务"""
        try:
            self.scheduler.pause_job(job_id)
            logger.info(f"暂停定时任务成功: {job_id}")
            return True
        except Exception as e:
            logger.error(f"暂停定时任务失败: {e}")
            return False
    
    def resume_job(self, job_id: str) -> bool:
        """恢复定时任务"""
        try:
            self.scheduler.resume_job(job_id)
            logger.info(f"恢复定时任务成功: {job_id}")
            return True
        except Exception as e:
            logger.error(f"恢复定时任务失败: {e}")
            return False
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态"""
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                return {
                    'id': job.id,
                    'name': job.name,
                    'func': str(job.func),
                    'trigger': str(job.trigger),
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                    'pending': job.pending
                }
            return None
        except Exception as e:
            logger.error(f"获取任务状态失败: {e}")
            return None
    
    def list_jobs(self) -> list:
        """列出所有任务"""
        try:
            jobs = []
            for job in self.scheduler.get_jobs():
                jobs.append({
                    'id': job.id,
                    'name': job.name,
                    'func': str(job.func),
                    'trigger': str(job.trigger),
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                    'pending': job.pending
                })
            return jobs
        except Exception as e:
            logger.error(f"列出任务失败: {e}")
            return []
    
    def start(self) -> None:
        """启动调度器"""
        try:
            if not self.scheduler.running:
                self.scheduler.start()
                logger.info("任务调度器启动成功")
            else:
                logger.warning("任务调度器已经在运行")
        except Exception as e:
            logger.error(f"启动调度器失败: {e}")
            raise
    
    def shutdown(self, wait: bool = True) -> None:
        """关闭调度器"""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown(wait=wait)
                logger.info("任务调度器已关闭")
            else:
                logger.warning("任务调度器未在运行")
        except Exception as e:
            logger.error(f"关闭调度器失败: {e}")
    
    def run_job_now(self, job_id: str) -> bool:
        """立即执行指定任务"""
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                job.modify(next_run_time=datetime.now(self.timezone))
                logger.info(f"任务 {job_id} 已设置为立即执行")
                return True
            else:
                logger.error(f"任务 {job_id} 不存在")
                return False
        except Exception as e:
            logger.error(f"立即执行任务失败: {e}")
            return False
    
    def _job_executed(self, event):
        """任务执行成功事件处理"""
        logger.info(f"任务执行成功: {event.job_id}, 执行时间: {event.scheduled_run_time}")
    
    def _job_error(self, event):
        """任务执行失败事件处理"""
        logger.error(f"任务执行失败: {event.job_id}, 错误: {event.exception}")
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """获取调度器状态"""
        try:
            return {
                'running': self.scheduler.running,
                'timezone': str(self.timezone),
                'job_count': len(self.scheduler.get_jobs()),
                'state': str(self.scheduler.state)
            }
        except Exception as e:
            logger.error(f"获取调度器状态失败: {e}")
            return {'error': str(e)}
    
    def __enter__(self):
        """上下文管理器入口"""
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器出口"""
        self.shutdown()