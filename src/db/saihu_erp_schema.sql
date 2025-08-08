-- ===================================================================
-- 赛狐ERP数据同步系统 PostgreSQL表结构
-- 创建时间: 2025-08-08
-- 用途: 将赛狐ERP数据同步到PostgreSQL数据库
-- ===================================================================

-- 确保在saihu_erp_sync数据库上操作
CREATE SCHEMA IF NOT EXISTS saihu_erp_sync;
SET search_path TO saihu_erp_sync;

-- 开始事务
BEGIN;

-- ===================================================================
-- 产品分析数据表 - 增强版 (对应product_analytics)
-- ===================================================================
CREATE TABLE IF NOT EXISTS saihu_product_analytics (
    id BIGSERIAL PRIMARY KEY,
    asin VARCHAR(32) NOT NULL,
    sku VARCHAR(128),
    marketplace_id VARCHAR(32),
    marketplace_name VARCHAR(64),
    data_date DATE NOT NULL,
    
    -- 销售数据
    sales_amount DECIMAL(15,2) DEFAULT 0.00,
    sales_quantity INT DEFAULT 0,
    
    -- 流量数据
    sessions INT DEFAULT 0,
    impressions INT DEFAULT 0,
    clicks INT DEFAULT 0,
    cpc DECIMAL(8,4) DEFAULT 0.0000,
    page_views INT DEFAULT 0,
    
    -- 转化率
    ctr DECIMAL(5,4) DEFAULT 0.0000,
    conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
    
    -- 广告数据
    ad_cost DECIMAL(12,2) DEFAULT 0.00,
    ad_sales DECIMAL(12,2) DEFAULT 0.00,
    ad_clicks INT DEFAULT 0,
    ad_impressions INT DEFAULT 0,
    acos DECIMAL(5,4) DEFAULT 0.0000,
    roas DECIMAL(8,2) DEFAULT 0.00,
    
    -- 订单数据
    orders INT DEFAULT 0,
    ad_orders INT DEFAULT 0,
    
    -- 评分数据
    rating DECIMAL(3,2) DEFAULT 0.00,
    review_count INT DEFAULT 0,
    
    -- 库存数据
    fba_inventory INT DEFAULT 0,
    inbound_quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    
    -- 产品信息
    product_title VARCHAR(500),
    brand_name VARCHAR(100),
    category_name VARCHAR(100),
    
    -- 业务指标
    profit DECIMAL(12,2) DEFAULT 0.00,
    profit_margin DECIMAL(5,4) DEFAULT 0.0000,
    
    -- JSON字段存储额外数据
    metrics_data JSONB,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束
    CONSTRAINT uk_saihu_product_date UNIQUE(asin, marketplace_id, data_date)
);

-- ===================================================================
-- FBA库存表
-- ===================================================================
CREATE TABLE IF NOT EXISTS saihu_fba_inventory (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(128) NOT NULL,
    asin VARCHAR(32),
    marketplace_id VARCHAR(32) NOT NULL,
    marketplace_name VARCHAR(64),
    
    -- 库存数量
    available_quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    inbound_quantity INT DEFAULT 0,
    researching_quantity INT DEFAULT 0,
    unfulfillable_quantity INT DEFAULT 0,
    total_quantity INT DEFAULT 0,
    
    -- 日期和状态
    snapshot_date DATE NOT NULL,
    inventory_state VARCHAR(32) DEFAULT 'active',
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束
    CONSTRAINT uk_saihu_fba_date UNIQUE(sku, marketplace_id, snapshot_date)
);

-- ===================================================================
-- 库存明细表
-- ===================================================================
CREATE TABLE IF NOT EXISTS saihu_inventory_details (
    id BIGSERIAL PRIMARY KEY,
    item_id VARCHAR(128) NOT NULL,
    item_name VARCHAR(255),
    sku VARCHAR(128) NOT NULL,
    
    -- 仓库信息
    warehouse_code VARCHAR(32) NOT NULL,
    warehouse_name VARCHAR(128),
    
    -- 库存数据
    quantity INT DEFAULT 0,
    available_quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    
    -- 批次信息
    batch_number VARCHAR(64),
    expiry_date DATE,
    location VARCHAR(128),
    
    -- 成本信息
    cost_price DECIMAL(10,2) DEFAULT 0.00,
    
    -- 状态和日期
    status VARCHAR(32) DEFAULT 'active',
    snapshot_date DATE NOT NULL,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束
    CONSTRAINT uk_saihu_inventory_date UNIQUE(sku, warehouse_code, snapshot_date)
);

-- ===================================================================
-- 同步任务记录表
-- ===================================================================
CREATE TYPE sync_task_type AS ENUM ('product_analytics', 'fba_inventory', 'inventory_details');
CREATE TYPE sync_status_type AS ENUM ('running', 'success', 'failed', 'timeout', 'cancelled');

