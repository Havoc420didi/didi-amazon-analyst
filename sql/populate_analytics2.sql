-- 将现有product_analytics数据迁移到product_analytics2
-- 专为30天历史数据存储

-- 步骤1: 创建并使用product_analytics2表
-- 运行: npx drizzle-kit push --config=src/db/config.ts

-- 步骤2: 迁移最近30天的数据
INSERT INTO product_analytics2 (
    product_id,
    asin, 
    sku,
    spu,
    msku,
    data_date,
    sales_amount,
    sales_quantity,
    impressions,
    clicks,
    conversion_rate,
    acos,
    marketplace_id,
    dev_name,
    operator_name,
    -- 完整迁移所有字段...
    sales_amount,
    impressions,
    clicks,
    ad_cost,
    ad_sales,
    ad_orders,
    fba_inventory,
    total_inventory,
    created_at,
    updated_at
)
SELECT 
    product_id,
    asin,
    sku,
    spu,
    msku,
    data_date,
    sales_amount,
    sales_quantity,
    impressions,
    clicks,
    conversion_rate,
    acos,
    marketplace_id,
    dev_name,
    operator_name,
    -- 映射所有对应字段...
    sales_amount,
    impressions,
    clicks,
    ad_cost AS ad_cost,
    ad_sales AS ad_sales,
    ad_orders AS ad_orders,
    fba_inventory IS NULL THEN 0 ELSE fba_inventory END,
    total_inventory IS NULL THEN 0 ELSE total_inventory END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM product_analytics
WHERE data_date >= CURRENT_DATE - INTERVAL '30 days'
ON CONFLICT (product_id, asin, data_date, marketplace_id) DO NOTHING;

-- 步骤3: 验证数据完整性
SELECT COUNT(*) as total_records,
       MIN(data_date) as earliest,
       MAX(data_date) as latest,
       COUNT(DISTINCT asin) as unique_asins
FROM product_analytics2
WHERE data_date >= CURRENT_DATE - INTERVAL '30 days';