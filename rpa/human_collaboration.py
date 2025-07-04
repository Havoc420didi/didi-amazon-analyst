"""
Pipiads人机协作RPA模块
管理RPA与人工之间的协作流程，确保重要决策由专业人员处理
"""

import pandas as pd
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
import logging
from pathlib import Path
import time
from enum import Enum
import sqlite3

from config import *

class ReviewStatus(Enum):
    """审核状态枚举"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ESCALATED = "escalated"
    REJECTED = "rejected"

class Priority(Enum):
    """优先级枚举"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class HumanCollaborationManager:
    """人机协作管理器"""
    
    def __init__(self):
        self.logger = self._setup_logger()
        self.db_path = os.path.join(PATHS['output_dir'], 'human_review.db')
        self.review_queue = []
        self.completed_reviews = []
        self.escalated_items = []
        self.callbacks = {}
        self._init_database()
        
    def _setup_logger(self) -> logging.Logger:
        """设置日志记录器"""
        logger = logging.getLogger('HumanCollaboration')
        logger.setLevel(logging.INFO)
        
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
    
    def _init_database(self):
        """初始化数据库"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 创建审核队列表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS review_queue (
                    id TEXT PRIMARY KEY,
                    item_type TEXT NOT NULL,
                    item_data TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    status TEXT NOT NULL,
                    assigned_to TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT,
                    due_date TEXT,
                    review_result TEXT,
                    reviewer_comments TEXT,
                    escalation_count INTEGER DEFAULT 0
                )
            ''')
            
            # 创建审核历史表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS review_history (
                    id TEXT PRIMARY KEY,
                    original_item_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    details TEXT,
                    FOREIGN KEY (original_item_id) REFERENCES review_queue (id)
                )
            ''')
            
            # 创建性能指标表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    date TEXT PRIMARY KEY,
                    total_items INTEGER,
                    pending_items INTEGER,
                    completed_items INTEGER,
                    escalated_items INTEGER,
                    avg_resolution_time REAL,
                    human_accuracy_rate REAL
                )
            ''')
            
            conn.commit()
            conn.close()
            
            self.logger.info("数据库初始化完成")
            
        except Exception as e:
            self.logger.error(f"数据库初始化失败: {e}")
    
    def add_review_item(self, 
                       item_type: str, 
                       item_data: Dict[str, Any], 
                       reason: str, 
                       priority: Priority = Priority.MEDIUM,
                       assigned_to: Optional[str] = None,
                       due_hours: int = 24) -> str:
        """添加审核项目到队列"""
        try:
            # 检查队列容量
            if len(self.get_pending_items()) >= REVIEW_QUEUE_CONFIG['max_queue_size']:
                self.logger.warning("审核队列已满，尝试自动处理部分项目")
                self._auto_process_low_priority_items()
            
            # 生成唯一ID
            item_id = f"review_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(self.review_queue)}"
            
            # 计算截止时间
            due_date = datetime.now() + timedelta(hours=due_hours)
            
            # 创建审核项目
            review_item = {
                'id': item_id,
                'item_type': item_type,
                'item_data': item_data,
                'reason': reason,
                'priority': priority.value,
                'status': ReviewStatus.PENDING.value,
                'assigned_to': assigned_to,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'due_date': due_date.isoformat(),
                'review_result': None,
                'reviewer_comments': None,
                'escalation_count': 0
            }
            
            # 保存到数据库
            self._save_review_item(review_item)
            
            # 添加到内存队列
            self.review_queue.append(review_item)
            
            # 记录历史
            self._add_history_record(item_id, 'created', 'system', 
                                   f"审核项目已创建: {reason}")
            
            # 发送通知
            self._send_review_notification(review_item)
            
            self.logger.info(f"已添加审核项目: {item_id} - {reason}")
            return item_id
            
        except Exception as e:
            self.logger.error(f"添加审核项目失败: {e}")
            return ""
    
    def _save_review_item(self, item: Dict[str, Any]):
        """保存审核项目到数据库"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO review_queue 
                (id, item_type, item_data, reason, priority, status, assigned_to, 
                 created_at, updated_at, due_date, review_result, reviewer_comments, escalation_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                item['id'], item['item_type'], json.dumps(item['item_data'], ensure_ascii=False),
                item['reason'], item['priority'], item['status'], item['assigned_to'],
                item['created_at'], item['updated_at'], item['due_date'],
                item['review_result'], item['reviewer_comments'], item['escalation_count']
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"保存审核项目失败: {e}")
    
    def get_pending_items(self, assigned_to: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取待审核项目"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if assigned_to:
                cursor.execute('''
                    SELECT * FROM review_queue 
                    WHERE status = ? AND assigned_to = ?
                    ORDER BY 
                        CASE priority 
                            WHEN 'critical' THEN 1
                            WHEN 'high' THEN 2
                            WHEN 'medium' THEN 3
                            WHEN 'low' THEN 4
                        END,
                        created_at
                ''', (ReviewStatus.PENDING.value, assigned_to))
            else:
                cursor.execute('''
                    SELECT * FROM review_queue 
                    WHERE status = ?
                    ORDER BY 
                        CASE priority 
                            WHEN 'critical' THEN 1
                            WHEN 'high' THEN 2
                            WHEN 'medium' THEN 3
                            WHEN 'low' THEN 4
                        END,
                        created_at
                ''', (ReviewStatus.PENDING.value,))
            
            items = []
            for row in cursor.fetchall():
                item = {
                    'id': row[0],
                    'item_type': row[1],
                    'item_data': json.loads(row[2]),
                    'reason': row[3],
                    'priority': row[4],
                    'status': row[5],
                    'assigned_to': row[6],
                    'created_at': row[7],
                    'updated_at': row[8],
                    'due_date': row[9],
                    'review_result': row[10],
                    'reviewer_comments': row[11],
                    'escalation_count': row[12]
                }
                items.append(item)
            
            conn.close()
            return items
            
        except Exception as e:
            self.logger.error(f"获取待审核项目失败: {e}")
            return []
    
    def assign_reviewer(self, item_id: str, reviewer: str) -> bool:
        """分配审核员"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE review_queue 
                SET assigned_to = ?, status = ?, updated_at = ?
                WHERE id = ?
            ''', (reviewer, ReviewStatus.IN_PROGRESS.value, datetime.now().isoformat(), item_id))
            
            conn.commit()
            conn.close()
            
            # 记录历史
            self._add_history_record(item_id, 'assigned', reviewer, 
                                   f"审核员已分配: {reviewer}")
            
            self.logger.info(f"审核项目 {item_id} 已分配给 {reviewer}")
            return True
            
        except Exception as e:
            self.logger.error(f"分配审核员失败: {e}")
            return False
    
    def submit_review_result(self, 
                           item_id: str, 
                           reviewer: str, 
                           result: str, 
                           comments: str = "",
                           next_actions: List[str] = None) -> bool:
        """提交审核结果"""
        try:
            # 验证审核员权限
            item = self._get_review_item(item_id)
            if not item:
                self.logger.error(f"审核项目不存在: {item_id}")
                return False
            
            if item['assigned_to'] != reviewer:
                self.logger.error(f"审核员 {reviewer} 无权限审核项目 {item_id}")
                return False
            
            # 更新审核结果
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE review_queue 
                SET status = ?, review_result = ?, reviewer_comments = ?, updated_at = ?
                WHERE id = ?
            ''', (ReviewStatus.COMPLETED.value, result, comments, 
                  datetime.now().isoformat(), item_id))
            
            conn.commit()
            conn.close()
            
            # 记录历史
            self._add_history_record(item_id, 'completed', reviewer, 
                                   f"审核完成: {result}")
            
            # 执行回调函数
            if item['item_type'] in self.callbacks:
                try:
                    self.callbacks[item['item_type']](item, result, comments)
                except Exception as callback_error:
                    self.logger.error(f"回调函数执行失败: {callback_error}")
            
            # 处理后续动作
            if next_actions:
                self._process_next_actions(item, next_actions, reviewer)
            
            self.logger.info(f"审核结果已提交: {item_id} - {result}")
            return True
            
        except Exception as e:
            self.logger.error(f"提交审核结果失败: {e}")
            return False
    
    def escalate_item(self, item_id: str, escalation_reason: str) -> bool:
        """升级审核项目"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 更新升级计数和状态
            cursor.execute('''
                UPDATE review_queue 
                SET status = ?, escalation_count = escalation_count + 1, 
                    updated_at = ?, reviewer_comments = ?
                WHERE id = ?
            ''', (ReviewStatus.ESCALATED.value, datetime.now().isoformat(), 
                  escalation_reason, item_id))
            
            conn.commit()
            conn.close()
            
            # 记录历史
            self._add_history_record(item_id, 'escalated', 'system', escalation_reason)
            
            # 发送升级通知
            self._send_escalation_notification(item_id, escalation_reason)
            
            self.logger.warning(f"审核项目已升级: {item_id} - {escalation_reason}")
            return True
            
        except Exception as e:
            self.logger.error(f"升级审核项目失败: {e}")
            return False
    
    def _get_review_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        """获取单个审核项目"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM review_queue WHERE id = ?', (item_id,))
            row = cursor.fetchone()
            
            conn.close()
            
            if row:
                return {
                    'id': row[0],
                    'item_type': row[1],
                    'item_data': json.loads(row[2]),
                    'reason': row[3],
                    'priority': row[4],
                    'status': row[5],
                    'assigned_to': row[6],
                    'created_at': row[7],
                    'updated_at': row[8],
                    'due_date': row[9],
                    'review_result': row[10],
                    'reviewer_comments': row[11],
                    'escalation_count': row[12]
                }
            return None
            
        except Exception as e:
            self.logger.error(f"获取审核项目失败: {e}")
            return None
    
    def _add_history_record(self, item_id: str, action: str, actor: str, details: str):
        """添加历史记录"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            history_id = f"hist_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{item_id}"
            
            cursor.execute('''
                INSERT INTO review_history 
                (id, original_item_id, action, actor, timestamp, details)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (history_id, item_id, action, actor, datetime.now().isoformat(), details))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"添加历史记录失败: {e}")
    
    def check_overdue_items(self) -> List[Dict[str, Any]]:
        """检查逾期项目"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            current_time = datetime.now().isoformat()
            
            cursor.execute('''
                SELECT * FROM review_queue 
                WHERE status IN (?, ?) AND due_date < ?
                ORDER BY due_date
            ''', (ReviewStatus.PENDING.value, ReviewStatus.IN_PROGRESS.value, current_time))
            
            overdue_items = []
            for row in cursor.fetchall():
                item = {
                    'id': row[0],
                    'item_type': row[1],
                    'item_data': json.loads(row[2]),
                    'reason': row[3],
                    'priority': row[4],
                    'status': row[5],
                    'assigned_to': row[6],
                    'created_at': row[7],
                    'updated_at': row[8],
                    'due_date': row[9],
                    'review_result': row[10],
                    'reviewer_comments': row[11],
                    'escalation_count': row[12]
                }
                overdue_items.append(item)
            
            conn.close()
            
            # 自动升级逾期项目
            for item in overdue_items:
                if item['escalation_count'] < 3:  # 最多升级3次
                    self.escalate_item(item['id'], f"项目逾期 {item['escalation_count'] + 1} 次")
            
            return overdue_items
            
        except Exception as e:
            self.logger.error(f"检查逾期项目失败: {e}")
            return []
    
    def _auto_process_low_priority_items(self):
        """自动处理低优先级项目"""
        try:
            low_priority_items = self.get_pending_items()
            low_priority_items = [item for item in low_priority_items 
                                if item['priority'] == Priority.LOW.value]
            
            for item in low_priority_items[:5]:  # 最多自动处理5个
                # 基于简单规则自动处理
                auto_result = self._auto_review_item(item)
                if auto_result:
                    self.submit_review_result(
                        item['id'], 
                        'auto_system', 
                        auto_result['result'], 
                        auto_result['comments']
                    )
                    
        except Exception as e:
            self.logger.error(f"自动处理低优先级项目失败: {e}")
    
    def _auto_review_item(self, item: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """自动审核项目（简单规则）"""
        try:
            item_type = item['item_type']
            item_data = item['item_data']
            
            # 数据异常的自动处理
            if item_type == 'data_anomaly':
                # 如果异常值不严重，自动标记为可接受
                if 'anomaly_score' in item_data and item_data['anomaly_score'] < 2:
                    return {
                        'result': 'accepted',
                        'comments': '异常程度较轻，自动接受'
                    }
                    
            # 低价值产品的自动处理
            elif item_type == 'low_value_product':
                if item_data.get('price', 0) < 5:  # 价格太低
                    return {
                        'result': 'rejected',
                        'comments': '价格过低，利润空间不足，自动拒绝'
                    }
            
            return None
            
        except Exception as e:
            self.logger.error(f"自动审核失败: {e}")
            return None
    
    def _send_review_notification(self, item: Dict[str, Any]):
        """发送审核通知"""
        try:
            if not NOTIFICATION_CONFIG['file_log_enabled']:
                return
            
            notification = {
                'type': 'review_request',
                'item_id': item['id'],
                'item_type': item['item_type'],
                'reason': item['reason'],
                'priority': item['priority'],
                'due_date': item['due_date'],
                'assigned_to': item['assigned_to'],
                'timestamp': datetime.now().isoformat()
            }
            
            # 保存通知文件
            notification_file = get_output_path('./outputs/review_notifications_{date}.json')
            
            if os.path.exists(notification_file):
                with open(notification_file, 'r', encoding='utf-8') as f:
                    notifications = json.load(f)
            else:
                notifications = []
            
            notifications.append(notification)
            
            with open(notification_file, 'w', encoding='utf-8') as f:
                json.dump(notifications, f, ensure_ascii=False, indent=2)
            
            # 控制台通知
            if NOTIFICATION_CONFIG['console_log_enabled']:
                priority_emoji = {
                    'critical': '🚨',
                    'high': '⚠️',
                    'medium': '📋',
                    'low': 'ℹ️'
                }
                emoji = priority_emoji.get(item['priority'], '📋')
                print(f"{emoji} 新审核任务: {item['reason']} (优先级: {item['priority']})")
                
        except Exception as e:
            self.logger.error(f"发送审核通知失败: {e}")
    
    def _send_escalation_notification(self, item_id: str, reason: str):
        """发送升级通知"""
        try:
            if NOTIFICATION_CONFIG['console_log_enabled']:
                print(f"🚨 审核项目升级: {item_id} - {reason}")
                
        except Exception as e:
            self.logger.error(f"发送升级通知失败: {e}")
    
    def _process_next_actions(self, item: Dict[str, Any], actions: List[str], reviewer: str):
        """处理后续动作"""
        try:
            for action in actions:
                if action == 'create_development_task':
                    self._create_development_task(item, reviewer)
                elif action == 'update_exclusion_list':
                    self._update_exclusion_list(item, reviewer)
                elif action == 'monitor_competitor':
                    self._add_competitor_monitoring(item, reviewer)
                    
        except Exception as e:
            self.logger.error(f"处理后续动作失败: {e}")
    
    def _create_development_task(self, item: Dict[str, Any], reviewer: str):
        """创建开发任务"""
        try:
            task = {
                'type': 'product_development',
                'product_data': item['item_data'],
                'reviewer': reviewer,
                'timestamp': datetime.now().isoformat(),
                'priority': 'high'
            }
            
            task_file = get_output_path('./outputs/development_tasks_{date}.json')
            
            if os.path.exists(task_file):
                with open(task_file, 'r', encoding='utf-8') as f:
                    tasks = json.load(f)
            else:
                tasks = []
            
            tasks.append(task)
            
            with open(task_file, 'w', encoding='utf-8') as f:
                json.dump(tasks, f, ensure_ascii=False, indent=2)
            
            self.logger.info(f"开发任务已创建: {item['item_data'].get('product_name', 'Unknown')}")
            
        except Exception as e:
            self.logger.error(f"创建开发任务失败: {e}")
    
    def register_callback(self, item_type: str, callback: Callable):
        """注册回调函数"""
        self.callbacks[item_type] = callback
        self.logger.info(f"已注册回调函数: {item_type}")
    
    def generate_review_dashboard(self) -> str:
        """生成审核仪表板"""
        try:
            self.logger.info("生成审核仪表板...")
            
            # 获取统计数据
            stats = self._get_review_statistics()
            
            # 生成仪表板HTML
            dashboard_html = self._create_dashboard_html(stats)
            
            # 保存仪表板文件
            dashboard_file = get_output_path('./outputs/review_dashboard_{date}.html')
            with open(dashboard_file, 'w', encoding='utf-8') as f:
                f.write(dashboard_html)
            
            self.logger.info(f"审核仪表板已生成: {dashboard_file}")
            return dashboard_file
            
        except Exception as e:
            self.logger.error(f"生成审核仪表板失败: {e}")
            return ""
    
    def _get_review_statistics(self) -> Dict[str, Any]:
        """获取审核统计数据"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 基础统计
            cursor.execute('SELECT COUNT(*) FROM review_queue')
            total_items = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM review_queue WHERE status = ?', 
                         (ReviewStatus.PENDING.value,))
            pending_items = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM review_queue WHERE status = ?', 
                         (ReviewStatus.COMPLETED.value,))
            completed_items = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM review_queue WHERE status = ?', 
                         (ReviewStatus.ESCALATED.value,))
            escalated_items = cursor.fetchone()[0]
            
            # 优先级分布
            cursor.execute('SELECT priority, COUNT(*) FROM review_queue GROUP BY priority')
            priority_dist = dict(cursor.fetchall())
            
            # 类型分布
            cursor.execute('SELECT item_type, COUNT(*) FROM review_queue GROUP BY item_type')
            type_dist = dict(cursor.fetchall())
            
            # 逾期项目
            current_time = datetime.now().isoformat()
            cursor.execute('''
                SELECT COUNT(*) FROM review_queue 
                WHERE status IN (?, ?) AND due_date < ?
            ''', (ReviewStatus.PENDING.value, ReviewStatus.IN_PROGRESS.value, current_time))
            overdue_items = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                'total_items': total_items,
                'pending_items': pending_items,
                'completed_items': completed_items,
                'escalated_items': escalated_items,
                'overdue_items': overdue_items,
                'priority_distribution': priority_dist,
                'type_distribution': type_dist,
                'completion_rate': (completed_items / max(total_items, 1)) * 100
            }
            
        except Exception as e:
            self.logger.error(f"获取审核统计失败: {e}")
            return {}
    
    def _create_dashboard_html(self, stats: Dict[str, Any]) -> str:
        """创建仪表板HTML"""
        html_template = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pipiads人工审核仪表板</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
        .header {{ background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
        .stat-card {{ background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }}
        .stat-number {{ font-size: 2em; font-weight: bold; color: #3498db; }}
        .stat-label {{ color: #666; margin-top: 5px; }}
        .priority-high {{ border-left: 5px solid #e74c3c; }}
        .priority-medium {{ border-left: 5px solid #f39c12; }}
        .priority-low {{ border-left: 5px solid #27ae60; }}
        .table {{ width: 100%; border-collapse: collapse; background: white; margin: 20px 0; }}
        .table th, .table td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        .table th {{ background-color: #34495e; color: white; }}
        .status-pending {{ background-color: #f39c12; color: white; padding: 5px 10px; border-radius: 3px; }}
        .status-completed {{ background-color: #27ae60; color: white; padding: 5px 10px; border-radius: 3px; }}
        .status-escalated {{ background-color: #e74c3c; color: white; padding: 5px 10px; border-radius: 3px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 Pipiads人工审核仪表板</h1>
        <p>生成时间: {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">{stats.get('total_items', 0)}</div>
            <div class="stat-label">总审核项目</div>
        </div>
        <div class="stat-card priority-high">
            <div class="stat-number">{stats.get('pending_items', 0)}</div>
            <div class="stat-label">待审核项目</div>
        </div>
        <div class="stat-card priority-medium">
            <div class="stat-number">{stats.get('completed_items', 0)}</div>
            <div class="stat-label">已完成项目</div>
        </div>
        <div class="stat-card priority-low">
            <div class="stat-number">{stats.get('escalated_items', 0)}</div>
            <div class="stat-label">升级项目</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{stats.get('overdue_items', 0)}</div>
            <div class="stat-label">逾期项目</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{stats.get('completion_rate', 0):.1f}%</div>
            <div class="stat-label">完成率</div>
        </div>
    </div>
    
    <h2>📊 优先级分布</h2>
    <table class="table">
        <tr><th>优先级</th><th>数量</th><th>占比</th></tr>
        {self._generate_priority_table_rows(stats.get('priority_distribution', {}))}
    </table>
    
    <h2>📋 项目类型分布</h2>
    <table class="table">
        <tr><th>项目类型</th><th>数量</th><th>占比</th></tr>
        {self._generate_type_table_rows(stats.get('type_distribution', {}))}
    </table>
    
    <h2>⏰ 待处理项目</h2>
    <div id="pending-items">
        {self._generate_pending_items_table()}
    </div>
    
    <div style="margin-top: 30px; text-align: center; color: #666;">
        <p>此仪表板每小时自动更新 | RPA系统 v1.0</p>
    </div>
</body>
</html>
        """
        
        return html_template
    
    def _generate_priority_table_rows(self, priority_dist: Dict[str, int]) -> str:
        """生成优先级表格行"""
        total = sum(priority_dist.values()) if priority_dist else 1
        rows = []
        
        for priority, count in priority_dist.items():
            percentage = (count / total) * 100
            rows.append(f"<tr><td>{priority}</td><td>{count}</td><td>{percentage:.1f}%</td></tr>")
        
        return ''.join(rows) if rows else "<tr><td colspan='3'>暂无数据</td></tr>"
    
    def _generate_type_table_rows(self, type_dist: Dict[str, int]) -> str:
        """生成类型表格行"""
        total = sum(type_dist.values()) if type_dist else 1
        rows = []
        
        for item_type, count in type_dist.items():
            percentage = (count / total) * 100
            rows.append(f"<tr><td>{item_type}</td><td>{count}</td><td>{percentage:.1f}%</td></tr>")
        
        return ''.join(rows) if rows else "<tr><td colspan='3'>暂无数据</td></tr>"
    
    def _generate_pending_items_table(self) -> str:
        """生成待处理项目表格"""
        pending_items = self.get_pending_items()
        
        if not pending_items:
            return "<p>🎉 当前无待处理项目</p>"
        
        table_html = """
        <table class="table">
            <tr>
                <th>项目ID</th>
                <th>类型</th>
                <th>原因</th>
                <th>优先级</th>
                <th>创建时间</th>
                <th>截止时间</th>
                <th>分配给</th>
            </tr>
        """
        
        for item in pending_items[:20]:  # 最多显示20个
            priority_class = f"priority-{item['priority']}"
            assigned_to = item['assigned_to'] or '未分配'
            
            table_html += f"""
            <tr class="{priority_class}">
                <td>{item['id']}</td>
                <td>{item['item_type']}</td>
                <td>{item['reason']}</td>
                <td>{item['priority']}</td>
                <td>{item['created_at'][:19]}</td>
                <td>{item['due_date'][:19]}</td>
                <td>{assigned_to}</td>
            </tr>
            """
        
        table_html += "</table>"
        
        if len(pending_items) > 20:
            table_html += f"<p>还有 {len(pending_items) - 20} 个项目未显示...</p>"
        
        return table_html
    
    def run_maintenance_tasks(self):
        """运行维护任务"""
        try:
            self.logger.info("开始执行维护任务...")
            
            # 检查逾期项目
            overdue_items = self.check_overdue_items()
            if overdue_items:
                self.logger.warning(f"发现 {len(overdue_items)} 个逾期项目")
            
            # 清理已完成的旧项目（保留30天）
            cutoff_date = (datetime.now() - timedelta(days=30)).isoformat()
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                DELETE FROM review_queue 
                WHERE status = ? AND updated_at < ?
            ''', (ReviewStatus.COMPLETED.value, cutoff_date))
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            if deleted_count > 0:
                self.logger.info(f"清理了 {deleted_count} 个过期的已完成项目")
            
            # 更新性能指标
            self._update_performance_metrics()
            
            self.logger.info("维护任务完成")
            
        except Exception as e:
            self.logger.error(f"维护任务执行失败: {e}")
    
    def _update_performance_metrics(self):
        """更新性能指标"""
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            stats = self._get_review_statistics()
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO performance_metrics
                (date, total_items, pending_items, completed_items, escalated_items, avg_resolution_time, human_accuracy_rate)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                today,
                stats.get('total_items', 0),
                stats.get('pending_items', 0),
                stats.get('completed_items', 0),
                stats.get('escalated_items', 0),
                0.0,  # 暂时设为0，可以后续计算实际平均解决时间
                95.0   # 暂时设为95%，可以后续基于实际数据计算
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"更新性能指标失败: {e}")

# 使用示例
if __name__ == "__main__":
    # 创建协作管理器
    collaboration_manager = HumanCollaborationManager()
    
    # 示例：添加高潜力产品到审核队列
    product_data = {
        'product_name': 'LED美容仪',
        'price': 89.99,
        'like_rate': 4.5,
        'impressions': 50000,
        'potential_score': 92
    }
    
    item_id = collaboration_manager.add_review_item(
        item_type='high_potential_product',
        item_data=product_data,
        reason='A级高潜力产品，需要专业评估开发可行性',
        priority=Priority.HIGH,
        due_hours=8
    )
    
    print(f"已创建审核项目: {item_id}")
    
    # 获取待审核项目
    pending_items = collaboration_manager.get_pending_items()
    print(f"当前待审核项目数量: {len(pending_items)}")
    
    # 生成仪表板
    dashboard_file = collaboration_manager.generate_review_dashboard()
    print(f"仪表板已生成: {dashboard_file}")
    
    # 运行维护任务
    collaboration_manager.run_maintenance_tasks()