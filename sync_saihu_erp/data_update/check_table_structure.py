#!/usr/bin/env python3
"""
检查inventory_points表结构
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def check_table_structure():
    """检查表结构"""
    db_manager = DatabaseManager()
    
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 检查表结构
            cursor.execute('DESC inventory_points')
            columns = cursor.fetchall()
            print('inventory_points表当前字段结构:')
            for col in columns:
                field = col['Field'] if 'Field' in col else col[0]
                type_info = col['Type'] if 'Type' in col else col[1]
                print(f'  {field} - {type_info}')
            
            print(f'\n总字段数: {len(columns)}')
            
            # 检查是否有欧盟相关字段
            field_names = [col['Field'] if 'Field' in col else col[0] for col in columns]
            
            eu_related_fields = [f for f in field_names if 'eu' in f.lower() or 'region' in f.lower() or 'merge' in f.lower()]
            
            if eu_related_fields:
                print(f'\n找到欧盟/区域相关字段: {eu_related_fields}')
            else:
                print('\n❌ 没有找到欧盟/区域相关字段')
            
            # 查看几条数据
            cursor.execute('SELECT * FROM inventory_points LIMIT 3')
            sample_data = cursor.fetchall()
            
            if sample_data:
                print(f'\n样本数据 (前3条):')
                for i, row in enumerate(sample_data, 1):
                    print(f'  记录{i}: marketplace={row.get("marketplace", "N/A")}, merge_type={row.get("merge_type", "N/A")}')

if __name__ == '__main__':
    check_table_structure()