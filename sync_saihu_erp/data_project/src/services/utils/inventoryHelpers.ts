// 库存相关处理函数
import { ProductData, InventoryPoint } from '@/types/product';
import { ANALYSIS_CONFIG } from './constants';
import { dataHelpers } from './dataHelpers';
import { isEUMarketplace, getStorePrefix, formatInventoryPointName } from './marketplaceHelpers';

/**
 * 计算周转天数
 */
export function calculateTurnoverDays(totalInventory: number, averageSales: number): number {
  // 防止除以零
  if (averageSales <= 0) {
    return totalInventory > 0 ? 999 : 0; // 如果有库存但没有销量，返回999天；无库存无销量返回0天
  }
  
  // 计算周转天数 = 总库存 / 平均销量
  // 直接使用Excel中的平均销量，不再进行处理
  
  // 直接使用实际计算值，而不进行限制
  const turnoverDays = Math.round((totalInventory / averageSales) * 10) / 10;
  
  return turnoverDays;
}

/**
 * 判断是否超过周转天数阈值
 */
export function isTurnoverExceeded(turnoverDays: number, productTag: string): boolean {
  // 根据产品标签判断周转天数是否超标
  if (productTag.includes('空运')) {
    return turnoverDays > ANALYSIS_CONFIG.TURNOVER_THRESHOLDS.AIR;
  } else if (productTag.includes('铁路')) {
    return turnoverDays > ANALYSIS_CONFIG.TURNOVER_THRESHOLDS.RAILWAY;
  }
  
  // 默认使用空运标准
  return turnoverDays > ANALYSIS_CONFIG.TURNOVER_THRESHOLDS.AIR;
}

/**
 * 判断是否缺货
 */
export function isOutOfStock(fbaSellable: number): boolean {
  return fbaSellable <= 0;
}

/**
 * 判断是否零销量
 */
export function isZeroSales(sales7Days: number): boolean {
  return sales7Days <= 0;
}

/**
 * 计算总库存
 */
export function calculateTotalInventory(products: ProductData[]): number {
  return products.reduce((total, product) => {
    // 检查是否为有效产品
    if (!product || typeof product !== 'object') {
      return total;
    }
    
    // 计算当前产品的总库存：FBA可售 + FBA在途
    const productInventory = (product.fbaAvailable || 0) + (product.fbaInbound || 0);
    
    return total + productInventory;
  }, 0);
}

/**
 * 合并同一库存点的数据
 */
export function mergeInventoryPoint(group: ProductData[]): ProductData {
  if (!group || group.length === 0) {
    throw new Error('Cannot merge empty product group');
  }
  
  // 使用第一个产品作为基础
  const baseProduct = { ...group[0] };
  
  // 合并销量数据
  const salesData = dataHelpers.mergeSalesData(group);
  
  // 合并后的产品
  const mergedProduct: ProductData = {
    ...baseProduct,
    ...salesData,
  };
  
  // 更新计算字段
  mergedProduct.averageSales = group.reduce((sum: number, p: ProductData) => sum + (p.averageSales || 0), 0);
  mergedProduct.averagePrice = group[0].averagePrice;
  
  return mergedProduct;
}

/**
 * 合并库存点数据
 */
