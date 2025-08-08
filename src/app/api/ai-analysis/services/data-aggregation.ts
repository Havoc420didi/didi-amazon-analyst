/**
 * 数据聚合服务 - 支持多日数据聚合分析
 * 实现不同时间维度的数据聚合逻辑
 */

import { SaiHuAdapter } from '@/lib/adapters/saihu-adapter';
import { ProductAnalysisData, AnalysisPeriod } from '@/types/ai-analysis';

export class DataAggregationService {
  private static saiHuAdapter = new SaiHuAdapter();

  /**
   * 聚合多日数据生成分析数据
   */
  static async aggregateMultiDayData(
    asin: string,
    warehouseLocation: string,
    analysisPeriod: AnalysisPeriod
  ): Promise<ProductAnalysisData> {
    const endDate = analysisPeriod.end_date || new Date().toISOString().split('T')[0];
    const startDate = this.calculateStartDate(endDate, analysisPeriod.days);

    // 从MySQL数据源获取指定时间范围内的所有数据
    const result = await this.saiHuAdapter.getInventoryPoints({
      asin,
      marketplace: warehouseLocation,
      startDate,
      endDate,
      page: 1,
      limit: 100 // 获取足够多的历史数据
    });

    if (!result.data || result.data.length === 0) {
      throw new Error(`在${startDate}到${endDate}期间未找到ASIN ${asin}的数据`);
    }

    // 转换数据格式
    const records = result.data.map(point => ({
      asin: point.asin,
      product_name: point.productName,
      warehouse_location: point.marketplace,
      sales_person: point.salesPerson || '未分配',
      date: point.dataDate,
      fba_available: point.inventory.fbaAvailable,
      fba_in_transit: point.inventory.fbaInbound,
      local_warehouse: point.inventory.localAvailable,
      total_inventory: point.inventory.total,
      avg_sales: point.sales.averageSales,
      daily_revenue: point.sales.dailySalesAmount,
      inventory_turnover_days: point.sales.turnoverDays,
      inventory_status: point.status.isOutOfStock ? '库存不足' : 
                       point.status.isTurnoverExceeded ? '周转超标' : '周转合格',
      ad_impressions: point.advertising.impressions,
      ad_clicks: point.advertising.clicks,
      ad_spend: point.advertising.spend,
      ad_orders: point.advertising.orders,
      ad_ctr: point.advertising.ctr,
      ad_conversion_rate: point.advertising.cvr,
      acos: point.advertising.acoas,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // 按聚合方法处理数据
    const aggregatedData = this.processAggregation(records, analysisPeriod);
    
    // 生成质量评估
    const qualityAssessment = this.assessDataQuality(records, analysisPeriod.days);

    // 构建最终的分析数据
    return {
      // 基本信息（取最新记录）
      asin: records[0].asin,
      product_name: records[0].product_name,
      warehouse_location: records[0].warehouse_location,
      sales_person: records[0].sales_person,

      // 聚合后的核心指标
      ...aggregatedData,

      // 趋势分析
      trends: this.calculateTrends(records),

      // 历史数据
      history: records.map(record => ({
        date: record.date,
        inventory: record.total_inventory,
        revenue: parseFloat(record.daily_revenue.toString()),
        sales: parseFloat(record.avg_sales.toString())
      })),

      // 聚合元数据
      aggregation_metadata: {
        analysis_period: analysisPeriod,
        data_points_count: records.length,
        date_range: {
          start_date: startDate,
          end_date: endDate
        },
        aggregation_quality: qualityAssessment.quality,
        missing_days: qualityAssessment.missingDays
      }
    };
  }

  /**
   * 根据聚合方法处理数据
   */
  private static processAggregation(
    records: any[], 
    period: AnalysisPeriod
  ): Partial<ProductAnalysisData> {
    const sortedRecords = records.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    switch (period.aggregation_method) {
      case 'latest':
        return this.getLatestValues(sortedRecords);
      
      case 'average':
        return this.getAverageValues(sortedRecords);
      
      case 'sum':
        return this.getSummedValues(sortedRecords);
      
      case 'trend':
        return this.getTrendBasedValues(sortedRecords);
      
      default:
        return this.getAverageValues(sortedRecords);
    }
  }

  /**
   * 最新值聚合（取最近一天的数据）
   */
  private static getLatestValues(records: any[]): Partial<ProductAnalysisData> {
    const latest = records[0];
    return {
      total_inventory: latest.total_inventory,
      fba_available: latest.fba_available,
      fba_in_transit: latest.fba_in_transit,
      local_warehouse: latest.local_warehouse,
      avg_sales: parseFloat(latest.avg_sales.toString()),
      daily_revenue: parseFloat(latest.daily_revenue.toString()),
      inventory_turnover_days: latest.inventory_turnover_days ? 
        parseFloat(latest.inventory_turnover_days.toString()) : undefined,
      inventory_status: latest.inventory_status || undefined,
      ad_impressions: latest.ad_impressions,
      ad_clicks: latest.ad_clicks,
      ad_spend: parseFloat(latest.ad_spend.toString()),
      ad_orders: latest.ad_orders,
      ad_ctr: latest.ad_ctr ? parseFloat(latest.ad_ctr.toString()) : undefined,
      ad_conversion_rate: latest.ad_conversion_rate ? 
        parseFloat(latest.ad_conversion_rate.toString()) : undefined,
      acos: latest.acos ? parseFloat(latest.acos.toString()) : undefined
    };
  }

  /**
   * 平均值聚合
   */
  private static getAverageValues(records: any[]): Partial<ProductAnalysisData> {
    const count = records.length;
    const latest = records[0]; // 取最新的库存状态
    
    return {
      // 库存数据取最新
      total_inventory: latest.total_inventory,
      fba_available: latest.fba_available,
      fba_in_transit: latest.fba_in_transit,
      local_warehouse: latest.local_warehouse,
      inventory_status: latest.inventory_status || undefined,
      
      // 销售和广告数据取平均
      avg_sales: this.average(records.map(r => parseFloat(r.avg_sales.toString()))),
      daily_revenue: this.average(records.map(r => parseFloat(r.daily_revenue.toString()))),
      inventory_turnover_days: this.average(
        records.map(r => r.inventory_turnover_days ? 
          parseFloat(r.inventory_turnover_days.toString()) : 0
        ).filter(v => v > 0)
      ),
      ad_impressions: Math.round(this.average(records.map(r => r.ad_impressions))),
      ad_clicks: Math.round(this.average(records.map(r => r.ad_clicks))),
      ad_spend: this.average(records.map(r => parseFloat(r.ad_spend.toString()))),
      ad_orders: Math.round(this.average(records.map(r => r.ad_orders))),
      ad_ctr: this.average(
        records.map(r => r.ad_ctr ? parseFloat(r.ad_ctr.toString()) : 0)
          .filter(v => v > 0)
      ),
      ad_conversion_rate: this.average(
        records.map(r => r.ad_conversion_rate ? 
          parseFloat(r.ad_conversion_rate.toString()) : 0
        ).filter(v => v > 0)
      ),
      acos: this.average(
        records.map(r => r.acos ? parseFloat(r.acos.toString()) : 0)
          .filter(v => v > 0)
      )
    };
  }

  /**
   * 求和聚合（适用于累积指标）
   */
  private static getSummedValues(records: any[]): Partial<ProductAnalysisData> {
    const latest = records[0];
    const count = records.length;
    
    return {
      // 库存数据取最新
      total_inventory: latest.total_inventory,
      fba_available: latest.fba_available,
      fba_in_transit: latest.fba_in_transit,
      local_warehouse: latest.local_warehouse,
      inventory_status: latest.inventory_status || undefined,
      
      // 销售数据按期间累积，然后求日均
      avg_sales: this.sum(records.map(r => parseFloat(r.avg_sales.toString()))) / count,
      daily_revenue: this.sum(records.map(r => parseFloat(r.daily_revenue.toString()))) / count,
      inventory_turnover_days: latest.inventory_turnover_days ? 
        parseFloat(latest.inventory_turnover_days.toString()) : undefined,
      
      // 广告数据累积求和
      ad_impressions: this.sum(records.map(r => r.ad_impressions)),
      ad_clicks: this.sum(records.map(r => r.ad_clicks)),
      ad_spend: this.sum(records.map(r => parseFloat(r.ad_spend.toString()))),
      ad_orders: this.sum(records.map(r => r.ad_orders)),
      
      // 比率数据取平均
      ad_ctr: this.average(
        records.map(r => r.ad_ctr ? parseFloat(r.ad_ctr.toString()) : 0)
          .filter(v => v > 0)
      ),
      ad_conversion_rate: this.average(
        records.map(r => r.ad_conversion_rate ? 
          parseFloat(r.ad_conversion_rate.toString()) : 0
        ).filter(v => v > 0)
      ),
      acos: this.average(
        records.map(r => r.acos ? parseFloat(r.acos.toString()) : 0)
          .filter(v => v > 0)
      )
    };
  }

  /**
   * 趋势加权聚合（近期数据权重更高）
   */
  private static getTrendBasedValues(records: any[]): Partial<ProductAnalysisData> {
    const latest = records[0];
    const sortedRecords = records.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // 生成权重：最新数据权重最高，呈指数递减
    const weights = sortedRecords.map((_, index) => Math.exp(-index * 0.3));
    const totalWeight = this.sum(weights);
    
    return {
      // 库存数据取最新
      total_inventory: latest.total_inventory,
      fba_available: latest.fba_available,
      fba_in_transit: latest.fba_in_transit,
      local_warehouse: latest.local_warehouse,
      inventory_status: latest.inventory_status || undefined,
      
      // 加权平均
      avg_sales: this.weightedAverage(
        sortedRecords.map(r => parseFloat(r.avg_sales.toString())),
        weights,
        totalWeight
      ),
      daily_revenue: this.weightedAverage(
        sortedRecords.map(r => parseFloat(r.daily_revenue.toString())),
        weights,
        totalWeight
      ),
      inventory_turnover_days: this.weightedAverage(
        sortedRecords.map(r => r.inventory_turnover_days ? 
          parseFloat(r.inventory_turnover_days.toString()) : 0
        ).filter(v => v > 0),
        weights.slice(0, sortedRecords.filter(r => r.inventory_turnover_days).length),
        this.sum(weights.slice(0, sortedRecords.filter(r => r.inventory_turnover_days).length))
      ),
      ad_impressions: Math.round(this.weightedAverage(
        sortedRecords.map(r => r.ad_impressions),
        weights,
        totalWeight
      )),
      ad_clicks: Math.round(this.weightedAverage(
        sortedRecords.map(r => r.ad_clicks),
        weights,
        totalWeight
      )),
      ad_spend: this.weightedAverage(
        sortedRecords.map(r => parseFloat(r.ad_spend.toString())),
        weights,
        totalWeight
      ),
      ad_orders: Math.round(this.weightedAverage(
        sortedRecords.map(r => r.ad_orders),
        weights,
        totalWeight
      )),
      ad_ctr: this.weightedAverage(
        sortedRecords.map(r => r.ad_ctr ? parseFloat(r.ad_ctr.toString()) : 0)
          .filter(v => v > 0),
        weights.slice(0, sortedRecords.filter(r => r.ad_ctr).length),
        this.sum(weights.slice(0, sortedRecords.filter(r => r.ad_ctr).length))
      ),
      ad_conversion_rate: this.weightedAverage(
        sortedRecords.map(r => r.ad_conversion_rate ? 
          parseFloat(r.ad_conversion_rate.toString()) : 0
        ).filter(v => v > 0),
        weights.slice(0, sortedRecords.filter(r => r.ad_conversion_rate).length),
        this.sum(weights.slice(0, sortedRecords.filter(r => r.ad_conversion_rate).length))
      ),
      acos: this.weightedAverage(
        sortedRecords.map(r => r.acos ? parseFloat(r.acos.toString()) : 0)
          .filter(v => v > 0),
        weights.slice(0, sortedRecords.filter(r => r.acos).length),
        this.sum(weights.slice(0, sortedRecords.filter(r => r.acos).length))
      )
    };
  }

  /**
   * 计算趋势数据
   */
  private static calculateTrends(records: any[]) {
    if (records.length < 2) {
      return {
        inventory_change: 0,
        revenue_change: 0,
        sales_change: 0
      };
    }

    const sortedRecords = records.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const oldest = sortedRecords[0];
    const newest = sortedRecords[sortedRecords.length - 1];

    return {
      inventory_change: this.calculatePercentageChange(
        oldest.total_inventory,
        newest.total_inventory
      ),
      revenue_change: this.calculatePercentageChange(
        parseFloat(oldest.daily_revenue.toString()),
        parseFloat(newest.daily_revenue.toString())
      ),
      sales_change: this.calculatePercentageChange(
        parseFloat(oldest.avg_sales.toString()),
        parseFloat(newest.avg_sales.toString())
      )
    };
  }

  /**
   * 评估数据质量
   */
  private static assessDataQuality(records: any[], expectedDays: number) {
    const actualDays = records.length;
    const completeness = actualDays / expectedDays;
    
    // 检查缺失的日期
    const recordDates = new Set(records.map(r => r.date));
    const missingDays: string[] = [];
    
    const endDate = new Date(Math.max(...records.map(r => new Date(r.date).getTime())));
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - expectedDays + 1);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!recordDates.has(dateStr)) {
        missingDays.push(dateStr);
      }
    }

    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    if (completeness >= 0.9) quality = 'excellent';
    else if (completeness >= 0.7) quality = 'good';
    else if (completeness >= 0.5) quality = 'fair';
    else quality = 'poor';

    return { quality, missingDays };
  }

  /**
   * 工具方法
   */
  private static calculateStartDate(endDate: string, days: number): string {
    const end = new Date(endDate);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    return start.toISOString().split('T')[0];
  }

  private static average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private static sum(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0);
  }

  private static weightedAverage(values: number[], weights: number[], totalWeight: number): number {
    if (values.length === 0 || weights.length === 0 || totalWeight === 0) return 0;
    const weightedSum = values.reduce((sum, value, index) => 
      sum + (value * (weights[index] || 0)), 0
    );
    return weightedSum / totalWeight;
  }

  private static calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }
}

export default DataAggregationService;