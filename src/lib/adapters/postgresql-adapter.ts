/**
 * PostgreSQL数据库适配器
 * 替换现有的MySQL适配器，支持AI分析功能
 */

import { PostgreSQLManager } from '@/sync/saihu-erp/database/postgresql-connection';
import { 
  InventoryPoint, 
  ProductAnalytics, 
  InventoryQueryParams, 
  PaginatedInventoryResponse,
  InventoryAggregationParams,
  AggregateDataResult
} from '@/types/inventory';

export class PostgreSQLAdapter {
  private pgManager: PostgreSQLManager;
  
  constructor() {
    this.pgManager = new PostgreSQLManager();
  }

  /**
   * 获取库存点数据（适配DataAggregationService）
   */
  async getInventoryPoints(params: InventoryQueryParams): Promise<PaginatedInventoryResponse> {
    const {
      asin,
      marketplace,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'data_date',
      sortOrder = 'desc'
    } = params;

    try {
      // 构建查询条件
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (asin) {
        conditions.push(`asin = $${paramIndex++}`);
        values.push(asin);
      }

      if (marketplace) {
        conditions.push(`marketplace = $${paramIndex++}`);
        values.push(marketplace);
      }

      if (startDate) {
        conditions.push(`data_date >= $${paramIndex++}`);
        values.push(startDate);
      }

      if (endDate) {
        conditions.push(`data_date <= $${paramIndex++}`);
        values.push(endDate);
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total_count
        FROM inventory_points ${whereClause}
      `;
      const totalResult = await this.pgManager.execute_single(countQuery, values);
      const totalCount = Number(totalResult?.total_count) || 0;

      // 主查询
      const offset = (page - 1) * limit;
      const safeValues = [...values, limit, offset];
      
      const query = `
        SELECT 
          asin,
          product_name,
          sales_person,
          marketplace,
          data_date,
          total_inventory,
          fba_available,
          fba_in_transit,
          local_available,
          average_sales,
          daily_sales_amount,
          average_price,
          turnover_days,
          ad_impressions,
          ad_clicks,
          ad_spend,
          ad_order_count,
          CASE
            WHEN total_inventory <= 0 THEN TRUE ELSE FALSE
          END as is_out_of_stock,
          CASE  
            WHEN turnover_days <= 45 THEN TRUE ELSE FALSE
          END as is_low_inventory,
          CASE
            WHEN turnover_days >= 90 THEN TRUE ELSE FALSE
          END as is_turnover_exceeded,
          CASE
            WHEN daily_sales_amount >= 16.7 THEN TRUE ELSE FALSE
          END as is_effective_inventory_point,
          product_tag,
          fba_sellable
        FROM inventory_points 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder.toUpperCase()}, id ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const results = await this.pgManager.execute_query(query, safeValues);

      // 转换数据格式
      const data = results.map(row => this.mapInventoryPointFromDb(row));

      return {
        data,
        pagination: {
          page,
          limit,
          total: totalCount,
          total_pages: Math.ceil(totalCount / limit)
        }
      };

    } catch (error) {
      console.error('PostgreSQL inventory points query error:', error);
      throw new Error(`Inventory points query failed: ${error}`);
    }
  }

  /**
   * 获取单条最新记录（用于DataAggregationService）
   */
  async getLatestInventoryPoint(asin: string, marketplace: string): Promise<InventoryPoint | null> {
    try {
      const query = `
        SELECT 
          asin,
          product_name,
          sales_person,
          marketplace,
          data_date,
          total_inventory,
          fba_available,
          fba_in_transit,
          local_available,
          average_sales,
          daily_sales_amount,
          turnover_days,
          CASE
            WHEN total_inventory <= 0 THEN '断货'
            WHEN turnover_days <= 45 THEN '库存不足'
            WHEN turnover_days >= 90 THEN '周转超标'
            ELSE '库存健康'
          END as inventory_status,
          ad_impressions,
          ad_clicks,
          ad_spend,
          ad_order_count,
          CASE 
            WHEN ad_impressions > 0 THEN (ad_clicks::numeric / ad_impressions) 
            ELSE 0
          END as ad_ctr,
          CASE
            WHEN ad_clicks > 0 THEN (ad_order_count::numeric / ad_clicks)
            ELSE 0 
          END as ad_conversion_rate,
          CASE
            WHEN daily_sales_amount * 7 > 0 THEN (ad_spend / (daily_sales_amount * 7))
            ELSE 0
          END as acos
        FROM inventory_points  
        WHERE asin = $1 AND marketplace = $2
        ORDER BY data_date DESC 
        LIMIT 1
      `;

      const result = await this.pgManager.execute_single(query, [asin, marketplace]);
      
      if (!result) return null;
      return this.mapInventoryPointFromDb(result);
      
    } catch (error) {
      console.error('PostgreSQL get latest inventory point error:', error);
      throw error;
    }
  }

