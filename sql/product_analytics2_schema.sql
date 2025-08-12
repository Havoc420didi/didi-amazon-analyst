-- product_analytics2 表结构
-- 完全复制现有product_analytics表结构，专用于30天历史数据存储

CREATE TABLE IF NOT EXISTS product_analytics2 (
    id SERIAL PRIMARY KEY,
    
    -- 产品基础信息
    product_id VARCHAR(50) NOT NULL,
    asin VARCHAR(20) NOT NULL,
    sku VARCHAR(100),
    parent_asin VARCHAR(20),
    spu VARCHAR(50),
    msku VARCHAR(100),
    spu_name VARCHAR(500),
    title VARCHAR(1000),
    brand VARCHAR(200),
    brand_name VARCHAR(200),
    category_name VARCHAR(500),
    
    -- 数据日期
    data_date DATE NOT NULL,
    open_date DATE,
    
    -- 销售和财务数据
    sales_amount DECIMAL(12,2) DEFAULT 0.00,
    sales_quantity INTEGER DEFAULT 0,
    avg_profit DECIMAL(10,2) DEFAULT 0.00,
    profit_amount DECIMAL(12,2) DEFAULT 0.00,
    profit_rate DECIMAL(5,4) DEFAULT 0.0000,
    buy_box_price DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- 广告数据
    impressions BIGINT DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ad_cost DECIMAL(12,2) DEFAULT 0.00,
    ad_sales DECIMAL(12,2) DEFAULT 0.00,
    ad_orders INTEGER DEFAULT 0,
    ad_conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
    conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
    acos DECIMAL(5,4) DEFAULT 0.0000,
    cpc DECIMAL(10,4) DEFAULT 0.0000,
    cpa DECIMAL(10,4) DEFAULT 0.0000,
    
    -- 会话和流量
    sessions INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    
    -- 订单和退货数据
    order_count INTEGER DEFAULT 0,
    refund_count INTEGER DEFAULT 0,
    refund_rate DECIMAL(5,4) DEFAULT 0.0000,
    return_count INTEGER DEFAULT 0,
    return_rate DECIMAL(5,4) DEFAULT 0.0000,
    
    -- 评价数据
    rating DECIMAL(3,2) DEFAULT 0.00,
    rating_count INTEGER DEFAULT 0,
    
    -- 库存信息管理
    available_days DECIMAL(10,1) DEFAULT 0.0,
    fba_inventory INTEGER DEFAULT 0,
    total_inventory INTEGER DEFAULT 0,
    
    -- 业务标识
    marketplace_id VARCHAR(50),
    shop_id VARCHAR(50),
    dev_id VARCHAR(50),
    operator_id VARCHAR(50),
    dev_name VARCHAR(100),
    operator_name VARCHAR(100),
    
    -- 分类和标签
    tag_id VARCHAR(50),
    brand_id VARCHAR(50),
    category_id VARCHAR(50),
    
    -- 状态和分类
    online_status VARCHAR(20),
    asin_type VARCHAR(20),
    stock_status VARCHAR(50),
    is_low_cost_store BOOLEAN DEFAULT FALSE,
    
    -- JSON字段存储多值数据
    shop_ids TEXT,
    dev_ids TEXT,
    operator_ids TEXT,
    marketplace_ids TEXT,
    label_ids TEXT,
    brand_ids TEXT,
    ad_types TEXT,
    
    -- 额外指标JSON
    metrics_json TEXT,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 业务标识字段
    data_source VARCHAR(20) DEFAULT 'erp_sync',
    batch_id VARCHAR(50),
    sync_status VARCHAR(20) DEFAULT 'active',
    
    -- 索引优化
    UNIQUE KEY uk_product_date (product_id, asin, data_date, marketplace_id),
    INDEX idx_asin_date (asin, data_date),
    INDEX idx_date_range (data_date, created_at),
    INDEX idx_brand_date (brand_id, data_date),
    INDEX idx_category_date (category_id, data_date),
    INDEX idx_total_inventory (total_inventory, data_date),
    INDEX idx_ad_metrics (ad_cost, ad_sales, ad_orders, data_date)
);

-- 创建用于历史数据查询的视图
CREATE OR REPLACE VIEW product_analytics_30day_view AS (
    SELECT * FROM product_analytics2 
    WHERE data_date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY data_date DESC, asin ASC
);

-- 创建每日快照视图
CREATE OR REPLACE VIEW daily_product_snapshots AS (
    SELECT 
        asin,
        data_date,
        COALESCE(sales_amount, 0) as daily_sales,
        COALESCE(sales_quantity, 0) as daily_quantity,
        COALESCE(impressions, 0) as daily_impressions,
        CASE 
            WHEN impressions > 0 THEN clicks::decimal / impressions
            ELSE 0 
        END as daily_ctr,
        CASE 
            WHEN clicks > 0 THEN ad_sales::decimal / clicks
            ELSE 0 
        END as daily_cpc,
        CASE 
            WHEN ad_cost > 0 THEN ad_sales::decimal / ad_cost * 100
            ELSE 0 
        END as daily_acos,
        fba_inventory as inventory_count,
        available_days as stock_days_left
    FROM product_analytics2
    WHERE data_date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY asin, data_date DESC
);

-- 创建快照合并函数调用视图（备用）
CREATE OR REPLACE VIEW time_dimensional_snapshots AS (
    SELECT 
        asin,
        -- T-1 单天
        (SELECT ARRAY_AGG(sales_amount) FROM product_analytics2 p21 WHERE p21.asin = p2.asin AND p21.data_date = p2.data_date) as t1_sales,
        -- T-3 合并
        (SELECT ARRAY_AGG(sales_amount) FROM product_analytics2 p23 WHERE p23.asin = p2.asin AND p23.data_date BETWEEN p2.data_date-2 AND p2.data_date) as t3_sales,
        -- 可以添加更多时间维度计算
        data_date
    FROM product_analytics2 p2
    WHERE data_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY asin, data_date
);