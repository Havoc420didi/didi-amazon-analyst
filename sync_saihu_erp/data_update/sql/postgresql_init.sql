-- PostgreSQL 数据库初始化脚本
-- 赛狐ERP数据同步系统

-- 创建数据库（如果未创建）
-- CREATE DATABASE saihu_erp_sync WITH OWNER postgres;

-- 使用该数据库
-- \c saihu_erp_sync;

-- ===========================================
-- 创建扩展
-- ===========================================

-- 创建uuid扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建json扩展
CREATE EXTENSION IF NOT EXISTS "json";

-- ===========================================
-- 表结构定义
-- ===========================================

-- FBA库存表
DROP TABLE IF EXISTS fba_inventory CASCADE;
CREATE TABLE IF NOT EXISTS fba_inventory (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) NOT NULL,
    fn_sku VARCHAR(100),
    asin VARCHAR(20) NOT NULL,
    marketplace_id VARCHAR(10) NOT NULL,
    shop_id VARCHAR(50),
    available INTEGER DEFAULT 0,
    reserved_customerorders INTEGER DEFAULT 0,
    inbound_working INTEGER DEFAULT 0,
    inbound_shipped INTEGER DEFAULT 0,
    inbound_receiving INTEGER DEFAULT 0,
    unfulfillable INTEGER DEFAULT 0,
    total_inventory INTEGER DEFAULT 0,
    snapshot_date DATE,
    commodity_id VARCHAR(50),
    commodity_name VARCHAR(500),
    commodity_sku VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sku, marketplace_id, shop_id)
);

-- 库存明细表
DROP TABLE IF EXISTS inventory_details CASCADE;
CREATE TABLE IF NOT EXISTS inventory_details (
    id SERIAL PRIMARY KEY,
    warehouse_id VARCHAR(50) NOT NULL,
    commodity_id VARCHAR(50) NOT NULL,
    commodity_sku VARCHAR(100),
    commodity_name VARCHAR(500),
    fn_sku VARCHAR(100),
    stock_available INTEGER DEFAULT 0,
    stock_defective INTEGER DEFAULT 0,
    stock_occupy INTEGER DEFAULT 0,
    stock_wait INTEGER DEFAULT 0,
    stock_plan INTEGER DEFAULT 0,
    stock_all_num INTEGER DEFAULT 0,
    per_purchase DECIMAL(12,2) DEFAULT 0,
    total_purchase DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, commodity_id)
);

-- 产品分析表（包含所有字段）
DROP TABLE IF EXISTS product_analytics CASCADE;
CREATE TABLE IF NOT EXISTS product_analytics (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(20) NOT NULL,
    sku VARCHAR(100),
    parent_asin VARCHAR(20),
    spu VARCHAR(50),
    msku VARCHAR(100),
    sales_amount DECIMAL(15,2) DEFAULT 0,
    sales_quantity INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    acos DECIMAL(5,4) DEFAULT 0,
    data_date DATE NOT NULL,
    marketplace_id VARCHAR(10),
    dev_name VARCHAR(100),
    operator_name VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'USD',
    shop_id VARCHAR(50),
    dev_id VARCHAR(50),
    operator_id VARCHAR(50),
    -- 广告指标
    ad_cost DECIMAL(15,2) DEFAULT 0,
    ad_sales DECIMAL(15,2) DEFAULT 0,
    cpc DECIMAL(8,4) DEFAULT 0,
    cpa DECIMAL(8,4) DEFAULT 0,
    ad_orders INTEGER DEFAULT 0,
    ad_conversion_rate DECIMAL(5,4) DEFAULT 0,
    -- 业务指标
    order_count INTEGER DEFAULT 0,
    refund_count INTEGER DEFAULT 0,
    refund_rate DECIMAL(5,4) DEFAULT 0,
    return_count INTEGER DEFAULT 0,
    return_rate DECIMAL(5,4) DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    -- 商品信息
    title VARCHAR(1000),
    brand_name VARCHAR(100),
    category_name VARCHAR(200),
    -- 利润指标
    profit_amount DECIMAL(15,2) DEFAULT 0,
    profit_rate DECIMAL(5,4) DEFAULT 0,
    avg_profit DECIMAL(12,2) DEFAULT 0,
    -- 库存信息
    available_days INTEGER DEFAULT 0,
    fba_inventory INTEGER DEFAULT 0,
    total_inventory INTEGER DEFAULT 0,
    -- 访问数据
    sessions INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    buy_box_price DECIMAL(12,2),
    spu_name VARCHAR(200),
    brand VARCHAR(100),
    product_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asin, sku, data_date)
);

