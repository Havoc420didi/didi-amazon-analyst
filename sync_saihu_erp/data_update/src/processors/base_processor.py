"""
基础数据处理器
提供数据清洗、转换、验证和持久化的通用功能
"""
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date
from ..database import db_manager
from ..models import SyncTaskLog, TaskType
from ..config.settings import Settings
settings = Settings()

logger = logging.getLogger(__name__)

class BaseProcessor(ABC):
    """基础数据处理器抽象类"""
    
    def __init__(self, task_type: str):
        """初始化处理器"""
        self.task_type = task_type
        self.batch_size = settings.get('sync.batch_size', 500)
        self.enable_validation = settings.get('sync.enable_validation', True)
        self.parallel_workers = settings.get('sync.parallel_workers', 1)
        
        logger.info(f"初始化数据处理器: {self.__class__.__name__}")
    
    def process_data(self, data_list: List[Any], task_date: date = None) -> Dict[str, Any]:
        """处理数据的主要方法"""
        if not data_list:
            logger.warning("数据列表为空，跳过处理")
            return {'success': 0, 'failed': 0, 'errors': []}
        
        # 创建任务记录
        task_log = SyncTaskLog.create_new_task(self.task_type, task_date)
        task_log_id = None
        
        try:
            # 保存任务记录
            task_log_id = self._save_task_log(task_log)
            
            logger.info(f"开始处理 {len(data_list)} 条数据")
            
            # 数据预处理
            processed_data = self._preprocess_data(data_list)
            
            # 数据验证
            if self.enable_validation:
                validated_data, validation_errors = self._validate_data(processed_data)
                if validation_errors:
                    logger.warning(f"数据验证发现 {len(validation_errors)} 个错误")
            else:
                validated_data = processed_data
                validation_errors = []
            
            # 数据清洗
            cleaned_data = self._clean_data(validated_data)
            
            # 数据转换
            transformed_data = self._transform_data(cleaned_data)
            
            # 数据持久化
            result = self._persist_data(transformed_data)
            
            # 更新任务记录
            task_log.add_processed_records(result['success'], result['failed'])
            task_log.complete_task(success=result['failed'] == 0)
            
            if task_log_id:
                self._update_task_log(task_log_id, task_log)
            
            logger.info(f"数据处理完成: 成功 {result['success']} 条, 失败 {result['failed']} 条")
            
            # 合并验证错误和处理错误
            all_errors = validation_errors + result.get('errors', [])
            
            return {
                'success': result['success'],
                'failed': result['failed'],
                'errors': all_errors,
                'task_log_id': task_log_id
            }
            
        except Exception as e:
            logger.error(f"数据处理失败: {e}")
            
            # 更新失败的任务记录
            task_log.fail_task(str(e))
            if task_log_id:
                self._update_task_log(task_log_id, task_log)
            
            return {
                'success': 0,
                'failed': len(data_list),
                'errors': [str(e)],
                'task_log_id': task_log_id
            }
    
    def _preprocess_data(self, data_list: List[Any]) -> List[Any]:
        """数据预处理"""
        try:
            # 去重处理
            unique_data = self._remove_duplicates(data_list)
            
            # 排序处理
            sorted_data = self._sort_data(unique_data)
            
            logger.info(f"预处理完成: 原始 {len(data_list)} 条 -> 处理后 {len(sorted_data)} 条")
            return sorted_data
            
        except Exception as e:
            logger.error(f"数据预处理失败: {e}")
            return data_list
    
    def _remove_duplicates(self, data_list: List[Any]) -> List[Any]:
        """去除重复数据"""
        if not hasattr(data_list[0], 'get_unique_key'):
            return data_list
        
        seen_keys = set()
        unique_data = []
        
        for item in data_list:
            key = item.get_unique_key()
            if key not in seen_keys:
                seen_keys.add(key)
                unique_data.append(item)
        
        removed_count = len(data_list) - len(unique_data)
        if removed_count > 0:
            logger.info(f"去除重复数据 {removed_count} 条")
        
        return unique_data
    
    def _sort_data(self, data_list: List[Any]) -> List[Any]:
        """数据排序"""
        try:
            # 默认排序逻辑，子类可以重写
            return sorted(data_list, key=lambda x: getattr(x, 'created_at', datetime.now()) or datetime.now())
        except Exception as e:
            logger.warning(f"数据排序失败: {e}")
            return data_list
    
    def _validate_data(self, data_list: List[Any]) -> Tuple[List[Any], List[str]]:
        """数据验证"""
        valid_data = []
        errors = []
        
        for i, item in enumerate(data_list):
            try:
                if hasattr(item, 'is_valid') and item.is_valid():
                    valid_data.append(item)
                else:
                    errors.append(f"第 {i+1} 条数据验证失败")
            except Exception as e:
                errors.append(f"第 {i+1} 条数据验证异常: {e}")
        
        logger.info(f"数据验证完成: 有效 {len(valid_data)} 条, 无效 {len(errors)} 条")
        return valid_data, errors
    
    @abstractmethod
    def _clean_data(self, data_list: List[Any]) -> List[Any]:
        """数据清洗，子类必须实现"""
        pass
    
    @abstractmethod
    def _transform_data(self, data_list: List[Any]) -> List[Any]:
        """数据转换，子类必须实现"""
        pass
    
    @abstractmethod
    def _persist_data(self, data_list: List[Any]) -> Dict[str, Any]:
        """数据持久化，子类必须实现"""
        pass
    
    def _persist_data_in_batches(self, data_list: List[Any], table_name: str) -> Dict[str, Any]:
        """批量数据持久化"""
        if not data_list:
            return {'success': 0, 'failed': 0, 'errors': []}
        
        total_success = 0
        total_failed = 0
        errors = []
        
        # 按批次处理数据
        for i in range(0, len(data_list), self.batch_size):
            batch = data_list[i:i + self.batch_size]
            batch_num = (i // self.batch_size) + 1
            
            logger.info(f"处理第 {batch_num} 批数据，共 {len(batch)} 条")
            
            try:
                # 构建批量插入SQL
                insert_sqls = []
                insert_params = []
                
                for item in batch:
                    try:
                        sql, params = item.get_insert_sql(table_name)
                        insert_sqls.append(sql)
                        insert_params.append(params)
                    except Exception as e:
                        logger.error(f"构建SQL失败: {e}")
                        total_failed += 1
                        errors.append(f"构建SQL失败: {e}")
                        continue
                
                if insert_sqls:
                    # 执行批量插入
                    with db_manager.get_db_transaction() as conn:
                        with conn.cursor() as cursor:
                            for sql, params in zip(insert_sqls, insert_params):
                                try:
                                    cursor.execute(sql, params)
                                    total_success += 1
                                except Exception as e:
                                    logger.error(f"插入数据失败: {e}")
                                    total_failed += 1
                                    errors.append(f"插入数据失败: {e}")
                
            except Exception as e:
                logger.error(f"批次 {batch_num} 处理失败: {e}")
                total_failed += len(batch)
                errors.append(f"批次 {batch_num} 处理失败: {e}")
        
        logger.info(f"批量处理完成: 成功 {total_success} 条, 失败 {total_failed} 条")
        
        return {
            'success': total_success,
            'failed': total_failed,
            'errors': errors
        }
    
    def _upsert_data_in_batches(self, data_list: List[Any], table_name: str, unique_keys: List[str]) -> Dict[str, Any]:
        """批量数据更新插入"""
        if not data_list:
            return {'success': 0, 'failed': 0, 'errors': []}
        
        total_success = 0
        total_failed = 0
        errors = []
        
        # 按批次处理数据
        for i in range(0, len(data_list), self.batch_size):
            batch = data_list[i:i + self.batch_size]
            batch_num = (i // self.batch_size) + 1
            
            logger.info(f"处理第 {batch_num} 批数据，共 {len(batch)} 条")
            
            try:
                with db_manager.get_db_transaction() as conn:
                    with conn.cursor() as cursor:
                        for item in batch:
                            try:
                                # 先尝试更新
                                where_conditions = {key: getattr(item, key) for key in unique_keys}
                                update_sql, update_params = item.get_update_sql(table_name, where_conditions)
                                
                                affected_rows = cursor.execute(update_sql, update_params)
                                
                                if affected_rows == 0:
                                    # 如果没有更新到记录，则插入新记录
                                    insert_sql, insert_params = item.get_insert_sql(table_name)
                                    cursor.execute(insert_sql, insert_params)
                                
                                total_success += 1
                                
                            except Exception as e:
                                logger.error(f"更新插入数据失败: {e}")
                                total_failed += 1
                                errors.append(f"更新插入数据失败: {e}")
                
            except Exception as e:
                logger.error(f"批次 {batch_num} 处理失败: {e}")
                total_failed += len(batch)
                errors.append(f"批次 {batch_num} 处理失败: {e}")
        
        logger.info(f"批量更新插入完成: 成功 {total_success} 条, 失败 {total_failed} 条")
        
        return {
            'success': total_success,
            'failed': total_failed,
            'errors': errors
        }
    
    def _save_task_log(self, task_log: SyncTaskLog) -> Optional[int]:
        """保存任务记录"""
        try:
            sql, params = task_log.get_insert_sql('sync_task_logs')
            return db_manager.execute_update(sql, params)
        except Exception as e:
            logger.error(f"保存任务记录失败: {e}")
            return None
    
    def _update_task_log(self, task_log_id: int, task_log: SyncTaskLog) -> None:
        """更新任务记录"""
        try:
            where_conditions = {'id': task_log_id}
            sql, params = task_log.get_update_sql('sync_task_logs', where_conditions)
            db_manager.execute_update(sql, params)
        except Exception as e:
            logger.error(f"更新任务记录失败: {e}")
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """获取处理统计信息"""
        try:
            # 查询最近的任务执行统计
            sql = """
                SELECT 
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_tasks,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
                    AVG(duration_seconds) as avg_duration,
                    SUM(records_processed) as total_records,
                    SUM(records_success) as total_success_records,
                    MAX(created_at) as last_run_time
                FROM sync_task_logs 
                WHERE task_type = %s 
                AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            """
            
            result = db_manager.execute_single(sql, (self.task_type,))
            
            if result:
                return {
                    'task_type': self.task_type,
                    'total_tasks': result['total_tasks'] or 0,
                    'success_tasks': result['success_tasks'] or 0,
                    'failed_tasks': result['failed_tasks'] or 0,
                    'success_rate': (result['success_tasks'] or 0) / max(result['total_tasks'] or 1, 1),
                    'avg_duration_minutes': (result['avg_duration'] or 0) / 60,
                    'total_records': result['total_records'] or 0,
                    'total_success_records': result['total_success_records'] or 0,
                    'last_run_time': result['last_run_time']
                }
            else:
                return {'task_type': self.task_type, 'no_data': True}
                
        except Exception as e:
            logger.error(f"获取处理统计失败: {e}")
            return {'task_type': self.task_type, 'error': str(e)}
    
    def cleanup_old_data(self, days_to_keep: int = 30) -> int:
        """清理旧数据"""
        try:
            sql = "DELETE FROM sync_task_logs WHERE task_type = %s AND created_at < DATE_SUB(NOW(), INTERVAL %s DAY)"
            deleted_count = db_manager.execute_update(sql, (self.task_type, days_to_keep))
            
            logger.info(f"清理旧任务记录: 删除 {deleted_count} 条记录")
            return deleted_count
            
        except Exception as e:
            logger.error(f"清理旧数据失败: {e}")
            return 0