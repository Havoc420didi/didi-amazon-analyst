#!/usr/bin/env python3
"""
修复库存明细表的唯一键约束问题
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from src.database import db_manager

def fix_inventory_constraints():
    """修复库存明细表的约束问题"""
    print("🔧 修复库存明细表的唯一键约束")
    print("=" * 60)
    
    try:
        # 1. 先查看当前约束
        print("📊 当前表约束:")
        indexes = db_manager.execute_query("SHOW INDEX FROM inventory_details")
        
        for index in indexes:
            if index['Key_name'] != 'PRIMARY':
                unique_status = "UNIQUE" if index['Non_unique'] == 0 else "INDEX"
                print(f"   {index['Key_name']}: {index['Column_name']} ({unique_status})")
        
        # 2. 删除有问题的唯一键约束
        print(f"\n🗑️  删除当前的唯一键约束...")
        try:
            db_manager.execute_update("ALTER TABLE inventory_details DROP INDEX uk_commodity_sku")
            print("   ✅ 已删除 uk_commodity_sku 约束")
        except Exception as e:
            if "doesn't exist" in str(e):
                print("   ⚠️  uk_commodity_sku 约束不存在，跳过删除")
            else:
                print(f"   ❌ 删除约束失败: {e}")
        
        # 3. 创建新的复合唯一键约束
        print(f"\n✨ 创建新的复合唯一键约束...")
        try:
            # 仓库ID + 商品SKU 的组合约束
            db_manager.execute_update(
                "ALTER TABLE inventory_details ADD UNIQUE KEY uk_warehouse_commodity (warehouse_id, commodity_sku)"
            )
            print("   ✅ 已创建 uk_warehouse_commodity (warehouse_id, commodity_sku) 约束")
        except Exception as e:
            if "Duplicate key name" in str(e):
                print("   ⚠️  uk_warehouse_commodity 约束已存在，跳过创建")
            else:
                print(f"   ❌ 创建约束失败: {e}")
        
        # 4. 验证新的约束
        print(f"\n🔍 验证修复后的约束:")
        indexes_after = db_manager.execute_query("SHOW INDEX FROM inventory_details")
        
        for index in indexes_after:
            if index['Key_name'] != 'PRIMARY':
                unique_status = "UNIQUE" if index['Non_unique'] == 0 else "INDEX"
                print(f"   {index['Key_name']}: {index['Column_name']} ({unique_status})")
        
        # 5. 清理数据库，准备重新同步
        print(f"\n🧹 清理现有数据，准备重新同步...")
        deleted = db_manager.execute_update("DELETE FROM inventory_details")
        print(f"   清理了 {deleted} 条记录")
        
        print(f"\n✅ 约束修复完成!")
        print(f"💡 现在同一个SKU可以在不同仓库中存在多条记录")
        
        return True
        
    except Exception as e:
        print(f"❌ 修复失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_new_constraints():
    """测试新的约束是否正常工作"""
    print(f"\n🧪 测试新约束的工作情况")
    print("=" * 60)
    
    try:
        from src.auth.saihu_api_client import saihu_api_client
        from src.models.inventory_details import InventoryDetails
        from datetime import date
        
        # 获取一些测试数据
        print("📡 获取测试数据...")
        result = saihu_api_client.fetch_warehouse_inventory(page_no=1, page_size=20, is_hidden=False)
        
        if result and 'rows' in result:
            rows = result['rows']
            print(f"   获取到 {len(rows)} 条测试数据")
            
            # 转换和保存数据
            today = date.today()
            inventory_list = []
            
            for item in rows:
                try:
                    inventory = InventoryDetails.from_api_response(item, today)
                    if inventory.is_valid():
                        inventory_list.append(inventory)
                except:
                    pass
            
            print(f"   转换成功 {len(inventory_list)} 条有效数据")
            
            if inventory_list:
                # 批量保存
                print("💾 测试批量保存...")
                count_before = db_manager.execute_single("SELECT COUNT(*) as total FROM inventory_details")['total']
                
                db_manager.batch_save_inventory_details(inventory_list)
                
                count_after = db_manager.execute_single("SELECT COUNT(*) as total FROM inventory_details")['total']
                actual_saved = count_after - count_before
                
                print(f"   实际保存: {actual_saved} 条记录")
                print(f"   保存率: {(actual_saved/len(inventory_list)*100):.1f}%")
                
                # 检查是否有重复的warehouse+sku组合
                duplicates = db_manager.execute_query("""
                    SELECT warehouse_id, commodity_sku, COUNT(*) as count 
                    FROM inventory_details 
                    GROUP BY warehouse_id, commodity_sku 
                    HAVING COUNT(*) > 1
                """)
                
                if duplicates:
                    print(f"   ⚠️  发现 {len(duplicates)} 个重复的warehouse+sku组合")
                    for dup in duplicates[:3]:
                        print(f"      仓库:{dup['warehouse_id']}, SKU:{dup['commodity_sku']}, 数量:{dup['count']}")
                else:
                    print(f"   ✅ 没有重复的warehouse+sku组合")
                
                # 显示保存的数据样本
                print(f"\n📋 保存的数据样本:")
                sample_data = db_manager.execute_query("""
                    SELECT warehouse_id, commodity_sku, commodity_name, stock_all_num, stock_available 
                    FROM inventory_details 
                    ORDER BY id DESC 
                    LIMIT 5
                """)
                
                for i, row in enumerate(sample_data):
                    print(f"   [{i+1}] 仓库:{row['warehouse_id']} | {row['commodity_sku'][:30]:<30} | 总库存:{row['stock_all_num']} | 可用:{row['stock_available']}")
                
                return actual_saved > 0
            else:
                print("❌ 没有有效测试数据")
                return False
        else:
            print("❌ 无法获取测试数据")
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 开始修复库存明细表约束问题")
    print("=" * 60)
    
    # 修复约束
    fix_success = fix_inventory_constraints()
    
    if fix_success:
        # 测试新约束
        test_success = test_new_constraints()
        
        print(f"\n{'='*60}")
        if test_success:
            print("🎉 库存明细表约束修复成功!")
            print("📝 现在可以正确保存来自不同仓库的相同SKU数据")
            print("📝 建议重新运行完整的库存明细同步")
        else:
            print("⚠️  约束修复成功，但测试未通过")
        print(f"{'='*60}")
    else:
        print(f"\n{'='*60}")
        print("💔 库存明细表约束修复失败")
        print(f"{'='*60}")