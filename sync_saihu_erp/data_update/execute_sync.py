#!/usr/bin/env python3
"""
执行数据同步的简化脚本
手动执行数据清理和重新同步
"""
import sys
import os
import logging
from datetime import datetime, date, timedelta
from pathlib import Path

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_sync_sql():
    """创建同步SQL脚本"""
    
    # 获取昨天日期（8月5日）
    yesterday = date(2024, 8, 5)
    
    # 获取前7天日期范围
    start_date = yesterday - timedelta(days=6)
    
    sql_script = f"""
-- ===================================================================
-- 数据重新同步脚本
-- 日期: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- 产品分析: {start_date} 到 {yesterday} (前7天)
-- FBA库存和库存明细: {yesterday} (昨天)
-- ===================================================================

-- 1. 清空表数据
TRUNCATE TABLE product_analytics;
TRUNCATE TABLE fba_inventory;
TRUNCATE TABLE inventory_details;

-- 2. 验证表结构（检查product_analytics字段）
DESCRIBE product_analytics;

-- 3. 检查当前记录数
SELECT 'product_analytics' as table_name, COUNT(*) as record_count FROM product_analytics
UNION ALL
SELECT 'fba_inventory', COUNT(*) FROM fba_inventory
UNION ALL  
SELECT 'inventory_details', COUNT(*) FROM inventory_details;

-- 4. 产品分析数据同步占位符
--    实际执行时需要运行Python脚本: python src/scrapers/product_analytics_scraper.py
--    日期范围: {start_date} 到 {yesterday}

-- 5. FBA库存数据同步占位符  
--    实际执行时需要运行Python脚本: python src/scrapers/fba_inventory_scraper.py
--    日期: {yesterday}

-- 6. 库存明细数据同步占位符
--    实际执行时需要运行Python脚本: python src/scrapers/inventory_details_scraper.py
--    日期: {yesterday}

-- 7. 验证同步结果
SELECT 'product_analytics' as table_name, COUNT(*) as record_count FROM product_analytics
UNION ALL
SELECT 'fba_inventory', COUNT(*) FROM fba_inventory  
UNION ALL
SELECT 'inventory_details', COUNT(*) FROM inventory_details;

-- 8. 验证广告数据（产品分析表）
SELECT 
    data_date,
    COUNT(*) as total_records,
    SUM(CASE WHEN ad_cost > 0 THEN 1 ELSE 0 END) as records_with_ad_cost,
    SUM(CASE WHEN ad_sales > 0 THEN 1 ELSE 0 END) as records_with_ad_sales,
    SUM(ad_cost) as total_ad_cost,
    SUM(ad_sales) as total_ad_sales,
    AVG(ad_cost) as avg_ad_cost
FROM product_analytics 
GROUP BY data_date
ORDER BY data_date;

-- 9. 验证广告字段不为0的示例数据
SELECT 
    asin,
    data_date,
    ad_cost,
    ad_sales,
    cpc,
    cpa,
    ad_orders,
    ad_conversion_rate
FROM product_analytics 
WHERE ad_cost > 0 OR ad_sales > 0
ORDER BY ad_cost DESC
LIMIT 10;
"""
    
    return sql_script

