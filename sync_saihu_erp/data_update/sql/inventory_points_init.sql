-- 库存点相关表结构初始化脚本
-- 用于支持库存点合并功能

-- 创建库存点表
CREATE TABLE IF NOT EXISTS `inventory_points` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  
  -- 基础产品信息
  `asin` VARCHAR(20) NOT NULL COMMENT '产品ASIN',
  `product_name` VARCHAR(500) NOT NULL COMMENT '产品名称',
  `sku` VARCHAR(100) COMMENT '产品SKU',
  `category` VARCHAR(200) COMMENT '产品分类',
  `sales_person` VARCHAR(100) COMMENT '业务员',
  `product_tag` VARCHAR(200) COMMENT '产品标签',
  
  -- 库存点信息
  `marketplace` VARCHAR(50) NOT NULL COMMENT '所属库存点/市场',
  `store` VARCHAR(200) COMMENT '店铺名称',
  `inventory_point_name` VARCHAR(100) COMMENT '库存点显示名称',
  
  -- 库存数据
  `fba_available` DECIMAL(12,2) DEFAULT 0 COMMENT 'FBA可用库存',
  `fba_inbound` DECIMAL(12,2) DEFAULT 0 COMMENT 'FBA在途库存',
  `fba_sellable` DECIMAL(12,2) DEFAULT 0 COMMENT 'FBA可售库存',
  `fba_unsellable` DECIMAL(12,2) DEFAULT 0 COMMENT 'FBA不可售库存',
  `local_available` DECIMAL(12,2) DEFAULT 0 COMMENT '本地仓可用库存',
  `inbound_shipped` DECIMAL(12,2) DEFAULT 0 COMMENT '入库已发货',
  `total_inventory` DECIMAL(12,2) DEFAULT 0 COMMENT '总库存',
  
  -- 销售数据
  `sales_7days` DECIMAL(12,2) DEFAULT 0 COMMENT '7天销量',
  `total_sales` DECIMAL(12,2) DEFAULT 0 COMMENT '总销量',
  `average_sales` DECIMAL(12,2) DEFAULT 0 COMMENT '平均销量',
  `order_count` DECIMAL(12,2) DEFAULT 0 COMMENT '订单量',
  `promotional_orders` DECIMAL(12,2) DEFAULT 0 COMMENT '促销订单量',
  
  -- 价格信息
  `average_price` VARCHAR(50) COMMENT '平均售价',
  `sales_amount` VARCHAR(50) COMMENT '销售额',
  `net_sales` VARCHAR(50) COMMENT '净销售额',
  `refund_rate` VARCHAR(20) COMMENT '退款率',
  
  -- 广告数据
  `ad_impressions` DECIMAL(15,2) DEFAULT 0 COMMENT '广告曝光量',
  `ad_clicks` DECIMAL(12,2) DEFAULT 0 COMMENT '广告点击量',
  `ad_spend` DECIMAL(12,2) DEFAULT 0 COMMENT '广告花费',
  `ad_order_count` DECIMAL(12,2) DEFAULT 0 COMMENT '广告订单量',
  `ad_sales` DECIMAL(12,2) DEFAULT 0 COMMENT '广告销售额',
  
  -- 计算的广告指标
  `ad_ctr` DECIMAL(8,4) DEFAULT 0 COMMENT '广告点击率',
  `ad_cvr` DECIMAL(8,4) DEFAULT 0 COMMENT '广告转化率',
  `acoas` DECIMAL(8,4) DEFAULT 0 COMMENT 'ACOAS',
  `ad_cpc` DECIMAL(8,2) DEFAULT 0 COMMENT '广告平均点击成本',
  `ad_roas` DECIMAL(8,2) DEFAULT 0 COMMENT '广告投资回报率',
  `ad_sales_per_click` DECIMAL(8,2) DEFAULT 0 COMMENT '广告销售转化率',
  `ad_cost_ratio` DECIMAL(8,4) DEFAULT 0 COMMENT '广告成本占销售额比例',
  
  -- 分析指标
  `turnover_days` DECIMAL(8,1) DEFAULT 0 COMMENT '库存周转天数',
  `daily_sales_amount` DECIMAL(12,2) DEFAULT 0 COMMENT '日均销售额',
  `is_turnover_exceeded` BOOLEAN DEFAULT FALSE COMMENT '是否周转超标',
  `is_out_of_stock` BOOLEAN DEFAULT FALSE COMMENT '是否断货',
  `is_zero_sales` BOOLEAN DEFAULT FALSE COMMENT '是否零销量',
  `is_low_inventory` BOOLEAN DEFAULT FALSE COMMENT '是否低库存',
  `is_effective_point` BOOLEAN DEFAULT FALSE COMMENT '是否为有效库存点',
  
  -- 合并元数据
  `merge_type` VARCHAR(50) COMMENT '合并类型 (eu_merged/non_eu_merged)',
  `merged_stores` TEXT COMMENT '合并的店铺列表(JSON格式)',
  `store_count` INT DEFAULT 1 COMMENT '合并的店铺数量',
  `representative_count` INT DEFAULT 1 COMMENT '代表产品数量',
  
  -- 数据来源和时间戳
  `data_date` VARCHAR(10) COMMENT '数据日期 YYYY-MM-DD',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  -- 创建索引
  INDEX `idx_asin_marketplace` (`asin`, `marketplace`),
  INDEX `idx_data_date` (`data_date`),
  INDEX `idx_sales_person` (`sales_person`),
  INDEX `idx_marketplace` (`marketplace`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_is_effective` (`is_effective_point`),
  INDEX `idx_turnover_exceeded` (`is_turnover_exceeded`),
  INDEX `idx_out_of_stock` (`is_out_of_stock`),
  INDEX `idx_asin_date` (`asin`, `data_date`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存点数据表';

-- 创建库存点历史数据表
CREATE TABLE IF NOT EXISTS `inventory_point_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `inventory_point_id` INT NOT NULL COMMENT '库存点ID',
  
  -- 基础信息
  `asin` VARCHAR(20) NOT NULL COMMENT '产品ASIN',
  `marketplace` VARCHAR(50) NOT NULL COMMENT '市场',
  `data_date` VARCHAR(10) NOT NULL COMMENT '数据日期',
  
  -- 快照数据
  `total_inventory` DECIMAL(12,2) DEFAULT 0 COMMENT '总库存快照',
  `average_sales` DECIMAL(12,2) DEFAULT 0 COMMENT '平均销量快照',
  `turnover_days` DECIMAL(8,1) DEFAULT 0 COMMENT '周转天数快照',
  `daily_sales_amount` DECIMAL(12,2) DEFAULT 0 COMMENT '日均销售额快照',
  
  -- 广告数据快照
  `ad_spend` DECIMAL(12,2) DEFAULT 0 COMMENT '广告花费快照',
  `ad_sales` DECIMAL(12,2) DEFAULT 0 COMMENT '广告销售额快照',
  `acoas` DECIMAL(8,4) DEFAULT 0 COMMENT 'ACOAS快照',
  
  -- 时间戳
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  -- 创建索引
  INDEX `idx_inventory_point_date` (`inventory_point_id`, `data_date`),
  INDEX `idx_asin_date` (`asin`, `data_date`),
  INDEX `idx_data_date_hist` (`data_date`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存点历史数据表';

-- 创建库存合并统计表
CREATE TABLE IF NOT EXISTS `inventory_merge_stats` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  
  -- 统计日期
  `data_date` VARCHAR(10) NOT NULL COMMENT '数据日期 YYYY-MM-DD',
  
  -- 合并统计
  `original_count` INT DEFAULT 0 COMMENT '原始产品数量',
  `merged_count` INT DEFAULT 0 COMMENT '合并后库存点数量',
  `eu_points` INT DEFAULT 0 COMMENT '欧盟库存点数量',
  `non_eu_points` INT DEFAULT 0 COMMENT '非欧盟库存点数量',
  `compression_ratio` DECIMAL(5,4) DEFAULT 0 COMMENT '压缩比例',
  
  -- 分析统计
  `turnover_exceeded` INT DEFAULT 0 COMMENT '周转超标数量',
  `low_inventory` INT DEFAULT 0 COMMENT '低库存数量',
  `out_of_stock` INT DEFAULT 0 COMMENT '断货数量',
  `zero_sales` INT DEFAULT 0 COMMENT '零销量数量',
  `effective_points` INT DEFAULT 0 COMMENT '有效库存点数量',
  `effectiveness_rate` DECIMAL(5,4) DEFAULT 0 COMMENT '有效率',
  
  -- 处理统计
  `processing_time_ms` INT DEFAULT 0 COMMENT '处理耗时(毫秒)',
  `merge_success` BOOLEAN DEFAULT TRUE COMMENT '合并是否成功',
  `error_message` TEXT COMMENT '错误信息',
  
  -- 时间戳  
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  -- 创建索引
  UNIQUE INDEX `idx_data_date_unique` (`data_date`),
  INDEX `idx_created_at_stats` (`created_at`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存合并统计表';

-- 插入初始配置数据
INSERT IGNORE INTO `inventory_merge_stats` (`data_date`, `created_at`) 
VALUES ('1970-01-01', '1970-01-01 00:00:00') 
ON DUPLICATE KEY UPDATE `data_date` = `data_date`;

-- 为了提高查询性能，创建一些视图

-- 创建有效库存点视图
CREATE OR REPLACE VIEW `v_effective_inventory_points` AS
SELECT 
    `asin`,
    `product_name`,
    `marketplace`,
    `sales_person`,
    `total_inventory`,
    `average_sales`,
    `turnover_days`,
    `daily_sales_amount`,
    `data_date`
FROM `inventory_points`
WHERE `is_effective_point` = TRUE
AND `data_date` = (SELECT MAX(`data_date`) FROM `inventory_points`);

-- 创建问题库存点视图
CREATE OR REPLACE VIEW `v_problem_inventory_points` AS  
SELECT 
    `asin`,
    `product_name`,
    `marketplace`,
    `sales_person`,
    `total_inventory`,
    `turnover_days`,
    CASE 
        WHEN `is_out_of_stock` = TRUE THEN '断货'
        WHEN `is_turnover_exceeded` = TRUE THEN '周转超标'
        WHEN `is_low_inventory` = TRUE THEN '低库存'
        WHEN `is_zero_sales` = TRUE THEN '零销量'
        ELSE '其他'
    END as `problem_type`,
    `data_date`
FROM `inventory_points`
WHERE (`is_out_of_stock` = TRUE 
       OR `is_turnover_exceeded` = TRUE 
       OR `is_low_inventory` = TRUE 
       OR `is_zero_sales` = TRUE)
AND `data_date` = (SELECT MAX(`data_date`) FROM `inventory_points`);

-- 创建业务员库存点统计视图
CREATE OR REPLACE VIEW `v_salesperson_inventory_stats` AS
SELECT 
    `sales_person`,
    COUNT(*) as `total_points`,
    SUM(CASE WHEN `is_effective_point` = TRUE THEN 1 ELSE 0 END) as `effective_points`,
    SUM(CASE WHEN `is_out_of_stock` = TRUE THEN 1 ELSE 0 END) as `out_of_stock_points`,
    SUM(CASE WHEN `is_turnover_exceeded` = TRUE THEN 1 ELSE 0 END) as `turnover_exceeded_points`,
    SUM(CASE WHEN `is_low_inventory` = TRUE THEN 1 ELSE 0 END) as `low_inventory_points`,
    SUM(`total_inventory`) as `total_inventory_value`,
    AVG(`turnover_days`) as `avg_turnover_days`,
    SUM(`daily_sales_amount`) as `total_daily_sales`,
    MAX(`data_date`) as `data_date`
FROM `inventory_points`
WHERE `data_date` = (SELECT MAX(`data_date`) FROM `inventory_points`)
GROUP BY `sales_person`;

COMMIT;