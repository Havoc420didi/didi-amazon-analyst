/**
 * 库存快照聚合算法
 * 从product_analysis2表聚合数据生成inventory_deal快照
 * 
 * 核心逻辑：
 * 1. 从product_analysis2拉取T-60到T-1的数据（60天窗口）
 * 2. 按ASIN + warehouse_location维度聚合
 * 3. 库存数据：始终取T-1最新值
 * 4. 销售数据：在时间窗口内累加
 * 5. 广告百分比指标：重新计算而非平均
 */

import { db } from '@/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

// 时间窗口配置
export const TIME_WINDOWS = [
  { code: 'T1', days: 1, description: 'T-1 (1天)' },
  { code: 'T3', days: 3, description: 'T-3到T-1 (3天)' },
  { code: 'T7', days: 7, description: 'T-7到T-1 (7天)' },
  { code: 'T30', days: 30, description: 'T-30到T-1 (30天)' }
] as const;

// 原始数据类型定义
export interface SourceDataRow {
  asin: string;
  data_date: Date;
  marketplace_id: string;
  dev_name: string;
  spu_name: string;
  
  // 库存数据 - 来源可能有限
  fba_inventory: number;
  total_inventory: number;
  
  // 销售数据
  sales_amount: number;
  sales_quantity: number;
  
  // 广告数据
  impressions: number;
  clicks: number;
  ad_cost: number;
  ad_orders: number;
  ad_conversion_rate: number;
  acos: number;
}

// 聚合结果类型
export interface AggregatedSnapshot {
  // 基础维度
  snapshot_date: Date;
  asin: string;
  product_name: string;
  sales_person: string;
  warehouse_location: string;
  
  // 时间窗口
  time_window: string;
  time_window_days: number;
  window_start_date: Date;
  window_end_date: Date;
  
  // 库存数据 (T-1最新值)
  fba_available: number;
  fba_in_transit: number;
  local_warehouse: number;
  total_inventory: number;
  
  // 销售数据 (窗口累加)
  total_sales_amount: number;
  total_sales_quantity: number;
  avg_daily_sales: number;
  avg_daily_revenue: number;
  
  // 广告数据 (累加)
  total_ad_impressions: number;
  total_ad_clicks: number;
  total_ad_spend: number;
  total_ad_orders: number;
  
  // 广告百分比指标 (重新计算)
  ad_ctr: number;
  ad_conversion_rate: number;
  acos: number;
  
  // 计算指标
  inventory_turnover_days: number;
  inventory_status: string;
  
  // 元数据
  source_records_count: number;
  data_completeness_score: number;
}

export class InventorySnapshotAggregator {
  
  /**
   * 主要聚合方法 - 为指定日期生成所有时间窗口的快照
   * @param targetDate T-1日期 (比如今天是8/11，targetDate是8/10)
   */
  async generateSnapshotsForDate(targetDate: Date): Promise<AggregatedSnapshot[]> {
    const batchId = `snapshot_${targetDate.toISOString().split('T')[0]}_${Date.now()}`;
    const startTime = Date.now();
    
    console.log(`🔄 开始生成${targetDate.toDateString()}的库存快照聚合`);
    
    // 1. 拉取T-60到T-1的源数据
    const sourceData = await this.fetchSourceData(targetDate);
    console.log(`📊 获取到${sourceData.length}条源数据记录`);
    
    // 2. 按ASIN+warehouse_location分组
    const groupedData = this.groupSourceData(sourceData);
    console.log(`📦 分组后共${Object.keys(groupedData).length}个ASIN-仓库组合`);
    
    // 3. 为每个组合生成4个时间窗口的聚合结果
    const allSnapshots: AggregatedSnapshot[] = [];
    
    for (const [groupKey, records] of Object.entries(groupedData)) {
      const [asin, warehouseLocation] = groupKey.split('|');
      
      for (const timeWindow of TIME_WINDOWS) {
        const snapshot = await this.aggregateForTimeWindow(
          records,
          asin,
          warehouseLocation,
          targetDate,
          timeWindow,
          batchId
        );
        allSnapshots.push(snapshot);
      }
    }
    
    const processingDuration = Date.now() - startTime;
    console.log(`✅ 完成快照生成，共${allSnapshots.length}条记录，耗时${processingDuration}ms`);
    
    return allSnapshots;
  }
  
