/**
 * 数据集成服务
 * 复用现有的赛狐ERP数据处理逻辑，为AI分析提供标准化数据
 */

import { InventoryPoint } from '@/types/inventory-view';
import { ProductAnalysisData, EnhancedProductAnalysisData } from '@/types/ai-analysis';
// import { calculateInventoryPoints } from '@/../../sync_saihu_erp/data_project/src/services/analysisService';

/**
 * 本地实现的库存点计算函数
 */
export interface ProductData {
  asin: string;
  sku?: string;
  productName: string;
  salesPerson: string;
  marketplace: string;
  fbaAvailable: number;
  fbaInbound: number;
  localAvailable?: number;
  averageSales: number;
  sales7Days?: number;
  adImpressions?: number;
  adClicks?: number;
  adSpend?: number;
  adOrderCount?: number;
  productTag?: string;
  fbaSellable?: number;
  averagePrice?: string;
  dailySalesAmount?: number;
}

function calculateInventoryPoints(products: ProductData[]): InventoryPoint[] {
  if (!products || products.length === 0) {
    return [];
  }

  return products.map(product => {
    const totalInventory = (product.fbaAvailable || 0) + (product.fbaInbound || 0) + (product.localAvailable || 0);
    const averageSales = product.averageSales || 0;
    const dailySalesAmount = product.dailySalesAmount || (product.averagePrice ? parseFloat(product.averagePrice) * averageSales : 0);
    const turnoverDays = averageSales > 0 ? totalInventory / averageSales : 999;
    
    return {
      asin: product.asin,
      productName: product.productName,
      salesPerson: product.salesPerson,
      marketplace: product.marketplace,
      totalInventory,
      fbaAvailable: product.fbaAvailable || 0,
      fbaInbound: product.fbaInbound || 0,
      localAvailable: product.localAvailable || 0,
      averageSales,
      dailySalesAmount,
      turnoverDays,
      adImpressions: product.adImpressions || 0,
      adClicks: product.adClicks || 0,
      adSpend: product.adSpend || 0,
      adOrderCount: product.adOrderCount || 0,
      
      // 状态判断
      isOutOfStock: totalInventory <= 0,
      isLowInventory: turnoverDays < 45,
      isTurnoverExceeded: turnoverDays > 90,
      isZeroSales: averageSales === 0,
      
      productTag: product.productTag,
      fbaSellable: product.fbaSellable,
      averagePrice: product.averagePrice
    };
  });
}

/**
 * 数据集成服务类
 */
export class DataIntegrationService {
  
  /**
   * 将Excel产品数据转换为AI分析数据格式
   */
  static convertProductDataToAnalysisData(inventoryPoint: InventoryPoint): ProductAnalysisData {
    // 计算基础指标
    const totalInventory = inventoryPoint.totalInventory;
    const avgSales = inventoryPoint.averageSales;
    const dailySalesAmount = inventoryPoint.dailySalesAmount || 0;
    
    // 计算广告指标
    const adImpressions = inventoryPoint.adImpressions || 0;
    const adClicks = inventoryPoint.adClicks || 0;
    const adSpend = inventoryPoint.adSpend || 0;
    const adOrders = inventoryPoint.adOrderCount || 0;
    
    // 计算ACOAS (广告花费 / (日均销售额 * 7))
    const weeklyRevenue = dailySalesAmount * 7;
    const acoas = weeklyRevenue > 0 ? (adSpend / weeklyRevenue) : 0;
    
    // 确定库存状态
    let inventoryStatus = 'unknown';
    if (inventoryPoint.isOutOfStock) {
      inventoryStatus = '断货';
    } else if (inventoryPoint.isLowInventory) {
      inventoryStatus = '库存不足';
    } else if (inventoryPoint.isTurnoverExceeded) {
      inventoryStatus = '周转超标';
    } else {
      inventoryStatus = '库存健康';
    }

    return {
      // 基本信息
      asin: inventoryPoint.asin,
      product_name: inventoryPoint.productName,
      warehouse_location: inventoryPoint.marketplace,
      sales_person: inventoryPoint.salesPerson || '',
      
      // 库存数据
      total_inventory: totalInventory,
      fba_available: inventoryPoint.fbaAvailable || 0,
      fba_in_transit: inventoryPoint.fbaInbound || 0,
      local_warehouse: inventoryPoint.localAvailable || 0,
      inventory_turnover_days: inventoryPoint.turnoverDays || 0,
      inventory_status: inventoryStatus,
      
      // 销售数据
      avg_sales: avgSales,
      daily_revenue: dailySalesAmount,
      
      // 广告数据
      ad_impressions: adImpressions,
      ad_clicks: adClicks,
      ad_spend: adSpend,
      ad_orders: adOrders,
      acos: acoas,
      
      // 趋势数据（默认值，后续可扩展）
      trends: {
        inventory_change: 0,
        revenue_change: 0,
        sales_change: 0
      },
      
      // 历史数据（空数组，后续可扩展）
      history: []
    };
  }

