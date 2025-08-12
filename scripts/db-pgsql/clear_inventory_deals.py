#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
清空 inventory_deals 库存点快照表数据
使用Python和psycopg2连接PostgreSQL数据库
"""

import psycopg2
import psycopg2.extras
from datetime import datetime
import sys

# 数据库连接配置
DB_CONFIG = {
    'host': '8.219.185.28',
    'port': 5432,
    'database': 'amazon_analyst',
    'user': 'amazon_analyst',
    'password': 'amazon_analyst_2024',
    'connect_timeout': 10
}

def clear_inventory_deals():
    """清空inventory_deals表的主函数"""
    conn = None
    cursor = None
    
    try:
        print('🗑️  开始清空 inventory_deals 库存点快照表数据\n')
        
        # 连接数据库
        print('🔌 正在连接数据库...')
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print('✅ 数据库连接成功')
        
        # 1. 检查表是否存在
        print('\n📋 1. 检查 inventory_deals 表是否存在:')
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'inventory_deals'
            );
        """)
        
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print('❌ inventory_deals 表不存在')
            return
        
        print('✅ inventory_deals 表已存在')

        # 2. 获取当前表数据统计
        print('\n📊 2. 获取当前表数据统计:')
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT snapshot_date) as unique_dates,
                COUNT(DISTINCT time_window) as unique_time_windows,
                MIN(snapshot_date) as earliest_date,
                MAX(snapshot_date) as latest_date
            FROM inventory_deals;
        """)
        
        stats = cursor.fetchone()
        total_records, unique_asins, unique_dates, unique_time_windows, earliest_date, latest_date = stats
        
        print(f'   总记录数: {total_records}')
        print(f'   独特ASIN数: {unique_asins}')
        print(f'   快照日期数: {unique_dates}')
        print(f'   时间窗口数: {unique_time_windows}')
        print(f'   日期范围: {earliest_date or "无"} 到 {latest_date or "无"}')

        if total_records == 0:
            print('✅ 表已经是空的，无需清空')
            return

        # 3. 确认操作
        print('\n⚠️  3. 确认清空操作:')
        print(f'   即将删除 {total_records} 条记录')
        print(f'   涉及 {unique_asins} 个ASIN')
        print(f'   覆盖 {unique_dates} 个快照日期')
        
        # 4. 执行清空操作
        print('\n🗑️  4. 执行清空操作...')
        
        cursor.execute("DELETE FROM inventory_deals;")
        deleted_count = cursor.rowcount
        
        print(f'✅ 清空操作完成，删除了 {deleted_count} 条记录')

        # 5. 验证清空结果
        print('\n🔍 5. 验证清空结果:')
        
        cursor.execute("SELECT COUNT(*) FROM inventory_deals;")
        remaining = cursor.fetchone()[0]
        
        if remaining == 0:
            print('✅ 验证通过：表已完全清空')
            print(f'   删除记录数: {deleted_count}')
            print(f'   剩余记录数: {remaining}')
        else:
            print('❌ 验证失败：表中仍有数据')
            print(f'   剩余记录数: {remaining}')

        # 6. 可选：重置自增ID（如果表有自增主键）
        print('\n🔄 6. 重置自增ID (如果适用):')
        
        try:
            cursor.execute("ALTER SEQUENCE IF EXISTS inventory_deals_id_seq RESTART WITH 1;")
            print('✅ 自增ID已重置')
        except psycopg2.Error as seq_error:
            print('ℹ️  表没有自增序列，或重置失败（这是正常的）')

        # 提交事务
        conn.commit()
        print('\n🎉 inventory_deals 表清空操作完成！')

    except psycopg2.Error as e:
        print(f'❌ 数据库操作错误: {e.pgerror}')
        print(f'错误代码: {e.pgcode}')
        if conn:
            conn.rollback()
    except Exception as e:
        print(f'❌ 发生未知错误: {str(e)}')
        if conn:
            conn.rollback()
    finally:
        # 清理资源
        if cursor:
            cursor.close()
        if conn:
            conn.close()
            print('🔌 数据库连接已关闭')

def main():
    """主函数入口"""
    try:
        clear_inventory_deals()
    except KeyboardInterrupt:
        print('\n\n⚠️  用户中断操作')
        sys.exit(1)
    except Exception as e:
        print(f'\n❌ 程序执行失败: {str(e)}')
        sys.exit(1)

if __name__ == '__main__':
    main()
