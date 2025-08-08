-- PostgreSQL数据表迁移方案
-- 从现有MySQL inventory_points 和 product_analytics 迁移到PostgreSQL

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 库存点数据表 (原inventory_points)
CREATE TABLE IF NOT EXISTS inventory_points (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(20) NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    sales_person VARCHAR(100),
    marketplace VARCHAR(10) NOT NULL,
    data_date DATE NOT NULL,
    
    -- 库存数据
    total_inventory INTEGER DEFAULT 0,
    fba_available INTEGER DEFAULT 0,
    fba_inbound INTEGER DEFAULT 0,
    local_available INTEGER DEFAULT 0,
    fba_sellable INTEGER DEFAULT 0,
    
    -- 销售数据
    average_sales NUMERIC(10,2) DEFAULT 0.00,
    daily_sales_amount NUMERIC(12,2) DEFAULT 0.00,
    average_price NUMERIC(10,2),
    turnover_days NUMERIC(8,2),
    
    -- 广告数据
    ad_impressions INTEGER DEFAULT 0,
    ad_clicks INTEGER DEFAULT 0,
    ad_spend NUMERIC(10,2) DEFAULT 0.00,
    ad_order_count INTEGER DEFAULT 0,
    
    -- 计算字段
    is_out_of_stock BOOLEAN DEFAULT FALSE,
    is_low_inventory BOOLEAN DEFAULT FALSE,
    is_turnover_exceeded BOOLEAN DEFAULT FALSE,
    is_effective_inventory_point BOOLEAN DEFAULT FALSE,
    
    -- 元数据
    product_tag VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 索引优化
    CONSTRAINT uk_inventory_point UNIQUE (asin, marketplace, data_date),
    INDEX idx_inventory_points_asin (asin),
    INDEX idx_inventory_points_marketplace (marketplace),
    INDEX idx_inventory_points_date (data_date),
    INDEX idx_inventory_points_sales_person (sales_person),
    INDEX idx_inventory_points_stock_status (is_out_of_stock, is_low_inventory)
);

-- 产品分析数据表 (简化版)
CREATE TABLE IF NOT EXISTS product_analytics (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(20) NOT NULL,
    sku VARCHAR(50),
    marketplace VARCHAR(10) NOT NULL,
    data_date DATE NOT NULL,
    
    -- 销售核心数据
    sales_amount NUMERIC(12,2) DEFAULT 0.00,
    sales_quantity INTEGER DEFAULT 0,
    average_price NUMERIC(10,2),
    
    -- 广告数据
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ad_cost NUMERIC(10,2) DEFAULT 0.00,
    ad_sales NUMERIC(12,2) DEFAULT 0.00,
    
    -- 关键指标
    conversion_rate NUMERIC(5,4) DEFAULT 0.0000,
    ctr NUMERIC(5,4) DEFAULT 0.0000,
    acos NUMERIC(5,4) DEFAULT 0.0000,
    
    -- 业务指标
    order_count INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    
    -- 库存信息
    total_inventory INTEGER DEFAULT 0,
    fba_inventory INTEGER DEFAULT 0,
    available_days NUMERIC(5,2),
    
    -- 元数据
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 复合索引
    CONSTRAINT uk_product_analytics UNIQUE (asin, marketplace, data_date),
    INDEX idx_product_analytics_asin (asin),
    INDEX idx_product_analytics_date (data_date),
    INDEX idx_product_analytics_marketplace (marketplace),
    INDEX idx_product_analytics_currency (currency),
    INDEX idx_product_analytics_performance (sales_amount, ad_sales, ad_cost)
);

-- AI分析任务表
CREATE TABLE IF NOT EXISTS ai_analysis_tasks (
    id SERIAL PRIMARY KEY,
    task_number VARCHAR(50) NOT NULL UNIQUE,
    asin VARCHAR(20) NOT NULL,
    warehouse_location VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    executor VARCHAR(100) NOT NULL,
    
    -- 产品数据JSON存储
    product_data JSONB NOT NULL,
    analysis_content TEXT,
    ai_model VARCHAR(50) DEFAULT 'helios',
    processing_time INTEGER, -- 毫秒
    tokens_used INTEGER,
    
    -- 用户反馈
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    rating_feedback TEXT,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 索引
    INDEX idx_ai_tasks_asin (asin),
    INDEX idx_ai_tasks_location (warehouse_location),
    INDEX idx_ai_tasks_status (status),
    INDEX idx_ai_tasks_executor (executor),
    INDEX idx_ai_tasks_date (created_at DESC),
    INDEX idx_ai_tasks_search (asin, warehouse_location, status)
);

