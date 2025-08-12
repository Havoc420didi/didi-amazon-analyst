-- ===================================================================
-- 产品分析表缺失字段补充脚本
-- 用途：添加赛狐API规范中最重要的缺失字段
-- 版本：v2.1
-- 日期：2025-01-XX
-- ===================================================================

-- 确保在正确的数据库上操作
USE saihu_erp;

-- 开始事务
START TRANSACTION;

-- ===================================================================
-- 添加环比/同比数据字段
-- ===================================================================

-- 销售数据环比字段
ALTER TABLE product_analytics ADD COLUMN sales_amount_last DECIMAL(15,2) DEFAULT 0.00 COMMENT '销售额上期';
ALTER TABLE product_analytics ADD COLUMN sales_amount_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '销售额环比';
ALTER TABLE product_analytics ADD COLUMN sales_quantity_last INTEGER DEFAULT 0 COMMENT '销量上期';
ALTER TABLE product_analytics ADD COLUMN sales_quantity_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '销量环比';

-- 广告数据环比字段
ALTER TABLE product_analytics ADD COLUMN ad_cost_last DECIMAL(15,2) DEFAULT 0.00 COMMENT '广告花费上期';
ALTER TABLE product_analytics ADD COLUMN ad_cost_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '广告花费环比';
ALTER TABLE product_analytics ADD COLUMN ad_sales_last DECIMAL(15,2) DEFAULT 0.00 COMMENT '广告销售额上期';
ALTER TABLE product_analytics ADD COLUMN ad_sales_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '广告销售额环比';

-- ===================================================================
-- 添加退款/退货相关字段
-- ===================================================================

-- 退款字段
ALTER TABLE product_analytics ADD COLUMN refund_amount_this DECIMAL(15,2) DEFAULT 0.00 COMMENT '退款金额本期';
ALTER TABLE product_analytics ADD COLUMN refund_amount_last DECIMAL(15,2) DEFAULT 0.00 COMMENT '退款金额上期';
ALTER TABLE product_analytics ADD COLUMN refund_amount_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '退款金额环比';

-- 退货字段
ALTER TABLE product_analytics ADD COLUMN return_count_last INTEGER DEFAULT 0 COMMENT '退货量上期';
ALTER TABLE product_analytics ADD COLUMN return_count_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '退货量环比';
ALTER TABLE product_analytics ADD COLUMN return_rate_last DECIMAL(7,4) DEFAULT 0.0000 COMMENT '退货率上期';
ALTER TABLE product_analytics ADD COLUMN return_rate_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '退货率环比';

-- ===================================================================
-- 添加评分相关字段
-- ===================================================================

-- 评分字段
ALTER TABLE product_analytics ADD COLUMN rating_last DECIMAL(3,2) DEFAULT 0.00 COMMENT '星级评分上期';
ALTER TABLE product_analytics ADD COLUMN rating_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '星级评分环比';
ALTER TABLE product_analytics ADD COLUMN rating_count_last INTEGER DEFAULT 0 COMMENT '评分数上期';
ALTER TABLE product_analytics ADD COLUMN rating_count_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '评分数环比';

-- ===================================================================
-- 添加流量相关字段
-- ===================================================================

-- 流量字段
ALTER TABLE product_analytics ADD COLUMN sessions_last INTEGER DEFAULT 0 COMMENT 'session上期';
ALTER TABLE product_analytics ADD COLUMN sessions_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT 'session环比';
ALTER TABLE product_analytics ADD COLUMN page_views_last INTEGER DEFAULT 0 COMMENT 'PV上期';
ALTER TABLE product_analytics ADD COLUMN page_views_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT 'PV环比';
ALTER TABLE product_analytics ADD COLUMN buy_box_percent_this DECIMAL(7,4) DEFAULT 0.0000 COMMENT 'Buybox本期';
ALTER TABLE product_analytics ADD COLUMN buy_box_percent_last DECIMAL(7,4) DEFAULT 0.0000 COMMENT 'Buybox上期';
ALTER TABLE product_analytics ADD COLUMN buy_box_percent_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT 'Buybox环比';

-- ===================================================================
-- 添加利润相关字段
-- ===================================================================