export function mergeInventoryPoints(products: ProductData[]): ProductData[] {
  if (!products || products.length === 0) {
    return [];
  }
  
  try {
    // 按ASIN分组
    const asinGroups = new Map<string, ProductData[]>();
    
    // 第一步：按ASIN分组所有产品
    products.forEach(product => {
      if (!product.asin) return;
      
      const key = product.asin;
      if (!asinGroups.has(key)) {
        asinGroups.set(key, []);
      }
      asinGroups.get(key)?.push(product);
    });
    
    const mergedProducts: ProductData[] = [];
    
    // 第二步：处理每个ASIN分组
    asinGroups.forEach((asinGroup, asin) => {
      // 分离欧盟和非欧盟产品
      const euProductsInAsinGroup: ProductData[] = [];
      const nonEuProductsInAsinGroup: ProductData[] = [];
      asinGroup.forEach(product => {
        if (isEUMarketplace(product.marketplace)) {
          euProductsInAsinGroup.push(product);
        } else {
          nonEuProductsInAsinGroup.push(product);
        }
      });

      // --- 开始处理欧盟库存点 (新逻辑) ---
      if (euProductsInAsinGroup.length > 0) {
        const euStorePrefixGroups = new Map<string, ProductData[]>();
        euProductsInAsinGroup.forEach(p => {
          const storePrefix = getStorePrefix(p.store);
          if (!euStorePrefixGroups.has(storePrefix)) {
            euStorePrefixGroups.set(storePrefix, []);
          }
          euStorePrefixGroups.get(storePrefix)!.push(p);
        });

        const euStoreRepresentatives: ProductData[] = [];
        euStorePrefixGroups.forEach((productsInStorePrefix, storePrefix) => {
          if (productsInStorePrefix.length === 0) return;

          const mergedSalesDataForStore = dataHelpers.mergeSalesData(productsInStorePrefix);
          const adImpressionsForStore = productsInStorePrefix.reduce((sum, p) => sum + (p.adImpressions || 0), 0);
          const adClicksForStore = productsInStorePrefix.reduce((sum, p) => sum + (p.adClicks || 0), 0);
          const adSpendForStore = productsInStorePrefix.reduce((sum, p) => sum + (p.adSpend || 0), 0);
          const adOrderCountForStore = productsInStorePrefix.reduce((sum, p) => sum + (p.adOrderCount || 0), 0);

          let bestInventorySiteProduct = productsInStorePrefix[0];
          let maxFbaInventoryForSite = dataHelpers.calculateProductInventory(productsInStorePrefix[0]);

          for (let i = 1; i < productsInStorePrefix.length; i++) {
            const currentFbaInventory = dataHelpers.calculateProductInventory(productsInStorePrefix[i]);
            if (currentFbaInventory > maxFbaInventoryForSite) {
              maxFbaInventoryForSite = currentFbaInventory;
              bestInventorySiteProduct = productsInStorePrefix[i];
            }
          }

          const storeRepresentativeMarketplace = `EU-${storePrefix}`;
          const storeRepresentativeStore = storePrefix;

          const storeRepresentative: ProductData = {
            asin: bestInventorySiteProduct.asin,
            productName: bestInventorySiteProduct.productName,
            sku: bestInventorySiteProduct.sku,
            category: bestInventorySiteProduct.category,
            salesPerson: bestInventorySiteProduct.salesPerson,
            productTag: bestInventorySiteProduct.productTag,
            fbaSellable: bestInventorySiteProduct.fbaSellable,
            inboundShipped: bestInventorySiteProduct.inboundShipped,
            fbaUnsellable: bestInventorySiteProduct.fbaUnsellable,
            fbaAvailable: bestInventorySiteProduct.fbaAvailable,
            fbaInbound: bestInventorySiteProduct.fbaInbound,
            localAvailable: bestInventorySiteProduct.localAvailable,
            sales7Days: mergedSalesDataForStore.sales7Days || 0,
            totalSales: mergedSalesDataForStore.totalSales || 0,
            orderCount: mergedSalesDataForStore.orderCount || 0,
            promotionalOrders: mergedSalesDataForStore.promotionalOrders || 0,
            adImpressions: adImpressionsForStore,
            adClicks: adClicksForStore,
            adSpend: adSpendForStore,
            adOrderCount: adOrderCountForStore,
            adSales: productsInStorePrefix.reduce((sum, p) => sum + (p.adSales || 0), 0),
            store: storeRepresentativeStore,
            marketplace: storeRepresentativeMarketplace,
            salesAmount: bestInventorySiteProduct.salesAmount,
            netSales: bestInventorySiteProduct.netSales,
            averagePrice: bestInventorySiteProduct.averagePrice,
            refundRate: bestInventorySiteProduct.refundRate,
            averageSales: productsInStorePrefix.reduce((sum: number, p: ProductData) => sum + (p.averageSales || 0), 0),
            // Add Chinese-keyed fields
            品名: bestInventorySiteProduct.productName,
            店铺: storeRepresentativeStore,
            站点: storeRepresentativeMarketplace,
            分类: bestInventorySiteProduct.category,
            业务员: bestInventorySiteProduct.salesPerson,
            产品标签: bestInventorySiteProduct.productTag,
          };
          storeRepresentative.averagePrice = bestInventorySiteProduct ? bestInventorySiteProduct.averagePrice : (productsInStorePrefix[0]?.averagePrice || '$0.00');
          euStoreRepresentatives.push(storeRepresentative);
        });

        if (euStoreRepresentatives.length > 0) {
          const firstRepresentative = euStoreRepresentatives[0];
          const finalEuMarketplace = '欧盟';
          const finalEuStore = '欧盟汇总';

          const finalEuProduct: ProductData = {
            asin: firstRepresentative.asin,
            productName: firstRepresentative.productName,
            sku: firstRepresentative.sku,
            category: firstRepresentative.category,
            salesPerson: firstRepresentative.salesPerson,
            productTag: firstRepresentative.productTag,
            marketplace: finalEuMarketplace,
            store: finalEuStore,
            fbaSellable: euStoreRepresentatives.reduce((sum, p) => sum + (p.fbaSellable || 0), 0),
            inboundShipped: euStoreRepresentatives.reduce((sum, p) => sum + (p.inboundShipped || 0), 0),
            fbaUnsellable: euStoreRepresentatives.reduce((sum, p) => sum + (p.fbaUnsellable || 0), 0),
            fbaAvailable: euStoreRepresentatives.reduce((sum, p) => sum + (p.fbaAvailable || 0), 0),
            fbaInbound: euStoreRepresentatives.reduce((sum, p) => sum + (p.fbaInbound || 0), 0),
            localAvailable: euStoreRepresentatives.reduce((sum, p) => sum + (p.localAvailable || 0), 0),
            sales7Days: euStoreRepresentatives.reduce((sum, p) => sum + (p.sales7Days || 0), 0),
            totalSales: euStoreRepresentatives.reduce((sum, p) => sum + (p.totalSales || 0), 0),
            orderCount: euStoreRepresentatives.reduce((sum, p) => sum + (p.orderCount || 0), 0),
            promotionalOrders: euStoreRepresentatives.reduce((sum, p) => sum + (p.promotionalOrders || 0), 0),
            adImpressions: euStoreRepresentatives.reduce((sum, p) => sum + (p.adImpressions || 0), 0),
            adClicks: euStoreRepresentatives.reduce((sum, p) => sum + (p.adClicks || 0), 0),
            adSpend: euStoreRepresentatives.reduce((sum, p) => sum + (p.adSpend || 0), 0),
            adOrderCount: euStoreRepresentatives.reduce((sum, p) => sum + (p.adOrderCount || 0), 0),
            adSales: euStoreRepresentatives.reduce((sum, p) => sum + (p.adSales || 0), 0),
            salesAmount: firstRepresentative.salesAmount,
            netSales: firstRepresentative.netSales,
            averagePrice: firstRepresentative.averagePrice,
            refundRate: firstRepresentative.refundRate,
            averageSales: euStoreRepresentatives.reduce((sum: number, rep: ProductData) => sum + (rep.averageSales || 0), 0),
            inventoryPointName: '',
            // Add Chinese-keyed fields
            品名: firstRepresentative.productName,
            店铺: finalEuStore,
            站点: finalEuMarketplace,
            分类: firstRepresentative.category,
            业务员: firstRepresentative.salesPerson,
            产品标签: firstRepresentative.productTag,
          };
          const representativeForEuPrice = euStoreRepresentatives[0];
          finalEuProduct.averagePrice = representativeForEuPrice ? representativeForEuPrice.averagePrice : '$0.00';
          finalEuProduct.inventoryPointName = formatInventoryPointName(finalEuProduct);
          mergedProducts.push(finalEuProduct);
        }
      }

      const nonEuCountryGroups = new Map<string, ProductData[]>();
      nonEuProductsInAsinGroup.forEach(product => {
        const key = `${product.marketplace}-${product.asin}`;
        if (!nonEuCountryGroups.has(key)) {
          nonEuCountryGroups.set(key, []);
        }
        nonEuCountryGroups.get(key)!.push(product);
      });

      nonEuCountryGroups.forEach((group) => {
        if (group.length > 0) {
          const baseProduct = group[0];
          const mergedSalesData = dataHelpers.mergeSalesData(group);

          const mergedNonEuProduct: ProductData = {
            asin: baseProduct.asin,
            productName: baseProduct.productName,
            sku: baseProduct.sku,
            store: baseProduct.store,
            marketplace: baseProduct.marketplace,
            category: baseProduct.category,
            salesPerson: baseProduct.salesPerson,
            productTag: baseProduct.productTag,
            fbaSellable: group.reduce((sum, p) => sum + (p.fbaSellable || 0), 0),
            inboundShipped: group.reduce((sum, p) => sum + (p.inboundShipped || 0), 0),
            fbaUnsellable: group.reduce((sum, p) => sum + (p.fbaUnsellable || 0), 0),
            fbaAvailable: group.reduce((sum, p) => sum + (p.fbaAvailable || 0), 0),
            fbaInbound: group.reduce((sum, p) => sum + (p.fbaInbound || 0), 0),
            localAvailable: Math.max(...group.map(p => p.localAvailable || 0)),
            sales7Days: mergedSalesData.sales7Days || 0,
            totalSales: mergedSalesData.totalSales || 0,
            orderCount: mergedSalesData.orderCount || 0,
            promotionalOrders: mergedSalesData.promotionalOrders || 0,
            adImpressions: group.reduce((sum, p) => sum + (p.adImpressions || 0), 0),
            adClicks: group.reduce((sum, p) => sum + (p.adClicks || 0), 0),
            adSpend: group.reduce((sum, p) => sum + (p.adSpend || 0), 0),
            adOrderCount: group.reduce((sum, p) => sum + (p.adOrderCount || 0), 0),
            adSales: group.reduce((sum, p) => sum + (p.adSales || 0), 0),
            salesAmount: baseProduct.salesAmount,
            netSales: baseProduct.netSales,
            averagePrice: baseProduct.averagePrice,
            refundRate: baseProduct.refundRate,
            averageSales: group.reduce((sum: number, p: ProductData) => sum + (p.averageSales || 0), 0),
            inventoryPointName: '',
            // Add Chinese-keyed fields
            品名: baseProduct.productName,
            店铺: baseProduct.store,
            站点: baseProduct.marketplace,
            分类: baseProduct.category,
            业务员: baseProduct.salesPerson,
            产品标签: baseProduct.productTag,
          };
          const representativeNonEuProductForPrice = group[0];
          mergedNonEuProduct.averagePrice = representativeNonEuProductForPrice ? representativeNonEuProductForPrice.averagePrice : (group[0]?.averagePrice || '$0.00');
          mergedNonEuProduct.inventoryPointName = formatInventoryPointName(mergedNonEuProduct);
          mergedProducts.push(mergedNonEuProduct);
        }
      });
    });
    
    return mergedProducts;
  } catch (error) {
    dataHelpers.logError(error, 'mergeInventoryPoints', { productCount: products.length });
    return products; // 发生错误时返回原始数据
  }
}
