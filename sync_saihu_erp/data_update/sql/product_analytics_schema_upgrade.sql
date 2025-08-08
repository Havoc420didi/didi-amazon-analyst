-- ===================================================================
-- 产品分析表结构升级脚本
-- 用途：添加缺失的重要字段，完善产品分析数据存储
-- 版本：v2.0
-- 日期：2025-07-25
-- ===================================================================

-- 确保在正确的数据库上操作
USE saihu_erp;

-- 开始事务
START TRANSACTION;

-- ===================================================================
-- 第一部分：添加核心缺失字段
-- ===================================================================

-- 添加货币类型字段
ALTER TABLE product_analytics ADD COLUMN currency VARCHAR(10) DEFAULT 'USD' COMMENT '货币类型' AFTER operator_name;

-- 添加店铺和组织结构字段
-- ALTER TABLE product_analytics ADD COLUMN shop_id VARCHAR(20) COMMENT '店铺ID' AFTER currency;
-- ALTER TABLE product_analytics ADD COLUMN dev_id VARCHAR(20) COMMENT '开发者ID' AFTER shop_id;
-- ALTER TABLE product_analytics ADD COLUMN operator_id VARCHAR(20) COMMENT '操作员ID' AFTER dev_id;

-- 添加标签和分类字段
-- ALTER TABLE product_analytics ADD COLUMN tag_id VARCHAR(50) COMMENT '标签ID' AFTER operator_id;
-- ALTER TABLE product_analytics ADD COLUMN brand_id VARCHAR(20) COMMENT '品牌ID' AFTER tag_id;
-- ALTER TABLE product_analytics ADD COLUMN category_id VARCHAR(50) COMMENT '分类ID' AFTER brand_id;

-- -- 添加产品状态字段
-- ALTER TABLE product_analytics ADD COLUMN online_status VARCHAR(20) COMMENT '在线状态' AFTER category_id;
-- ALTER TABLE product_analytics ADD COLUMN asin_type VARCHAR(20) COMMENT 'ASIN类型' AFTER online_status;
-- ALTER TABLE product_analytics ADD COLUMN stock_status VARCHAR(50) COMMENT '库存状态' AFTER asin_type;

-- ===================================================================
-- 第二部分：添加广告核心指标
-- ===================================================================

-- 添加广告成本和收入指标
-- ALTER TABLE product_analytics ADD COLUMN ad_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '广告花费' AFTER stock_status;
ALTER TABLE product_analytics ADD COLUMN ad_sales DECIMAL(12,2) DEFAULT 0.00 COMMENT '广告销售额' AFTER ad_cost;
ALTER TABLE product_analytics ADD COLUMN cpc DECIMAL(8,4) DEFAULT 0.0000 COMMENT '每次点击成本' AFTER ad_sales;
ALTER TABLE product_analytics ADD COLUMN cpa DECIMAL(8,4) DEFAULT 0.0000 COMMENT '每次转化成本' AFTER cpc;

-- 添加广告转化指标
ALTER TABLE product_analytics ADD COLUMN ad_orders INT(11) DEFAULT 0 COMMENT '广告订单数' AFTER cpa;
ALTER TABLE product_analytics ADD COLUMN ad_conversion_rate DECIMAL(6,4) DEFAULT 0.0000 COMMENT '广告转化率' AFTER ad_orders;

-- ===================================================================
-- 第三部分：添加业务核心指标
-- ===================================================================

-- 添加订单和退款指标
ALTER TABLE product_analytics ADD COLUMN order_count INT(11) DEFAULT 0 COMMENT '订单数量' AFTER ad_conversion_rate;
ALTER TABLE product_analytics ADD COLUMN refund_count INT(11) DEFAULT 0 COMMENT '退款数量' AFTER order_count;
ALTER TABLE product_analytics ADD COLUMN refund_rate DECIMAL(6,4) DEFAULT 0.0000 COMMENT '退款率' AFTER refund_count;
ALTER TABLE product_analytics ADD COLUMN return_count INT(11) DEFAULT 0 COMMENT '退货数量' AFTER refund_rate;
ALTER TABLE product_analytics ADD COLUMN return_rate DECIMAL(6,4) DEFAULT 0.0000 COMMENT '退货率' AFTER return_count;

-- 添加评分指标
ALTER TABLE product_analytics ADD COLUMN rating DECIMAL(3,2) DEFAULT 0.00 COMMENT '评分' AFTER return_rate;
ALTER TABLE product_analytics ADD COLUMN rating_count INT(11) DEFAULT 0 COMMENT '评分数量' AFTER rating;

-- ===================================================================
-- 第四部分：添加商品基础信息
-- ===================================================================

-- 添加商品标题和品牌信息
ALTER TABLE product_analytics ADD COLUMN title VARCHAR(500) COMMENT '商品标题' AFTER rating_count;
ALTER TABLE product_analytics ADD COLUMN brand_name VARCHAR(100) COMMENT '品牌名称' AFTER title;
-- ALTER TABLE product_analytics ADD COLUMN category_name VARCHAR(100) COMMENT '分类名称' AFTER brand_name;

-- -- ===================================================================
-- -- 第五部分：添加利润和库存指标
-- -- ===================================================================

