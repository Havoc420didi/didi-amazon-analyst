import { db } from '@/db';
import { inventoryRecords, aiAnalysisTasks } from '@/db/schema';
import { and, eq, gte, lte, desc, asc, ilike, sql, count } from 'drizzle-orm';
import { 
  CreateInventoryRecord, 
  InventoryFilterParams,
  InventoryRecord,
  InventoryStats,
  InventoryTrend,
  WarehouseLocation,
  InventoryStatus
} from '@/lib/inventory-schema';
import type { PaginatedResponse } from '@/types/inventory';

/**
 * 创建单条库存记录
 */
export async function createInventoryRecord(data: CreateInventoryRecord): Promise<InventoryRecord> {
  const [record] = await db()
    .insert(inventoryRecords)
    .values({
      ...data,
      // 确保numeric字段正确转换
      avg_sales: data.avg_sales?.toString() || '0',
      daily_revenue: data.daily_revenue?.toString() || '0',
      inventory_turnover_days: data.inventory_turnover_days?.toString() || null,
      ad_spend: data.ad_spend?.toString() || '0',
      ad_ctr: data.ad_ctr?.toString() || null,
      ad_conversion_rate: data.ad_conversion_rate?.toString() || null,
      acos: data.acos?.toString() || null,
    })
    .returning();

  return transformDbRecordToApi(record);
}

/**
 * 批量创建库存记录
 */
export async function createInventoryRecords(data: CreateInventoryRecord[]): Promise<InventoryRecord[]> {
  if (data.length === 0) return [];

  const records = await db()
    .insert(inventoryRecords)
    .values(data.map(item => ({
      ...item,
      avg_sales: item.avg_sales?.toString() || '0',
      daily_revenue: item.daily_revenue?.toString() || '0',
      inventory_turnover_days: item.inventory_turnover_days?.toString() || null,
      ad_spend: item.ad_spend?.toString() || '0',
      ad_ctr: item.ad_ctr?.toString() || null,
      ad_conversion_rate: item.ad_conversion_rate?.toString() || null,
      acos: item.acos?.toString() || null,
    })))
    .returning();

  return records.map(transformDbRecordToApi);
}

/**
 * 批量更新或插入库存记录 (upsert)
 */
export async function upsertInventoryRecords(data: CreateInventoryRecord[]): Promise<InventoryRecord[]> {
  if (data.length === 0) return [];

  const results: InventoryRecord[] = [];

  for (const item of data) {
    const [record] = await db()
      .insert(inventoryRecords)
      .values({
        ...item,
        avg_sales: item.avg_sales?.toString() || '0',
        daily_revenue: item.daily_revenue?.toString() || '0',
        inventory_turnover_days: item.inventory_turnover_days?.toString() || null,
        ad_spend: item.ad_spend?.toString() || '0',
        ad_ctr: item.ad_ctr?.toString() || null,
        ad_conversion_rate: item.ad_conversion_rate?.toString() || null,
        acos: item.acos?.toString() || null,
        updated_at: sql`NOW()`,
      })
      .onConflictDoUpdate({
        target: [inventoryRecords.asin, inventoryRecords.warehouse_location, inventoryRecords.date],
        set: {
          product_name: item.product_name,
          sales_person: item.sales_person,
          fba_available: item.fba_available || 0,
          fba_in_transit: item.fba_in_transit || 0,
          local_warehouse: item.local_warehouse || 0,
          total_inventory: item.total_inventory || 0,
          avg_sales: item.avg_sales?.toString() || '0',
          daily_revenue: item.daily_revenue?.toString() || '0',
          inventory_turnover_days: item.inventory_turnover_days?.toString() || null,
          inventory_status: item.inventory_status || null,
          ad_impressions: item.ad_impressions || 0,
          ad_clicks: item.ad_clicks || 0,
          ad_spend: item.ad_spend?.toString() || '0',
          ad_orders: item.ad_orders || 0,
          ad_ctr: item.ad_ctr?.toString() || null,
          ad_conversion_rate: item.ad_conversion_rate?.toString() || null,
          acos: item.acos?.toString() || null,
          updated_at: sql`NOW()`,
        },
      })
      .returning();

    results.push(transformDbRecordToApi(record));
  }

  return results;
}

/**
 * 查询库存记录 (支持筛选和分页)
 */