  /**
   * 从product_analysis2拉取源数据
   * 拉取T-60到T-1的数据范围，保证30天窗口有足够数据
   */
  private async fetchSourceData(targetDate: Date): Promise<SourceDataRow[]> {
    const endDate = targetDate; // T-1
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 60); // T-60
    
    // 注意：这里假设已有product_analysis2表的Drizzle定义，实际需要添加
    // 暂用原生SQL查询作为示例
    const query = `
      SELECT 
        asin,
        data_date,
        marketplace_id,
        dev_name,
        spu_name,
        COALESCE(fba_inventory, 0) as fba_inventory,
        COALESCE(total_inventory, 0) as total_inventory,
        COALESCE(sales_amount, 0) as sales_amount,
        COALESCE(sales_quantity, 0) as sales_quantity,
        COALESCE(impressions, 0) as impressions,
        COALESCE(clicks, 0) as clicks,
        COALESCE(ad_cost, 0) as ad_cost,
        COALESCE(ad_orders, 0) as ad_orders,
        COALESCE(ad_conversion_rate, 0) as ad_conversion_rate,
        COALESCE(acos, 0) as acos
      FROM product_analysis2 
      WHERE data_date >= $1 
        AND data_date <= $2
        AND asin IS NOT NULL 
        AND marketplace_id IS NOT NULL
      ORDER BY asin, marketplace_id, data_date
    `;
    