CREATE TABLE IF NOT EXISTS saihu_sync_task_logs (
    id BIGSERIAL PRIMARY KEY,
    task_type sync_task_type NOT NULL,
    task_date DATE NOT NULL,
    status sync_status_type DEFAULT 'running',
    
    -- 时间信息
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER DEFAULT 0,
    
    -- 统计信息
    records_processed INTEGER DEFAULT 0,
    records_success INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    
    -- API调用统计
    api_calls_count INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    
    -- 错误信息
    error_message TEXT,
    
    -- 任务配置
    config_json JSONB,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    CONSTRAINT uk_saihu_sync_task UNIQUE(task_type, task_date)
);

-- ===================================================================
-- API配置表
-- ===================================================================
CREATE TABLE IF NOT EXISTS saihu_api_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(64) NOT NULL UNIQUE,
    config_name VARCHAR(128) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    timeout_seconds INTEGER DEFAULT 30,
    rate_limit_per_minute INTEGER DEFAULT 60,
    retry_count INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================================================================
-- 系统配置表
-- ===================================================================
CREATE TYPE config_value_type AS ENUM ('string', 'int', 'float', 'json', 'boolean');

CREATE TABLE IF NOT EXISTS saihu_system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(64) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type config_value_type DEFAULT 'string',
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================================================================
-- 库存合并视图
-- ===================================================================
CREATE OR REPLACE VIEW v_saihu_latest_inventory AS
SELECT 
    COALESCE(fi.sku, id.sku) as sku,
    COALESCE(fi.asin, pa.asin) as asin,
    COALESCE(fi.marketplace_name, 'unknown') as marketplace_name,
    
    -- FBA库存
    COALESCE(fi.available_quantity, 0) as fba_available,
    COALESCE(fi.total_quantity, 0) as fba_total,
    
    -- 仓库库存
    COALESCE(id.available_quantity, 0) as warehouse_available,
    
    -- 总库存
    (COALESCE(fi.total_quantity, 0) + COALESCE(id.available_quantity, 0)) as total_quantity,
    
    -- 最新日期
    GREATEST(
        COALESCE(fi.snapshot_date, CURRENT_DATE - INTERVAL '7 days'),
        COALESCE(id.snapshot_date, CURRENT_DATE - INTERVAL '7 days')
    ) as latest_date
    
FROM saihu_fba_inventory fi
FULL OUTER JOIN saihu_inventory_details id ON fi.sku = id.sku
FULL OUTER JOIN saihu_product_analytics pa ON fi.asin = pa.asin OR id.sku = (pa.metrics_data->>'sku')::text

WHERE fi.snapshot_date = (
    SELECT MAX(snapshot_date) 
    FROM saihu_fba_inventory 
    WHERE COALESCE(sku, '') = COALESCE(fi.sku, '')
) OR id.snapshot_date = (
    SELECT MAX(snapshot_date) 
    FROM saihu_inventory_details 
    WHERE COALESCE(sku, '') = COALESCE(id.sku, '')
);

-- ===================================================================
-- 产品销售分析视图
-- ===================================================================
CREATE OR REPLACE VIEW v_saihu_product_summary AS
SELECT 
    pa.asin,
    pa.sku,
    pa.marketplace_name,
    pa.product_title,
    pa.brand_name,
    pa.category_name,
    
    -- 最近7天销售数据
    SUM(CASE WHEN pa.data_date >= CURRENT_DATE - INTERVAL '7 days' THEN pa.sales_amount ELSE 0 END) as sales_7d,
    SUM(CASE WHEN pa.data_date >= CURRENT_DATE - INTERVAL '7 days' THEN pa.sales_quantity ELSE 0 END) as quantity_7d,
    AVG(CASE WHEN pa.data_date >= CURRENT_DATE - INTERVAL '7 days' THEN pa.conversion_rate END) as conversion_7d,
    
    -- 最近30天销售数据
    SUM(CASE WHEN pa.data_date >= CURRENT_DATE - INTERVAL '30 days' THEN pa.sales_amount ELSE 0 END) as sales_30d,
    SUM(CASE WHEN pa.data_date >= CURRENT_DATE - INTERVAL '30 days' THEN pa.sales_quantity ELSE 0 END) as quantity_30d,
    
    -- 最近广告数据
    SUM(CASE WHEN pa.data_date >= CURRENT_DATE - INTERVAL '7 days' THEN pa.ad_cost ELSE 0 END) as ad_cost_7d,
    SUM(CASE WHEN pa.data_date >= CURRENT_DATE - INTERVAL '7 days' THEN pa.ad_sales ELSE 0 END) as ad_sales_7d,
    
    -- 库存数据
    COALESCE(vs.fba_available, 0) as fba_available,
    COALESCE(vs.total_quantity, 0) as total_inventory,
    
    -- 评分
    AVG(pa.rating) as avg_rating,
    SUM(pa.review_count) as total_reviews
    
FROM saihu_product_analytics pa
LEFT JOIN v_saihu_latest_inventory vs ON pa.asin = vs.asin