-- 利润字段
ALTER TABLE product_analytics ADD COLUMN profit_amount_last DECIMAL(15,2) DEFAULT 0.00 COMMENT '毛利润上期';
ALTER TABLE product_analytics ADD COLUMN profit_amount_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '毛利润环比';
ALTER TABLE product_analytics ADD COLUMN profit_rate_last DECIMAL(7,4) DEFAULT 0.0000 COMMENT '毛利率上期';
ALTER TABLE product_analytics ADD COLUMN profit_rate_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '毛利率环比';

-- ===================================================================
-- 添加自然流量字段
-- ===================================================================

-- 自然流量字段
ALTER TABLE product_analytics ADD COLUMN natural_clicks_this INTEGER DEFAULT 0 COMMENT '自然点击量本期';
ALTER TABLE product_analytics ADD COLUMN natural_clicks_last INTEGER DEFAULT 0 COMMENT '自然点击量上期';
ALTER TABLE product_analytics ADD COLUMN natural_clicks_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '自然点击量环比';
ALTER TABLE product_analytics ADD COLUMN natural_orders_this INTEGER DEFAULT 0 COMMENT '自然订单量本期';
ALTER TABLE product_analytics ADD COLUMN natural_orders_last INTEGER DEFAULT 0 COMMENT '自然订单量上期';
ALTER TABLE product_analytics ADD COLUMN natural_orders_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '自然订单量环比';

-- ===================================================================
-- 添加促销相关字段
-- ===================================================================

-- 促销字段
ALTER TABLE product_analytics ADD COLUMN promotion_orders_this INTEGER DEFAULT 0 COMMENT '促销订单量本期';
ALTER TABLE product_analytics ADD COLUMN promotion_orders_last INTEGER DEFAULT 0 COMMENT '促销订单量上期';
ALTER TABLE product_analytics ADD COLUMN promotion_orders_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '促销订单量环比';
ALTER TABLE product_analytics ADD COLUMN promotion_sales_this INTEGER DEFAULT 0 COMMENT '促销销量本期';
ALTER TABLE product_analytics ADD COLUMN promotion_sales_last INTEGER DEFAULT 0 COMMENT '促销销量上期';
ALTER TABLE product_analytics ADD COLUMN promotion_sales_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '促销销量环比';

-- ===================================================================
-- 添加其他重要字段
-- ===================================================================

-- 取消订单字段
ALTER TABLE product_analytics ADD COLUMN cancel_orders_this INTEGER DEFAULT 0 COMMENT '取消订单量本期';
ALTER TABLE product_analytics ADD COLUMN cancel_orders_last INTEGER DEFAULT 0 COMMENT '取消订单量上期';
ALTER TABLE product_analytics ADD COLUMN cancel_orders_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '取消订单量环比';

-- 留评字段
ALTER TABLE product_analytics ADD COLUMN review_rate_this DECIMAL(7,4) DEFAULT 0.0000 COMMENT '留评率本期';
ALTER TABLE product_analytics ADD COLUMN review_rate_last DECIMAL(7,4) DEFAULT 0.0000 COMMENT '留评率上期';
ALTER TABLE product_analytics ADD COLUMN review_rate_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '留评率环比';

-- 净销售额字段
ALTER TABLE product_analytics ADD COLUMN net_sales_amount_this DECIMAL(15,2) DEFAULT 0.00 COMMENT '净销售额本期';
ALTER TABLE product_analytics ADD COLUMN net_sales_amount_last DECIMAL(15,2) DEFAULT 0.00 COMMENT '净销售额上期';
ALTER TABLE product_analytics ADD COLUMN net_sales_amount_percent DECIMAL(7,4) DEFAULT 0.0000 COMMENT '净销售额环比';

-- ===================================================================
-- 添加索引优化
-- ===================================================================

-- 添加新的复合索引
CREATE INDEX idx_analytics_performance ON product_analytics(sales_amount, ad_cost, profit_amount);
CREATE INDEX idx_analytics_date_range ON product_analytics(data_date, marketplace_id);
CREATE INDEX idx_analytics_percent_change ON product_analytics(sales_amount_percent, ad_cost_percent, profit_amount_percent);

-- 提交事务
COMMIT;

-- 显示升级结果
SELECT '产品分析表重要字段补充完成！' AS message;
SELECT COUNT(*) AS total_columns FROM information_schema.columns WHERE table_name = 'product_analytics'; 