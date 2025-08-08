#!/usr/bin/env python3
"""
赛狐ERP数据同步启动脚本
提供用户友好的启动界面和选择菜单
"""
import sys
import os
import subprocess
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(__file__))

def print_banner():
    """打印启动横幅"""
    print("=" * 80)
    print("🚀 赛狐ERP数据同步服务")
    print("=" * 80)
    print("📅 当前时间:", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    print("🎯 同步目标: FBA库存 + 库存明细 + 产品分析数据")
    print("💾 数据库: MySQL (hudi用户)")
    print("🔄 宝塔看板: 可实时查看数据变化")
    print("=" * 80)

def show_menu():
    """显示菜单选项"""
    print("\n📋 请选择操作:")
    print("1. 🔍 测试数据库连接和状态")
    print("2. 🧪 单次数据同步测试")
    print("3. 🔄 启动4小时间隔连续同步 (推荐)")
    print("4. ⚡ 启动30秒间隔快速同步 (调试用)")
    print("5. 📊 查看历史同步日志")
    print("0. ❌ 退出")
    print("-" * 40)

def run_database_test():
    """运行数据库测试"""
    print("\n🔍 运行数据库连接测试...")
    try:
        result = subprocess.run([sys.executable, "database_test.py"], 
                              cwd=os.path.dirname(__file__),
                              capture_output=False)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ 运行数据库测试失败: {e}")
        return False

def run_single_sync():
    """运行单次同步测试"""
    print("\n🧪 运行单次数据同步测试...")
    try:
        result = subprocess.run([sys.executable, "test_product_analytics_sync.py"], 
                              cwd=os.path.dirname(__file__),
                              capture_output=False)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ 运行同步测试失败: {e}")
        return False

def run_continuous_sync_4hours():
    """运行4小时间隔连续同步"""
    print("\n🔄 启动4小时间隔连续同步服务...")
    print("💡 提示: 按 Ctrl+C 可停止同步")
    print("📊 可在宝塔面板中实时查看数据库变化")
    print("-" * 40)
    try:
        subprocess.run([sys.executable, "continuous_sync_4hours.py"], 
                      cwd=os.path.dirname(__file__))
    except KeyboardInterrupt:
        print("\n🛑 用户停止同步服务")
    except Exception as e:
        print(f"❌ 连续同步服务异常: {e}")

def run_continuous_sync_30s():
    """运行30秒间隔连续同步"""
    print("\n⚡ 启动30秒间隔快速同步服务...")
    print("💡 提示: 按 Ctrl+C 可停止同步")
    print("⚠️ 注意: 快速同步可能触发API频率限制")
    print("-" * 40)
    
    # 创建30秒间隔的临时脚本
    script_content = '''#!/usr/bin/env python3
import sys
import os
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from src.services.data_sync_service import data_sync_service

def main():
    print("⚡ 30秒间隔快速同步服务启动")
    sync_count = 0
    
    try:
        while True:
            sync_count += 1
            print(f"\\n🔄 第 {sync_count} 次快速同步 - {datetime.now().strftime('%H:%M:%S')}")
            
            # 执行数据同步
            results = data_sync_service.sync_all_data()
            success_count = sum(1 for result in results.values() if result)
            print(f"📊 同步结果: {success_count}/4 成功")
            
            print("💤 等待30秒后进行下次同步...")
            time.sleep(30)
            
    except KeyboardInterrupt:
        print("\\n🛑 快速同步服务已停止")

if __name__ == "__main__":
    main()
'''
    
    try:
        # 写入临时脚本
        temp_script = "/tmp/fast_sync_30s.py"
        with open(temp_script, 'w', encoding='utf-8') as f:
            f.write(script_content)
        
        subprocess.run([sys.executable, temp_script])
    except KeyboardInterrupt:
        print("\n🛑 用户停止快速同步服务")
    except Exception as e:
        print(f"❌ 快速同步服务异常: {e}")
    finally:
        # 清理临时文件
        if os.path.exists("/tmp/fast_sync_30s.py"):
            os.remove("/tmp/fast_sync_30s.py")

def show_logs():
    """显示同步日志"""
    print("\n📊 查看同步日志...")
    log_file = "/home/hudi_data/sync_saihu_erp/data_update/sync_4hours.log"
    
    if os.path.exists(log_file):
        print(f"📄 日志文件: {log_file}")
        print("-" * 40)
        try:
            # 显示最后50行日志
            result = subprocess.run(["tail", "-50", log_file], 
                                  capture_output=True, text=True)
            if result.stdout:
                print(result.stdout)
            else:
                print("📋 日志文件为空")
        except Exception as e:
            print(f"❌ 读取日志失败: {e}")
    else:
        print("❌ 日志文件不存在，请先运行同步服务")

def main():
    """主函数"""
    print_banner()
    
    while True:
        show_menu()
        
        try:
            choice = input("请输入选项 (0-5): ").strip()
            
            if choice == "0":
                print("👋 感谢使用赛狐ERP数据同步服务！")
                break
            elif choice == "1":
                run_database_test()
            elif choice == "2":
                run_single_sync()
            elif choice == "3":
                run_continuous_sync_4hours()
            elif choice == "4":
                run_continuous_sync_30s()
            elif choice == "5":
                show_logs()
            else:
                print("❌ 无效选项，请重新选择")
                
        except KeyboardInterrupt:
            print("\n👋 用户退出程序")
            break
        except Exception as e:
            print(f"❌ 程序异常: {e}")
        
        # 等待用户确认后继续
        input("\n按回车键继续...")

if __name__ == "__main__":
    main()