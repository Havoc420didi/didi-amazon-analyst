/**
 * 赛狐数据适配器
 * 将 sync_saihu_erp 数据库的数据适配为 total_project 前端所需的格式
 */

import { adDataDAO, type InventoryPointData, type ProductAnalyticsData } from '@/lib/database/ad-data-dao';
import { DataTransformer } from './data-transformer';

// 前端展示数据模型
export interface AdMetrics {
  // 基础指标
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;       // 广告订单量
  
  // 计算指标
  ctr: number;          // 点击率 (%)
  cvr: number;          // 转化率 (%)
  cpc: number;          // 平均点击成本
  roas: number;         // 投资回报率
  acoas: number;        // 广告成本占销售比 (%)
  
  // 趋势数据
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
}

export interface InventoryPoint {
  id: number;
  asin: string;
  productName: string;
  sku?: string;
  marketplace: string;
  salesPerson?: string;
  
  // 库存信息
  inventory: {
    fbaAvailable: number;
    fbaInbound: number;
    localAvailable: number;
    total: number;
  };
  
  // 销售信息
  sales: {
    sales7Days: number;
    averageSales: number;
    dailySalesAmount: number;
    turnoverDays: number;
  };
  
  // 广告信息
  advertising: AdMetrics;
  
  // 状态标识
  status: {
    isEffective: boolean;
    isTurnoverExceeded: boolean;
    isOutOfStock: boolean;
    isLowInventory: boolean;
    isZeroSales: boolean;
  };
  
  // 合并信息
  mergeInfo?: {
    type: string;
    storeCount: number;
    mergedStores?: string[];
  };
  
  dataDate: string;
}

export interface AdDashboardData {
  summary: {
    totalProducts: number;
    totalInventoryPoints: number;
    totalInventory: number;
    totalDailySales: number;
    totalAdSpend: number;
    averageMetrics: AdMetrics;
  };
  
  trends: Array<{
    date: string;
    metrics: AdMetrics;
  }>;
  
  distribution: Array<{
    marketplace: string;
    pointCount: number;
    inventory: number;
    dailySales: number;
    adSpend: number;
    averageMetrics: AdMetrics;
  }>;
  
  inventoryPoints: InventoryPoint[];
}

export interface SyncStatus {
  taskType: string;
  lastSyncDate: string;
  status: 'running' | 'success' | 'failed' | 'timeout';
  duration: number;
  recordsProcessed: number;
  errorMessage?: string;
}

export class SaiHuAdapter {
  private transformer = new DataTransformer();

