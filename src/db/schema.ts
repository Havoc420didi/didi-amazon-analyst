import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  decimal,
  date,
  bigint,
  index,
} from "drizzle-orm/pg-core";

// Users table
export const users = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    uuid: varchar({ length: 255 }).notNull().unique(),
    email: varchar({ length: 255 }).notNull(),
    username: varchar({ length: 100 }).unique(),
    password_hash: varchar({ length: 255 }),
    email_verified: boolean().notNull().default(false),
    created_at: timestamp({ withTimezone: true }),
    nickname: varchar({ length: 255 }),
    avatar_url: varchar({ length: 255 }),
    locale: varchar({ length: 50 }),
    signin_type: varchar({ length: 50 }),
    signin_ip: varchar({ length: 255 }),
    signin_provider: varchar({ length: 50 }),
    signin_openid: varchar({ length: 255 }),
    invite_code: varchar({ length: 255 }).notNull().default(""),
    updated_at: timestamp({ withTimezone: true }),
    invited_by: varchar({ length: 255 }).notNull().default(""),
    is_affiliate: boolean().notNull().default(false),
  },
  (table) => [
    uniqueIndex("email_provider_unique_idx").on(
      table.email,
      table.signin_provider
    ),
  ]
);

// Orders table
export const orders = pgTable("orders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  order_no: varchar({ length: 255 }).notNull().unique(),
  created_at: timestamp({ withTimezone: true }),
  user_uuid: varchar({ length: 255 }).notNull().default(""),
  user_email: varchar({ length: 255 }).notNull().default(""),
  amount: integer().notNull(),
  interval: varchar({ length: 50 }),
  expired_at: timestamp({ withTimezone: true }),
  status: varchar({ length: 50 }).notNull(),
  stripe_session_id: varchar({ length: 255 }),
  credits: integer().notNull(),
  currency: varchar({ length: 50 }),
  sub_id: varchar({ length: 255 }),
  sub_interval_count: integer(),
  sub_cycle_anchor: integer(),
  sub_period_end: integer(),
  sub_period_start: integer(),
  sub_times: integer(),
  product_id: varchar({ length: 255 }),
  product_name: varchar({ length: 255 }),
  valid_months: integer(),
  order_detail: text(),
  paid_at: timestamp({ withTimezone: true }),
  paid_email: varchar({ length: 255 }),
  paid_detail: text(),
});

// API Keys table
export const apikeys = pgTable("apikeys", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  api_key: varchar({ length: 255 }).notNull().unique(),
  title: varchar({ length: 100 }),
  user_uuid: varchar({ length: 255 }).notNull(),
  created_at: timestamp({ withTimezone: true }),
  status: varchar({ length: 50 }),
});

// Credits table
export const credits = pgTable("credits", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  trans_no: varchar({ length: 255 }).notNull().unique(),
  created_at: timestamp({ withTimezone: true }),
  user_uuid: varchar({ length: 255 }).notNull(),
  trans_type: varchar({ length: 50 }).notNull(),
  credits: integer().notNull(),
  order_no: varchar({ length: 255 }),
  expired_at: timestamp({ withTimezone: true }),
});

// Posts table
export const posts = pgTable("posts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  uuid: varchar({ length: 255 }).notNull().unique(),
  slug: varchar({ length: 255 }),
  title: varchar({ length: 255 }),
  description: text(),
  content: text(),
  created_at: timestamp({ withTimezone: true }),
  updated_at: timestamp({ withTimezone: true }),
  status: varchar({ length: 50 }),
  cover_url: varchar({ length: 255 }),
  author_name: varchar({ length: 255 }),
  author_avatar_url: varchar({ length: 255 }),
  locale: varchar({ length: 50 }),
});

// Affiliates table
export const affiliates = pgTable("affiliates", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  user_uuid: varchar({ length: 255 }).notNull(),
  created_at: timestamp({ withTimezone: true }),
  status: varchar({ length: 50 }).notNull().default(""),
  invited_by: varchar({ length: 255 }).notNull(),
  paid_order_no: varchar({ length: 255 }).notNull().default(""),
  paid_amount: integer().notNull().default(0),
  reward_percent: integer().notNull().default(0),
  reward_amount: integer().notNull().default(0),
});

