// 常量和配置
import { ProductData } from '@/types/product';

// 欧盟国家列表
export const EU_MARKETPLACES = new Set([
  '法国', '德国', '意大利', '西班牙', '荷兰', '波兰', '瑞典',
  '比利时', '葡萄牙', '奥地利', '丹麦', '芬兰', '爱尔兰', '卢森堡',
  '希腊', '捷克', '罗马尼亚', '保加利亚', '克罗地亚', '斯洛文尼亚', 
  '斯洛伐克', '匈牙利', '马耳他', '塞浦路斯', '爱沙尼亚', '拉脱维亚', 
  '立陶宛'
]);

// 库存点列表
export const INVENTORY_POINTS = new Set(['美国', '欧盟', '英国', '加拿大', '澳大利亚']);

// 分析配置
export const ANALYSIS_CONFIG = {
  MIN_MERGED_INVENTORY: 0, // 合并后的最小库存阈值 (不过滤)
  LOW_INVENTORY_THRESHOLD: 10, // 低库存阈值 (这个似乎未使用，保留观察)
  TURNOVER_THRESHOLDS: {
    AIR: 30,    // 空运产品阈值 (30天)
    RAILWAY: 60  // 铁路运输产品阈值 (60天)
  },
  EFFECTIVE_POINT_THRESHOLD: 16.7, // 每日销售额阈值，用于判断有效库存点
  OUT_OF_STOCK_DAYS_THRESHOLD: 3,    // 断货天数阈值 (FBA可用库存/日均销量 < N 天)
  TURNOVER_EXCEEDED_DAYS_MAX: 100, // 周转超标天数上限 (周转天数 > N 天)
  LOW_INVENTORY_DAYS_MIN: 45,      // 低库存天数下限 (周转天数 < N 天)
  ZERO_SALES_CHECK_DAYS: 7,        // 检查零销量的天数周期 (例如过去7天)
  TURNAROUND_NO_SALES_DAYS: 999    // 无销量时，周转天数统一标识为999
} as const;

// 站点映射关系
export const MARKETPLACE_MAPPING: Record<string, string> = {
  'FR': '法国',
  'DE': '德国',
  'IT': '意大利',
  'ES': '西班牙',
  'NL': '荷兰',
  'PL': '波兰',
  'SE': '瑞典',
  'BE': '比利时',
  'UK': '英国',
  'US': '美国',
  'CA': '加拿大',
  'AU': '澳大利亚'
};

// 销量相关字段
export const SALES_FIELDS = [
  'sales7Days', 'totalSales', 'orderCount',
  'promotionalOrders', 'salesAmount', 'netSales'
] as const;

// 库存相关字段
export const INVENTORY_FIELDS = [
  'fbaSellable', 'inboundShipped', 'fbaUnsellable',
  'fbaAvailable', 'fbaInbound', 'localAvailable'
] as const;

// 平均值字段
export const AVERAGE_FIELDS = [
  'fbaSellableDays', 'averagePrice', 'refundRate'
] as const;

// 类型定义
export type NumericFields = keyof Pick<ProductData, 
  | 'sales7Days' | 'totalSales' | 'averageSales' | 'orderCount' 
  | 'promotionalOrders' | 'fbaSellable' | 'inboundShipped' | 'fbaUnsellable' 
  | 'fbaAvailable' | 'fbaInbound' | 'fbaSellableDays'
>;

// 金额字段类型定义
export type MonetaryFields = keyof Pick<ProductData,
  | 'salesAmount' | 'netSales' | 'averagePrice'
>;
