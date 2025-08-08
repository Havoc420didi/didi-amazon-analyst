-- 数据同步系统数据库初始化脚本
-- 创建时间: 2025-07-23
-- 用途: 赛狐ERP数据同步项目

-- 创建数据库
CREATE DATABASE IF NOT EXISTS saihu_erp_sync DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE saihu_erp_sync;

-- 产品分析数据表
CREATE TABLE IF NOT EXISTS product_analytics (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    product_id VARCHAR(64) NOT NULL COMMENT '产品ID',
    data_date DATE NOT NULL COMMENT '数据日期',
    sales_amount DECIMAL(15,2) DEFAULT 0.00 COMMENT '销售金额',
    sales_quantity INT DEFAULT 0 COMMENT '销售数量',
    impressions INT DEFAULT 0 COMMENT '曝光量',
    clicks INT DEFAULT 0 COMMENT '点击量',
    conversion_rate DECIMAL(5,4) DEFAULT 0.0000 COMMENT '转化率',
    acos DECIMAL(5,4) DEFAULT 0.0000 COMMENT 'ACOS广告成本占比',
    metrics_json TEXT COMMENT '其他指标JSON格式',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_product_date (product_id, data_date),
    INDEX idx_data_date (data_date),
    INDEX idx_product_id (product_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品分析数据表';

-- FBA库存表
CREATE TABLE IF NOT EXISTS fba_inventory (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    sku VARCHAR(128) NOT NULL COMMENT 'SKU编码',
    asin VARCHAR(32) DEFAULT NULL COMMENT 'ASIN码',
    marketplace_id VARCHAR(32) NOT NULL COMMENT '市场ID',
    marketplace_name VARCHAR(64) DEFAULT NULL COMMENT '市场名称',
    available_quantity INT DEFAULT 0 COMMENT '可用库存数量',
    reserved_quantity INT DEFAULT 0 COMMENT '预留库存数量',
    inbound_quantity INT DEFAULT 0 COMMENT '入库中数量',
    researching_quantity INT DEFAULT 0 COMMENT '研究中数量',
    unfulfillable_quantity INT DEFAULT 0 COMMENT '不可履约数量',
    total_quantity INT DEFAULT 0 COMMENT '总库存数量',
    snapshot_date DATE NOT NULL COMMENT '快照日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_sku_marketplace_date (sku, marketplace_id, snapshot_date),
    INDEX idx_sku (sku),
    INDEX idx_marketplace_id (marketplace_id),
    INDEX idx_snapshot_date (snapshot_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='FBA库存表';

-- 库存明细表
CREATE TABLE IF NOT EXISTS inventory_details (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    item_id VARCHAR(128) NOT NULL COMMENT '商品ID',
    item_name VARCHAR(255) DEFAULT NULL COMMENT '商品名称',
    sku VARCHAR(128) NOT NULL COMMENT 'SKU编码',
    warehouse_code VARCHAR(32) NOT NULL COMMENT '仓库代码',
    warehouse_name VARCHAR(128) DEFAULT NULL COMMENT '仓库名称',
    quantity INT DEFAULT 0 COMMENT '库存数量',
    available_quantity INT DEFAULT 0 COMMENT '可用数量',
    reserved_quantity INT DEFAULT 0 COMMENT '预留数量',
    status VARCHAR(32) DEFAULT 'active' COMMENT '状态',
    cost_price DECIMAL(10,2) DEFAULT 0.00 COMMENT '成本价',
    batch_number VARCHAR(64) DEFAULT NULL COMMENT '批次号',
    expiry_date DATE DEFAULT NULL COMMENT '过期日期',
    location VARCHAR(128) DEFAULT NULL COMMENT '库位',
    snapshot_date DATE NOT NULL COMMENT '快照日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    INDEX idx_item_warehouse (item_id, warehouse_code),
    INDEX idx_sku_warehouse (sku, warehouse_code),
    INDEX idx_snapshot_date (snapshot_date),
    INDEX idx_warehouse_code (warehouse_code),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存明细表';

-- 同步任务记录表
CREATE TABLE IF NOT EXISTS sync_task_logs (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    task_type ENUM('product_analytics', 'fba_inventory', 'inventory_details') NOT NULL COMMENT '任务类型',
    task_date DATE NOT NULL COMMENT '任务执行日期',
    status ENUM('running', 'success', 'failed', 'timeout') DEFAULT 'running' COMMENT '任务状态',
    start_time TIMESTAMP NULL DEFAULT NULL COMMENT '开始时间',
    end_time TIMESTAMP NULL DEFAULT NULL COMMENT '结束时间',
    duration_seconds INT DEFAULT 0 COMMENT '执行时长(秒)',
    records_processed INT DEFAULT 0 COMMENT '处理记录数',
    records_success INT DEFAULT 0 COMMENT '成功记录数',
    records_failed INT DEFAULT 0 COMMENT '失败记录数',
    error_message TEXT DEFAULT NULL COMMENT '错误信息',
    api_calls_count INT DEFAULT 0 COMMENT 'API调用次数',
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    INDEX idx_task_type_date (task_type, task_date),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='同步任务记录表';

-- API配置表
CREATE TABLE IF NOT EXISTS api_configs (
    id INT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    config_key VARCHAR(64) NOT NULL COMMENT '配置键',
    config_name VARCHAR(128) NOT NULL COMMENT '配置名称',
    base_url VARCHAR(255) NOT NULL COMMENT '接口基础URL',
    endpoint VARCHAR(255) NOT NULL COMMENT '接口端点',
    method VARCHAR(10) DEFAULT 'GET' COMMENT 'HTTP方法',
    timeout_seconds INT DEFAULT 30 COMMENT '超时时间(秒)',
    rate_limit_per_minute INT DEFAULT 60 COMMENT '每分钟请求限制',
    retry_count INT DEFAULT 3 COMMENT '重试次数',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_config_key (config_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API配置表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id INT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    config_key VARCHAR(64) NOT NULL COMMENT '配置键',
    config_value TEXT NOT NULL COMMENT '配置值',
    config_type ENUM('string', 'int', 'float', 'json', 'boolean') DEFAULT 'string' COMMENT '配置类型',
    description VARCHAR(255) DEFAULT NULL COMMENT '配置描述',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_config_key (config_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 插入初始配置数据
INSERT INTO api_configs (config_key, config_name, base_url, endpoint, method, timeout_seconds, rate_limit_per_minute, retry_count) VALUES
('product_analytics', '产品分析数据接口', 'https://api.saihu-erp.com', '/api/v1/analytics/products', 'GET', 60, 100, 3),
('fba_inventory', 'FBA库存接口', 'https://api.saihu-erp.com', '/api/v1/inventory/fba', 'GET', 45, 120, 3),
('inventory_details', '库存明细接口', 'https://api.saihu-erp.com', '/api/v1/inventory/details', 'GET', 90, 80, 3)
ON DUPLICATE KEY UPDATE 
    config_name = VALUES(config_name),
    base_url = VALUES(base_url),
    endpoint = VALUES(endpoint),
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO system_configs (config_key, config_value, config_type, description) VALUES
('sync_batch_size', '500', 'int', '数据同步批处理大小'),
('max_history_days', '30', 'int', '最大历史数据保留天数'),
('enable_data_validation', 'true', 'boolean', '是否启用数据验证'),
('notification_email', 'admin@company.com', 'string', '告警通知邮箱'),
('log_level', 'INFO', 'string', '日志级别'),
('timezone', 'Asia/Shanghai', 'string', '时区设置')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

-- 创建视图：最新库存概览
CREATE OR REPLACE VIEW v_latest_inventory_summary AS
SELECT 
    fi.sku,
    fi.asin,
    fi.marketplace_name,
    fi.total_quantity as fba_quantity,
    COALESCE(id_summary.total_warehouse_quantity, 0) as warehouse_quantity,
    (fi.total_quantity + COALESCE(id_summary.total_warehouse_quantity, 0)) as total_quantity,
    fi.snapshot_date as fba_snapshot_date,
    id_summary.snapshot_date as warehouse_snapshot_date
FROM fba_inventory fi
LEFT JOIN (
    SELECT 
        sku,
        SUM(quantity) as total_warehouse_quantity,
        snapshot_date
    FROM inventory_details
    WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM inventory_details)
    GROUP BY sku, snapshot_date
) id_summary ON fi.sku = id_summary.sku
WHERE fi.snapshot_date = (SELECT MAX(snapshot_date) FROM fba_inventory);

-- 创建存储过程：清理历史数据
DELIMITER //
CREATE PROCEDURE CleanHistoryData()
BEGIN
    DECLARE max_days INT DEFAULT 30;
    DECLARE cutoff_date DATE;
    
    -- 获取配置的最大保留天数
    SELECT CAST(config_value AS SIGNED) INTO max_days 
    FROM system_configs 
    WHERE config_key = 'max_history_days' AND is_active = 1;
    
    SET cutoff_date = DATE_SUB(CURDATE(), INTERVAL max_days DAY);
    
    -- 清理过期的同步日志
    DELETE FROM sync_task_logs WHERE task_date < cutoff_date;
    
    -- 清理过期的产品分析数据（保留最近的数据）
    DELETE FROM product_analytics WHERE data_date < cutoff_date;
    
    -- 清理过期的库存快照（保留最近7天的数据）
    DELETE FROM fba_inventory WHERE snapshot_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY);
    DELETE FROM inventory_details WHERE snapshot_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY);
    
END //
DELIMITER ;

-- 创建事件调度器（如果需要自动清理）
-- SET GLOBAL event_scheduler = ON;
-- CREATE EVENT IF NOT EXISTS evt_clean_history_data
-- ON SCHEDULE EVERY 1 DAY STARTS '2025-07-24 02:00:00'
-- DO CALL CleanHistoryData();

COMMIT;