// Feedbacks table
export const feedbacks = pgTable("feedbacks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  created_at: timestamp({ withTimezone: true }),
  status: varchar({ length: 50 }),
  user_uuid: varchar({ length: 255 }),
  content: text(),
  rating: integer(),
});

// Inventory Records table
export const inventoryRecords = pgTable(
  "inventory_records",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    asin: varchar({ length: 50 }).notNull(),
    product_name: varchar({ length: 500 }).notNull(),
    sales_person: varchar({ length: 100 }).notNull(),
    warehouse_location: varchar({ length: 50 }).notNull(),
    date: date().notNull(),
    
    // 库存数据
    fba_available: integer().notNull().default(0),
    fba_in_transit: integer().notNull().default(0),
    local_warehouse: integer().notNull().default(0),
    total_inventory: integer().notNull().default(0),
    
    // 销售数据
    avg_sales: decimal({ precision: 10, scale: 2 }).notNull().default('0'),
    daily_revenue: decimal({ precision: 10, scale: 2 }).notNull().default('0'),
    inventory_turnover_days: decimal({ precision: 8, scale: 2 }),
    inventory_status: varchar({ length: 20 }),
    
    // 广告数据
    ad_impressions: bigint({ mode: 'number' }).notNull().default(0),
    ad_clicks: integer().notNull().default(0),
    ad_spend: decimal({ precision: 10, scale: 2 }).notNull().default('0'),
    ad_orders: integer().notNull().default(0),
    ad_ctr: decimal({ precision: 10, scale: 8 }),
    ad_conversion_rate: decimal({ precision: 10, scale: 8 }),
    acos: decimal({ precision: 10, scale: 8 }),
    
    created_at: timestamp({ withTimezone: true }).defaultNow(),
    updated_at: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    // 多维度查询索引
    index("idx_inventory_filter_latest").on(
      table.warehouse_location,
      table.sales_person,
      table.asin,
      table.date
    ),
    // 业务员查询索引
    index("idx_inventory_sales_person").on(table.sales_person, table.date),
    // ASIN查询索引
    index("idx_inventory_asin").on(table.asin, table.warehouse_location, table.date),
    // 时间范围查询索引
    index("idx_inventory_date_range").on(table.date, table.warehouse_location),
    // 唯一约束：每个产品在每个库存点每天只能有一条记录
    uniqueIndex("unique_daily_inventory").on(
      table.asin,
      table.warehouse_location,
      table.date
    ),
  ]
);

// AI Analysis Tasks table
export const aiAnalysisTasks = pgTable(
  "ai_analysis_tasks",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    task_number: varchar({ length: 20 }).notNull().unique(),
    asin: varchar({ length: 50 }).notNull(),
    warehouse_location: varchar({ length: 50 }).notNull(),
    status: varchar({ length: 20 }).notNull().default('pending'), // pending, processing, completed, failed
    executor: varchar({ length: 100 }).notNull(),
    batch_id: varchar({ length: 50 }), // 批量分析批次ID
    
    // 数据快照 (JSON存储，快速开发)
    product_data: text('product_data').notNull(),
    
    // AI结果
    analysis_content: text(),
    ai_model: varchar({ length: 50 }).default('deepseek-chat'),
    processing_time: integer(), // 处理时间(毫秒)
    tokens_used: integer(),
    
    // 评价系统
    rating: integer(), // 1-5星评价，null表示未评价
    rating_feedback: text(), // 评价反馈文字
    
    created_at: timestamp({ withTimezone: true }).defaultNow(),
    completed_at: timestamp({ withTimezone: true }),
    updated_at: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    // 基础索引
    index("idx_ai_analysis_asin_warehouse").on(table.asin, table.warehouse_location),
    index("idx_ai_analysis_status").on(table.status),
    index("idx_ai_analysis_created_at").on(table.created_at),
    index("idx_ai_analysis_executor").on(table.executor),
    // 任务编号唯一索引
    uniqueIndex("unique_task_number").on(table.task_number),
  ]
);

