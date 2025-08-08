#!/usr/bin/env python3
"""
简单修复欧盟显示：直接更新marketplace字段
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def simple_fix_eu():
    """简单修复欧盟显示"""
    print("🔧 简单修复欧盟显示逻辑")
    
    db_manager = DatabaseManager()
    
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 查看修复前状态
            cursor.execute("""
                SELECT marketplace, COUNT(*) as count 
                FROM inventory_points 
                GROUP BY marketplace 
                ORDER BY count DESC
            """)
            before_stats = cursor.fetchall()
            
            print("修复前:")
            for stat in before_stats:
                print(f"   {stat['marketplace']}: {stat['count']} 个")
            
            # 直接更新欧盟国家的marketplace字段
            cursor.execute("""
                UPDATE inventory_points 
                SET marketplace = '欧盟',
                    store = '欧盟汇总',
                    inventory_point_name = CONCAT(SUBSTRING_INDEX(inventory_point_name, '-', 1), '-欧盟'),
                    merge_type = 'eu_unified'
                WHERE marketplace IN ('DE', 'FR', 'IT', 'ES')
            """)
            
            updated_count = cursor.rowcount
            conn.commit()
            
            print(f"✅ 更新了 {updated_count} 个库存点的显示")
            
            # 查看修复后状态
            cursor.execute("""
                SELECT marketplace, COUNT(*) as count 
                FROM inventory_points 
                GROUP BY marketplace 
                ORDER BY count DESC
            """)
            after_stats = cursor.fetchall()
            
            print("\n修复后:")
            for stat in after_stats:
                if stat['marketplace'] == '欧盟':
                    print(f"   ✅ {stat['marketplace']}: {stat['count']} 个 (符合README要求)")
                else:
                    print(f"   ✅ {stat['marketplace']}: {stat['count']} 个")
    
    print("\n🎉 欧盟显示修复完成！")

if __name__ == '__main__':
    simple_fix_eu()