  /**
   * 聚合多日数据 (用于数据聚合服务)
   */
  async aggregateInventoryData(params: InventoryAggregationParams): Promise<AggregateDataResult> {
    try {
      const {
        asin,
        marketplace,
        days,
        endDate,
        method = 'average'
      } = params;

      const actualEndDate = endDate || new Date().toISOString().split('T')[0];
      const startDate = this.calculateStartDate(actualEndDate, days);

      const query = this.buildAggregationQuery(method, asin, marketplace, startDate, actualEndDate);
      
      const result = await this.pgManager.execute_single(query, [
        asin,
        marketplace,
        startDate,
        actualEndDate,
        days
      ]);

      if (!result) {
        throw new Error(`No data found for ASIN ${asin} in ${marketplace} between ${startDate} and ${actualEndDate}`);
      }

      return {
        asin: result.asin,
        product_name: result.product_name,
        warehouse_location: result.marketplace,
        sales_person: result.sales_person || '未分配',
        
        total_inventory: this.getAggregatedValue(result.total_inventory, method),
        fba_available: this.getAggregatedValue(result.fba_available, method),
        local_warehouse: this.getAggregatedValue(result.local_warehouse, method),
        avg_sales: this.getAggregatedValue(result.average_sales, method),
        daily_revenue: this.getAggregatedValue(result.daily_sales_amount, method),
        inventory_turnover_days: this.calculateTurnoverDays(
          this.getAggregatedValue(result.total_inventory, method),
          this.getAggregatedValue(result.average_sales, method)
        ),
        
        ad_impressions: this.getAggregatedValue(result.ad_impressions, method),
        ad_clicks: this.getAggregatedValue(result.ad_clicks, method),
        ad_spend: this.getAggregatedValue(result.ad_spend, method),
        ad_orders: this.getAggregatedValue(result.ad_order_count, method),
        
        trends: {
          inventory_change: parseFloat(result.inventory_trend_pct || '0'),
          revenue_change: parseFloat(result.revenue_trend_pct || '0'),
          sales_change: parseFloat(result.sales_trend_pct || '0')
        },
        
        history: result.history_data || []
      };

    } catch (error) {
      console.error('PostgreSQL aggregation query error:', error);
      throw error;
    }
  }

  /**
   * 获取历史数据
   */
  async getHistoryData(asin: string, marketplace: string, limit: number = 10) {
    try {
      const query = `
        SELECT 
          data_date as date,
          total_inventory as inventory,
          daily_sales_amount as revenue,
          average_sales as sales,
          ROUND(ad_spend::numeric, 2) as ad_spend,
          ROUND(ad_impressions::numeric, 2) as ad_impressions,
          ROUND(ad_clicks::numeric, 2) as ad_clicks
        FROM inventory_points 
        WHERE asin = $1 AND marketplace = $2
          AND data_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY data_date DESC
        LIMIT $3
      `;

      const results = await this.pgManager.execute_query(query, [asin, marketplace, limit]);
      
      return results.map(row => ({
        date: row.date,
        inventory: parseInt(row.inventory),
        revenue: parseFloat(row.revenue),
        sales: parseFloat(row.sales),
        ad_spend: parseFloat(row.ad_spend),
        ad_impressions: parseInt(row.ad_impressions),
        ad_clicks: parseInt(row.ad_clicks)
      }));

    } catch (error) {
      console.error('PostgreSQL history data error:', error);
      throw error;
    }
  }

  /**
   * 连接测试
   */
  async testConnection(): Promise<boolean> {
    try {
      return await this.pgManager.test_connection();
    } catch (error) {
      console.error('PostgreSQL connection test failed:', error);
      return false;
    }
  }

  /**
   * 性能监控
   */
  async getConnectionStats(): Promise<any> {
    return this.pgManager.get_connection_info();
  }

