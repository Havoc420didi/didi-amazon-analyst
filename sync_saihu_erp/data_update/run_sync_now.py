#!/usr/bin/env python3
"""
立即执行数据同步脚本 - 非交互式
使用验证过的API凭据执行所有数据类型的同步
"""

import sys
import os
from datetime import datetime, date, timedelta
import json
import time

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
    print(f"  Client ID: {api_config.get('client_id', 'N/A')}")
    
    try:
        # Web状态集成 - 报告开始
        from src.utils.web_integration import report_status, report_progress, report_error, report_completed
        
        report_status('started', '赛狐ERP数据同步已启动')
        
        # 1. 同步昨天的产品分析数据
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
        from src.database import get_db_session
        from src.models import ProductAnalytics, FbaInventory
        
        with get_db_session() as session:
            # 检查产品分析数据
            analytics_count = session.query(ProductAnalytics).count()
            print(f"   产品分析数据总数: {analytics_count}")
            
            if analytics_count > 0:
                # 检查是否有广告数据
                ad_data = session.query(ProductAnalytics).filter(
                    ProductAnalytics.ad_cost > 0
                ).limit(5).all()
                print(f"   有广告数据的记录数: {len(ad_data)}")
                
                if ad_data:
                    print("   广告数据示例:")
                    for item in ad_data[:3]:
                        print(f"     SKU: {item.sku}, 广告花费: {item.ad_cost}, 广告销售: {item.ad_sales}")
            
            # 检查FBA库存数据
            fba_count = session.query(FbaInventory).count()
            print(f"   FBA库存数据总数: {fba_count}")
            
            if fba_count > 0:
                fba_sample = session.query(FbaInventory).limit(3).all()
                print("   FBA库存数据示例:")
                for item in fba_sample:
                    print(f"     SKU: {item.sku}, 可用库存: {item.available_quantity}, 总库存: {item.total_quantity}")
        
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
        print(f"⏱️  总执行时间: {duration}")
    
    print("\n🎉 数据同步执行完成!")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("赛狐ERP数据同步系统 - 非交互式")
    print("=" * 60)
    
    success = main()
    if not success:
        sys.exit(1)