export async function getInventoryRecords(
  params: InventoryFilterParams = {}
): Promise<PaginatedResponse<InventoryRecord>> {
  const {
    sales_person,
    asin,
    warehouse_location,
    inventory_status,
    date_from,
    date_to,
    page = 1,
    limit = 20,
    sort_by = 'date',
    sort_order = 'desc'
  } = params;

  // 构建查询条件
  const conditions = [];

  if (sales_person) {
    conditions.push(eq(inventoryRecords.sales_person, sales_person));
  }

  if (asin) {
    conditions.push(ilike(inventoryRecords.asin, `%${asin}%`));
  }

  if (warehouse_location) {
    conditions.push(eq(inventoryRecords.warehouse_location, warehouse_location));
  }

  if (inventory_status) {
    conditions.push(eq(inventoryRecords.inventory_status, inventory_status));
  }

  if (date_from) {
    conditions.push(gte(inventoryRecords.date, date_from));
  }

  if (date_to) {
    conditions.push(lte(inventoryRecords.date, date_to));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const [{ total }] = await db()
    .select({ total: count() })
    .from(inventoryRecords)
    .where(whereClause);

  // 排序设置
  const orderBy = sort_order === 'desc' 
    ? desc(inventoryRecords[sort_by as keyof typeof inventoryRecords])
    : asc(inventoryRecords[sort_by as keyof typeof inventoryRecords]);

  // 获取分页数据
  const records = await db()
    .select()
    .from(inventoryRecords)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    data: records.map(transformDbRecordToApi),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  };
}

/**
 * 获取最新的库存记录 (每个ASIN+库存点的最新记录，包含分析数量)
 */