def create_field_check_sql():
    """创建字段检查SQL"""
    
    sql = """
-- ===================================================================
-- 字段验证SQL
-- 验证product_analytics表字段是否符合模型要求
-- ===================================================================

-- 1. 检查表结构
SHOW CREATE TABLE product_analytics;

-- 2. 检查现有字段
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'saihu_erp_sync' 
  AND TABLE_NAME = 'product_analytics'
ORDER BY ORDINAL_POSITION;

-- 3. 检查广告相关字段是否存在
SELECT 
    CASE 
        WHEN COLUMN_NAME = 'ad_cost' THEN 'ad_cost - 广告花费'
        WHEN COLUMN_NAME = 'ad_sales' THEN 'ad_sales - 广告销售额'
        WHEN COLUMN_NAME = 'cpc' THEN 'cpc - 每次点击成本'
        WHEN COLUMN_NAME = 'cpa' THEN 'cpa - 每次转化成本'
        WHEN COLUMN_NAME = 'ad_orders' THEN 'ad_orders - 广告订单数'
        WHEN COLUMN_NAME = 'ad_conversion_rate' THEN 'ad_conversion_rate - 广告转化率'
        ELSE COLUMN_NAME
    END as field_info,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'saihu_erp_sync' 
  AND TABLE_NAME = 'product_analytics'
  AND COLUMN_NAME IN (
    'ad_cost', 'ad_sales', 'cpc', 'cpa', 'ad_orders', 'ad_conversion_rate',
    'sales_amount', 'sales_quantity', 'impressions', 'clicks', 'conversion_rate',
    'acos', 'data_date', 'asin', 'sku', 'marketplace_id'
  )
ORDER BY ORDINAL_POSITION;

-- 4. 检查数据类型是否正确
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    CASE 
        WHEN COLUMN_NAME IN ('ad_cost', 'ad_sales', 'cpc', 'cpa') 
            AND COLUMN_TYPE LIKE 'decimal%' THEN '✅ 正确'
        WHEN COLUMN_NAME IN ('ad_orders') 
            AND COLUMN_TYPE LIKE 'int%' THEN '✅ 正确'
        WHEN COLUMN_NAME IN ('ad_conversion_rate', 'conversion_rate', 'acos') 
            AND COLUMN_TYPE LIKE 'decimal%' THEN '✅ 正确'
        WHEN COLUMN_NAME IN ('sales_amount', 'sales_quantity', 'impressions', 'clicks')
            AND COLUMN_TYPE IN ('int', 'bigint') THEN '✅ 正确'
        ELSE '⚠️ 检查类型'
    END as type_check
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'saihu_erp_sync' 
  AND TABLE_NAME = 'product_analytics'
  AND COLUMN_NAME IN (
    'ad_cost', 'ad_sales', 'cpc', 'cpa', 'ad_orders', 'ad_conversion_rate',
    'sales_amount', 'sales_quantity', 'impressions', 'clicks', 'conversion_rate',
    'acos'
  );
"""
    
    return sql

def run_manual_sync():
    """运行手动同步"""
    
    logger.info("🚀 开始执行数据重新同步...")
    
    # 计算日期
    yesterday = date(2024, 8, 5)
    start_date = yesterday - timedelta(days=6)
    
    logger.info(f"📅 产品分析日期范围: {start_date} 到 {yesterday}")
    logger.info(f"📅 FBA库存和库存明细日期: {yesterday}")
    
    # 创建SQL脚本
    sync_sql = create_sync_sql()
    check_sql = create_field_check_sql()
    
    # 保存SQL脚本
    with open('sync_data.sql', 'w', encoding='utf-8') as f:
        f.write(sync_sql)
    
    with open('check_fields.sql', 'w', encoding='utf-8') as f:
        f.write(check_sql)
    
    logger.info("✅ SQL脚本已生成:")
    logger.info("   📄 sync_data.sql - 数据同步脚本")
    logger.info("   📄 check_fields.sql - 字段验证脚本")
    
    # 创建执行说明
    instructions = f"""
执行步骤:

1. 手动执行数据库清理:
   mysql -h 47.79.123.234 -u saihu_erp_sync -p saihu_erp_sync < sync_data.sql

2. 或者使用以下命令单独执行:
   mysql -h 47.79.123.234 -u saihu_erp_sync -p
   USE saihu_erp_sync;
   TRUNCATE TABLE product_analytics;
   TRUNCATE TABLE fba_inventory;
   TRUNCATE TABLE inventory_details;

3. 运行Python数据同步脚本:
   python src/scrapers/product_analytics_scraper.py --date-range {start_date} {yesterday}
   python src/scrapers/fba_inventory_scraper.py --date {yesterday}
   python src/scrapers/inventory_details_scraper.py --date {yesterday}

4. 验证数据:
   运行 check_fields.sql 验证字段
   检查广告数据不为0

注意: 确保已安装pymysql: pip install pymysql
"""
    
    with open('sync_instructions.txt', 'w', encoding='utf-8') as f:
        f.write(instructions)
    
    logger.info("📄 执行说明已保存到 sync_instructions.txt")
    
    print("\n" + "="*60)
    print("📋 执行摘要")
    print("="*60)
    print(f"产品分析数据范围: {start_date} 到 {yesterday}")
    print(f"FBA库存数据日期: {yesterday}")
    print(f"库存明细数据日期: {yesterday}")
    print("\n下一步:")
    print("1. 执行数据库清理: 运行 sync_data.sql")
    print("2. 运行Python脚本同步数据")
    print("3. 验证广告数据不为0")

if __name__ == '__main__':
    run_manual_sync()