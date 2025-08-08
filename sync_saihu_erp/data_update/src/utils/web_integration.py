"""
Web状态集成工具
将同步状态实时发送到Web系统
"""
import requests
import json
import os
from datetime import datetime

def report_status(status, message, progress=None, details=None):
    """发送同步状态到Web系统"""
    payload = {
        "status": status,
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "source": "saihu_sync",
        "metadata": details or {}
    }
    
    if progress is not None:
        payload["progress"] = progress
    
    try:
        response = requests.post(
            "http://localhost:3000/api/rpa/status",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        return response.json()
    except Exception as e:
        print(f"状态通知失败: {e}")
        return None

def report_progress(message, progress):
    """报告进度"""
    return report_status("processing", message, progress)

def report_error(error_msg):
    """报告错误"""
    return report_status("failed", f"同步错误: {error_msg}")

def report_completed(records, duration):
    """报告完成"""
    return report_status("success", f"数据同步完成: {records}条记录", 
                        details={"records": records, "duration": duration})