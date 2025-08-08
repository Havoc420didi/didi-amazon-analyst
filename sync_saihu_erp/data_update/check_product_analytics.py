#!/usr/bin/env python3
"""
检查product_analytics表结构
"""

import sys
sys.path.insert(0, '.')
from src.database.connection import DatabaseManager

def check_table_structure():
    """检查product_analytics表结构"""
    db_manager = DatabaseManager()
    
    print("🔍 检查product_analytics表结构...")
    with db_manager.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 获取表结构
            cursor.execute("DESCRIBE product_analytics")
            columns = cursor.fetchall()
            
            print("\n📊 product_analytics表字段:")
            for col in columns:
                print(f"   {col['Field']}: {col['Type']} {'NULL' if col['Null'] == 'YES' else 'NOT NULL'}")
            
            # 获取样本数据
            cursor.execute("SELECT * FROM product_analytics LIMIT 3")
            samples = cursor.fetchall()
            
            if samples:
                print("\n📋 样本数据:")
                sample = samples[0]
                for key, value in sample.items():
                    print(f"   {key}: {value}")

if __name__ == '__main__':
    check_table_structure()