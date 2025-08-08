import { ProductData, InventoryPoint, SalesPersonStats, AnalysisStats, ReportType } from '@/types/product';

// 导入工具函数
import { dataHelpers } from './utils/dataHelpers';
import { 
  getNormalizedMarketplace, 
  getStorePrefix, 
  isEUMarketplace, 
  formatInventoryPointName 
} from './utils/marketplaceHelpers';
import { 
  calculateTotalInventory, 
  calculateTurnoverDays, 
  isTurnoverExceeded, 
  isOutOfStock, 
  isZeroSales,
  mergeInventoryPoints as mergeInventoryPointsUtil
} from './utils/inventoryHelpers';
import { 
  generateReport as generateReportUtil, 
  calculateStats as calculateStatsUtil, 
  calculateSalesPersonStats as calculateSalesPersonStatsUtil 
} from './utils/reportHelpers';
import { 
  EU_MARKETPLACES, 
  INVENTORY_POINTS, 
  ANALYSIS_CONFIG 
} from './utils/constants';

/**
 * 计算库存点数据
 * 从产品数据中提取并计算库存点信息
 */
export function calculateInventoryPoints(products: ProductData[]): InventoryPoint[] {
  if (!products || products.length === 0) {
    return [];
  }

  try {
    // 第一步：合并库存点数据
    const mergedProducts = mergeInventoryPointsUtil(products);
    
    // 第二步：创建库存点对象
    return mergedProducts.map(product => {
      // 计算总库存
      const totalInventory = (product.fbaAvailable || 0) + (product.fbaInbound || 0) + (product.localAvailable || 0);
      // 计算库存周转天数
      // 直接使用Excel中的平均销量，不再进行处理
      const averageSales = product.averageSales || 0;
      const turnoverDays = averageSales > 0 
        ? Math.round((totalInventory / averageSales) * 10) / 10 
        : (totalInventory > 0 ? ANALYSIS_CONFIG.TURNAROUND_NO_SALES_DAYS : 0);

      const averagePriceStr = product.averagePrice || '';
      let averagePrice = 0;
      if (averagePriceStr) {
        const priceMatch = averagePriceStr.match(/[\d.]+/);
        if (priceMatch) {
          averagePrice = parseFloat(priceMatch[0]);
        }
      }
      
      // 计算日均销售额 = 平均销量 * 平均售价
      const dailySalesAmount = averageSales * averagePrice;
      
      // 判断是否为有效库存点（日均销售额 ≥ 16.7）
      const isEffectivePoint = dailySalesAmount >= ANALYSIS_CONFIG.EFFECTIVE_POINT_THRESHOLD;

      // Re-inserting missing boolean flag definitions
      const isOutOfStock = averageSales > 0 
        ? (product.fbaAvailable || 0) / averageSales < ANALYSIS_CONFIG.OUT_OF_STOCK_DAYS_THRESHOLD 
        : (product.fbaAvailable || 0) <= 0;

      const isZeroSales = (product.sales7Days || 0) === 0; // Consider using ANALYSIS_CONFIG.ZERO_SALES_CHECK_DAYS if needed for flexibility

      const isTurnoverExceeded = (turnoverDays > ANALYSIS_CONFIG.TURNOVER_EXCEEDED_DAYS_MAX || turnoverDays === ANALYSIS_CONFIG.TURNAROUND_NO_SALES_DAYS) && totalInventory > 0;
      
      const isLowInventory = averageSales > 0 && totalInventory > 0 && turnoverDays > 0 && turnoverDays < ANALYSIS_CONFIG.LOW_INVENTORY_DAYS_MIN;
      
      // 创建库存点对象
      const inventoryPoint: InventoryPoint = {
        asin: product.asin,
        sku: product.sku,
        productName: product.productName,
        productTag: product.productTag,
        salesPerson: product.salesPerson,
        marketplace: product.marketplace,
        averageSales: averageSales,
        fbaSellable: product.fbaSellable,
        fbaAvailable: product.fbaAvailable,
        fbaInbound: product.fbaInbound,
        localAvailable: product.localAvailable || 0,
        totalInventory,
        turnoverDays,
        isOutOfStock: isOutOfStock,
        isLowInventory: isLowInventory,
        isZeroSales: isZeroSales,
        isTurnoverExceeded: isTurnoverExceeded,
        dailySalesAmount: Math.round(dailySalesAmount * 100) / 100, // 保留两位小数
        isEffectivePoint,
        // 添加广告数据
        adImpressions: product.adImpressions || 0,
        adClicks: product.adClicks || 0,
        adSpend: product.adSpend || 0,
        adSales: product.adSales || 0,
        adOrderCount: product.adOrderCount || 0
      };
      
      return inventoryPoint;
    });
  } catch (error) {
    console.error('Error calculating inventory points:', error);
    return [];
  }
}

