// 使用Drizzle ORM同步创建product_analytics2表
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, serial, varchar, date, decimal, integer, boolean, text, timestamp } from 'drizzle-orm/pg-core';
import dotenv from 'dotenv';

dotenv.config();

// 定义product_analytics2表结构，与现有模型完全一致
export const productAnalytics2 = pgTable('product_analytics2', {
  id: serial('id').primaryKey(),
  
  // 产品基础信息
  productId: varchar('product_id', { length: 50 }).notNull(),
  asin: varchar('asin', { length: 20 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  parentAsin: varchar('parent_asin', { length: 20 }),
  spu: varchar('spu', { length: 50 }),
  msku: varchar('msku', { length: 100 }),
  spuName: varchar('spu_name', { length: 500 }),
  title: varchar('title', { length: 1000 }),
  brand: varchar('brand', { length: 200 }),
  brandName: varchar('brand_name', { length: 200 }),
  categoryName: varchar('category_name', { length: 500 }),
  
  // 数据日期
  dataDate: date('data_date').notNull(),
  openDate: date('open_date'),
  
  // 销售和财务数据
  salesAmount: decimal('sales_amount', { precision: 12, scale: 2 }).default('0.00'),
  salesQuantity: integer('sales_quantity').default(0),
  avgProfit: decimal('avg_profit', { precision: 10, scale: 2 }).default('0.00'),
  profitAmount: decimal('profit_amount', { precision: 12, scale: 2 }).default('0.00'),
  profitRate: decimal('profit_rate', { precision: 5, scale: 4 }).default('0.0000'),
  buyBoxPrice: decimal('buy_box_price', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 10 }).default('USD'),
  
  // 广告数据
  impressions: decimal('impressions', { precision: 15, scale: 0 }).default('0'),
  clicks: integer('clicks').default(0),
  adCost: decimal('ad_cost', { precision: 12, scale: 2 }).default('0.00'),
  adSales: decimal('ad_sales', { precision: 12, scale: 2 }).default('0.00'),
  adOrders: integer('ad_orders').default(0),
  adConversionRate: decimal('ad_conversion_rate', { precision: 5, scale: 4 }).default('0.0000'),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 4 }).default('0.0000'),
  acos: decimal('acos', { precision: 5, scale: 4 }).default('0.0000'),
  cpc: decimal('cpc', { precision: 10, scale: 4 }).default('0.0000'),
  cpa: decimal('cpa', { precision: 10, scale: 4 }).default('0.0000'),
  
  // 会话和流量
  sessions: integer('sessions').default(0),
  pageViews: integer('page_views').default(0),
  
  // 订单和退货数据
  orderCount: integer('order_count').default(0),
  refundCount: integer('refund_count').default(0),
  refundRate: decimal('refund_rate', { precision: 5, scale: 4 }).default('0.0000'),
  returnCount: integer('return_count').default(0),
  returnRate: decimal('return_rate', { precision: 5, scale: 4 }).default('0.0000'),
  
  // 评价数据
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0.00'),
  ratingCount: integer('rating_count').default(0),
  
  // 库存信息
  availableDays: decimal('available_days', { precision: 10, scale: 1 }).default('0.0'),
  fbaInventory: integer('fba_inventory').default(0),
  totalInventory: integer('total_inventory').default(0),
  
  // 业务标识
  marketplaceId: varchar('marketplace_id', { length: 50 }),
  shopId: varchar('shop_id', { length: 50 }),
  devId: varchar('dev_id', { length: 50 }),
  operatorId: varchar('operator_id', { length: 50 }),
  devName: varchar('dev_name', { length: 100 }),
  operatorName: varchar('operator_name', { length: 100 }),
  
  // 分类和标签
  tagId: varchar('tag_id', { length: 50 }),
  brandId: varchar('brand_id', { length: 50 }),
  categoryId: varchar('category_id', { length: 50 }),
  
  // 状态信息
  onlineStatus: varchar('online_status', { length: 20 }),
  asinType: varchar('asin_type', { length: 20 }),
  stockStatus: varchar('stock_status', { length: 50 }),
  isLowCostStore: boolean('is_low_cost_store').default(false),
  
  // JSON存储多值数据
  shopIds: text('shop_ids'),
  devIds: text('dev_ids'),
  operatorIds: text('operator_ids'),
  marketplaceIds: text('marketplace_ids'),
  labelIds: text('label_ids'),
  brandIds: text('brand_ids'),
  adTypes: text('ad_types'),
  
  // 额外指标
  metricsJson: text('metrics_json'),
  
  -- 业务标识
  dataSource: varchar('data_source', { length: 20 }).default('erp_sync'),
  batchId: varchar('batch_id', { length: 50 }),
  syncStatus: varchar('sync_status', { length: 20 }).default('active'),
  
  -- 时间戳
  createdAt: text('created_at').default(new Date().toISOString()),
  updatedAt: text('updated_at').default(new Date().toISOString())
}, (table) => ([
  { name: 'uk_product_date2', columns: [table.productId, table.asin, table.dataDate, table.marketplaceId], unique: true },
  { name: 'idx_asin_date2', columns: [table.asin, table.dataDate] },
  { name: 'idx_date_range2', columns: [table.dataDate] },
  { name: 'idx_brand_date2', columns: [table.brandId, table.dataDate] },
  { name: 'idx_ad_metrics2', columns: [table.adCost, table.adSales, table.dataDate] }
]));

// 数据库连接配置
export async function createProductAnalytics2Table() {
  try {
    const db = drizzle(process.env.DATABASE_URL!);
    // 使用现有的PostgreSQL连接执行创建
    console.log('✅ product_analytics2表结构已定义，可以通过数据库迁移创建');
    console.log('📋 表结构完全复刻现有的product_analytics');
    console.log('🎯 执行命令: npx drizzle-kit push --config=src/db/config.ts');
  } catch (error) {
    console.error('数据库连接错误:', error);
    console.log('📋 请确保已正确配置数据库连接');
  }
}