  /**
   * 获取广告数据看板信息
   */
  async getAdDashboard(filter: {
    asin?: string;
    marketplace?: string;
    salesPerson?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<AdDashboardData> {
    try {
      // 并行获取各类数据
      const [summaryResult, trendsResult, distributionResult, pointsResult] = await Promise.all([
        this.getAdSummary(filter),
        this.getAdTrends(filter),
        this.getAdDistribution(),
        this.getInventoryPoints(filter),
      ]);

      return {
        summary: summaryResult,
        trends: trendsResult,
        distribution: distributionResult,
        inventoryPoints: pointsResult.data,
      };
    } catch (error) {
      console.error('获取广告看板数据失败:', error);
      throw new Error('获取广告看板数据失败');
    }
  }

  /**
   * 获取广告数据汇总
   */
  async getAdSummary(filter: {
    asin?: string;
    marketplace?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<AdDashboardData['summary']> {
    const result = await adDataDAO.getAdMetricsSummary({
      asin: filter.asin,
      marketplace: filter.marketplace,
      start_date: filter.startDate,
      end_date: filter.endDate,
    });
    
    if (!result.success || !result.data?.[0]) {
      throw new Error('获取广告汇总数据失败');
    }

    const data = result.data[0];
    
    return {
      totalProducts: parseInt(data.total_products?.toString() || '0'),
      totalInventoryPoints: parseInt(data.total_points?.toString() || '0'),
      totalInventory: parseFloat(data.total_inventory?.toString() || '0'),
      totalDailySales: parseFloat(data.total_daily_sales?.toString() || '0'),
      totalAdSpend: parseFloat(data.total_ad_spend?.toString() || '0'),
      averageMetrics: {
        impressions: parseFloat(data.total_impressions?.toString() || '0'),
        clicks: parseFloat(data.total_clicks?.toString() || '0'),
        spend: parseFloat(data.total_ad_spend?.toString() || '0'),
        sales: parseFloat(data.total_ad_sales?.toString() || '0'),
        orders: parseFloat(data.total_ad_orders?.toString() || '0'), // 需要在DAO中添加总广告订单量
        ctr: this.transformer.formatPercentage(data.avg_ctr || 0),
        cvr: this.transformer.formatPercentage(data.avg_cvr || 0),
        cpc: this.transformer.calculateCPC(data.total_ad_spend || 0, data.total_clicks || 0),
        roas: this.transformer.calculateROAS(data.total_ad_sales || 0, data.total_ad_spend || 0),
        acoas: this.transformer.formatPercentage(data.avg_acoas || 0),
      },
    };
  }

  /**
   * 获取广告趋势数据
   */
  async getAdTrends(filter: {
    asin?: string;
    marketplace?: string;
    days?: number;
  } = {}): Promise<AdDashboardData['trends']> {
    const result = await adDataDAO.getAdTrendData(filter);
    
    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map(item => ({
      date: item.data_date,
      metrics: {
        impressions: parseFloat(item.impressions?.toString() || '0'),
        clicks: parseFloat(item.clicks?.toString() || '0'),
        spend: parseFloat(item.spend?.toString() || '0'),
        sales: parseFloat(item.sales?.toString() || '0'),
        orders: parseFloat(item.orders?.toString() || '0'), // 需要在DAO查询中添加广告订单量
        ctr: this.transformer.formatPercentage(item.ctr || 0),
        cvr: this.transformer.formatPercentage(item.cvr || 0),
        cpc: this.transformer.calculateCPC(item.spend || 0, item.clicks || 0),
        roas: this.transformer.calculateROAS(item.sales || 0, item.spend || 0),
        acoas: this.transformer.formatPercentage(item.acoas || 0),
      },
    }));
  }

  /**
   * 获取库存点分布数据
   */
  async getAdDistribution(): Promise<AdDashboardData['distribution']> {
    const result = await adDataDAO.getInventoryPointDistribution();
    
    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map(item => ({
      marketplace: item.marketplace,
      pointCount: parseInt(item.point_count?.toString() || '0'),
      inventory: parseFloat(item.total_inventory?.toString() || '0'),
      dailySales: parseFloat(item.total_daily_sales?.toString() || '0'),
      adSpend: parseFloat(item.total_ad_spend?.toString() || '0'),
      averageMetrics: {
        impressions: 0, // 分布数据中没有明细
        clicks: 0,
        spend: parseFloat(item.total_ad_spend?.toString() || '0'),
        sales: parseFloat(item.total_daily_sales?.toString() || '0'),
        orders: 0, // 分布数据中没有广告订单量明细
        ctr: this.transformer.formatPercentage(item.avg_ctr || 0),
        cvr: 0,
        cpc: 0,
        roas: 0,
        acoas: this.transformer.formatPercentage(item.avg_acoas || 0),
      },
    }));
  }

  /**
   * 获取库存点列表
   */
  async getInventoryPoints(filter: {
    asin?: string;
    marketplace?: string;
    salesPerson?: string;
    isEffective?: boolean;
    isTurnoverExceeded?: boolean;
    isOutOfStock?: boolean;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    data: InventoryPoint[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await adDataDAO.getInventoryPoints({
      asin: filter.asin,
      marketplace: filter.marketplace,
      sales_person: filter.salesPerson,
      is_effective_point: filter.isEffective,
      is_turnover_exceeded: filter.isTurnoverExceeded,
      is_out_of_stock: filter.isOutOfStock,
      start_date: filter.startDate,
      end_date: filter.endDate,
    }, {
      page: filter.page,
      limit: filter.limit,
    });

    if (!result.success) {
      throw new Error(result.error || '获取库存点数据失败');
    }

    const transformedData = result.data?.map(item => this.transformInventoryPointData(item)) || [];

    return {
      data: transformedData,
      total: result.total || 0,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * 获取单个ASIN的详细数据
   */
  async getAsinDetails(asin: string, marketplace?: string): Promise<{
    basicInfo: InventoryPoint;
    adTrends: AdDashboardData['trends'];
    relatedProducts: InventoryPoint[];
  }> {
    const [basicResult, trendsResult, relatedResult] = await Promise.all([
      this.getInventoryPoints({ asin, marketplace, limit: 1 }),
      this.getAdTrends({ asin, marketplace, days: 30 }),
      this.getInventoryPoints({ 
        asin, 
        limit: 10,
        // 获取同一ASIN的其他库存点
      }),
    ]);

    if (!basicResult.data || basicResult.data.length === 0) {
      throw new Error('未找到该ASIN的数据');
    }

    return {
      basicInfo: basicResult.data[0],
      adTrends: trendsResult,
      relatedProducts: relatedResult.data.slice(1), // 排除第一个（自己）
    };
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<SyncStatus[]> {
    const result = await adDataDAO.getSyncTaskStatus();
    
    if (!result.success || !result.data) {
      return [];
    }

    // 按任务类型分组，只返回最新状态
    const statusMap = new Map<string, any>();
    
    result.data.forEach(item => {
      const taskType = item.task_type;
      if (!statusMap.has(taskType) || 
          new Date(item.task_date) > new Date(statusMap.get(taskType).task_date)) {
        statusMap.set(taskType, item);
      }
    });

    return Array.from(statusMap.values()).map(item => ({
      taskType: this.transformer.formatTaskType(item.task_type),
      lastSyncDate: item.task_date,
      status: item.status,
      duration: parseInt(item.duration_seconds?.toString() || '0'),
      recordsProcessed: parseInt(item.records_processed?.toString() || '0'),
      errorMessage: item.error_message || undefined,
    }));
  }

  /**
   * 获取广告效果对比数据
   */
  async getAdPerformanceComparison(filter: {
    asins?: string[];
    marketplaces?: string[];
    startDate?: string;
    endDate?: string;
  } = {}): Promise<Array<{
    asin: string;
    marketplace: string;
    metrics: AdMetrics;
    ranking: number;
  }>> {
    // 获取多个ASIN的数据进行对比
    const promises = (filter.asins || []).map(asin => 
      this.getInventoryPoints({ 
        asin, 
        startDate: filter.startDate,
        endDate: filter.endDate,
        limit: 1 
      })
    );

    const results = await Promise.all(promises);
    
    const comparisonData = results
      .filter(result => result.data && result.data.length > 0)
      .map(result => result.data[0])
      .map(point => ({
        asin: point.asin,
        marketplace: point.marketplace,
        metrics: point.advertising,
        ranking: 0, // 稍后计算排名
      }));

    // 按ROAS排序并设置排名
    comparisonData
      .sort((a, b) => b.metrics.roas - a.metrics.roas)
      .forEach((item, index) => {
        item.ranking = index + 1;
      });

    return comparisonData;
  }

  /**
   * 转换库存点数据格式
   */
  private transformInventoryPointData(data: InventoryPointData): InventoryPoint {
    return {
      id: data.id,
      asin: data.asin,
      productName: data.product_name,
      sku: data.sku || undefined,
      marketplace: data.marketplace,
      salesPerson: data.sales_person || undefined,
      
      inventory: {
        fbaAvailable: parseFloat(data.fba_available?.toString() || '0'),
        fbaInbound: parseFloat(data.fba_inbound?.toString() || '0'),
        localAvailable: parseFloat(data.local_available?.toString() || '0'),
        total: parseFloat(data.total_inventory?.toString() || '0'),
      },
      
      sales: {
        sales7Days: parseFloat(data.sales_7days?.toString() || '0'),
        averageSales: parseFloat(data.average_sales?.toString() || '0'),
        dailySalesAmount: parseFloat(data.daily_sales_amount?.toString() || '0'),
        turnoverDays: parseFloat(data.turnover_days?.toString() || '0'),
      },
      
      advertising: {
        impressions: parseFloat(data.ad_impressions?.toString() || '0'),
        clicks: parseFloat(data.ad_clicks?.toString() || '0'),
        spend: parseFloat(data.ad_spend?.toString() || '0'),
        sales: parseFloat(data.ad_sales?.toString() || '0'),
        orders: parseFloat(data.ad_order_count?.toString() || '0'), // 添加广告订单量映射
        ctr: this.transformer.formatPercentage(data.ad_ctr || 0),
        cvr: this.transformer.formatPercentage(data.ad_cvr || 0),
        cpc: parseFloat(data.ad_cpc?.toString() || '0'),
        roas: parseFloat(data.ad_roas?.toString() || '0'),
        acoas: this.transformer.formatPercentage(data.acoas || 0),
      },
      
      status: {
        isEffective: Boolean(data.is_effective_point),
        isTurnoverExceeded: Boolean(data.is_turnover_exceeded),
        isOutOfStock: Boolean(data.is_out_of_stock),
        isLowInventory: Boolean(data.is_low_inventory),
        isZeroSales: Boolean(data.is_zero_sales),
      },
      
      mergeInfo: data.merge_type ? {
        type: data.merge_type,
        storeCount: data.store_count,
        mergedStores: data.merged_stores ? JSON.parse(data.merged_stores) : undefined,
      } : undefined,
      
      dataDate: data.data_date,
    };
  }
}

// 单例模式导出
export const saiHuAdapter = new SaiHuAdapter();