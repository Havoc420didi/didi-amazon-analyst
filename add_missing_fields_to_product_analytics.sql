-- 为product_analytics表添加所有缺失的API字段
-- 基于"获取产品分析数据（NEW）" OpenAPI规范
-- 执行时间: 2025-08-12

-- ===========================================
-- 库存相关字段扩展
-- ===========================================

-- 可售天数 (核心运营指标)
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS available_days INTEGER DEFAULT 0;

-- 在途库存详情
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS inbound_working INTEGER DEFAULT 0 COMMENT '在途库存-工作中';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS inbound_shipped INTEGER DEFAULT 0 COMMENT '在途库存-已发货'; 
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS inbound_receiving INTEGER DEFAULT 0 COMMENT '在途库存-接收中';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS reserved_inventory INTEGER DEFAULT 0 COMMENT '预留库存';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS unfulfillable_inventory INTEGER DEFAULT 0 COMMENT '不可履约库存';

-- 总在途库存 (所有在途状态之和)
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS total_inbound_inventory INTEGER DEFAULT 0 COMMENT '总在途库存';

-- ===========================================
-- 广告相关字段扩展
-- ===========================================

-- 广告投资回报率
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS ad_roas DECIMAL(8,4) DEFAULT 0.0000 COMMENT '广告ROAS';

-- 销售归因分析
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS organic_sales DECIMAL(15,2) DEFAULT 0.00 COMMENT '自然销售额';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS sponsored_sales DECIMAL(15,2) DEFAULT 0.00 COMMENT '广告销售额';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS organic_orders INTEGER DEFAULT 0 COMMENT '自然订单数';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS sponsored_orders INTEGER DEFAULT 0 COMMENT '广告订单数';

-- 广告展示份额和竞争指标
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS impression_share DECIMAL(5,4) DEFAULT 0.0000 COMMENT '展示份额';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS lost_impression_share_budget DECIMAL(5,4) DEFAULT 0.0000 COMMENT '预算损失的展示份额';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS lost_impression_share_rank DECIMAL(5,4) DEFAULT 0.0000 COMMENT '排名损失的展示份额';

-- ===========================================
-- 流量和转化相关字段
-- ===========================================

-- 单位会话相关指标
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS unit_session_percentage DECIMAL(5,4) DEFAULT 0.0000 COMMENT '单位会话百分比';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS sessions_percentage_new DECIMAL(5,4) DEFAULT 0.0000 COMMENT '新访客会话百分比';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS sessions_percentage_returning DECIMAL(5,4) DEFAULT 0.0000 COMMENT '回访会话百分比';

-- 页面浏览深度分析
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS page_views_per_session DECIMAL(6,2) DEFAULT 0.00 COMMENT '每会话页面浏览数';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS bounce_rate DECIMAL(5,4) DEFAULT 0.0000 COMMENT '跳出率';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS avg_session_duration INTEGER DEFAULT 0 COMMENT '平均会话时长(秒)';

-- ===========================================
-- 业务表现指标
-- ===========================================

-- 退款和退货详细指标
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(15,2) DEFAULT 0.00 COMMENT '退款金额';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS return_amount DECIMAL(15,2) DEFAULT 0.00 COMMENT '退货金额';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS defect_rate DECIMAL(5,4) DEFAULT 0.0000 COMMENT '缺陷率';

-- 评价和客户满意度
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS review_count_new INTEGER DEFAULT 0 COMMENT '新增评价数';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS five_star_percentage DECIMAL(5,4) DEFAULT 0.0000 COMMENT '五星评价百分比';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS four_star_percentage DECIMAL(5,4) DEFAULT 0.0000 COMMENT '四星评价百分比';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS three_star_percentage DECIMAL(5,4) DEFAULT 0.0000 COMMENT '三星评价百分比';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS two_star_percentage DECIMAL(5,4) DEFAULT 0.0000 COMMENT '二星评价百分比';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS one_star_percentage DECIMAL(5,4) DEFAULT 0.0000 COMMENT '一星评价百分比';

-- 客户获取成本
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS customer_acquisition_cost DECIMAL(10,2) DEFAULT 0.00 COMMENT '客户获取成本';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(12,2) DEFAULT 0.00 COMMENT '客户生命周期价值';

-- ===========================================
-- 竞争和市场分析
-- ===========================================

-- 竞品相关数据 (JSON格式存储复杂数据)
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS competitor_data TEXT COMMENT '竞品数据JSON';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS market_share DECIMAL(5,4) DEFAULT 0.0000 COMMENT '市场份额';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS price_competitiveness_score DECIMAL(3,2) DEFAULT 0.00 COMMENT '价格竞争力评分';

