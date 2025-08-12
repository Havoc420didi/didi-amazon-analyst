#!/usr/bin/env python3
"""
执行60天产品分析数据同步脚本
从最后同步的时间开始，再同步30天，实现总共60天的数据同步
"""

import sys
import os
from datetime import datetime, date, timedelta
import json

# 添加项目根目录到Python路径
project_root = os.path.dirname(__file__)
sync_path = os.path.join(project_root, "sync_saihu_erp", "data_update")
sys.path.insert(0, sync_path)

from src.scheduler.sync_jobs import SyncJobs
from src.config.settings import settings
from src.utils.logging_utils import setup_logging
from src.database import db_manager

def get_last_sync_date():
    """获取数据库中最后同步的日期"""
    try:
        # 查询product_analytics表中最新的数据日期
        result = db_manager.execute_single(
            "SELECT MAX(data_date) as last_date FROM product_analytics"
        )
        
        if result and result.get('last_date'):
            last_date = result['last_date']
            print(f"📅 数据库中最后同步日期: {last_date}")
            return last_date
        else:
            print("⚠️ 数据库中无历史数据，将从30天前开始同步")
            return None
            
    except Exception as e:
        print(f"❌ 获取最后同步日期失败: {e}")
        return None

def calculate_sync_range(last_sync_date=None, additional_days=30):
    """
    计算同步日期范围
    
    Args:
        last_sync_date: 最后同步的日期，如果为None则从30+additional_days天前开始
        additional_days: 额外需要同步的天数，默认30天
        
    Returns:
        tuple: (start_date, end_date) 需要同步的日期范围
    """
    today = date.today()
    
    if last_sync_date:
        # 从最后同步日期的下一天开始
        if isinstance(last_sync_date, str):
            last_sync_date = datetime.strptime(last_sync_date, '%Y-%m-%d').date()
        
        start_date = last_sync_date + timedelta(days=1)
        end_date = start_date + timedelta(days=additional_days - 1)
        
        # 确保不超过昨天
        yesterday = today - timedelta(days=1)
        if end_date > yesterday:
            end_date = yesterday
        
        print(f"📊 继续同步模式:")
        print(f"   最后同步日期: {last_sync_date}")
        print(f"   新同步范围: {start_date} 到 {end_date}")
        print(f"   新增天数: {(end_date - start_date).days + 1}")
        
    else:
        # 如果没有历史数据，同步最近60天
        total_days = 60
        end_date = today - timedelta(days=1)
        start_date = end_date - timedelta(days=total_days - 1)
        
        print(f"📊 首次同步模式:")
        print(f"   同步范围: {start_date} 到 {end_date}")
        print(f"   总天数: {total_days}")
    
    return start_date, end_date

def sync_date_range(sync_jobs, start_date, end_date):
    """
    按日期范围同步产品分析数据
    
    Args:
        sync_jobs: SyncJobs实例
        start_date: 开始日期
        end_date: 结束日期
        
    Returns:
        dict: 同步结果
    """
    print(f"\n🔄 开始按日期范围同步: {start_date} 到 {end_date}")
    
    results = []
    success_count = 0
    current_date = start_date
    
    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        print(f"   正在同步 {date_str}...")
        
        try:
            result = sync_jobs.sync_product_analytics_by_date(date_str)
            results.append(result)
            
            if result.get('status') == 'success':
                success_count += 1
                processed_count = result.get('processed_count', 0)
                print(f"   ✅ {date_str}: {processed_count} 条记录")
            else:
                error_msg = result.get('error', '未知错误')
                print(f"   ❌ {date_str}: {error_msg}")
                
        except Exception as e:
            print(f"   ❌ {date_str}: 同步异常 - {e}")
            results.append({
                'status': 'error',
                'data_date': date_str,
                'error': str(e)
            })
        
        current_date += timedelta(days=1)
    
    total_days = (end_date - start_date).days + 1
    
    return {
        'status': 'completed' if success_count > 0 else 'failed',
        'total_days': total_days,
        'success_count': success_count,
        'failure_count': total_days - success_count,
        'results': results
    }

