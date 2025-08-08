-- ===================================================================
-- 产品分析表备份脚本
-- 用途：在升级前备份现有数据
-- 日期：2025-07-25
-- ===================================================================

-- 确保在正确的数据库上操作
USE saihu_erp;

-- 创建备份表
CREATE TABLE product_analytics_backup_20250725 AS 
SELECT * FROM product_analytics;

-- 验证备份
SELECT 
    'product_analytics备份完成' as status,
    COUNT(*) as backup_records,
    COUNT(DISTINCT asin) as backup_unique_asins,
    MIN(data_date) as backup_earliest_date,
    MAX(data_date) as backup_latest_date
FROM product_analytics_backup_20250725;

-- 显示原表统计
SELECT 
    'product_analytics原表统计' as status,
    COUNT(*) as original_records,
    COUNT(DISTINCT asin) as original_unique_asins,
    MIN(data_date) as original_earliest_date,
    MAX(data_date) as original_latest_date
FROM product_analytics;