-- 库存点表
DROP TABLE IF EXISTS inventory_points CASCADE;
CREATE TABLE IF NOT EXISTS inventory_points (
    id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(10) NOT NULL,
    warehouse_name VARCHAR(100) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    is_eu BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_code)
);

-- 同步任务日志表
DROP TABLE IF EXISTS sync_task_log CASCADE;
CREATE TABLE IF NOT EXISTS sync_task_log (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 创建索引
-- ===========================================

-- FBA库存表索引
CREATE INDEX IF NOT EXISTS idx_fba_inventory_asin ON fba_inventory(asin);
CREATE INDEX IF NOT EXISTS idx_fba_inventory_marketplace ON fba_inventory(marketplace_id);
CREATE INDEX IF NOT EXISTS idx_fba_inventory_shop ON fba_inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_fba_inventory_snapshot ON fba_inventory(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_fba_inventory_combined ON fba_inventory(asin, marketplace_id, shop_id);

-- 库存明细表索引
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory_details(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_commodity ON inventory_details(commodity_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_details(commodity_sku);
CREATE INDEX IF NOT EXISTS idx_inventory_combined ON inventory_details(warehouse_id, commodity_id);

-- 产品分析表索引
CREATE INDEX IF NOT EXISTS idx_analytics_asin ON product_analytics(asin);
CREATE INDEX IF NOT EXISTS idx_analytics_sku ON product_analytics(sku);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON product_analytics(data_date);
CREATE INDEX IF NOT EXISTS idx_analytics_marketplace ON product_analytics(marketplace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_combined ON product_analytics(asin, sku, data_date);
CREATE INDEX IF NOT EXISTS idx_analytics_shop ON product_analytics(shop_id);
CREATE INDEX IF NOT EXISTS idx_analytics_dev ON product_analytics(dev_id);

-- 库存点索引
CREATE INDEX IF NOT EXISTS idx_inventory_points_country ON inventory_points(country_code);
CREATE INDEX IF NOT EXISTS idx_inventory_points_eu ON inventory_points(is_eu);

-- 同步任务日志索引
CREATE INDEX IF NOT EXISTS idx_sync_log_task ON sync_task_log(task_name);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON sync_task_log(task_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_task_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_time ON sync_task_log(start_time, end_time);

-- ===========================================
-- 创建触发器函数（用于更新updated_at字段）
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为表创建触发器
DROP TRIGGER IF EXISTS update_fba_inventory_updated_at ON fba_inventory;
CREATE TRIGGER update_fba_inventory_updated_at 
    BEFORE UPDATE ON fba_inventory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_details_updated_at ON inventory_details;
CREATE TRIGGER update_inventory_details_updated_at 
    BEFORE UPDATE ON inventory_details 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_analytics_updated_at ON product_analytics;
CREATE TRIGGER update_product_analytics_updated_at 
    BEFORE UPDATE ON product_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_points_updated_at ON inventory_points;
CREATE TRIGGER update_inventory_points_updated_at 
    BEFORE UPDATE ON inventory_points 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 初始数据插入
-- ===========================================

-- 默认库存点数据
INSERT INTO inventory_points (warehouse_code, warehouse_name, country_code, is_eu) VALUES
('AMAZON_US', 'Amazon US Warehouse', 'US', FALSE),
('AMAZON_UK', 'Amazon UK Warehouse', 'GB', TRUE),
('AMAZON_DE', 'Amazon Germany Warehouse', 'DE', TRUE),
('AMAZON_FR', 'Amazon France Warehouse', 'FR', TRUE),
('AMAZON_IT', 'Amazon Italy Warehouse', 'IT', TRUE),
('AMAZON_ES', 'Amazon Spain Warehouse', 'ES', TRUE),
('AMAZON_PL', 'Amazon Poland Warehouse', 'PL', TRUE),
('AMAZON_CZ', 'Amazon Czech Warehouse', 'CZ', TRUE);

-- ===========================================
-- 配置说明
-- ===========================================
-- PostgreSQL特点：
-- 1. 支持ON CONFLICT...DO UPDATE语法替代MySQL的ON DUPLICATE KEY UPDATE
-- 2. 使用SERIAL代替MySQL的AUTO_INCREMENT
-- 3. 使用BOOLEAN代替MySQL的TINYINT(1)
-- 4. TIMESTAMP WITH TIME ZONE包含时区信息
-- 5. 字符串类型使用VARCHAR(n)和TEXT
-- 6. 数字类型：INTEGER, DECIMAL(精度,小数位)
-- 7. 使用CURRENT_TIMESTAMP代替NOW()
-- 8. 使用UUID扩展支持UUID类型