def main():
    """主函数：执行60天数据同步"""
    print("🚀 开始执行60天产品分析数据同步...")
    print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # 设置日志
    setup_logging()
    
    # 初始化同步作业
    sync_jobs = SyncJobs()
    start_time = datetime.now()
    
    # 执行结果汇总
    results = {
        'start_time': start_time.isoformat(),
        'sync_type': '60day_extended',
        'tasks': []
    }
    
    # 获取API配置和凭据检查
    api_config = settings.get('api', {})
    print(f"🔧 API配置检查:")
    print(f"   Base URL: {api_config.get('base_url', 'N/A')}")

    try:
        from src.config.secure_config import config
        from src.auth.oauth_client import oauth_client
        creds = config.get_api_credentials()
        print(f"   Client ID: {creds.client_id}")
        
        # 试图获取一次访问令牌
        token = oauth_client.get_access_token()
        if not token:
            raise RuntimeError("无法获取访问令牌，请检查 SELLFOX_CLIENT_ID/SELLFOX_CLIENT_SECRET 是否正确")
        print("   访问令牌: ✅ 已获取")
    except Exception as precheck_err:
        print(f"❌ 凭据预检失败: {precheck_err}")
        return False
    
    try:
        # Web状态集成
        from src.utils.web_integration import report_status, report_progress, report_error, report_completed
        report_status('started', '60天扩展数据同步已启动')
        
        # 步骤1: 获取最后同步日期
        print("\n📊 步骤1: 分析现有数据")
        last_sync_date = get_last_sync_date()
        
        # 步骤2: 计算需要同步的日期范围
        print("\n📊 步骤2: 计算同步范围")
        start_date, end_date = calculate_sync_range(last_sync_date, additional_days=30)
        
        # 检查是否需要同步
        if start_date > end_date:
            print("✅ 数据已是最新，无需额外同步")
            results['message'] = '数据已是最新状态'
            results['status'] = 'up_to_date'
            return results
        
        # 步骤3: 执行日期范围同步
        print(f"\n📊 步骤3: 执行扩展同步")
        report_progress('正在执行扩展同步', 30)
        
        sync_result = sync_date_range(sync_jobs, start_date, end_date)
        results['tasks'].append({
            'task': 'extended_product_analytics',
            'date_range': f"{start_date} 到 {end_date}",
            'result': sync_result
        })
        
        # 显示同步结果
        if sync_result.get('status') == 'completed':
            total_days = sync_result.get('total_days', 0)
            success_count = sync_result.get('success_count', 0)
            failure_count = sync_result.get('failure_count', 0)
            
            print(f"\n✅ 扩展同步完成:")
            print(f"   目标天数: {total_days}")
            print(f"   成功天数: {success_count}")
            print(f"   失败天数: {failure_count}")
            print(f"   成功率: {success_count/total_days*100:.1f}%")
            
            # 显示近期成功的同步详情
            recent_success = [r for r in sync_result.get('results', []) if r.get('status') == 'success'][-5:]
            if recent_success:
                print(f"   近期成功同步:")
                for result in recent_success:
                    date_str = result.get('data_date', 'N/A')
                    count = result.get('processed_count', 0)
                    print(f"     ✅ {date_str}: {count} 条记录")
        else:
            print(f"❌ 扩展同步失败: {sync_result.get('error', '未知错误')}")
            report_error(f"扩展同步失败")
        
        # 步骤4: 同步其他数据类型
        print(f"\n📊 步骤4: 同步其他数据类型")
        
        # 同步FBA库存
        print("📦 同步FBA库存数据...")
        report_progress('正在同步FBA库存', 70)
        fba_result = sync_jobs.sync_fba_inventory()
        results['tasks'].append({
            'task': 'fba_inventory',
            'result': fba_result
        })
        
        if fba_result.get('status') == 'success':
            print(f"✅ FBA库存同步成功: {fba_result.get('data_count', 0)} 条")
        else:
            print(f"❌ FBA库存同步失败: {fba_result.get('error', '未知错误')}")
        
        # 同步库存明细
        print("🔍 同步库存明细数据...")
        report_progress('正在同步库存明细', 85)
        inventory_result = sync_jobs.sync_inventory_details()
        results['tasks'].append({
            'task': 'inventory_details',
            'result': inventory_result
        })
        
        if inventory_result.get('status') == 'success':
            print(f"✅ 库存明细同步成功: {inventory_result.get('data_count', 0)} 条")
        else:
            print(f"❌ 库存明细同步失败: {inventory_result.get('error', '未知错误')}")
        
        # 步骤5: 验证最终数据状态
        print(f"\n📊 步骤5: 验证数据完整性")
        report_progress('验证数据完整性', 95)
        
        # 检查总记录数
        total_count_result = db_manager.execute_single("SELECT COUNT(*) AS count FROM product_analytics")
        total_count = total_count_result.get('count', 0) if total_count_result else 0
        print(f"   产品分析数据总计: {total_count} 条")
        
        # 检查日期分布
        date_range_result = db_manager.execute_single(
            "SELECT MIN(data_date) as min_date, MAX(data_date) as max_date FROM product_analytics"
        )
        if date_range_result:
            min_date = date_range_result.get('min_date')
            max_date = date_range_result.get('max_date')
            if min_date and max_date:
                if isinstance(min_date, str):
                    min_date = datetime.strptime(min_date, '%Y-%m-%d').date()
                if isinstance(max_date, str):
                    max_date = datetime.strptime(max_date, '%Y-%m-%d').date()
                
                total_days_in_db = (max_date - min_date).days + 1
                print(f"   数据日期范围: {min_date} 到 {max_date}")
                print(f"   覆盖天数: {total_days_in_db} 天")
        
        # 检查最近7天数据
        recent_data = db_manager.execute_query(
            """
            SELECT data_date, COUNT(*) as count 
            FROM product_analytics 
            WHERE data_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY data_date 
            ORDER BY data_date DESC 
            LIMIT 7
            """
        )
        
        if recent_data:
            print(f"   最近7天数据分布:")
            for row in recent_data:
                date_str = row.get('data_date')
                count = row.get('count', 0)
                print(f"     {date_str}: {count} 条记录")
        
        # 计算总处理记录数并完成报告
        end_time = datetime.now()
        duration = end_time - start_time
        duration_seconds = duration.total_seconds()
        
        total_processed = 0
        for task in results['tasks']:
            task_result = task['result']
            if task_result.get('status') in ['success', 'completed']:
                if 'success_count' in task_result:  # 历史同步任务
                    # 计算成功同步的天数对应的记录数
                    successful_results = [r for r in task_result.get('results', []) if r.get('status') == 'success']
                    for day_result in successful_results:
                        total_processed += day_result.get('processed_count', 0)
                else:  # 单次同步任务
                    total_processed += task_result.get('processed_count', task_result.get('data_count', 0))
        
        results['total_processed'] = total_processed
        results['final_total_count'] = total_count
        
        report_completed(total_processed, duration_seconds)
        
        print(f"\n🎉 60天扩展同步完成!")
        print(f"   新增处理记录: {total_processed}")
        print(f"   数据库总记录: {total_count}")
        print(f"   执行时长: {duration}")
        
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
        results['duration'] = str(datetime.now() - start_time)
        
        # 保存结果到文件
        result_filename = 'sync_60day_result.json'
        with open(result_filename, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2, default=str)
        
        print(f"\n📁 执行结果已保存到: {result_filename}")
    
    return True

if __name__ == "__main__":
    print("=" * 70)
    print("赛狐ERP数据同步系统 - 60天扩展同步")
    print("=" * 70)
    
    success = main()
    if not success:
        sys.exit(1)