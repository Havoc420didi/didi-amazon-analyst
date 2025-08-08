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

// RPA Configurations table
export const rpaConfigurations = pgTable(
  "rpa_configurations",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    version: varchar({ length: 50 }).notNull().default('1.0.0'),
    configuration: text().notNull(), // JSON格式配置
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_rpa_config_active").on(table.isActive),
    index("idx_rpa_config_version").on(table.version),
  ]
);