-- -- 添加利润指标
-- ALTER TABLE product_analytics ADD COLUMN profit_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT '利润金额' AFTER category_name;
ALTER TABLE product_analytics ADD COLUMN profit_rate DECIMAL(6,4) DEFAULT 0.0000 COMMENT '利润率' AFTER profit_amount;
ALTER TABLE product_analytics ADD COLUMN avg_profit DECIMAL(8,2) DEFAULT 0.00 COMMENT '平均利润' AFTER profit_rate;

-- 添加库存指标
ALTER TABLE product_analytics ADD COLUMN available_days DECIMAL(8,1) DEFAULT 0.0 COMMENT '可用天数' AFTER avg_profit;
ALTER TABLE product_analytics ADD COLUMN fba_inventory INT(11) DEFAULT 0 COMMENT 'FBA库存' AFTER available_days;
ALTER TABLE product_analytics ADD COLUMN total_inventory INT(11) DEFAULT 0 COMMENT '总库存' AFTER fba_inventory;

-- ===================================================================
-- 第六部分：添加JSON字段（存储多值数据）
-- ===================================================================

-- 添加多值ID存储字段
ALTER TABLE product_analytics ADD COLUMN shop_ids JSON COMMENT '店铺ID列表' AFTER total_inventory;
-- ALTER TABLE product_analytics ADD COLUMN dev_ids JSON COMMENT '开发者ID列表' AFTER shop_ids;
-- ALTER TABLE product_analytics ADD COLUMN operator_ids JSON COMMENT '操作员ID列表' AFTER dev_ids;
-- ALTER TABLE product_analytics ADD COLUMN marketplace_ids JSON COMMENT '市场ID列表' AFTER operator_ids;
-- ALTER TABLE product_analytics ADD COLUMN label_ids JSON COMMENT '标签ID列表' AFTER marketplace_ids;
-- ALTER TABLE product_analytics ADD COLUMN brand_ids JSON COMMENT '品牌ID列表' AFTER label_ids;
-- ALTER TABLE product_analytics ADD COLUMN ad_types JSON COMMENT '广告类型列表' AFTER brand_ids;

-- -- ===================================================================
-- -- 第七部分：添加其他时间和状态字段
-- -- ===================================================================

-- -- 添加时间字段
-- ALTER TABLE product_analytics ADD COLUMN open_date DATE COMMENT '产品上线日期' AFTER ad_types;
-- ALTER TABLE product_analytics ADD COLUMN is_low_cost_store BOOLEAN DEFAULT FALSE COMMENT '是否低价店铺' AFTER open_date;

-- ===================================================================
-- 第八部分：优化索引
-- ===================================================================

-- 添加新的复合索引
CREATE INDEX idx_shop_date ON product_analytics(shop_id, data_date);
CREATE INDEX idx_brand_date ON product_analytics(brand_id, data_date);
CREATE INDEX idx_currency_date ON product_analytics(currency, data_date);
CREATE INDEX idx_online_status ON product_analytics(online_status);
CREATE INDEX idx_asin_type ON product_analytics(asin_type);

-- 添加覆盖索引优化常用查询
CREATE INDEX idx_analytics_summary ON product_analytics(data_date, asin, sales_amount, ad_cost, profit_amount);

-- ===================================================================
-- 第九部分：数据验证和清理
-- ===================================================================

-- 更新现有数据的默认值
UPDATE product_analytics 
SET 
    currency = COALESCE(currency, 'USD'),
    ad_cost = COALESCE(ad_cost, 0.00),
    ad_sales = COALESCE(ad_sales, 0.00),
    cpc = COALESCE(cpc, 0.0000),
    cpa = COALESCE(cpa, 0.0000),
    ad_orders = COALESCE(ad_orders, 0),
    ad_conversion_rate = COALESCE(ad_conversion_rate, 0.0000),
    order_count = COALESCE(order_count, 0),
    refund_count = COALESCE(refund_count, 0),
    refund_rate = COALESCE(refund_rate, 0.0000),
    return_count = COALESCE(return_count, 0),
    return_rate = COALESCE(return_rate, 0.0000),
    rating = COALESCE(rating, 0.00),
    rating_count = COALESCE(rating_count, 0),
    profit_amount = COALESCE(profit_amount, 0.00),
    profit_rate = COALESCE(profit_rate, 0.0000),
    avg_profit = COALESCE(avg_profit, 0.00),
    available_days = COALESCE(available_days, 0.0),
    fba_inventory = COALESCE(fba_inventory, 0),
    total_inventory = COALESCE(total_inventory, 0),
    is_low_cost_store = COALESCE(is_low_cost_store, FALSE)
WHERE data_date IS NOT NULL;

-- ===================================================================
-- 第十部分：统计信息更新
-- ===================================================================

-- 更新表统计信息
ANALYZE TABLE product_analytics;

-- 提交事务
COMMIT;

-- ===================================================================
-- 升级完成通知
-- ===================================================================

SELECT 
    'product_analytics表结构升级完成' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT asin) as unique_asins,
    MIN(data_date) as earliest_date,
    MAX(data_date) as latest_date
FROM product_analytics;

-- 显示新的表结构
SHOW CREATE TABLE product_analytics;