export async function getLatestInventoryRecords(
  params: Omit<InventoryFilterParams, 'date_from' | 'date_to'> = {}
): Promise<PaginatedResponse<InventoryRecord>> {
  const {
    sales_person,
    asin,
    warehouse_location,
    inventory_status,
    page = 1,
    limit = 20,
    sort_by = 'date',
    sort_order = 'desc'
  } = params;

  // 使用窗口函数获取每个产品在每个库存点的最新记录
  const latestRecordsQuery = db()
    .select({
      ...inventoryRecords,
      rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${inventoryRecords.asin}, ${inventoryRecords.warehouse_location} ORDER BY ${inventoryRecords.date} DESC)`.as('rn')
    })
    .from(inventoryRecords);

  // 构建筛选条件
  const conditions = [sql`latest.rn = 1`];

  if (sales_person) {
    conditions.push(sql`latest.sales_person = ${sales_person}`);
  }

  if (asin) {
    conditions.push(sql`latest.asin ILIKE ${'%' + asin + '%'}`);
  }

  if (warehouse_location) {
    conditions.push(sql`latest.warehouse_location = ${warehouse_location}`);
  }

  if (inventory_status) {
    conditions.push(sql`latest.inventory_status = ${inventory_status}`);
  }

  const whereClause = and(...conditions);

  // 获取总数
  const countQuery = db()
    .select({ total: count() })
    .from(latestRecordsQuery.as('latest'))
    .where(whereClause);

  const [{ total }] = await countQuery;

  // 获取分页数据，联合查询分析数量
  const orderByClause = sort_order === 'desc' ? sql`${sql.identifier(sort_by)} DESC` : sql`${sql.identifier(sort_by)} ASC`;

  const recordsWithAnalysisCount = await db()
    .select({
      id: sql`latest.id`,
      asin: sql`latest.asin`,
      product_name: sql`latest.product_name`,
      sales_person: sql`latest.sales_person`,
      warehouse_location: sql`latest.warehouse_location`,
      date: sql`latest.date`,
      fba_available: sql`latest.fba_available`,
      fba_in_transit: sql`latest.fba_in_transit`,
      local_warehouse: sql`latest.local_warehouse`,
      total_inventory: sql`latest.total_inventory`,
      avg_sales: sql`latest.avg_sales`,
      daily_revenue: sql`latest.daily_revenue`,
      inventory_turnover_days: sql`latest.inventory_turnover_days`,
      inventory_status: sql`latest.inventory_status`,
      ad_impressions: sql`latest.ad_impressions`,
      ad_clicks: sql`latest.ad_clicks`,
      ad_spend: sql`latest.ad_spend`,
      ad_orders: sql`latest.ad_orders`,
      ad_ctr: sql`latest.ad_ctr`,
      ad_conversion_rate: sql`latest.ad_conversion_rate`,
      acos: sql`latest.acos`,
      created_at: sql`latest.created_at`,
      updated_at: sql`latest.updated_at`,
      // 添加分析数量统计
      analysis_count: sql<number>`COALESCE(COUNT(${aiAnalysisTasks.id}), 0)`.as('analysis_count')
    })
    .from(latestRecordsQuery.as('latest'))
    .leftJoin(
      aiAnalysisTasks,
      and(
        eq(sql`latest.asin`, aiAnalysisTasks.asin),
        eq(sql`latest.warehouse_location`, aiAnalysisTasks.warehouse_location),
        eq(aiAnalysisTasks.status, 'completed')
      )
    )
    .where(whereClause)
    .groupBy(
      sql`latest.id`,
      sql`latest.asin`,
      sql`latest.product_name`,
      sql`latest.sales_person`,
      sql`latest.warehouse_location`,
      sql`latest.date`,
      sql`latest.fba_available`,
      sql`latest.fba_in_transit`,
      sql`latest.local_warehouse`,
      sql`latest.total_inventory`,
      sql`latest.avg_sales`,
      sql`latest.daily_revenue`,
      sql`latest.inventory_turnover_days`,
      sql`latest.inventory_status`,
      sql`latest.ad_impressions`,
      sql`latest.ad_clicks`,
      sql`latest.ad_spend`,
      sql`latest.ad_orders`,
      sql`latest.ad_ctr`,
      sql`latest.ad_conversion_rate`,
      sql`latest.acos`,
      sql`latest.created_at`,
      sql`latest.updated_at`
    )
    .orderBy(orderByClause)
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    data: recordsWithAnalysisCount.map(record => transformDbRecordToApiWithAnalysisCount(record as any)),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  };
}

/**
 * 获取库存统计信息
 */
export async function getInventoryStats(
  date_from?: string,
  date_to?: string
): Promise<InventoryStats> {
  const conditions = [];

  if (date_from) {
    conditions.push(gte(inventoryRecords.date, date_from));
  }

  if (date_to) {
    conditions.push(lte(inventoryRecords.date, date_to));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 基础统计
  const [basicStats] = await db()
    .select({
      total_products: count(),
      total_inventory: sql<number>`SUM(${inventoryRecords.total_inventory})`,
      total_daily_revenue: sql<number>`SUM(${inventoryRecords.daily_revenue})`,
      total_ad_spend: sql<number>`SUM(${inventoryRecords.ad_spend})`,
    })
    .from(inventoryRecords)
    .where(whereClause);

  // 库存状态分布
  const statusDistribution = await db()
    .select({
      inventory_status: inventoryRecords.inventory_status,
      count: count()
    })
    .from(inventoryRecords)
    .where(whereClause)
    .groupBy(inventoryRecords.inventory_status);

  // 库存点分布
  const warehouseDistribution = await db()
    .select({
      warehouse_location: inventoryRecords.warehouse_location,
      count: count()
    })
    .from(inventoryRecords)
    .where(whereClause)
    .groupBy(inventoryRecords.warehouse_location);

  return {
    total_products: basicStats.total_products,
    total_inventory: basicStats.total_inventory || 0,
    total_daily_revenue: Number(basicStats.total_daily_revenue) || 0,
    total_ad_spend: Number(basicStats.total_ad_spend) || 0,
    inventory_status_distribution: statusDistribution.reduce((acc, item) => {
      if (item.inventory_status) {
        acc[item.inventory_status as InventoryStatus] = item.count;
      }
      return acc;
    }, {} as { [key in InventoryStatus]: number }),
    warehouse_distribution: warehouseDistribution.reduce((acc, item) => {
      acc[item.warehouse_location as WarehouseLocation] = item.count;
      return acc;
    }, {} as { [key in WarehouseLocation]: number })
  };
}

/**
 * 获取特定库存点的历史数据
 */
export async function getInventoryLocationHistory(
  location: WarehouseLocation,
  asin?: string,
  date_from?: string,
  date_to?: string
): Promise<InventoryRecord[]> {
  const conditions = [eq(inventoryRecords.warehouse_location, location)];

  if (asin) {
    conditions.push(eq(inventoryRecords.asin, asin));
  }

  if (date_from) {
    conditions.push(gte(inventoryRecords.date, date_from));
  }

  if (date_to) {
    conditions.push(lte(inventoryRecords.date, date_to));
  }

  const records = await db()
    .select()
    .from(inventoryRecords)
    .where(and(...conditions))
    .orderBy(desc(inventoryRecords.date));

  return records.map(transformDbRecordToApi);
}

/**
 * 根据日期范围获取特定产品的库存记录（用于聚合分析）
 */
export async function getByDateRange(
  asin: string,
  warehouseLocation: string,
  startDate: string,
  endDate: string
): Promise<InventoryRecord[]> {
  const records = await db()
    .select()
    .from(inventoryRecords)
    .where(
      and(
        eq(inventoryRecords.asin, asin),
        eq(inventoryRecords.warehouse_location, warehouseLocation),
        gte(inventoryRecords.date, startDate),
        lte(inventoryRecords.date, endDate)
      )
    )
    .orderBy(desc(inventoryRecords.date));

  return records.map(transformDbRecordToApi);
}

/**
 * 获取业务员列表
 */
export async function getSalesPersonList(): Promise<string[]> {
  const result = await db()
    .selectDistinct({ sales_person: inventoryRecords.sales_person })
    .from(inventoryRecords)
    .orderBy(asc(inventoryRecords.sales_person));

  return result.map(r => r.sales_person);
}

/**
 * 获取ASIN列表
 */
export async function getAsinList(limit: number = 100): Promise<string[]> {
  const result = await db()
    .selectDistinct({ asin: inventoryRecords.asin })
    .from(inventoryRecords)
    .orderBy(asc(inventoryRecords.asin))
    .limit(limit);

  return result.map(r => r.asin);
}

/**
 * 数据库记录转换为API格式
 */
function transformDbRecordToApi(record: any): InventoryRecord {
  return {
    id: record.id,
    asin: record.asin,
    product_name: record.product_name,
    sales_person: record.sales_person,
    warehouse_location: record.warehouse_location,
    date: record.date,
    fba_available: record.fba_available,
    fba_in_transit: record.fba_in_transit,
    local_warehouse: record.local_warehouse,
    total_inventory: record.total_inventory,
    avg_sales: Number(record.avg_sales),
    daily_revenue: Number(record.daily_revenue),
    inventory_turnover_days: record.inventory_turnover_days ? Number(record.inventory_turnover_days) : null,
    inventory_status: record.inventory_status,
    ad_impressions: record.ad_impressions,
    ad_clicks: record.ad_clicks,
    ad_spend: Number(record.ad_spend),
    ad_orders: record.ad_orders,
    ad_ctr: record.ad_ctr ? Number(record.ad_ctr) : null,
    ad_conversion_rate: record.ad_conversion_rate ? Number(record.ad_conversion_rate) : null,
    acos: record.acos ? Number(record.acos) : null,
    created_at: record.created_at ? new Date(record.created_at).toISOString() : '',
    updated_at: record.updated_at ? new Date(record.updated_at).toISOString() : '',
  };
}

/**
 * 数据库记录转换为API格式 (包含分析数量)
 */
function transformDbRecordToApiWithAnalysisCount(record: any): InventoryRecord {
  return {
    id: record.id,
    asin: record.asin,
    product_name: record.product_name,
    sales_person: record.sales_person,
    warehouse_location: record.warehouse_location,
    date: record.date,
    fba_available: record.fba_available,
    fba_in_transit: record.fba_in_transit,
    local_warehouse: record.local_warehouse,
    total_inventory: record.total_inventory,
    avg_sales: Number(record.avg_sales),
    daily_revenue: Number(record.daily_revenue),
    inventory_turnover_days: record.inventory_turnover_days ? Number(record.inventory_turnover_days) : null,
    inventory_status: record.inventory_status,
    ad_impressions: record.ad_impressions,
    ad_clicks: record.ad_clicks,
    ad_spend: Number(record.ad_spend),
    ad_orders: record.ad_orders,
    ad_ctr: record.ad_ctr ? Number(record.ad_ctr) : null,
    ad_conversion_rate: record.ad_conversion_rate ? Number(record.ad_conversion_rate) : null,
    acos: record.acos ? Number(record.acos) : null,
    created_at: record.created_at ? new Date(record.created_at).toISOString() : '',
    updated_at: record.updated_at ? new Date(record.updated_at).toISOString() : '',
    analysis_count: Number(record.analysis_count) || 0, // 添加分析数量
  };
}

// Export all functions as InventoryModel for consistency
export const InventoryModel = {
  createInventoryRecord,
  createInventoryRecords,
  upsertInventoryRecords,
  getInventoryRecords,
  getLatestInventoryRecords,
  getInventoryStats,
  getInventoryLocationHistory,
  getByDateRange,
  getSalesPersonList,
  getAsinList,
};