-- 关键词和搜索表现
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS organic_keywords_count INTEGER DEFAULT 0 COMMENT '自然关键词数量';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS sponsored_keywords_count INTEGER DEFAULT 0 COMMENT '广告关键词数量';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS avg_keyword_rank DECIMAL(6,2) DEFAULT 0.00 COMMENT '平均关键词排名';

-- ===========================================
-- 季节性和趋势分析
-- ===========================================

-- 季节性指数
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS seasonality_index DECIMAL(6,4) DEFAULT 1.0000 COMMENT '季节性指数';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS trend_indicator VARCHAR(20) DEFAULT 'stable' COMMENT '趋势指标: up/down/stable';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS trend_strength DECIMAL(3,2) DEFAULT 0.00 COMMENT '趋势强度(0-1)';

-- 历史比较基准
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS yoy_growth_rate DECIMAL(6,4) DEFAULT 0.0000 COMMENT '同比增长率';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS mom_growth_rate DECIMAL(6,4) DEFAULT 0.0000 COMMENT '环比增长率';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS wow_growth_rate DECIMAL(6,4) DEFAULT 0.0000 COMMENT '周同比增长率';

-- ===========================================
-- 运营效率指标
-- ===========================================

-- 库存周转和效率
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS inventory_turnover_ratio DECIMAL(8,4) DEFAULT 0.0000 COMMENT '库存周转率';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS days_of_supply INTEGER DEFAULT 0 COMMENT '供应天数';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS stockout_probability DECIMAL(5,4) DEFAULT 0.0000 COMMENT '缺货概率';

-- 供应链指标
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0 COMMENT '补货周期(天)';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 0 COMMENT '再订购点';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS safety_stock INTEGER DEFAULT 0 COMMENT '安全库存';

-- ===========================================
-- 财务和盈利能力
-- ===========================================

-- 成本结构详细分解
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS cogs DECIMAL(12,2) DEFAULT 0.00 COMMENT '商品销售成本';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0.00 COMMENT '运费';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS fba_fees DECIMAL(10,2) DEFAULT 0.00 COMMENT 'FBA费用';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS storage_fees DECIMAL(10,2) DEFAULT 0.00 COMMENT '仓储费';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS referral_fees DECIMAL(10,2) DEFAULT 0.00 COMMENT '推荐费';

-- 盈利能力分析
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS gross_profit DECIMAL(12,2) DEFAULT 0.00 COMMENT '毛利润';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS gross_margin DECIMAL(5,4) DEFAULT 0.0000 COMMENT '毛利率';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS net_profit DECIMAL(12,2) DEFAULT 0.00 COMMENT '净利润';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS net_margin DECIMAL(5,4) DEFAULT 0.0000 COMMENT '净利率';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS roi DECIMAL(6,4) DEFAULT 0.0000 COMMENT '投资回报率';

-- ===========================================
-- 营销和促销效果
-- ===========================================

-- 促销活动效果
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS promotion_sales DECIMAL(15,2) DEFAULT 0.00 COMMENT '促销销售额';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS promotion_orders INTEGER DEFAULT 0 COMMENT '促销订单数';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS coupon_redemption_rate DECIMAL(5,4) DEFAULT 0.0000 COMMENT '优惠券兑换率';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS lightning_deal_sales DECIMAL(12,2) DEFAULT 0.00 COMMENT '秒杀销售额';

-- 品牌和类目表现
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS brand_rank INTEGER DEFAULT 0 COMMENT '品牌排名';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS category_rank INTEGER DEFAULT 0 COMMENT '类目排名';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS subcategory_rank INTEGER DEFAULT 0 COMMENT '子类目排名';

-- ===========================================
-- 数据质量和完整性
-- ===========================================

-- 数据质量评分
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS data_quality_score DECIMAL(3,2) DEFAULT 1.00 COMMENT '数据质量评分(0-1)';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS data_completeness DECIMAL(3,2) DEFAULT 1.00 COMMENT '数据完整性(0-1)';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS last_updated_field VARCHAR(50) COMMENT '最后更新的字段';

-- API同步状态
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS api_sync_status VARCHAR(20) DEFAULT 'pending' COMMENT 'API同步状态';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS api_last_sync TIMESTAMP COMMENT 'API最后同步时间';
ALTER TABLE product_analytics ADD COLUMN IF NOT EXISTS api_sync_errors TEXT COMMENT 'API同步错误信息';