-- 聚合查询视图 - 用于AI分析的聚合数据
CREATE OR REPLACE VIEW ai_analysis_inventory_v AS
SELECT 
    ip.asin,
    ip.marketplace,
    MIN(ip.data_date) as analysis_start_date,
    MAX(ip.data_date) as analysis_end_date,
    -- 最新数据
    FIRST_VALUE(ip.total_inventory) OVER (PARTITION BY ip.asin, ip.marketplace ORDER BY ip.data_date DESC) as latest_total_inventory,
    FIRST_VALUE(ip.fba_available) OVER (PARTITION BY ip.asin, ip.marketplace ORDER BY ip.data_date DESC) as latest_fba_available,
    FIRST_VALUE(ip.average_sales) OVER (PARTITION BY ip.asin, ip.marketplace ORDER BY ip.data_date DESC) as latest_avg_sales,
    FIRST_VALUE(ip.daily_sales_amount) OVER (PARTITION BY ip.asin, ip.marketplace ORDER BY ip.data_date DESC) as latest_daily_revenue,
    -- 平均值（7天窗口）  
    AVG(ip.total_inventory) FILTER (WHERE ip.data_date >= CURRENT_DATE - INTERVAL '7 days') as avg_total_inventory_7d,
    AVG(ip.fba_available) FILTER (WHERE ip.data_date >= CURRENT_DATE - INTERVAL '7 days') as avg_fba_available_7d,
    AVG(ip.average_sales) FILTER (WHERE ip.data_date >= CURRENT_DATE - INTERVAL '7 days') as avg_sales_7d,
    AVG(ip.daily_sales_amount) FILTER (WHERE ip.data_date >= CURRENT_DATE - INTERVAL '7 days') as avg_daily_revenue_7d,
    -- 趋势变化
    (FIRST_VALUE(ip.total_inventory) OVER (PARTITION BY ip.asin, ip.marketplace ORDER BY ip.data_date DESC) - 
     FIRST_VALUE(ip.total_inventory) OVER (PARTITION BY ip.asin, ip.marketplace ORDER BY ip.data_date ASC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)) 
    / NULLIF(FIRST_VALUE(ip.total_inventory) OVER (PARTITION BY ip.asin, ip.marketplace ORDER BY ip.data_date ASC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING), 0) * 100 as inventory_trend_pct,
    -- 健康指标
    CASE 
        WHEN ip.total_inventory <= 0 THEN '断货'
        WHEN ip.turnover_days <= 45 THEN '库存不足' 
        WHEN ip.turnover_days >= 90 THEN '周转超标'
        ELSE '库存健康'
    END as inventory_health_status,
    ip.sales_person
FROM inventory_points ip
WHERE ip.data_date >= CURRENT_DATE - INTERVAL '30 days';

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_inventory_points_updated_at BEFORE UPDATE ON inventory_points
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_product_analytics_updated_at BEFORE UPDATE ON product_analytics  
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_ai_tasks_updated_at BEFORE UPDATE ON ai_analysis_tasks
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 索引优化查询视图
CREATE OR REPLACE VIEW inventory_analysis_data_v AS
SELECT 
    asin,
    marketplace as warehouse_location,
    product_name,
    sales_person,
    total_inventory,
    fba_available,
    fba_in_transit,
    local_available,
    average_sales as avg_sales,
    daily_sales_amount,
    turnover_days as inventory_turnover_days,
    ad_impressions,
    ad_clicks,
    ad_spend,
    ad_order_count as ad_orders,
    CASE 
        WHEN total_inventory <= 0 THEN '断货'
        WHEN turnover_days <= 45 THEN '库存不足'
        WHEN turnover_days >= 90 THEN '周转超标'
        ELSE '库存健康'
    END as inventory_status,
    data_date,
    created_at
FROM inventory_points;