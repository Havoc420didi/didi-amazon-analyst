// 数据处理辅助函数
import { ProductData } from '@/types/product';
import { MonetaryFields, NumericFields, SALES_FIELDS, INVENTORY_FIELDS, AVERAGE_FIELDS } from './constants';

/**
 * 数据处理相关工具函数
 */
export const dataHelpers = {
  /**
   * 安全的数字转换
   */
  toNumber: (value: any): number => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  },

  /**
   * 字符串转换
   */
  toString: (value: any, defaultValue = '空'): string => {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    return String(value);
  },

  /**
   * 安全的数据获取
   */
  safeGet: <T extends keyof ProductData>(product: ProductData, field: T): any => {
    return product[field] ?? (isNumericField(field) ? 0 : '');
  },

  /**
   * 安全的数组操作
   */
  safeArray: <T>(value: T | T[] | null | undefined): T[] => {
    if (value === null || value === undefined) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  },

  /**
   * 简单的错误日志
   */
  logError: (error: unknown, context: string, data?: any): void => {
    console.error(`Error in ${context}:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      data
    });
  },

  /**
   * 金额解析函数
   */
  parseAmount: (amount: string | null | undefined): number => {
    if (!amount) return 0;
    // 移除货币符号、逗号等，并转换为数字
    const numericStr = amount.replace(/[^0-9.-]+/g, '');
    return parseFloat(numericStr) || 0;
  },

  /**
   * 金额格式化函数
   */
  formatAmount: (amount: number): string => {
    return amount.toFixed(2);
  },

  /**
   * 安全的数字累加函数
   */
  safeSum: (arr: ProductData[], key: keyof ProductData): number | string => {
    // 处理金额字段
    if (isMonetaryField(key)) {
      const total = arr.reduce((sum, item) => sum + dataHelpers.parseAmount(item[key] as string), 0);
      return dataHelpers.formatAmount(total);
    }
    // 处理数字字段
    return arr.reduce((sum, item) => {
      const value = item[key];
      if (typeof value === 'number') {
        return sum + (value || 0);
      }
      return sum + (Number(value) || 0);
    }, 0);
  },

  /**
   * 安全的平均值计算函数
   */
  safeAverage: (arr: ProductData[], key: keyof ProductData): number => {
    // 只处理数字类型的字段
    const validValues = arr.filter(item => {
      const value = item[key];
      // 如果是字符串类型的金额，先转换为数字
      if (typeof value === 'string' && isMonetaryField(key)) {
        return dataHelpers.parseAmount(value) > 0;
      }
      return Number(value) > 0;
    });

    if (validValues.length === 0) return 0;

    // 根据字段类型进行不同的处理
    if (isMonetaryField(key)) {
      const sum = validValues.reduce((acc, item) => acc + dataHelpers.parseAmount(item[key] as string), 0);
      return sum / validValues.length;
    }

    // 处理普通数字字段
    const sum = validValues.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
    return sum / validValues.length;
  },

  /**
   * 计算总库存
   */
  calculateProductInventory: (product: ProductData): number => {
    return product.fbaAvailable + product.fbaInbound;
  },

  /**
   * 生成库存点唯一标识
   */
  generateInventoryPointKey: (product: ProductData): string => {
    return `${product.asin}-${product.marketplace}`;
  },

  /**
   * 计算平均销量
   */
  calculateDailyAverage: (sales7Days: number): number => {
    return Math.round((sales7Days / 7) * 1000) / 1000; // 保留3位小数
  },

  /**
   * 销量数据合并函数
   */
  mergeSalesData: (group: ProductData[]): Partial<ProductData> => {
    return {
      // 直接相加平均销量
      averageSales: group.reduce((sum, p) => sum + (p.averageSales || 0), 0),
      // 其他销量数据也需要累加
      sales7Days: dataHelpers.safeSum(group, 'sales7Days') as number,
      totalSales: dataHelpers.safeSum(group, 'totalSales') as number,
      orderCount: dataHelpers.safeSum(group, 'orderCount') as number,
      promotionalOrders: dataHelpers.safeSum(group, 'promotionalOrders') as number,
      // 金额字段处理
      salesAmount: dataHelpers.safeSum(group, 'salesAmount') as string,
      netSales: dataHelpers.safeSum(group, 'netSales') as string,
      // 使用第一条记录的价格和退款率
      averagePrice: group[0].averagePrice,
      refundRate: group[0].refundRate,
    };
  },

  /**
   * 合并库存数据
   */
  mergeInventoryData: (product: ProductData): Partial<ProductData> => {
    return INVENTORY_FIELDS.reduce((acc, field) => ({
      ...acc,
      [field]: product[field]
    }), {});
  },

  /**
   * 计算平均值数据
   */
  calculateAverages: (group: ProductData[]): Partial<ProductData> => {
    return AVERAGE_FIELDS.reduce((acc, field) => ({
      ...acc,
      [field]: dataHelpers.safeAverage(group, field)
    }), {});
  },

  /**
   * 产品数据验证
   */
  validateProduct: (product: any): product is ProductData => {
    if (!product || typeof product !== 'object') {
      return false;
    }

    // 为空值设置默认值
    if (!product.asin) product.asin = '空';
    if (!product.sku) product.sku = '空';
    if (!product.store) product.store = '未知店铺';
    if (!product.marketplace) product.marketplace = '未知站点';
    if (!product.salesPerson) product.salesPerson = '未知业务员';

    // 数值字段验证和默认值设置
    const numericFields = [
      'sales7Days', 'totalSales', 'averageSales', 'orderCount',
      'promotionalOrders', 'salesAmount', 'netSales',
      'fbaSellable', 'inboundShipped', 'fbaUnsellable',
      'fbaAvailable', 'fbaInbound', 'localAvailable', 'fbaSellableDays'
    ] as const;

    numericFields.forEach(field => {
      if (product[field] == null || isNaN(Number(product[field]))) {
        product[field] = 0;
      }
    });

    // 其他字符串字段的默认值设置
    if (!product.productName) product.productName = '未知商品';
    if (!product.productTag) product.productTag = '无标签';

    return true;
  },
};

/**
 * 检查字段是否为金额字段
 */
export function isMonetaryField(key: keyof ProductData): boolean {
  return key === 'salesAmount' || key === 'netSales' || key === 'averagePrice';
}

/**
 * 检查字段是否为数字字段
 */
export function isNumericField(key: keyof ProductData): boolean {
  const numericFields = [
    'sales7Days', 'totalSales', 'averageSales', 'orderCount',
    'promotionalOrders', 'fbaSellable', 'inboundShipped', 'fbaUnsellable',
    'fbaAvailable', 'fbaInbound', 'localAvailable', 'fbaSellableDays'
  ];
  return numericFields.includes(key as any);
}