-- ===========================================
-- 创建新的复合索引优化查询性能
-- ===========================================

-- 库存相关查询索引
CREATE INDEX IF NOT EXISTS idx_analytics_inventory_extended 
ON product_analytics(asin, available_days, total_inventory, fba_inventory, data_date);

-- 广告效果查询索引
CREATE INDEX IF NOT EXISTS idx_analytics_ad_performance 
ON product_analytics(asin, ad_roas, acos, ad_cost, data_date);

-- 销售归因查询索引
CREATE INDEX IF NOT EXISTS idx_analytics_sales_attribution 
ON product_analytics(asin, organic_sales, sponsored_sales, data_date);

-- 趋势分析查询索引  
CREATE INDEX IF NOT EXISTS idx_analytics_trends 
ON product_analytics(asin, seasonality_index, trend_indicator, data_date);

-- 盈利能力查询索引
CREATE INDEX IF NOT EXISTS idx_analytics_profitability 
ON product_analytics(asin, gross_margin, net_margin, roi, data_date);

-- 竞争分析查询索引
CREATE INDEX IF NOT EXISTS idx_analytics_competition 
ON product_analytics(asin, market_share, price_competitiveness_score, data_date);

-- 数据质量查询索引
CREATE INDEX IF NOT EXISTS idx_analytics_data_quality 
ON product_analytics(data_quality_score, api_sync_status, api_last_sync);

-- ===========================================
-- 更新现有记录的计算字段
-- ===========================================

-- 计算已有数据的派生指标
UPDATE product_analytics 
SET 
    -- 广告ROAS计算 (广告销售 / 广告支出)
    ad_roas = CASE 
        WHEN ad_cost > 0 AND ad_sales > 0 THEN ad_sales / ad_cost
        ELSE 0 
    END,
    
    -- 总在途库存 (如果有详细在途数据)
    total_inbound_inventory = COALESCE(inbound_working, 0) + COALESCE(inbound_shipped, 0) + COALESCE(inbound_receiving, 0),
    
    -- 单位会话百分比 (销售数量 / 会话数)
    unit_session_percentage = CASE 
        WHEN sessions > 0 THEN sales_quantity::DECIMAL / sessions 
        ELSE 0 
    END,
    
    -- 每会话页面浏览数
    page_views_per_session = CASE 
        WHEN sessions > 0 THEN page_views::DECIMAL / sessions 
        ELSE 0 
    END,
    
    -- 毛利率计算 (如果有利润数据)
    gross_margin = CASE 
        WHEN sales_amount > 0 AND profit_amount IS NOT NULL THEN profit_amount / sales_amount 
        ELSE 0 
    END,
    
    -- 净利率计算
    net_margin = CASE 
        WHEN sales_amount > 0 AND profit_amount IS NOT NULL THEN profit_amount / sales_amount 
        ELSE 0 
    END,
    
    -- 库存周转率 (基于可用天数)
    inventory_turnover_ratio = CASE 
        WHEN available_days > 0 THEN 365.0 / available_days 
        ELSE 0 
    END,
    
    -- 数据更新时间
    api_last_sync = CURRENT_TIMESTAMP,
    api_sync_status = 'completed'
    
WHERE id IS NOT NULL;

-- ===========================================
-- 添加字段注释(PostgreSQL语法)
-- ===========================================

-- 库存字段注释
COMMENT ON COLUMN product_analytics.available_days IS '库存可售天数 - 核心运营指标';
COMMENT ON COLUMN product_analytics.inbound_working IS '在途库存-工作中状态';
COMMENT ON COLUMN product_analytics.inbound_shipped IS '在途库存-已发货状态';
COMMENT ON COLUMN product_analytics.inbound_receiving IS '在途库存-接收中状态';
COMMENT ON COLUMN product_analytics.total_inbound_inventory IS '总在途库存数量';

-- 广告字段注释
COMMENT ON COLUMN product_analytics.ad_roas IS '广告投资回报率 - 关键盈利指标';
COMMENT ON COLUMN product_analytics.organic_sales IS '自然销售额 - 非广告销售';
COMMENT ON COLUMN product_analytics.sponsored_sales IS '广告销售额 - 付费推广销售';

-- 分析字段注释
COMMENT ON COLUMN product_analytics.seasonality_index IS '季节性指数 - 需求波动分析';
COMMENT ON COLUMN product_analytics.market_share IS '市场份额 - 竞争地位';
COMMENT ON COLUMN product_analytics.data_quality_score IS '数据质量评分 - 数据可信度';

COMMIT;