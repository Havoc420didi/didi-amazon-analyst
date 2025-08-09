#!/usr/bin/env python3
"""
30天回补同步脚本 - 执行30天产品分析数据回补 + FBA库存 + 库存明细同步
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
    """主函数：执行30天回补 + 完整数据同步"""
    print("🚀 开始执行30天回补 + 完整数据同步...")
    print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 设置日志
    setup_logging()
    
    # 初始化同步作业
    sync_jobs = SyncJobs()
    start_time = datetime.now()
    
    # 执行结果汇总
    results = {
        'start_time': start_time.isoformat(),
        'tasks': []
    }
    
    # 获取API配置
    api_config = settings.get('api', {})
    print(f"API配置:")
    print(f"  Base URL: {api_config.get('base_url', 'N/A')}")

    # 启动前凭据/令牌预检
    try:
        from src.config.secure_config import config
        from src.auth.oauth_client import oauth_client
        creds = config.get_api_credentials()
        print(f"  Client ID: {creds.client_id}")
        # 试图获取一次访问令牌
        token = oauth_client.get_access_token()
        if not token:
            raise RuntimeError("无法获取访问令牌，请检查 SELLFOX_CLIENT_ID/SELLFOX_CLIENT_SECRET 是否正确")
        print("  访问令牌: 已获取")
    except Exception as precheck_err:
        print(f"❌ 凭据预检失败: {precheck_err}")
        raise
    
    try:
        # Web状态集成 - 报告开始
        from src.utils.web_integration import report_status, report_progress, report_error, report_completed
        
        report_status('started', '30天回补数据同步已启动')
        
        # 1. 回补最近30天的产品分析数据
        print("\n📊 1. 回补最近30天的产品分析数据...")
        report_progress('正在回补30天产品分析数据', 10)
        
        backfill_result = sync_jobs.sync_product_analytics_history(days=30)
        results['tasks'].append({
            'task': 'product_analytics_30day_backfill',
            'result': backfill_result
        })
        
        if backfill_result.get('status') == 'completed':
            success_count = backfill_result.get('success_count', 0)
            failure_count = backfill_result.get('failure_count', 0)
            print(f"✅ 30天产品分析数据回补完成")
            print(f"   成功同步: {success_count} 天")
            print(f"   失败同步: {failure_count} 天")
            
            # 显示部分结果详情
            results_list = backfill_result.get('results', [])
            if results_list:
                print("   近5天同步结果:")
                for i, result in enumerate(results_list[:5]):
                    status_icon = "✅" if result.get('status') == 'success' else "❌"
                    data_date = result.get('data_date', 'N/A')
                    processed_count = result.get('processed_count', result.get('raw_count', 0))
                    print(f"     {status_icon} {data_date}: {processed_count} 条记录")
        else:
            print(f"❌ 30天产品分析数据回补失败: {backfill_result.get('error', '未知错误')}")
            report_error(f"30天数据回补失败: {backfill_result.get('error', '未知错误')}")
        
        # 2. 同步FBA库存数据
        print("\n📦 2. 同步FBA库存数据...")
        report_progress('正在同步FBA库存数据', 60)
        fba_result = sync_jobs.sync_fba_inventory()
        results['tasks'].append({
            'task': 'fba_inventory',
            'result': fba_result
        })
        
        if fba_result.get('status') == 'success':
            print(f"✅ FBA库存数据同步成功: {fba_result.get('data_count', 0)} 条数据")
        else:
            print(f"❌ FBA库存数据同步失败: {fba_result.get('error', '未知错误')}")
            report_error(f"FBA库存数据同步失败: {fba_result.get('error', '未知错误')}")
        
        # 3. 同步库存明细数据
        print("\n🔍 3. 同步库存明细数据...")
        report_progress('正在同步库存明细数据', 80)
        inventory_result = sync_jobs.sync_inventory_details()
        results['tasks'].append({
            'task': 'inventory_details',
            'result': inventory_result
        })
        
        if inventory_result.get('status') == 'success':
            print(f"✅ 库存明细数据同步成功: {inventory_result.get('data_count', 0)} 条数据")
        else:
            print(f"❌ 库存明细数据同步失败: {inventory_result.get('error', '未知错误')}")
            report_error(f"库存明细数据同步失败: {inventory_result.get('error', '未知错误')}")
        
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
        for task in recent_tasks[:8]:  # 显示最近8个任务
            task_type = task.get('task_type', 'unknown')
            status_icon = "✅" if task.get('status') == 'success' else "❌" if task.get('status') == 'failed' else "🔄"
            created_at = task.get('created_at', 'N/A')
            data_date = task.get('data_date') or ''
            print(f"   {status_icon} {task_type} {data_date}: {task.get('status')} ({created_at})")
        
        # 6. 验证数据
        print("\n🔍 5. 验证同步数据...")
        from src.database import db_manager
        
        # 检查产品分析数据
        analytics_count_row = db_manager.execute_single("SELECT COUNT(*) AS count FROM product_analytics")
        analytics_count = analytics_count_row['count'] if analytics_count_row else 0
        print(f"   产品分析数据总数: {analytics_count}")
        
        # 检查最近30天的数据分布
        if analytics_count > 0:
            date_distribution_rows = db_manager.execute_query(
                """
                SELECT data_date, COUNT(*) as count 
                FROM product_analytics 
                WHERE data_date >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY data_date 
                ORDER BY data_date DESC 
                LIMIT 10
                """
            )
            print("   最近10天数据分布:")
            for row in date_distribution_rows:
                print(f"     {row.get('data_date')}: {row.get('count')} 条记录")
        
        # 检查FBA库存数据
        fba_count_row = db_manager.execute_single("SELECT COUNT(*) AS count FROM fba_inventory")
        fba_count = fba_count_row['count'] if fba_count_row else 0
        print(f"   FBA库存数据总数: {fba_count}")
        
        # 检查库存明细数据
        inventory_details_count_row = db_manager.execute_single("SELECT COUNT(*) AS count FROM inventory_details")
        inventory_details_count = inventory_details_count_row['count'] if inventory_details_count_row else 0
        print(f"   库存明细数据总数: {inventory_details_count}")
        
        # Web状态集成 - 报告完成
        end_time = datetime.now()
        duration = end_time - start_time
        duration_seconds = duration.total_seconds()
        
        # 计算总处理记录数
        total_records = 0
        for task in results['tasks']:
            task_result = task['result']
            if task_result.get('status') in ['success', 'completed']:
                if task['task'] == 'product_analytics_30day_backfill':
                    # 30天回补任务，计算所有成功日期的记录数
                    backfill_results = task_result.get('results', [])
                    for day_result in backfill_results:
                        if day_result.get('status') == 'success':
                            total_records += day_result.get('processed_count', day_result.get('raw_count', 0))
                else:
                    total_records += task_result.get('processed_count', task_result.get('data_count', 0))
        
        report_completed(total_records, duration_seconds)
        
    except Exception as e:
        print(f"🚨 数据同步执行失败: {e}")
        import traceback
        print("错误详情:")
        print(traceback.format_exc())
        results['error'] = str(e)
        report_error(str(e))
        return False
    
    finally:
        # 保存执行结果
        results['end_time'] = datetime.now().isoformat()
        final_duration = datetime.now() - start_time
        results['duration'] = str(final_duration)
        
        # 保存结果到文件
        with open('sync_30day_backfill_result.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print(f"\n📁 执行结果已保存到: sync_30day_backfill_result.json")
        print(f"⏱️  总执行时间: {final_duration}")
    
    print("\n🎉 30天回补 + 完整数据同步执行完成!")
    return True

if __name__ == "__main__":
    print("=" * 70)
    print("赛狐ERP数据同步系统 - 30天回补 + 完整同步")
    print("=" * 70)
    
    success = main()
    if not success:
        sys.exit(1)