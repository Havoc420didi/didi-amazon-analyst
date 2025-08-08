/**
 * 广告数据访问对象 (DAO)
 * 提供对 sync_saihu_erp 数据库中广告相关数据的访问接口
 */

import { mysqlClient } from './mysql-client';

// 数据模型定义
export interface ProductAnalyticsData {
  id: number;
  product_id: string;
  asin?: string;
  sku?: string;
  parent_asin?: string;
  spu?: string;
  msku?: string;
  marketplace_id: string;
  dev_name?: string;
  operator_name?: string;
  data_date: string;
  sales_amount: number;
  sales_quantity: number;
  impressions: number;
  clicks: number;
  conversion_rate: number;
  acos: number;
  metrics_json?: string;
}

export interface FbaInventoryData {
  id: number;
  sku: string;
  asin?: string;
  fn_sku?: string;
  shop_id?: string;
  marketplace_id: string;
  marketplace_name?: string;
  available_quantity: number;
  reserved_quantity: number;
  inbound_quantity: number;
  inbound_shipped_quantity?: number;
  inbound_receiving_quantity?: number;
  researching_quantity: number;
  unfulfillable_quantity: number;
  defective_quantity?: number;
  total_quantity: number;
  commodity_id?: string;
  commodity_name?: string;
  commodity_sku?: string;
  snapshot_date: string;
}

export interface InventoryDetailsData {
  id: number;
  item_id: string;
  item_name?: string;
  sku: string;
  fn_sku?: string;
  warehouse_code: string;
  warehouse_name?: string;
  quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  stock_defective?: number;
  stock_wait?: number;
  stock_plan?: number;
  status: string;
  cost_price: number;
  total_purchase?: number;
  batch_number?: string;
  expiry_date?: string;
  location?: string;
  snapshot_date: string;
}

export interface InventoryPointData {
  id: number;
  asin: string;
  product_name: string;
  sku?: string;
  category?: string;
  sales_person?: string;
  product_tag?: string;
  marketplace: string;
  store?: string;
  inventory_point_name?: string;
  
  // 库存数据
  fba_available: number;
  fba_inbound: number;
  fba_sellable?: number;
  fba_unsellable?: number;
  local_available: number;
  inbound_shipped?: number;
  total_inventory: number;
  
  // 销售数据
  sales_7days: number;
  total_sales?: number;
  average_sales: number;
  order_count?: number;
  promotional_orders?: number;
  
  // 广告数据
  ad_impressions: number;
  ad_clicks: number;
  ad_spend: number;
  ad_order_count?: number;
  ad_sales?: number;
  
  // 计算的广告指标
  ad_ctr: number;
  ad_cvr: number;
  acoas: number;
  ad_cpc?: number;
  ad_roas?: number;
  
  // 分析指标
  turnover_days: number;
  daily_sales_amount: number;
  is_turnover_exceeded: boolean;
  is_out_of_stock: boolean;
  is_zero_sales: boolean;
  is_low_inventory: boolean;
  is_effective_point: boolean;
  
  // 合并元数据
  merge_type?: string;
  merged_stores?: string;
  store_count: number;
  data_date: string;
}

// 查询过滤条件
export interface ProductAnalyticsFilter {
  product_id?: string;
  asin?: string;
  sku?: string;
  marketplace_id?: string;
  dev_name?: string;
  operator_name?: string;
  start_date?: string;
  end_date?: string;
  data_date?: string;
}

export interface FbaInventoryFilter {
  sku?: string;
  asin?: string;
  marketplace_id?: string;
  marketplace_name?: string;
  snapshot_date?: string;
  start_date?: string;
  end_date?: string;
}

export interface InventoryDetailsFilter {
  item_id?: string;
  sku?: string;
  warehouse_code?: string;
  warehouse_name?: string;
  status?: string;
  snapshot_date?: string;
  start_date?: string;
  end_date?: string;
}