// RPA Analysis Results table
export const rpaAnalysisResults = pgTable(
  "rpa_analysis_results",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    timestamp: varchar({ length: 255 }).notNull(),
    totalProducts: integer().notNull().default(0),
    highPotentialProducts: integer().notNull().default(0),
    aLevelProducts: text().notNull().default('[]'), // JSON格式
    marketTrends: text().notNull().default('{}'), // JSON格式
    processingTime: decimal({ precision: 10, scale: 2 }).notNull().default('0'),
    dataQualityScore: decimal({ precision: 3, scale: 2 }).notNull().default('0'),
    syncTimestamp: varchar({ length: 255 }),
    createdAt: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_rpa_analysis_timestamp").on(table.timestamp),
    index("idx_rpa_analysis_created_at").on(table.createdAt),
  ]
);

// RPA System Status table
export const rpaSystemStatus = pgTable(
  "rpa_system_status",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    status: varchar({ length: 50 }).notNull(), // running, completed, error, idle
    message: text().notNull().default(''),
    timestamp: varchar({ length: 255 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_rpa_status_created_at").on(table.createdAt),
    index("idx_rpa_status_status").on(table.status),
  ]
);

// Dynamic Inventory Permissions Table - 基于operator字段的动态权限表
export const inventorypermissions = pgTable(
  "inventorypermissions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // 操作员字段 - 与数据库表的operator字段保持一致
    operator: varchar({ length: 100 }).notNull(), // 关键字段：与表中的operator字段映射
    operator_uuid: varchar({ length: 255 }), // 关联users.uuid (可为空)
    
    // 数据权限维度
    data_source: varchar({ length: 50 }).notNull().default('inventory_deals'), // 数据来源表
    warehouse_location: varchar({ length: 50 }), // 可为空表示all warehouses
    asin: varchar({ length: 20 }), // 可为空表示all products
    sales_person: varchar({ length: 100 }), // 可为空表示all sales persons
    
    // 动态权限配置
    permission_rule: text('permission_rule').notNull(), // JSON格式存储权限规则
    
    // 数据级别控制 (基于operator字段)
    data_access_level: varchar({ length: 30 }).notNull().default('all'), // 'filter_by_operator', 'full_access', 'readonly'
    
    // 字段级权限
    visible_fields: text('visible_fields'), // JSON格式存储可见字段列表
    masked_fields: text('masked_fields'), // JSON格式存储脱敏字段配置  
    
    // 基于operator的脱敏规则
    masking_config: text('masking_config'), // JSON格式基于operator的脱敏配置
    
    // 特殊权限开关
    can_view_delegated: boolean().notNull().default(false), // 是否可以看到委派给operator的数据
    can_view_team: boolean().notNull().default(false), // 是否可以看到相同团队operator的数据
    can_view_all: boolean().notNull().default(false), // 是否可以看到所有operator的数据
    
    // 生效条件
    conditions: text('conditions'), // JSON格式存储判断条件
    
    // 时间控制
    effective_date: date().notNull().defaultNow(),
    expiry_date: date(),
    
    // 审计信息
    config_author: varchar({ length: 255 }).notNull(), // 配置创建者
    is_active: boolean().notNull().default(true),
    description: text(),
    
    created_at: timestamp({ withTimezone: true }).defaultNow(),
    updated_at: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    // 操作员权限索引
    index("idx_operator_permissions").on(table.operator, table.data_source),
    
    // 仓库权限索引
    index("idx_warehouse_permissions").on(table.warehouse_location, table.is_active),
    
    // ASIN权限索引
    index("idx_asin_permissions").on(table.asin, table.operator, table.is_active),
    
    // 综合查询索引
    index("idx_permissions_query").on(
      table.operator,
      table.data_source,
      table.warehouse_location,
      table.is_active,
      table.effective_date
    ),
    
    // 团队权限索引
    index("idx_team_permissions").on(table.data_access_level, table.is_active),
    
    // 唯一约束：同一操作员对同一维度只能有一条有效规则
    uniqueIndex("unique_operator_permission").on(
      table.operator,
      table.data_source,
      table.warehouse_location,
      table.asin,
      table.sales_person
    ),
  ]
);

