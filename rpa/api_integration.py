#!/usr/bin/env python
"""
RPA系统与Web系统API集成模块
提供数据共享和状态同步功能
"""

import os
import json
import requests
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import logging

@dataclass
class RPAAnalysisResult:
    """RPA分析结果数据结构"""
    timestamp: str
    total_products: int
    high_potential_products: int
    a_level_products: List[Dict]
    market_trends: Dict
    processing_time: float
    data_quality_score: float

class WebSystemIntegration:
    """Web系统集成接口"""
    
    def __init__(self, web_api_base_url: str = "http://localhost:3000/api"):
        self.web_api_base_url = web_api_base_url
        self.logger = logging.getLogger(__name__)
        
    def sync_analysis_results(self, results: RPAAnalysisResult) -> bool:
        """将RPA分析结果同步到Web系统"""
        try:
            # 准备API数据
            api_data = {
                "source": "rpa_system",
                "analysis_data": asdict(results),
                "sync_timestamp": datetime.now().isoformat()
            }
            
            # 发送到Web系统API
            response = requests.post(
                f"{self.web_api_base_url}/rpa/sync",
                json=api_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                self.logger.info("RPA数据同步成功")
                return True
            else:
                self.logger.error(f"API同步失败: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"数据同步异常: {e}")
            return False
    
    def update_rpa_status(self, status: str, message: str = "") -> bool:
        """更新RPA系统状态到Web系统"""
        try:
            status_data = {
                "status": status,  # running, completed, error, idle
                "message": message,
                "timestamp": datetime.now().isoformat()
            }
            
            response = requests.post(
                f"{self.web_api_base_url}/rpa/status",
                json=status_data,
                timeout=10
            )
            
            return response.status_code == 200
            
        except Exception as e:
            self.logger.error(f"状态更新失败: {e}")
            return False
    
    def get_web_system_config(self) -> Optional[Dict]:
        """从Web系统获取配置更新"""
        try:
            response = requests.get(
                f"{self.web_api_base_url}/rpa/config",
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return None
                
        except Exception as e:
            self.logger.error(f"配置获取失败: {e}")
            return None

class SharedDataManager:
    """共享数据管理器"""
    
    def __init__(self, shared_db_path: str = "../shared/rpa_web_data.db"):
        self.db_path = shared_db_path
        self.init_shared_database()
    
    def init_shared_database(self):
        """初始化共享数据库"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 创建RPA分析结果表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rpa_analysis_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                total_products INTEGER,
                high_potential_products INTEGER,
                a_level_products TEXT,  -- JSON格式
                market_trends TEXT,     -- JSON格式
                processing_time REAL,
                data_quality_score REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建RPA状态表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rpa_system_status (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL,
                message TEXT,
                timestamp TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建数据文件索引表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rpa_data_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_type TEXT NOT NULL,  -- daily_scan, report, excel
                file_path TEXT NOT NULL,
                file_size INTEGER,
                created_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def save_analysis_result(self, result: RPAAnalysisResult):
        """保存分析结果到共享数据库"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO rpa_analysis_results 
            (timestamp, total_products, high_potential_products, 
             a_level_products, market_trends, processing_time, data_quality_score)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            result.timestamp,
            result.total_products,
            result.high_potential_products,
            json.dumps(result.a_level_products, ensure_ascii=False),
            json.dumps(result.market_trends, ensure_ascii=False),
            result.processing_time,
            result.data_quality_score
        ))
        
        conn.commit()
        conn.close()
    
    def get_latest_analysis(self) -> Optional[Dict]:
        """获取最新的分析结果"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM rpa_analysis_results 
            ORDER BY created_at DESC LIMIT 1
        ''')
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "timestamp": row[1],
                "total_products": row[2],
                "high_potential_products": row[3],
                "a_level_products": json.loads(row[4]),
                "market_trends": json.loads(row[5]),
                "processing_time": row[6],
                "data_quality_score": row[7]
            }
        return None
    
    def register_data_file(self, file_type: str, file_path: str):
        """注册数据文件到索引"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        
        cursor.execute('''
            INSERT INTO rpa_data_files (file_type, file_path, file_size, created_date)
            VALUES (?, ?, ?, ?)
        ''', (
            file_type,
            file_path,
            file_size,
            datetime.now().strftime('%Y-%m-%d')
        ))
        
        conn.commit()
        conn.close()

# RPA系统主模块中的集成使用示例
class IntegratedRPASystem:
    """集成版RPA系统"""
    
    def __init__(self, enable_web_integration: bool = False):
        self.enable_web_integration = enable_web_integration
        
        if enable_web_integration:
            self.web_integration = WebSystemIntegration()
            self.shared_data = SharedDataManager()
    
    def run_with_integration(self):
        """运行RPA并集成到Web系统"""
        try:
            # 更新状态：开始运行
            if self.enable_web_integration:
                self.web_integration.update_rpa_status("running", "开始每日数据采集")
            
            # 执行原有的RPA流程
            analysis_results = self.execute_rpa_workflow()
            
            # 同步结果到Web系统
            if self.enable_web_integration and analysis_results:
                # 保存到共享数据库
                self.shared_data.save_analysis_result(analysis_results)
                
                # 同步到Web API
                self.web_integration.sync_analysis_results(analysis_results)
                
                # 更新状态：完成
                self.web_integration.update_rpa_status(
                    "completed", 
                    f"分析完成，处理了{analysis_results.total_products}个产品"
                )
            
        except Exception as e:
            if self.enable_web_integration:
                self.web_integration.update_rpa_status("error", str(e))
            raise
    
    def execute_rpa_workflow(self) -> RPAAnalysisResult:
        """执行RPA工作流程（示例）"""
        # 这里是原有的RPA逻辑
        return RPAAnalysisResult(
            timestamp=datetime.now().isoformat(),
            total_products=150,
            high_potential_products=12,
            a_level_products=[],
            market_trends={},
            processing_time=1800.0,  # 30分钟
            data_quality_score=0.95
        )

if __name__ == "__main__":
    # 测试集成功能
    rpa = IntegratedRPASystem(enable_web_integration=True)
    rpa.run_with_integration()