export interface InventoryPointFilter {
  asin?: string;
  marketplace?: string;
  sales_person?: string;
  is_effective_point?: boolean;
  is_turnover_exceeded?: boolean;
  is_out_of_stock?: boolean;
  merge_type?: string;
  data_date?: string;
  start_date?: string;
  end_date?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export class AdDataDAO {
  
  /**
   * 获取产品分析数据
   */
  async getProductAnalytics(
    filter: ProductAnalyticsFilter = {},
    pagination: PaginationOptions = {}
  ) {
    const { whereClause, params } = mysqlClient.buildWhereClause({
      product_id: filter.product_id,
      asin: filter.asin,
      sku: filter.sku,
      marketplace_id: filter.marketplace_id,
      dev_name: filter.dev_name,
      operator_name: filter.operator_name,
      data_date: filter.data_date,
    });

    // 添加日期范围查询
    let dateRangeClause = '';
    if (filter.start_date && filter.end_date) {
      dateRangeClause = whereClause 
        ? ` AND data_date BETWEEN ? AND ?`
        : ` WHERE data_date BETWEEN ? AND ?`;
      params.push(filter.start_date, filter.end_date);
    } else if (filter.start_date) {
      dateRangeClause = whereClause 
        ? ` AND data_date >= ?`
        : ` WHERE data_date >= ?`;
      params.push(filter.start_date);
    } else if (filter.end_date) {
      dateRangeClause = whereClause 
        ? ` AND data_date <= ?`
        : ` WHERE data_date <= ?`;
      params.push(filter.end_date);
    }

    const sql = `
      SELECT 
        id, product_id, asin, sku, parent_asin, spu, msku,
        marketplace_id, dev_name, operator_name, data_date,
        sales_amount, sales_quantity, impressions, clicks,
        conversion_rate, acos, metrics_json
      FROM product_analytics 
      ${whereClause}${dateRangeClause}
      ORDER BY data_date DESC, id DESC
    `;

    return await mysqlClient.queryWithPagination<ProductAnalyticsData>(
      sql, 
      params, 
      pagination
    );
  }

  /**
   * 获取FBA库存数据
   */
  async getFbaInventory(
    filter: FbaInventoryFilter = {},
    pagination: PaginationOptions = {}
  ) {
    const { whereClause, params } = mysqlClient.buildWhereClause({
      sku: filter.sku,
      asin: filter.asin,
      marketplace_id: filter.marketplace_id,
      marketplace_name: filter.marketplace_name,
      snapshot_date: filter.snapshot_date,
    });

    // 添加日期范围查询
    let dateRangeClause = '';
    if (filter.start_date && filter.end_date) {
      dateRangeClause = whereClause 
        ? ` AND snapshot_date BETWEEN ? AND ?`
        : ` WHERE snapshot_date BETWEEN ? AND ?`;
      params.push(filter.start_date, filter.end_date);
    }

    const sql = `
      SELECT 
        id, sku, asin, fn_sku, shop_id, marketplace_id, marketplace_name,
        available_quantity, reserved_quantity, inbound_quantity,
        inbound_shipped_quantity, inbound_receiving_quantity,
        researching_quantity, unfulfillable_quantity,
        defective_quantity, total_quantity,
        commodity_id, commodity_name, commodity_sku, snapshot_date
      FROM fba_inventory 
      ${whereClause}${dateRangeClause}
      ORDER BY snapshot_date DESC, id DESC
    `;

    return await mysqlClient.queryWithPagination<FbaInventoryData>(
      sql, 
      params, 
      pagination
    );
  }

  /**
   * 获取库存明细数据
   */
  async getInventoryDetails(
    filter: InventoryDetailsFilter = {},
    pagination: PaginationOptions = {}
  ) {
    const { whereClause, params } = mysqlClient.buildWhereClause({
      item_id: filter.item_id,
      sku: filter.sku,
      warehouse_code: filter.warehouse_code,
      warehouse_name: filter.warehouse_name,
      status: filter.status,
      snapshot_date: filter.snapshot_date,
    });

    // 添加日期范围查询
    let dateRangeClause = '';
    if (filter.start_date && filter.end_date) {
      dateRangeClause = whereClause 
        ? ` AND snapshot_date BETWEEN ? AND ?`
        : ` WHERE snapshot_date BETWEEN ? AND ?`;
      params.push(filter.start_date, filter.end_date);
    }

    const sql = `
      SELECT 
        id, item_id, item_name, sku, fn_sku,
        warehouse_code, warehouse_name, quantity,
        available_quantity, reserved_quantity,
        stock_defective, stock_wait, stock_plan,
        status, cost_price, total_purchase,
        batch_number, expiry_date, location, snapshot_date
      FROM inventory_details 
      ${whereClause}${dateRangeClause}
      ORDER BY snapshot_date DESC, id DESC
    `;

    return await mysqlClient.queryWithPagination<InventoryDetailsData>(
      sql, 
      params, 
      pagination
    );
  }

  /**
   * 获取库存点数据
   */
  async getInventoryPoints(
    filter: InventoryPointFilter = {},
    pagination: PaginationOptions = {}
  ) {
    const { whereClause, params } = mysqlClient.buildWhereClause({
      asin: filter.asin,
      marketplace: filter.marketplace,
      sales_person: filter.sales_person,
      is_effective_point: filter.is_effective_point,
      is_turnover_exceeded: filter.is_turnover_exceeded,
      is_out_of_stock: filter.is_out_of_stock,
      merge_type: filter.merge_type,
      data_date: filter.data_date,
    });

    // 添加日期范围查询
    let dateRangeClause = '';
    if (filter.start_date && filter.end_date) {
      dateRangeClause = whereClause 
        ? ` AND data_date BETWEEN ? AND ?`
        : ` WHERE data_date BETWEEN ? AND ?`;
      params.push(filter.start_date, filter.end_date);
    }

    const sql = `
      SELECT 
        id, asin, product_name, sku, category, sales_person, product_tag,
        marketplace, store, inventory_point_name,
        fba_available, fba_inbound, fba_sellable, fba_unsellable,
        local_available, inbound_shipped, total_inventory,
        sales_7days, total_sales, average_sales, order_count, promotional_orders,
        ad_impressions, ad_clicks, ad_spend, ad_order_count, ad_sales,
        ad_ctr, ad_cvr, acoas, ad_cpc, ad_roas,
        turnover_days, daily_sales_amount,
        is_turnover_exceeded, is_out_of_stock, is_zero_sales,
        is_low_inventory, is_effective_point,
        merge_type, merged_stores, store_count, data_date
      FROM inventory_points 
      ${whereClause}${dateRangeClause}
      ORDER BY data_date DESC, daily_sales_amount DESC, id DESC
    `;

    return await mysqlClient.queryWithPagination<InventoryPointData>(
      sql, 
      params, 
      pagination
    );
  }

  /**
   * 获取广告数据汇总统计
   */
  async getAdMetricsSummary(filter: {
    asin?: string;
    marketplace?: string;
    start_date?: string;
    end_date?: string;
  } = {}) {
    const { whereClause, params } = mysqlClient.buildWhereClause({
      asin: filter.asin,
      marketplace: filter.marketplace,
    });

    // 添加日期范围查询
    let dateRangeClause = '';
    if (filter.start_date && filter.end_date) {
      dateRangeClause = whereClause 
        ? ` AND data_date BETWEEN ? AND ?`
        : ` WHERE data_date BETWEEN ? AND ?`;
      params.push(filter.start_date, filter.end_date);
    }

    const sql = `
      SELECT 
        COUNT(DISTINCT asin) as total_products,
        COUNT(*) as total_points,
        SUM(total_inventory) as total_inventory,
        SUM(sales_7days) as total_sales_7days,
        SUM(daily_sales_amount) as total_daily_sales,
        SUM(ad_impressions) as total_impressions,
        SUM(ad_clicks) as total_clicks,
        SUM(ad_spend) as total_ad_spend,
        SUM(ad_sales) as total_ad_sales,
        AVG(CASE WHEN ad_impressions > 0 THEN ad_ctr ELSE NULL END) as avg_ctr,
        AVG(CASE WHEN ad_clicks > 0 THEN ad_cvr ELSE NULL END) as avg_cvr,
        AVG(CASE WHEN daily_sales_amount > 0 THEN acoas ELSE NULL END) as avg_acoas,
        SUM(CASE WHEN is_effective_point = 1 THEN 1 ELSE 0 END) as effective_points,
        SUM(CASE WHEN is_turnover_exceeded = 1 THEN 1 ELSE 0 END) as turnover_exceeded_points,
        SUM(CASE WHEN is_out_of_stock = 1 THEN 1 ELSE 0 END) as out_of_stock_points
      FROM inventory_points 
      ${whereClause}${dateRangeClause}
    `;

    return await mysqlClient.query(sql, params);
  }

  /**
   * 获取广告效果趋势数据
   */
  async getAdTrendData(filter: {
    asin?: string;
    marketplace?: string;
    days?: number;
  } = {}) {
    const days = filter.days || 30;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { whereClause, params } = mysqlClient.buildWhereClause({
      asin: filter.asin,
      marketplace: filter.marketplace,
    });

    const dateRangeClause = whereClause 
      ? ` AND data_date BETWEEN ? AND ?`
      : ` WHERE data_date BETWEEN ? AND ?`;
    params.push(startDate, endDate);

    const sql = `
      SELECT 
        data_date,
        SUM(ad_impressions) as impressions,
        SUM(ad_clicks) as clicks,
        SUM(ad_spend) as spend,
        SUM(ad_sales) as sales,
        AVG(CASE WHEN ad_impressions > 0 THEN ad_ctr ELSE 0 END) as ctr,
        AVG(CASE WHEN ad_clicks > 0 THEN ad_cvr ELSE 0 END) as cvr,
        AVG(CASE WHEN daily_sales_amount > 0 THEN acoas ELSE 0 END) as acoas
      FROM inventory_points 
      ${whereClause}${dateRangeClause}
      GROUP BY data_date
      ORDER BY data_date ASC
    `;

    return await mysqlClient.query(sql, params);
  }

  /**
   * 获取库存点分布数据
   */
  async getInventoryPointDistribution() {
    const sql = `
      SELECT 
        marketplace,
        COUNT(*) as point_count,
        SUM(total_inventory) as total_inventory,
        SUM(daily_sales_amount) as total_daily_sales,
        SUM(ad_spend) as total_ad_spend,
        AVG(CASE WHEN ad_impressions > 0 THEN ad_ctr ELSE 0 END) as avg_ctr,
        AVG(CASE WHEN daily_sales_amount > 0 THEN acoas ELSE 0 END) as avg_acoas
      FROM inventory_points 
      WHERE data_date = (SELECT MAX(data_date) FROM inventory_points)
      GROUP BY marketplace
      ORDER BY total_daily_sales DESC
    `;

    return await mysqlClient.query(sql);
  }

  /**
   * 获取同步任务状态
   */
  async getSyncTaskStatus(taskType?: string) {
    const { whereClause, params } = mysqlClient.buildWhereClause({
      task_type: taskType,
    });

    const sql = `
      SELECT 
        task_name, task_type, status, start_time, end_time,
        execution_time, records_processed, records_success,
        records_failed, error_message, created_at
      FROM sync_task_logs 
      ${whereClause}
      ORDER BY created_at DESC, start_time DESC
      LIMIT 50
    `;

    return await mysqlClient.query(sql, params);
  }

  /**
   * 批量更新库存点数据
   */
  async batchUpdateInventoryPoints(data: Partial<InventoryPointData>[]) {
    if (!data || data.length === 0) {
      return { success: true, total: 0 };
    }

    const updateFields = [
      'fba_available = VALUES(fba_available)',
      'fba_inbound = VALUES(fba_inbound)',
      'total_inventory = VALUES(total_inventory)',
      'sales_7days = VALUES(sales_7days)',
      'average_sales = VALUES(average_sales)',
      'ad_impressions = VALUES(ad_impressions)',
      'ad_clicks = VALUES(ad_clicks)',
      'ad_spend = VALUES(ad_spend)',
      'ad_ctr = VALUES(ad_ctr)',
      'ad_cvr = VALUES(ad_cvr)',
      'acoas = VALUES(acoas)',
      'turnover_days = VALUES(turnover_days)',
      'daily_sales_amount = VALUES(daily_sales_amount)',
      'is_effective_point = VALUES(is_effective_point)',
    ].join(', ');

    return await mysqlClient.batchInsert(
      'inventory_points',
      data,
      updateFields
    );
  }
}

// 单例模式导出
export const adDataDAO = new AdDataDAO();