// Operator Permission Rules - 操作员权限规则配置
export const operatorpermissionrules = pgTable(
  "operatorpermissionrules",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    operator: varchar({ length: 100 }).notNull(),
    rule_name: varchar({ length: 50 }).notNull(),
    
    // 规则类型和配置
    rule_type: varchar({ length: 30 }).notNull(), // 'self_only', 'team_view', 'delegated_only', 'custom'
    rule_config: text('rule_config').notNull(), // JSON格式存储规则配置
    
    // 数据筛选条件
    filter_criteria: text('filter_criteria'), // JSON格式存储筛选条件
    
    // 脱敏策略
    masking_strategy: text('masking_strategy'), // JSON格式存储脱敏策略（基于operator）
    
    // 权限级别映射
    access_mapping: text('access_mapping'), // JSON格式存储operator到访问级别的映射
    
    // 继承关系
    inherits_from: varchar({ length: 100 }), // 从其他operator继承的权限
    
    // 激活状态
    is_primary: boolean().notNull().default(false), // 是否为主规则
    priority: integer().notNull().default(0), // 规则优先级
    
    created_by: varchar({ length: 255 }).notNull(),
    last_updated: timestamp({ withTimezone: true }).defaultNow(),
    is_active: boolean().notNull().default(true),
    description: text(),
    
    created_at: timestamp({ withTimezone: true }).defaultNow(),
    updated_at: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_operator_rules").on(table.operator, table.rule_type, table.is_active),
    index("idx_rule_priority").on(table.priority, table.is_primary),
    uniqueIndex("unique_operator_rule").on(table.operator, table.rule_name, table.is_active),
  ]
);

// Warehouse Operator Mapping - 仓库操作员映射表 (支持多层operator权限)
export const warehouseoperatormapping = pgTable(
  "warehouseoperatormapping",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    warehouse_location: varchar({ length: 50 }).notNull(),
    operator: varchar({ length: 100 }).notNull(),
    
    // 操作员层级关系
    primary_operator: varchar({ length: 100 }), // 主operator
    secondary_operators: text('secondary_operators'), // JSON格式存储次级operators
    
    // 权限继承
    inherit_permissions: boolean().notNull().default(true),
    custom_permissions: text('custom_permissions'), // JSON格式存储自定义权限
    
    // 层级控制
    hierarchy_level: integer().notNull().default(1), // 权限层级
    
    is_active: boolean().notNull().default(true),
    created_at: timestamp({ withTimezone: true }).defaultNow(),
    updated_at: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_warehouse_operator").on(table.warehouse_location, table.operator, table.is_active),
    index("idx_hierarchy_mapping").on(table.primary_operator, table.hierarchy_level),
    uniqueIndex("unique_warehouse_operator").on(table.warehouse_location, table.operator),
  ]
);

// RPA Configurations table

