// 报表生成相关函数
import { InventoryPoint, ReportType, AnalysisStats, SalesPersonStats, ProductData } from '@/types/product';
import { ANALYSIS_CONFIG } from './constants';
import { isOutOfStock, isZeroSales, isTurnoverExceeded } from './inventoryHelpers';

/**
 * 生成报表数据
 * 根据报表类型筛选库存点数据
 */
export function generateReport(inventoryPoints: InventoryPoint[], reportType: ReportType): InventoryPoint[] {
  if (!inventoryPoints || inventoryPoints.length === 0) {
    return [];
  }

  // 根据报表类型筛选数据
  switch (reportType) {
    case 'inventory':
      return inventoryPoints;
    
    case 'outOfStock':
      return inventoryPoints.filter(point => point.isOutOfStock === true);
    
    // 低库存处理已移到isLowInventory属性
    // 返回所有低库存的库存点
    case 'lowInventory':
      return inventoryPoints.filter(point => point.isLowInventory === true);
    
    case 'turnoverExceeded':
      return inventoryPoints.filter(point => point.isTurnoverExceeded === true);
    
    case 'zeroSales':
      return inventoryPoints.filter(point => point.isZeroSales === true);
    
    default:
      return inventoryPoints;
  }
}

/**
 * 计算统计数据
 * 分析库存点数据并生成统计摘要
 */
export function calculateStats(inventoryPoints: InventoryPoint[]): AnalysisStats {
  // 直接使用库存点对象上的状态标志进行统计
  const totalInventoryPoints = inventoryPoints.length;
  const outOfStockCount = inventoryPoints.filter(point => point.isOutOfStock === true).length;
  const lowInventoryCount = inventoryPoints.filter(point => point.isLowInventory === true).length;
  const turnoverExceededCount = inventoryPoints.filter(point => point.isTurnoverExceeded === true).length;
  const zeroSalesCount = inventoryPoints.filter(point => point.isZeroSales === true).length;
  const effectiveInventoryPointCount = inventoryPoints.filter(point => point.isEffectivePoint === true).length;

  return {
    totalInventoryPoints,
    outOfStockCount,
    lowInventoryCount,
    turnoverExceededCount,
    zeroSalesCount,
    effectiveInventoryPointCount
  };
}

/**
 * 计算业务员统计数据
 */
export function calculateSalesPersonStats(products: ProductData[]): SalesPersonStats[] {
  if (!products || products.length === 0) {
    return [];
  }

  try {
    const salesPersonData = new Map<string, ProductData[]>();
    products.forEach(p => {
      const salesPerson = p.salesPerson || '未知业务员';
      if (!salesPersonData.has(salesPerson)) {
        salesPersonData.set(salesPerson, []);
      }
      salesPersonData.get(salesPerson)?.push(p);
    });

    const finalStats: SalesPersonStats[] = [];

    salesPersonData.forEach((group, salesPerson) => {
      const inventoryPointKeys = new Set<string>();
      const effectivePointKeys = new Set<string>();
      const outOfStockPointKeys = new Set<string>();
      const lowInventoryPointKeys = new Set<string>();
      const turnoverExceededPointKeys = new Set<string>();
      const zeroSalesPointKeys = new Set<string>();

      group.forEach(product => {
        const pointKey = `${product.asin}-${product.marketplace}`;
        inventoryPointKeys.add(pointKey);

        const totalInventory = (product.fbaAvailable || 0) + (product.fbaInbound || 0) + (product.localAvailable || 0);
        const averageSales = product.averageSales || 0;
        const turnoverDays = averageSales > 0 
          ? Math.round((totalInventory / averageSales) * 10) / 10 
          : (totalInventory > 0 ? 999 : 0);
        
        const averagePriceStr = product.averagePrice || '';
        let averagePrice = 0;
        if (averagePriceStr) {
          const priceMatch = averagePriceStr.match(/[\d.]+/);
          if (priceMatch) averagePrice = parseFloat(priceMatch[0]);
        }
        const dailySalesAmount = averageSales * averagePrice;

        // Effective Point
        if (dailySalesAmount >= ANALYSIS_CONFIG.EFFECTIVE_POINT_THRESHOLD) {
          effectivePointKeys.add(pointKey);
        }

        // Out of Stock
        const isOutOfStockProduct = averageSales > 0 
          ? (product.fbaAvailable || 0) / averageSales < ANALYSIS_CONFIG.OUT_OF_STOCK_DAYS_THRESHOLD 
          : (product.fbaAvailable || 0) <= 0;
        if (isOutOfStockProduct) {
          outOfStockPointKeys.add(pointKey);
        }

        // Zero Sales
        const isZeroSalesProduct = (product.sales7Days || 0) === 0;
        if (isZeroSalesProduct) {
          zeroSalesPointKeys.add(pointKey);
        }

        // Turnover Exceeded
        const isTurnoverExceededProduct = (turnoverDays > ANALYSIS_CONFIG.TURNOVER_EXCEEDED_DAYS_MAX || turnoverDays === 999) && totalInventory > 0;
        if (isTurnoverExceededProduct) {
          turnoverExceededPointKeys.add(pointKey);
        }

        // Low Inventory
        const isLowInventoryProduct = averageSales > 0 && totalInventory > 0 && turnoverDays > 0 && turnoverDays < ANALYSIS_CONFIG.LOW_INVENTORY_DAYS_MIN;
        if (isLowInventoryProduct) {
          lowInventoryPointKeys.add(pointKey);
        }
      });

      finalStats.push({
        salesPerson,
        inventoryPointCount: inventoryPointKeys.size,
        effectivePointCount: effectivePointKeys.size,
        outOfStock: outOfStockPointKeys.size,
        lowInventory: lowInventoryPointKeys.size,
        turnoverExceeded: turnoverExceededPointKeys.size,
        zeroSales: zeroSalesPointKeys.size,
        totalProducts: inventoryPointKeys.size, // Assuming totalProducts is the count of unique inventory points
      });
    });

    return finalStats.sort((a, b) => b.inventoryPointCount - a.inventoryPointCount);
  } catch (error) {
    console.error('Error calculating sales person stats:', error);
    return [];
  }
}