  /**
   * 批量处理Excel数据转换为AI分析数据
   */
  static async processExcelDataForAI(productDataList: ProductData[]): Promise<ProductAnalysisData[]> {
    try {
      // 使用现有的库存点计算逻辑
      const inventoryPoints = calculateInventoryPoints(productDataList);
      
      // 转换为AI分析数据格式
      const analysisDataList = inventoryPoints.map(point => 
        this.convertProductDataToAnalysisData(point)
      );
      
      return analysisDataList;
    } catch (error) {
      console.error('Excel数据处理失败:', error);
      throw new Error(`数据处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证产品数据完整性
   */
  static validateProductData(data: ProductAnalysisData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基本信息验证
    if (!data.asin) errors.push('ASIN不能为空');
    if (!data.product_name) errors.push('产品名称不能为空');
    if (!data.warehouse_location) errors.push('库存点不能为空');
    
    // 数值验证
    if (data.total_inventory < 0) errors.push('总库存不能为负数');
    if (data.avg_sales < 0) errors.push('平均销量不能为负数');
    if (data.daily_revenue < 0) errors.push('日均销售额不能为负数');
    if (data.ad_impressions < 0) errors.push('广告曝光量不能为负数');
    if (data.ad_clicks < 0) errors.push('广告点击量不能为负数');
    if (data.ad_spend < 0) errors.push('广告花费不能为负数');
    if (data.ad_orders < 0) errors.push('广告订单数不能为负数');
    
    // 逻辑验证
    if (data.ad_clicks > data.ad_impressions) {
      errors.push('广告点击量不能超过曝光量');
    }
    if (data.ad_orders > data.ad_clicks) {
      errors.push('广告订单数不能超过点击量');
    }
    if (data.fba_available + data.fba_in_transit + data.local_warehouse !== data.total_inventory) {
      errors.push('库存数据不一致');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 从库存点数据获取分析数据（单个产品）
   */
  static async getAnalysisDataFromInventoryPoint(
    asin: string, 
    marketplace: string, 
    productDataList: ProductData[]
  ): Promise<ProductAnalysisData | null> {
    try {
      // 计算库存点数据
      const inventoryPoints = calculateInventoryPoints(productDataList);
      
      // 查找匹配的库存点
      const targetPoint = inventoryPoints.find(point => 
        point.asin === asin && point.marketplace === marketplace
      );
      
      if (!targetPoint) {
        return null;
      }
      
      return this.convertProductDataToAnalysisData(targetPoint);
    } catch (error) {
      console.error('获取分析数据失败:', error);
      throw new Error(`获取分析数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 计算动态转化率标准
   */
  static calculateStandardConversionRate(avgPrice: number): number {
    if (avgPrice <= 10) return 18;
    if (avgPrice <= 15) return 15;
    if (avgPrice <= 20) return 13;
    if (avgPrice <= 25) return 10;
    if (avgPrice <= 30) return 8;
    if (avgPrice <= 35) return 6;
    return 5; // 35以上
  }

  /**
   * 增强分析数据（添加计算字段）
   */
  static enhanceAnalysisData(data: ProductAnalysisData): EnhancedProductAnalysisData {
    const avgPrice = data.avg_sales > 0 ? data.daily_revenue / data.avg_sales : 0;
    const standardCvr = this.calculateStandardConversionRate(avgPrice);
    
    // 计算实际转化率
    const actualCvr = data.ad_clicks > 0 ? (data.ad_orders / data.ad_clicks) * 100 : 0;
    
    // 计算点击率
    const ctr = data.ad_impressions > 0 ? (data.ad_clicks / data.ad_impressions) * 100 : 0;

    // 返回增强后的数据（临时移除enhanced_metrics以避免类型错误）
    return {
      ...data,
      enhanced_metrics: {
        avg_price: avgPrice,
        standard_cvr: standardCvr,
        actual_cvr: actualCvr,
        ctr: ctr,
        cvr_health: actualCvr >= standardCvr * 0.9 ? 'good' : 'poor',
        ctr_health: ctr >= 0.5 ? 'good' : 'poor',
        acoas_health: (data.acos || 0) >= 0.07 && (data.acos || 0) <= 0.15 ? 'good' : 
                      ((data.acos || 0) < 0.07 ? 'low' : 'high'),
        inventory_health: (data.inventory_turnover_days || 0) >= 40 && (data.inventory_turnover_days || 0) <= 90 ? 'good' :
                         ((data.inventory_turnover_days || 0) < 40 ? 'low' : 'high')
      }
    };
  }

  /**
   * 获取库存点历史数据（模拟实现，后续可接入实际历史数据）
   */
  static async getHistoricalData(_asin: string, _marketplace: string, _days: number = 7): Promise<any[]> {
    // 这里返回模拟数据，实际实现时可以从数据库获取历史记录
    return [];
  }

  /**
   * 批量验证产品数据
   */
  static validateBatchProductData(dataList: ProductAnalysisData[]): {
    validData: ProductAnalysisData[];
    invalidData: { data: ProductAnalysisData; errors: string[] }[];
  } {
    const validData: ProductAnalysisData[] = [];
    const invalidData: { data: ProductAnalysisData; errors: string[] }[] = [];

    dataList.forEach(data => {
      const validation = this.validateProductData(data);
      if (validation.valid) {
        validData.push(data);
      } else {
        invalidData.push({ data, errors: validation.errors });
      }
    });

    return { validData, invalidData };
  }
}

/**
 * 数据转换工具函数
 */
export const DataConverters = {
  /**
   * 库存点数据转换为AI分析格式
   */
  inventoryPointToAnalysisData: DataIntegrationService.convertProductDataToAnalysisData,
  
  /**
   * Excel原始数据转换为库存点数据
   */
  rawDataToInventoryPoints: calculateInventoryPoints,
  
  /**
   * 增强分析数据
   */
  enhanceData: DataIntegrationService.enhanceAnalysisData
};

export default DataIntegrationService;