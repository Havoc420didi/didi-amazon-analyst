-- ===================================================================
-- 数据重新同步手动SQL命令
-- 用于API认证问题解决前的手动数据验证
-- ===================================================================

-- 1. 验证表结构（已清空）
SHOW TABLES LIKE '%product_analytics%';
SHOW TABLES LIKE '%fba_inventory%';
SHOW TABLES LIKE '%inventory_details%';

-- 2. 检查表字段（product_analytics）
DESCRIBE product_analytics;

-- 3. 验证广告字段存在
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'saihu_erp_sync' 
  AND TABLE_NAME = 'product_analytics'
  AND COLUMN_NAME IN ('ad_cost', 'ad_sales', 'cpc', 'cpa', 'ad_orders', 'ad_conversion_rate');

-- 4. 插入测试数据验证字段映射
INSERT INTO product_analytics (
    asin, sku, data_date, sales_amount, sales_quantity, 
    impressions, clicks, ad_cost, ad_sales, cpc, cpa, 
    ad_orders, ad_conversion_rate, marketplace_id, currency
) VALUES 
('B08N5WRWNW', 'TEST-SKU-001', '2024-08-05', 1500.00, 25, 5000, 150, 75.50, 450.25, 0.5033, 7.55, 10, 0.0667, 'ATVPDKIKX0DER', 'USD'),
('B08N5WRWNW', 'TEST-SKU-001', '2024-08-04', 1200.00, 20, 4500, 120, 60.40, 360.20, 0.5033, 6.04, 8, 0.0667, 'ATVPDKIKX0DER', 'USD'),
('B08N5WRWNW', 'TEST-SKU-001', '2024-08-03', 1800.00, 30, 6000, 180, 90.60, 540.30, 0.5033, 9.06, 12, 0.0667, 'ATVPDKIKX0DER', 'USD');

-- 5. 验证广告数据不为0
SELECT 
    data_date,
    COUNT(*) as total_records,
    SUM(CASE WHEN ad_cost > 0 THEN 1 ELSE 0 END) as records_with_ad_cost,
    SUM(CASE WHEN ad_sales > 0 THEN 1 ELSE 0 END) as records_with_ad_sales,
    SUM(ad_cost) as total_ad_cost,
    SUM(ad_sales) as total_ad_sales,
    AVG(ad_cost) as avg_ad_cost,
    AVG(ad_sales) as avg_ad_sales
FROM product_analytics 
GROUP BY data_date
ORDER BY data_date;

-- 6. 查看具体广告数据示例
SELECT 
    asin,
    sku,
    data_date,
    ad_cost,
    ad_sales,
    impressions,
    clicks,
    cpc,
    cpa,
    ad_orders,
    ad_conversion_rate
FROM product_analytics 
WHERE ad_cost > 0
ORDER BY data_date DESC, ad_cost DESC;

-- 7. 清理测试数据（需要时执行）
-- DELETE FROM product_analytics WHERE asin = 'B08N5WRWNW';

-- 8. 检查表记录总数
SELECT 'product_analytics' as table_name, COUNT(*) as record_count FROM product_analytics
UNION ALL
SELECT 'fba_inventory', COUNT(*) FROM fba_inventory
UNION ALL
SELECT 'inventory_details', COUNT(*) FROM inventory_details;

-- 9. 准备API数据插入的SQL模板
-- 当API正常工作后，使用以下格式批量插入：
-- INSERT INTO product_analytics (
--     asin, sku, parent_asin, spu, msku, sales_amount, sales_quantity,
--     impressions, clicks, conversion_rate, acos, data_date, marketplace_id,
--     dev_name, operator_name, currency, shop_id, dev_id, operator_id,
--     ad_cost, ad_sales, cpc, cpa, ad_orders, ad_conversion_rate,
--     order_count, refund_count, refund_rate, return_count, return_rate,
--     rating, rating_count, title, brand_name, category_name,
--     profit_amount, profit_rate, avg_profit, available_days,
--     fba_inventory, total_inventory, sessions, page_views, buy_box_price,
--     spu_name, brand, product_id, created_at, updated_at
-- ) VALUES (...);

-- 10. 创建数据质量检查查询
-- 检查空值
SELECT 
    'ad_cost' as field, COUNT(*) as null_count
FROM product_analytics 
WHERE ad_cost IS NULL OR ad_cost = 0
UNION ALL
SELECT 
    'ad_sales' as field, COUNT(*)
FROM product_analytics 
WHERE ad_sales IS NULL OR ad_sales = 0;

-- 11. 验证数据完整性
SELECT 
    data_date,
    COUNT(*) as records,
    MIN(ad_cost) as min_ad_cost,
    MAX(ad_cost) as max_ad_cost,
    AVG(ad_cost) as avg_ad_cost,
    SUM(ad_cost) as total_ad_cost
FROM product_analytics 
GROUP BY data_date
ORDER BY data_date;