  /**
   * 私有方法：构建聚合查询
   */
  private buildAggregationQuery(method: string, asin: string, marketplace: string, startDate: string, endDate: string): string {
    const aggregations = {
      'latest': `FIRST_VALUE(column_name) OVER (PARTITION BY asin, marketplace ORDER BY data_date DESC)`,
      'average': 'AVG(column_name)',
      'sum': 'SUM(column_name)',
      'trend': 'AVG(column_name)'  -- 带权重的平均值
    };

    const aggMethod = aggregations[method as keyof typeof aggregations] || aggregations.average;

    return `
      SELECT 
        asin,
        ${method === 'latest' ? 'product_name' : 'MAX(product_name)'} as product_name,
        ${method === 'latest' ? 'sales_person' : 'MAX(sales_person)'} as sales_person,
        marketplace,
        
        ${aggMethod.replace('column_name', 'total_inventory')} as total_inventory,
        ${aggMethod.replace('column_name', 'fba_available')} as fba_available,
        ${aggMethod.replace('column_name', 'local_available')} as local_warehouse,
        ${aggMethod.replace('column_name', 'average_sales')} as average_sales,
        ${aggMethod.replace('column_name', 'daily_sales_amount')} as daily_sales_amount,
        ${aggMethod.replace('column_name', 'ad_impressions')} as ad_impressions,
        ${aggMethod.replace('column_name', 'ad_clicks')} as ad_clicks,
        ${aggMethod.replace('column_name', 'ad_spend')} as ad_spend,
        ${aggMethod.replace('column_name', 'ad_order_count')} as ad_order_count,
        
        -- 趋势百分比
        (MAX(daily_sales_amount) - MIN(daily_sales_amount)) / 
        NULLIF(MIN(daily_sales_amount), 0) * 100 as sales_trend_pct,
        (MAX(total_inventory) - MIN(total_inventory)) /
        NULLIF(MIN(total_inventory), 0) * 100 as inventory_trend_pct,
        (MAX(daily_sales_amount) - MIN(daily_sales_amount)) / 
        NULLIF(MIN(daily_sales_amount), 0) * 100 as revenue_trend_pct,
        
        -- 历史JSON结构
        COALESCE(json_agg(json_build_object(
          'date', data_date,
          'inventory', total_inventory,
          'revenue', daily_sales_amount, 
          'sales', average_sales
        )) FILTER (WHERE data_date IS NOT NULL ORDER BY data_date DESC), '[{}]') as history_data,
        
        COUNT(*) as data_points_count,
        MIN(data_date) as start_date,
        MAX(data_date) as end_date

      FROM inventory_points 
      WHERE asin = $1 AND marketplace = $2
        AND data_date BETWEEN $3 AND $4
      GROUP BY asin, marketplace;
    `;
  }

  /**
   * 私有方法：数据映射转换
   */
  private mapInventoryPointFromDb(row: any): InventoryPoint {
    return {
      asin: row.asin,
      productName: row.product_name,
      salesPerson: row.sales_person || '未分配',
      marketplace: row.marketplace,
      totalInventory: parseInt(row.total_inventory) || 0,
      fbaAvailable: parseInt(row.fba_available) || 0,
      fbaInbound: parseInt(row.fba_in_transit) || 0,
      localAvailable: parseInt(row.local_available) || 0,
      averageSales: parseFloat(row.average_sales) || 0,
      dailySalesAmount: parseFloat(row.daily_sales_amount) || 0,
      turnoverDays: parseFloat(row.turnover_days) || 0,
      adImpressions: parseInt(row.ad_impressions) || 0,
      adClicks: parseInt(row.ad_clicks) || 0,
      adSpend: parseFloat(row.ad_spend) || 0,
      adOrderCount: parseInt(row.ad_order_count) || 0,
      dataDate: row.data_date ? new Date(row.data_date) : new Date()
    };
  }

  private calculateStartDate(endDate: string, days: number): string {
    const end = new Date(endDate);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    return start.toISOString().split('T')[0];
  }

  private calculateTurnoverDays(totalInventory: number, averageSales: number): number {
    return averageSales > 0 ? totalInventory / averageSales : 999;
  }

  private getAggregatedValue(value: string, method: string): number {
    if (!value) return 0;
    
    switch (method) {
      case 'latest':
      case 'average':
        return parseFloat(value);
      case 'sum':
        return parseFloat(value);
      default:
        return parseFloat(value);
    }
  }

  /**
   * 数据源统计检查
   */
  async getDataStats(): Promise<{
    total_inventory_points: number;
    total_products: number;
    unique_marketplaces: string[];
    date_range: { min_date: string; max_date: string };
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_inventory_points,
          COUNT(DISTINCT asin) as total_products,
          ARRAY_AGG(DISTINCT marketplace) as unique_marketplaces,
          MIN(data_date) as min_date,
          MAX(data_date) as max_date
        FROM inventory_points
      `;

      const result = await this.pgManager.execute_single(query);
      
      return {
        total_inventory_points: parseInt(result.total_inventory_points),
        total_products: parseInt(result.total_products),
        unique_marketplaces: result.unique_marketplaces || [],
        date_range: {
          min_date: result.min_date,
          max_date: result.max_date
        }
      };

    } catch (error) {
      console.error('PostgreSQL data stats error:', error);
      throw error;
    }
  }
}

// 导出单例
export default new PostgreSQLAdapter();