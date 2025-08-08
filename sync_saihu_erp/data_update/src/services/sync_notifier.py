"""
赛狐同步状态通知器 - 向Web系统汇报进度
"""
import requests
import json
import os
from datetime import datetime

class SyncNotifier:
    """极简同步状态通知器 - 零依赖单文件"""
    
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.api_key = os.getenv("SYNC_API_KEY", "dev-key-123")
    
    def notify_status(self, status, message, details=None):
        """发送同步状态到Web系统"""
        payload = {
            "status": status,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "source": "saihu_sync",
            "details": details or {}
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/rpa/status",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            return response.json()
        except Exception as e:
            print(f"状态通知失败（可忽略）: {e}")
            return None
    
    def notify_start(self):
        """通知同步开始"""
        return self.notify_status("started", "开始赛狐数据同步")
    
    def notify_progress(self, processing, total, info=""):
        """通知同步进度"""
        return self.notify_status("processing", f"处理中: {processing}/{total}", 
                                {"processed": processing, "total": total, "info": info})
    
    def notify_complete(self, records_processed, errors=None):
        """通知同步完成"""
        details = {
            "records_processed": records_processed,
            "errors": errors or []
        }
        return self.notify_status("completed", f"同步完成: {records_processed}条记录", details)
    
    def notify_error(self, error_msg, details=None):
        """通知同步错误"""
        return self.notify_status("error", f"同步错误: {error_msg}", 
                                details or {"error": error_msg})

# 全局实例
notifier = SyncNotifier()