/**
 * 分析服务主函数
 * 分析产品数据并生成报表
 */
export function analyzeProducts(products: ProductData[], reportType: ReportType = 'inventory'): {
  inventoryPoints: InventoryPoint[];
  stats: AnalysisStats;
  salesPersonStats: SalesPersonStats[];
} {
  // 验证并过滤产品数据
  const validProducts = products.filter(product => dataHelpers.validateProduct(product));
  
  // 计算库存点数据
  const inventoryPoints = calculateInventoryPoints(validProducts);
  
  // 生成报表数据
  const filteredPoints = generateReportUtil(inventoryPoints, reportType);
  
  // 计算统计数据
  const stats = calculateStatsUtil(inventoryPoints);
  
  // 计算业务员统计数据
  const salesPersonStats = calculateSalesPersonStatsUtil(validProducts); // Reverted to pass validProducts (ProductData[])
  
  return {
    inventoryPoints: filteredPoints,
    stats,
    salesPersonStats
  };
}


/**
 * 导出分析模块 
 */
export default {
  calculateInventoryPoints,
  analyzeProducts,
  mergeInventoryPoints: mergeInventoryPointsUtil,
  generateReport: generateReportUtil,
  calculateStats: calculateStatsUtil,
  calculateSalesPersonStats: calculateSalesPersonStatsUtil
};

// 计算业务员统计数据 - 调用reportHelpers中的实现
export function calculateSalesPersonStats(products: ProductData[]): SalesPersonStats[] {
  // 直接使用reportHelpers中的实现
  return calculateSalesPersonStatsUtil(products);
}

// 生成报表数据
export function generateReport(inventoryPoints: InventoryPoint[], reportType: ReportType): InventoryPoint[] {
  switch(reportType) {
    case 'inventory':
      // 合并后的库存点数据表
      return inventoryPoints;
    case 'turnoverExceeded':
      // 周转超标情况表
      return inventoryPoints.filter(point => point.isTurnoverExceeded);
    
    case 'outOfStock':
      // 断货情况表
      return inventoryPoints.filter(point => point.isOutOfStock);
    
    case 'zeroSales':
      // 0动销情况表
      return inventoryPoints.filter(point => point.isZeroSales);
    
    default:
      return [];
  }
}

// 计算统计数据
export function calculateStats(inventoryPoints: InventoryPoint[]): AnalysisStats {
  // 使用过滤条件计算各类统计数量
  const totalInventoryPoints = inventoryPoints.length;
  
  // 周转超标：周转天数 > 100 或无销量(999)
  const turnoverExceededCount = inventoryPoints.filter(point => {
    // 使用与Excel导出完全相同的逻辑来计算统计数据
    const turnoverDays = point.turnoverDays || 0;
    const totalInventory = point.totalInventory || 0;
    
    // 只有当周转天数 > 100 或等于999（无销量），且有库存时才算周转超标
    return ((turnoverDays > 100 || turnoverDays === 999) && totalInventory > 0);
  }).length;
  
  // 低库存：周转天数 < 45
  const lowInventoryCount = inventoryPoints.filter(point => {
    const turnoverDays = point.turnoverDays || 0;
    
    // 与Excel导出完全一致，只要周转天数 < 45 就算库存不足
    return turnoverDays < 45;
  }).length;
  
  // 断货：FBA可售 <= 0
  const outOfStockCount = inventoryPoints.filter(point => point.isOutOfStock).length;
  
  // 零销量：仅计算7天销量为0的产品，不是整个数据库里的所有库存点
  const zeroSalesCount = inventoryPoints.filter(point => point.isZeroSales && !point.isOutOfStock).length;
  
  // 有效库存点：日均销售额 >= 16.7
  const effectiveInventoryPointCount = inventoryPoints.filter(point => point.isEffectivePoint).length;
  
  return {
    totalInventoryPoints,
    turnoverExceededCount,
    lowInventoryCount,
    outOfStockCount,
    zeroSalesCount,
    effectiveInventoryPointCount
  };
}

// 为了向后兼容，保留旧的函数名
export const mergeEUData = mergeInventoryPointsUtil;

// 直接导出 mergeInventoryPoints 函数
export const mergeInventoryPoints = mergeInventoryPointsUtil;