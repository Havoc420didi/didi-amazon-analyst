#!/usr/bin/env python3
"""
立即执行数据同步脚本 - 非交互式
使用验证过的API凭据执行所有数据类型的同步
"""

import sys
import os
import argparse
from datetime import datetime, date, timedelta
import json
import time

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.scheduler.sync_jobs import SyncJobs
from src.config.settings import settings
from src.utils.logging_utils import setup_logging

def main():
    """主函数：执行完整的数据同步，支持30天历史数据回填"""
    # 添加命令行参数支持
    parser = argparse.ArgumentParser(description='赛狐ERP数据同步脚本')
    parser.add_argument('--days', type=int, default=1, 
                       help="同步多少天的历史产品分析数据，默认1天，可设为30进行30天完整回填")
    parser.add_argument('--type', choices=['analytics', 'fba', 'inventory', 'all'], 
                       default='all', help="同步类型：analytics(仅产品分析)、fba、inventory、all(全部)")
    
    args = parser.parse_args()
    
    print("🚀 开始执行赛狐ERP数据同步...")
    print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🎯 同步模式: {args.days}天历史数据 + {args.type}类型")
    if args.days == 30:
        print("📊 模式: 30天完整历史数据回填（包含库存合并）")
    
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
        
        report_status('started', '赛狐ERP数据同步已启动')
        
        # 根据模式选择同步策略
        if args.days == 30:
            print("\n📊 1. 同步30天历史产品分析数据...")
            report_progress('正在同步30天历史数据', 20)
            analytics_result = sync_jobs.sync_product_analytics_history(days=30)
            results['tasks'].append({
                'task': 'product_analytics_30day',
                'days': 30,
                'result': analytics_result
            })
        else:
            print("\n📊 1. 同步产品分析数据（昨天）...")
            report_progress('正在同步产品分析数据', 20)
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
            report_error(f"产品分析数据同步失败: {analytics_result.get('error', '未知错误')}")
        
        # 2. 同步FBA库存数据
        print("\n📦 2. 同步FBA库存数据...")
        report_progress('正在同步FBA库存数据', 50)
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
        for task in recent_tasks[:5]:  # 显示最近5个任务
            print(f"   {task.get('task_type')}: {task.get('status')} ({task.get('created_at')})")
        
        # 6. 验证数据
        print("\n🔍 5. 验证同步数据...")
        from src.database import db_manager
        
        # 检查产品分析数据
        analytics_count_row = db_manager.execute_single("SELECT COUNT(*) AS count FROM product_analytics")
        analytics_count = analytics_count_row['count'] if analytics_count_row else 0
        print(f"   产品分析数据总数: {analytics_count}")
        
        if analytics_count > 0:
            ad_sample_rows = db_manager.execute_query(
                "SELECT sku, ad_cost, ad_sales FROM product_analytics WHERE ad_cost > 0 ORDER BY data_date DESC LIMIT 3"
            )
            print(f"   有广告数据的记录数示例: {len(ad_sample_rows)}")
            if ad_sample_rows:
                print("   广告数据示例:")
                for row in ad_sample_rows:
                    print(f"     SKU: {row.get('sku')}, 广告花费: {row.get('ad_cost')}, 广告销售: {row.get('ad_sales')}")
        
        # 检查FBA库存数据
        fba_count_row = db_manager.execute_single("SELECT COUNT(*) AS count FROM fba_inventory")
        fba_count = fba_count_row['count'] if fba_count_row else 0
        print(f"   FBA库存数据总数: {fba_count}")
        
        if fba_count > 0:
            fba_sample_rows = db_manager.execute_query(
                "SELECT sku, available, total_inventory FROM fba_inventory ORDER BY snapshot_date DESC NULLS LAST LIMIT 3"
            )
            print("   FBA库存数据示例:")
            for row in fba_sample_rows:
                print(f"     SKU: {row.get('sku')}, 可用库存: {row.get('available')}, 总库存: {row.get('total_inventory')}")
        
        # Web状态集成 - 报告完成
        end_time = datetime.now()
        duration = end_time - start_time
        duration_seconds = duration.total_seconds()
        
        total_records = sum(task['result'].get('processed_count', task['result'].get('data_count', 0)) 
                          for task in results['tasks'] if task['result'].get('status') == 'success')
        
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
        with open('sync_execution_result.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print(f"\n📁 执行结果已保存到: sync_execution_result.json")
        print(f"⏱️  总执行时间: {final_duration}")
    
    print("\n🎉 数据同步执行完成!")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("赛狐ERP数据同步系统 - 非交互式")
    print("=" * 60)
    
    success = main()
    if not success:
        sys.exit(1)