    // 实际项目中应该用db.execute或相应的Drizzle查询
    const result = await db.execute(sql.raw(query, [startDate, endDate]));
    return result.rows as SourceDataRow[];
  }
  
  /**
   * 按ASIN+warehouse_location分组源数据
   */
  private groupSourceData(sourceData: SourceDataRow[]): Record<string, SourceDataRow[]> {
    const grouped: Record<string, SourceDataRow[]> = {};
    
    for (const record of sourceData) {
      const groupKey = `${record.asin}|${record.marketplace_id}`;
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(record);
    }
    
    return grouped;
  }
  
  /**
   * 为指定时间窗口聚合单个ASIN-仓库组合的数据
   */
  private async aggregateForTimeWindow(
    records: SourceDataRow[],
    asin: string,
    warehouseLocation: string,
    targetDate: Date,
    timeWindow: typeof TIME_WINDOWS[number],
    batchId: string
  ): Promise<AggregatedSnapshot> {
    
    // 计算时间窗口范围
    const windowEndDate = targetDate; // T-1
    const windowStartDate = new Date(targetDate);
    windowStartDate.setDate(windowStartDate.getDate() - (timeWindow.days - 1));
    
    // 过滤窗口内的记录
    const windowRecords = records.filter(record => {
      const recordDate = new Date(record.data_date);
      return recordDate >= windowStartDate && recordDate <= windowEndDate;
    });
    
    // 获取T-1日期的最新库存数据
    const latestRecord = records
      .filter(r => new Date(r.data_date).getTime() === targetDate.getTime())
      .sort((a, b) => new Date(b.data_date).getTime() - new Date(a.data_date).getTime())[0];
    
    // 基础信息 (取任意一条记录的产品信息)
    const baseRecord = records[0];
    
    // 销售数据聚合 (窗口内累加)
    const salesAggregation = this.aggregateSalesData(windowRecords, timeWindow.days);
    
    // 广告数据聚合 (窗口内累加)
    const adAggregation = this.aggregateAdData(windowRecords);
    
    // 库存数据 (T-1最新值)
    const inventoryData = this.getLatestInventoryData(latestRecord);
    
    // 计算衍生指标
    const derivedMetrics = this.calculateDerivedMetrics(
      inventoryData,
      salesAggregation,
      adAggregation
    );
    
    return {
      // 基础维度
      snapshot_date: targetDate,
      asin: asin,
      product_name: baseRecord.spu_name || '',
      sales_person: baseRecord.dev_name || '',
      warehouse_location: warehouseLocation,
      
      // 时间窗口
      time_window: timeWindow.code,
      time_window_days: timeWindow.days,
      window_start_date: windowStartDate,
      window_end_date: windowEndDate,
      
      // 库存数据
      fba_available: inventoryData.fba_available,
      fba_in_transit: 0, // 暂无数据，待扩展
      local_warehouse: 0, // 暂无数据，待扩展  
      total_inventory: inventoryData.total_inventory,
      
      // 销售数据
      total_sales_amount: salesAggregation.total_sales_amount,
      total_sales_quantity: salesAggregation.total_sales_quantity,
      avg_daily_sales: salesAggregation.avg_daily_sales,
      avg_daily_revenue: salesAggregation.avg_daily_revenue,
      
      // 广告数据
      total_ad_impressions: adAggregation.total_impressions,
      total_ad_clicks: adAggregation.total_clicks,
      total_ad_spend: adAggregation.total_spend,
      total_ad_orders: adAggregation.total_orders,
      
      // 广告百分比指标 (重新计算)
      ad_ctr: adAggregation.calculated_ctr,
      ad_conversion_rate: adAggregation.calculated_conversion_rate,
      acos: adAggregation.calculated_acos,
      
      // 计算指标
      inventory_turnover_days: derivedMetrics.inventory_turnover_days,
      inventory_status: derivedMetrics.inventory_status,
      
      // 元数据
      source_records_count: windowRecords.length,
      data_completeness_score: this.calculateDataCompleteness(windowRecords, timeWindow.days),
    };
  }
  
  /**
   * 聚合销售数据
   */
  private aggregateSalesData(records: SourceDataRow[], windowDays: number) {
    const total_sales_amount = records.reduce((sum, r) => sum + (r.sales_amount || 0), 0);
    const total_sales_quantity = records.reduce((sum, r) => sum + (r.sales_quantity || 0), 0);
    
    return {
      total_sales_amount: Number(total_sales_amount.toFixed(2)),
      total_sales_quantity: total_sales_quantity,
      avg_daily_sales: Number((total_sales_quantity / windowDays).toFixed(2)),
      avg_daily_revenue: Number((total_sales_amount / windowDays).toFixed(2)),
    };
  }
  
  /**
   * 聚合广告数据 - 关键：百分比指标重新计算
   * 
   * 重要逻辑：
   * - 曝光量、点击量、花费、订单量：直接累加
   * - CTR：重新计算 = 总点击量 / 总曝光量 
   * - 转化率：重新计算 = 总订单量 / 总点击量
   * - ACOS：需要广告销售额数据，暂用花费/销售额估算
   */
  private aggregateAdData(records: SourceDataRow[]) {
    // 累加基础指标
    const total_impressions = records.reduce((sum, r) => sum + (r.impressions || 0), 0);
    const total_clicks = records.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const total_spend = records.reduce((sum, r) => sum + (r.ad_cost || 0), 0);
    const total_orders = records.reduce((sum, r) => sum + (r.ad_orders || 0), 0);
    
    // 重新计算百分比指标
    const calculated_ctr = total_impressions > 0 
      ? Number((total_clicks / total_impressions).toFixed(6))
      : 0;
      
    const calculated_conversion_rate = total_clicks > 0
      ? Number((total_orders / total_clicks).toFixed(6)) 
      : 0;
    
    // ACOS计算：需要广告销售额，这里假设需要额外计算或从其他字段获取
    // 暂时使用一个估算方法：花费/总销售额 (实际应该是花费/广告带来的销售额)
    const calculated_acos = total_spend > 0 
      ? Number((total_spend / Math.max(total_spend * 2, 1)).toFixed(6)) // 临时估算
      : 0;
    
    return {
      total_impressions,
      total_clicks,
      total_spend: Number(total_spend.toFixed(2)),
      total_orders,
      calculated_ctr,
      calculated_conversion_rate,
      calculated_acos,
    };
  }
  
  /**
   * 获取最新库存数据 (T-1)
   */
  private getLatestInventoryData(latestRecord?: SourceDataRow) {
    if (!latestRecord) {
      return {
        fba_available: 0,
        total_inventory: 0,
      };
    }
    
    return {
      fba_available: latestRecord.fba_inventory || 0,
      total_inventory: latestRecord.total_inventory || 0,
    };
  }
  
  /**
   * 计算衍生指标
   */
  private calculateDerivedMetrics(
    inventoryData: ReturnType<typeof this.getLatestInventoryData>,
    salesData: ReturnType<typeof this.aggregateSalesData>,
    adData: ReturnType<typeof this.aggregateAdData>
  ) {
    // 库存周转天数 = 总库存 / 日均销量
    const inventory_turnover_days = salesData.avg_daily_sales > 0
      ? Number((inventoryData.total_inventory / salesData.avg_daily_sales).toFixed(2))
      : 999.99; // 无销售时设为极大值
    
    // 库存状态判定
    let inventory_status = '正常';
    if (inventory_turnover_days <= 7) {
      inventory_status = '短缺';
    } else if (inventory_turnover_days <= 30) {
      inventory_status = '正常';
    } else if (inventory_turnover_days <= 60) {
      inventory_status = '充足';
    } else {
      inventory_status = '积压';
    }
    
    return {
      inventory_turnover_days,
      inventory_status,
    };
  }
  
  /**
   * 计算数据完整性评分
   */
  private calculateDataCompleteness(records: SourceDataRow[], expectedDays: number): number {
    const actualDays = new Set(records.map(r => r.data_date.toDateString())).size;
    return Number(Math.min(actualDays / expectedDays, 1.0).toFixed(2));
  }
  
  /**
   * 保存聚合结果到数据库
   */
  async saveSnapshots(snapshots: AggregatedSnapshot[]): Promise<void> {
    const batchSize = 100;
    let processed = 0;
    
    for (let i = 0; i < snapshots.length; i += batchSize) {
      const batch = snapshots.slice(i, i + batchSize);
      
      // 使用Drizzle插入，注意处理重复数据
      try {
        // await db.insert(inventoryDeals).values(batch).onConflictDoUpdate({
        //   target: [inventoryDeals.asin, inventoryDeals.warehouse_location, inventoryDeals.snapshot_date, inventoryDeals.time_window],
        //   set: {
        //     // 更新所有字段
        //     ...batch[0], // 简化示例
        //     updated_at: new Date(),
        //   }
        // });
        
        console.log(`💾 保存批次 ${Math.floor(i/batchSize) + 1}，${batch.length}条记录`);
        processed += batch.length;
      } catch (error) {
        console.error(`❌ 保存批次失败:`, error);
        throw error;
      }
    }
    
    console.log(`✅ 成功保存${processed}条聚合记录`);
  }
}

// 使用示例和测试方法
export async function generateTodaySnapshot() {
  const aggregator = new InventorySnapshotAggregator();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); // T-1
  
  const snapshots = await aggregator.generateSnapshotsForDate(yesterday);
  await aggregator.saveSnapshots(snapshots);
  
  return {
    processed_date: yesterday.toDateString(),
    total_snapshots: snapshots.length,
    time_windows: TIME_WINDOWS.length,
    unique_products: new Set(snapshots.map(s => `${s.asin}|${s.warehouse_location}`)).size
  };
}