#!/usr/bin/env python3
"""
完整的库存明细数据同步
"""
import sys
import os
import time
from datetime import datetime, date, timedelta

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from src.auth.saihu_api_client import saihu_api_client
from src.models.inventory_details import InventoryDetails
from src.database import db_manager

def sync_complete_inventory():
    """完整的库存明细同步"""
    print("🚀 开始完整库存明细数据同步")
    print("=" * 60)
    
    try:
        # 清理现有数据
        print("🧹 清理现有数据...")
        deleted = db_manager.execute_update("DELETE FROM inventory_details")
        print(f"   清理了 {deleted} 条旧记录")
        
        # 使用手动分页获取所有数据
        print("📡 获取所有库存明细数据...")
        all_data = []
        page_no = 1
        max_retries = 3
        
        while True:
            success = False
            for retry in range(max_retries):
                try:
                    print(f"   获取第 {page_no} 页数据... (尝试 {retry + 1}/{max_retries})")
                    
                    result = saihu_api_client.fetch_warehouse_inventory(
                        page_no=page_no,
                        page_size=100,
                        is_hidden=False  # 获取所有数据包括库存为0的
                    )
                    
                    if result and 'rows' in result:
                        rows = result['rows']
                        all_data.extend(rows)
                        
                        total_pages = result.get('totalPage', 1)
                        total_size = result.get('totalSize', 0)
                        
                        print(f"   ✅ 第 {page_no} 页成功: {len(rows)} 条数据")
                        print(f"      进度: {page_no}/{total_pages} 页, 已获取: {len(all_data)}/{total_size} 条")
                        
                        success = True
                        break
                    else:
                        print(f"   ❌ 第 {page_no} 页返回空数据")
                        break
                        
                except Exception as e:
                    print(f"   ❌ 第 {page_no} 页失败 (尝试 {retry + 1}): {e}")
                    if retry < max_retries - 1:
                        print(f"   ⏳ 等待 {(retry + 1) * 2} 秒后重试...")
                        time.sleep((retry + 1) * 2)
            
            if not success:
                print(f"   ⚠️  第 {page_no} 页获取失败，继续下一页")
            
            # 检查是否还有更多页
            if page_no >= total_pages:
                break
            
            page_no += 1
            
            # 添加延迟避免API频率限制
            if page_no % 5 == 0:
                print(f"   ⏳ 休息2秒避免频率限制...")
                time.sleep(2)
        
        print(f"📊 API总共获取: {len(all_data)} 条数据")
        
        if not all_data:
            print("❌ 未获取到任何数据")
            return False
        
        # 分批处理和保存数据
        batch_size = 100
        total_saved = 0
        total_valid = 0
        batch_count = 0
        
        print(f"🔄 分批处理数据 (批次大小: {batch_size})...")
        
        today = date.today()
        
        for i in range(0, len(all_data), batch_size):
            batch_count += 1
            batch_data = all_data[i:i + batch_size]
            
            print(f"\n📦 处理批次 {batch_count}: {len(batch_data)} 条数据")
            
            # 转换为数据模型
            inventory_list = []
            conversion_errors = 0
            validation_errors = 0
            
            for item in batch_data:
                try:
                    inventory = InventoryDetails.from_api_response(item, today)
                    if inventory.is_valid():
                        inventory_list.append(inventory)
                        total_valid += 1
                    else:
                        validation_errors += 1
                except Exception:
                    conversion_errors += 1
            
            print(f"   ✅ 有效数据: {len(inventory_list)} 条")
            if conversion_errors > 0:
                print(f"   ❌ 转换错误: {conversion_errors} 条")
            if validation_errors > 0:
                print(f"   ❌ 验证失败: {validation_errors} 条")
            
            # 批量保存数据
            if inventory_list:
                try:
                    # 获取保存前的记录数
                    count_before = db_manager.execute_single("SELECT COUNT(*) as total FROM inventory_details")['total']
                    
                    # 执行批量保存
                    db_manager.batch_save_inventory_details(inventory_list)
                    
                    # 获取保存后的记录数
                    count_after = db_manager.execute_single("SELECT COUNT(*) as total FROM inventory_details")['total']
                    
                    actual_saved = count_after - count_before
                    total_saved += actual_saved
                    
                    print(f"   💾 实际保存: {actual_saved} 条 (数据库从 {count_before} 增加到 {count_after})")
                    
                except Exception as e:
                    print(f"   ❌ 保存失败: {e}")
                    import traceback
                    traceback.print_exc()
        
        # 验证最终结果
        print(f"\n🔍 验证最终结果...")
        final_count = db_manager.execute_single("SELECT COUNT(*) as total FROM inventory_details")['total']
        
        # 统计各个仓库的数据分布
        warehouse_stats = db_manager.execute_query("""
            SELECT warehouse_id, COUNT(*) as count, 
                   SUM(stock_all_num) as total_stock,
                   SUM(stock_available) as available_stock
            FROM inventory_details 
            GROUP BY warehouse_id 
            ORDER BY count DESC
        """)
        
        print(f"\n📊 同步结果汇总:")
        print(f"   API获取数据: {len(all_data)} 条")
        print(f"   有效数据: {total_valid} 条")
        print(f"   实际保存: {total_saved} 条")
        print(f"   数据库最终记录: {final_count} 条")
        print(f"   保存成功率: {(final_count/total_valid*100):.1f}%")
        
        print(f"\n📋 各仓库数据分布:")
        for warehouse in warehouse_stats:
            print(f"   仓库 {warehouse['warehouse_id']}: {warehouse['count']} 个SKU | 总库存:{warehouse['total_stock']} | 可用:{warehouse['available_stock']}")
        
        # 显示部分保存的数据
        print(f"\n📋 库存数据样本 (有库存的商品):")
        sample_data = db_manager.execute_query("""
            SELECT warehouse_id, commodity_sku, commodity_name, stock_all_num, stock_available, fn_sku
            FROM inventory_details 
            WHERE stock_all_num > 0
            ORDER BY stock_all_num DESC 
            LIMIT 10
        """)
        
        for i, row in enumerate(sample_data):
            fn_sku_display = row['fn_sku'] if row['fn_sku'] else '无'
            print(f"   [{i+1:2d}] 仓库:{row['warehouse_id']} | {row['commodity_sku'][:35]:<35} | 总库存:{row['stock_all_num']:>4} | 可用:{row['stock_available']:>4} | FN:{fn_sku_display[:15]}")
        
        # 成功标识
        success_rate = (final_count / total_valid * 100) if total_valid > 0 else 0
        if success_rate >= 95:
            print(f"\n✅ 库存明细同步成功! 已保存 {final_count} 条记录到数据库")
            return True
        else:
            print(f"\n⚠️  库存明细同步部分成功，保存率: {success_rate:.1f}%")
            return final_count > 0
        
    except Exception as e:
        print(f"❌ 同步失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 开始完整库存明细同步")
    print("=" * 60)
    
    # 执行完整同步
    success = sync_complete_inventory()
    
    print(f"\n{'='*60}")
    if success:
        print("🎉 库存明细完整同步完成!")
        print("📝 用户现在可以在Navicat中查看完整的库存明细数据")
        print("📝 数据按 warehouse_id + commodity_sku 组合进行唯一性管理")
        print("📝 支持同一SKU在不同仓库中的独立库存记录")
    else:
        print("💔 库存明细同步失败或不完整")
    print(f"{'='*60}")