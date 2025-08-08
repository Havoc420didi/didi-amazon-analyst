"""
同步任务记录模型
"""
from datetime import datetime, date
from typing import Optional, Dict, Any
from enum import Enum
from .base import BaseModel

class TaskType(Enum):
    """任务类型枚举"""
    PRODUCT_ANALYTICS = 'product_analytics'
    FBA_INVENTORY = 'fba_inventory'
    INVENTORY_DETAILS = 'inventory_details'

class TaskStatus(Enum):
    """任务状态枚举"""
    RUNNING = 'running'
    SUCCESS = 'success'
    FAILED = 'failed'
    TIMEOUT = 'timeout'

class SyncTaskLog(BaseModel):
    """同步任务记录模型"""
    
    def __init__(self,
                 task_type: str = None,
                 task_date: date = None,
                 status: str = None,
                 start_time: Optional[datetime] = None,
                 end_time: Optional[datetime] = None,
                 duration_seconds: Optional[int] = 0,
                 records_processed: Optional[int] = 0,
                 records_success: Optional[int] = 0,
                 records_failed: Optional[int] = 0,
                 error_message: Optional[str] = None,
                 api_calls_count: Optional[int] = 0,
                 retry_count: Optional[int] = 0,
                 created_at: Optional[datetime] = None,
                 updated_at: Optional[datetime] = None,
                 id: Optional[int] = None):
        """初始化同步任务记录"""
        self.id = id
        self.task_type = task_type
        self.task_date = task_date
        self.status = status or TaskStatus.RUNNING.value
        self.start_time = start_time
        self.end_time = end_time
        self.duration_seconds = duration_seconds or 0
        self.records_processed = records_processed or 0
        self.records_success = records_success or 0
        self.records_failed = records_failed or 0
        self.error_message = error_message
        self.api_calls_count = api_calls_count or 0
        self.retry_count = retry_count or 0
        self.created_at = created_at
        self.updated_at = updated_at
    
    def start_task(self) -> None:
        """开始任务"""
        self.status = TaskStatus.RUNNING.value
        self.start_time = datetime.now()
        self.error_message = None
    
    def complete_task(self, success: bool = True) -> None:
        """完成任务"""
        self.end_time = datetime.now()
        
        if self.start_time:
            delta = self.end_time - self.start_time
            self.duration_seconds = int(delta.total_seconds())
        
        self.status = TaskStatus.SUCCESS.value if success else TaskStatus.FAILED.value
    
    def fail_task(self, error_message: str = None) -> None:
        """任务失败"""
        self.status = TaskStatus.FAILED.value
        self.error_message = error_message
        self.complete_task(success=False)
    
    def timeout_task(self) -> None:
        """任务超时"""
        self.status = TaskStatus.TIMEOUT.value
        self.complete_task(success=False)
    
    def add_processed_records(self, success_count: int, failed_count: int = 0) -> None:
        """添加处理记录数"""
        self.records_success += success_count
        self.records_failed += failed_count
        self.records_processed = self.records_success + self.records_failed
    
    def increment_api_calls(self, count: int = 1) -> None:
        """增加API调用次数"""
        self.api_calls_count += count
    
    def increment_retry(self) -> None:
        """增加重试次数"""
        self.retry_count += 1
    
    def get_success_rate(self) -> float:
        """获取成功率"""
        if self.records_processed == 0:
            return 0.0
        return self.records_success / self.records_processed
    
    def get_duration_minutes(self) -> float:
        """获取执行时长（分钟）"""
        if self.duration_seconds:
            return self.duration_seconds / 60.0
        return 0.0
    
    def is_running(self) -> bool:
        """检查是否正在运行"""
        return self.status == TaskStatus.RUNNING.value
    
    def is_success(self) -> bool:
        """检查是否成功"""
        return self.status == TaskStatus.SUCCESS.value
    
    def is_failed(self) -> bool:
        """检查是否失败"""
        return self.status in [TaskStatus.FAILED.value, TaskStatus.TIMEOUT.value]
    
    def is_valid(self) -> bool:
        """验证数据有效性"""
        if not self.task_type or not self.task_date:
            return False
        
        # 检查任务类型是否有效
        valid_types = [t.value for t in TaskType]
        if self.task_type not in valid_types:
            return False
        
        # 检查状态是否有效
        valid_statuses = [s.value for s in TaskStatus]
        if self.status not in valid_statuses:
            return False
        
        # 检查数量是否为负数
        counts = [
            self.duration_seconds, self.records_processed,
            self.records_success, self.records_failed,
            self.api_calls_count, self.retry_count
        ]
        
        for count in counts:
            if count is not None and count < 0:
                return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = super().to_dict()
        
        # 处理日期类型
        if isinstance(self.task_date, date):
            data['task_date'] = self.task_date.isoformat()
        
        return data
    
    @classmethod
    def create_new_task(cls, task_type: str, task_date: date = None) -> 'SyncTaskLog':
        """创建新任务记录"""
        if not task_date:
            task_date = date.today()
        
        return cls(
            task_type=task_type,
            task_date=task_date,
            status=TaskStatus.RUNNING.value,
            start_time=datetime.now()
        )
    
    def get_summary(self) -> str:
        """获取任务摘要"""
        status_text = {
            TaskStatus.RUNNING.value: '运行中',
            TaskStatus.SUCCESS.value: '成功',
            TaskStatus.FAILED.value: '失败',
            TaskStatus.TIMEOUT.value: '超时'
        }.get(self.status, '未知')
        
        return (f"任务[{self.task_type}] 日期[{self.task_date}] "
                f"状态[{status_text}] 处理[{self.records_processed}条] "
                f"成功[{self.records_success}条] 失败[{self.records_failed}条] "
                f"耗时[{self.get_duration_minutes():.1f}分钟]")
    
    def __str__(self) -> str:
        return f"SyncTaskLog(type={self.task_type}, date={self.task_date}, status={self.status})"