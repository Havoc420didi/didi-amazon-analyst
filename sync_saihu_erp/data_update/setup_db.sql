-- MySQL/MariaDB数据库初始化脚本
-- 创建数据库
CREATE DATABASE IF NOT EXISTS saihu_erp_sync DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户并授权
CREATE USER IF NOT EXISTS 'hudi'@'localhost' IDENTIFIED BY '123456';
GRANT ALL PRIVILEGES ON saihu_erp_sync.* TO 'hudi'@'localhost';
FLUSH PRIVILEGES;

-- 使用数据库
USE saihu_erp_sync;

-- 创建FBA库存表
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

-- 显示创建的表
SHOW TABLES;
DESCRIBE fba_inventory;