// Inventory Deal Snapshots table - 库存快照聚合表
export const inventoryDeals = pgTable(
  "inventory_deals",
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    
    // 基础维度信息
    snapshot_date: date().notNull(), // 库存点日期 (T-1)
    asin: varchar({ length: 20 }).notNull(), // ASIN
    product_name: varchar({ length: 500 }).notNull(), // 品名
    sales_person: varchar({ length: 100 }).notNull(), // 业务员
    warehouse_location: varchar({ length: 50 }).notNull(), // 库存点（对应marketplace_id）
    
    // 时间窗口标识
    time_window: varchar({ length: 10 }).notNull(), // 'T1', 'T3', 'T7', 'T30'
    time_window_days: integer().notNull(), // 1, 3, 7, 30
    window_start_date: date().notNull(), // 窗口开始日期
    window_end_date: date().notNull(), // 窗口结束日期（T-1）
    
    // 库存数据（始终取T-1最新值）
    fba_available: integer().notNull().default(0), // FBA可用
    fba_in_transit: integer().notNull().default(0), // FBA在途
    local_warehouse: integer().notNull().default(0), // 本地仓
    total_inventory: integer().notNull().default(0), // 总库存
    
    // 销售数据（窗口内累加）
    total_sales_amount: decimal({ precision: 12, scale: 2 }).notNull().default('0'), // 总销售额
    total_sales_quantity: integer().notNull().default(0), // 总销售数量
    avg_daily_sales: decimal({ precision: 10, scale: 2 }).notNull().default('0'), // 平均销量（数量）
    avg_daily_revenue: decimal({ precision: 10, scale: 2 }).notNull().default('0'), // 日均销售额
    
    // 广告数据（累加和重计算）
    total_ad_impressions: bigint({ mode: 'number' }).notNull().default(0), // 广告曝光量（累加）
    total_ad_clicks: integer().notNull().default(0), // 广告点击量（累加）
    total_ad_spend: decimal({ precision: 12, scale: 2 }).notNull().default('0'), // 广告花费（累加）
    total_ad_orders: integer().notNull().default(0), // 广告订单量（累加）
    
    // 广告百分比指标（重新计算）
    ad_ctr: decimal({ precision: 8, scale: 6 }).notNull().default('0'), // 广告点击率 = total_clicks / total_impressions
    ad_conversion_rate: decimal({ precision: 8, scale: 6 }).notNull().default('0'), // 广告转化率 = total_ad_orders / total_clicks
    acos: decimal({ precision: 8, scale: 6 }).notNull().default('0'), // ACOS = total_ad_spend / total_ad_sales
    
    // 计算指标
    inventory_turnover_days: decimal({ precision: 10, scale: 2 }).notNull().default('0'), // 库存周转天数
    inventory_status: varchar({ length: 20 }).notNull().default('正常'), // 库存状态
    
    // 数据质量和元信息
    source_records_count: integer().notNull().default(0), // 源数据记录数
    calculation_method: varchar({ length: 50 }).notNull().default('sum_aggregate'), // 计算方法标识
    data_completeness_score: decimal({ precision: 3, scale: 2 }).notNull().default('1.00'), // 数据完整性评分
    
    // 审计字段
    batch_id: varchar({ length: 50 }), // 批处理ID
    processing_duration_ms: integer(), // 处理耗时（毫秒）
    created_at: timestamp({ withTimezone: true }).defaultNow(),
    updated_at: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    // 主要业务查询索引
    index("idx_inventory_deals_main").on(
      table.snapshot_date,
      table.asin,
      table.warehouse_location,
      table.time_window
    ),
    
    // 时间范围查询索引
    index("idx_inventory_deals_time_range").on(
      table.snapshot_date,
      table.time_window
    ),
    
    // 业务员查询索引
    index("idx_inventory_deals_sales_person").on(
      table.sales_person,
      table.snapshot_date
    ),
    
    // ASIN查询索引
    index("idx_inventory_deals_asin").on(
      table.asin,
      table.warehouse_location,
      table.snapshot_date
    ),
    
    // 库存状态查询索引
    index("idx_inventory_deals_inventory_status").on(
      table.inventory_status,
      table.total_inventory,
      table.snapshot_date
    ),
    
    // 批处理查询索引
    index("idx_inventory_deals_batch").on(
      table.batch_id,
      table.created_at
    ),
    
    // 唯一性约束：每个ASIN在每个库存点每天每个时间窗口只能有一条记录
    uniqueIndex("unique_inventory_deal_snapshot").on(
      table.asin,
      table.warehouse_location,
      table.snapshot_date,
      table.time_window
    ),
  ]
);
