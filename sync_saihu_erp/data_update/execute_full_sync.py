#!/usr/bin/env python3
"""
完整数据同步执行脚本
使用验证过的API凭据执行所有数据类型的同步
"""

import sys
import os
from datetime import datetime, date, timedelta
import json

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.scheduler.sync_jobs import SyncJobs
from src.config.settings import settings
from src.utils.logging_utils import setup_logging

def main():
    """主函数：执行完整的数据同步"""
    print("🚀 开始执行赛狐ERP数据同步...")
    print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 设置日志
    setup_logging()
    
    # 初始化同步作业
    sync_jobs = SyncJobs()
    
    # 执行结果汇总
    results = {
        'start_time': datetime.now().isoformat(),
        'tasks': []
    }
    
    try:
        # 1. 同步昨天的产品分析数据
        print("\n📊 1. 同步产品分析数据（昨天）...")
        yesterday = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        analytics_result = sync_jobs.sync_product_analytics_by_date(yesterday)
        results['tasks'].append({
            'task': 'product_analytics_yesterday',
            'date': yesterday,
            'result': analytics_result
        })
        
        if analytics_result.get('status') == 'success':
            print(f"✅ 产品分析数据同步成功: {analytics_result.get('raw_count', 0)} 条原始数据")
            print(f"   处理成功: {analytics_result.get('processed_count', 0)} 条")
            print(f"   库存合并: {analytics_result.get('merged_count', 0)} 条")
        else:
            print(f"❌ 产品分析数据同步失败: {analytics_result.get('error', '未知错误')}")
        
        # 2. 同步FBA库存数据
        print("\n📦 2. 同步FBA库存数据...")
        fba_result = sync_jobs.sync_fba_inventory()
        results['tasks'].append({
            'task': 'fba_inventory',
            'result': fba_result
        })
        
        if fba_result.get('status') == 'success':
            print(f"✅ FBA库存数据同步成功: {fba_result.get('data_count', 0)} 条数据")
        else:
            print(f"❌ FBA库存数据同步失败: {fba_result.get('error', '未知错误')}")
        
        # 3. 同步库存明细数据
        print("\n🔍 3. 同步库存明细数据...")
        inventory_result = sync_jobs.sync_inventory_details()
        results['tasks'].append({
            'task': 'inventory_details',
            'result': inventory_result
        })
        
        if inventory_result.get('status') == 'success':
            print(f"✅ 库存明细数据同步成功: {inventory_result.get('data_count', 0)} 条数据")
        else:
            print(f"❌ 库存明细数据同步失败: {inventory_result.get('error', '未知错误')}")
        
        # 4. 获取同步状态
        print("\n📋 4. 获取同步状态...")
        sync_status = sync_jobs.get_sync_status()
        results['sync_status'] = sync_status
        
        print("📊 同步状态汇总:")
        if 'merge_summary' in sync_status:
            summary = sync_status['merge_summary']
            print(f"   库存点总数: {summary.get('total_points', 0)}")
            print(f"   EU库存点数: {summary.get('eu_points', 0)}")
            print(f"   非EU库存点数: {summary.get('non_eu_points', 0)}")
            print(f"   合并记录数: {summary.get('merged_records', 0)}")
        
        # 5. 显示最近任务
        print("\n🕐 最近任务:")
        recent_tasks = sync_status.get('recent_tasks', [])
        for task in recent_tasks[:5]:  # 显示最近5个任务
            print(f"   {task.get('task_type')}: {task.get('status')} ({task.get('created_at')})")
        
    except Exception as e:
        print(f"🚨 数据同步执行失败: {e}")
        results['error'] = str(e)
        return False
    
    finally:
        # 保存执行结果
        results['end_time'] = datetime.now().isoformat()
        results['duration'] = str(datetime.now() - datetime.fromisoformat(results['start_time']))
        
        # 保存结果到文件
        with open('sync_execution_result.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print(f"\n📁 执行结果已保存到: sync_execution_result.json")
    
    return True

def sync_historical_data():
    """同步历史数据（可选）"""
    print("\n📈 开始同步历史数据...")
    
    sync_jobs = SyncJobs()
    
    # 同步过去7天的产品分析数据
    print("📊 同步过去7天的产品分析数据...")
    history_result = sync_jobs.sync_product_analytics_history(days=7)
    
    return history_result

if __name__ == "__main__":
    print("=" * 60)
    print("赛狐ERP数据同步系统")
    print("=" * 60)
    
    # 获取API配置
    api_config = settings.get('api', {})
    print(f"API配置:")
    print(f"  Base URL: {api_config.get('base_url', 'N/A')}")
    print(f"  Client ID: {api_config.get('client_id', 'N/A')}")
    
    # 确认执行
    print("\n⚠️  确认执行数据同步?")
    print("这将从赛狐ERP API获取最新数据并同步到本地数据库")
    
    try:
        choice = input("\n按Enter继续，或输入 'history' 同步历史数据: ").strip().lower()
        
        if choice == 'history':
            result = sync_historical_data()
            print(f"\n历史数据同步结果: {result}")
        else:
            success = main()
            if success:
                print("\n🎉 数据同步执行完成!")
            else:
                print("\n❌ 数据同步执行失败，请检查日志")
                sys.exit(1)
                
    except KeyboardInterrupt:
        print("\n⏹️  用户取消操作")
        sys.exit(0)
    except Exception as e:
        print(f"\n🚨 执行错误: {e}")
        sys.exit(1)