GROUP BY 
    pa.asin, pa.sku, pa.marketplace_name, pa.product_title, 
    pa.brand_name, pa.category_name, vs.fba_available, vs.total_quantity;

-- ===================================================================
-- 函数：清理历史数据
-- ===================================================================
CREATE OR REPLACE FUNCTION clean_saihu_history_data()
RETURNS INTEGER AS $$
DECLARE
    max_days INTEGER := 30;
    cutoff_date DATE;
    deleted_count INTEGER := 0;
BEGIN
    -- 获取历史数据保留天数
    SELECT COALESCE(config_value::INTEGER, 30) INTO max_days
    FROM saihu_system_configs 
    WHERE config_key = 'max_history_days' AND is_active = true;
    
    cutoff_date := CURRENT_DATE - INTERVAL '1 day' * max_days;
    
    -- 清理产品分析历史数据
    DELETE FROM saihu_product_analytics WHERE data_date < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 清理FBA库存历史数据（保留最近7天）
    DELETE FROM saihu_fba_inventory WHERE snapshot_date < CURRENT_DATE - INTERVAL '7 days';
    
    -- 清理库存明细历史数据（保留最近7天）
    DELETE FROM saihu_inventory_details WHERE snapshot_date < CURRENT_DATE - INTERVAL '7 days';
    
    -- 清理同步日志历史数据
    DELETE FROM saihu_sync_task_logs WHERE task_date < cutoff_date;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 插入初始配置数据
-- ===================================================================
INSERT INTO saihu_api_configs (config_key, config_name, base_url, endpoint, method, timeout_seconds, rate_limit_per_minute, retry_count) VALUES
('product_analytics', '赛狐产品分析数据接口', 'https://openapi.saihu-erp.com/gateway/app', '/amazon/product/analysis', 'POST', 60, 100, 3),
('fba_inventory', '赛狐FBA库存接口', 'https://openapi.saihu-erp.com/gateway/app', '/amazon/inventory/fba', 'POST', 45, 120, 3),
('inventory_details', '赛狐库存明细接口', 'https://openapi.saihu-erp.com/gateway/app', '/amazon/inventory/detail', 'POST', 90, 80, 3)
ON CONFLICT (config_key) DO UPDATE SET
    config_name = EXCLUDED.config_name,
    base_url = EXCLUDED.base_url,
    endpoint = EXCLUDED.endpoint,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO saihu_system_configs (config_key, config_value, config_type, description) VALUES
('sync_batch_size', '1000', 'int', '数据同步批处理大小'),
('max_history_days', '60', 'int', '最大历史数据保留天数'),
('enable_data_validation', 'true', 'boolean', '是否启用数据验证'),
('sync_timeout', '300', 'int', '同步超时时间(秒)'),
('parallel_threads', '5', 'int', '并行同步线程数'),
('retry_delay_seconds', '10', 'int', '重试等待时间(秒)'),
('log_level', 'INFO', 'string', '日志级别'),
('timezone', 'Asia/Shanghai', 'string', '时区设置'),
('currency', 'USD', 'string', '默认货币'),
('marketplaces', '["US", "UK", "DE", "ES", "FR", "IT"]', 'json', '同步的市场列表')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    config_type = EXCLUDED.config_type,
    updated_at = CURRENT_TIMESTAMP;

-- ===================================================================
-- 创建索引优化查询性能
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_saihu_product_date ON saihu_product_analytics(data_date);
CREATE INDEX IF NOT EXISTS idx_saihu_product_asin_date ON saihu_product_analytics(asin, data_date);
CREATE INDEX IF NOT EXISTS idx_saihu_product_marketplace_date ON saihu_product_analytics(marketplace_id, data_date);
CREATE INDEX IF NOT EXISTS idx_saihu_product_brand_date ON saihu_product_analytics(brand_name, data_date);
CREATE INDEX IF NOT EXISTS idx_saihu_product_created ON saihu_product_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_saihu_fba_sku_date ON saihu_fba_inventory(sku, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_saihu_fba_marketplace_date ON saihu_fba_inventory(marketplace_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_saihu_fba_snapshot ON saihu_fba_inventory(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_saihu_inventory_sku_date ON saihu_inventory_details(sku, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_saihu_inventory_warehouse_date ON saihu_inventory_details(warehouse_code, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_saihu_inventory_snapshot ON saihu_inventory_details(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_saihu_sync_task_type_date ON saihu_sync_task_logs(task_type, task_date);
CREATE INDEX IF NOT EXISTS idx_saihu_sync_status ON saihu_sync_task_logs(status);
CREATE INDEX IF NOT EXISTS idx_saihu_sync_created ON saihu_sync_task_logs(created_at);

-- ===================================================================
-- 提交事务
-- ===================================================================
COMMIT;

-- ===================================================================
-- 测试查询
-- ===================================================================
-- 查看表结构创建结果
SELECT 
    '表创建成功' as status,
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'saihu_erp_sync';

-- 查看创建的所有表
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'saihu_erp_sync' 
ORDER BY table_name;