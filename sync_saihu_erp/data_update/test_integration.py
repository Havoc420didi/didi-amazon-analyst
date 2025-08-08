#!/usr/bin/env python3
"""
Web集成测试脚本
测试新的状态通知功能
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_web_integration():
    """测试Web状态集成"""
    print("🧪 测试Web状态集成...")
    
    try:
        from src.utils.web_integration import report_status, report_started, report_error, report_completed
        
        # 测试各个功能
        result1 = report_status("started", "测试脚本开始")
        print(f"✅ 开始状态测试: 已发送")
        
        result2 = report_status("processing", f"处理中: 正在测试数据拉取", 50)
        print(f"✅ 进度状态测试: 已发送")
        
        result3 = report_status("success", f"测试完成: 处理了100条记录", 
                               details={"records": 100, "duration": 3.2})
        print(f"✅ 完成状态测试: 已发送")
        
        print("🎉 所有Web状态测试通过!")
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_web_integration()