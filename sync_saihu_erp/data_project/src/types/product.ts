// 产品数据接口
export interface ProductData {
  // Excel 基础信息字段
  asin: string;                  // Excel: 'ASIN'
  productName: string;           // Excel: '品名'
  sku: string;                   // Excel: 'SKU'
  store: string;                 // Excel: '店铺'
  marketplace: string;           // Excel: '站点'
  category: string;              // Excel: '分类'
  salesPerson: string;           // Excel: '业务员'
  productTag: string;            // Excel: '产品标签'

  // Excel 销售数据字段
  sales7Days: number;            // Excel: '7天销量'
  totalSales: number;            // Excel: '销量'
  averageSales: number;          // Excel: '平均销量'
  orderCount: number;            // Excel: '订单量'
  promotionalOrders: number;     // Excel: '促销订单量'
  adImpressions?: number;        // Excel: '广告曝光量'
  adClicks?: number;           // Excel: '广告点击量'
  adSpend?: number;            // Excel: '广告花费'
  adSales?: number;            // Excel: '广告销量'
  adOrderCount?: number;       // Excel: '广告订单量'
  
  // Excel 金额字段（带格式的字符串）
  salesAmount: string;           // Excel: '销售额' (格式: US$xxx.xx)
  netSales: string;              // Excel: '净销售额' (格式: US$xxx.xx)
  averagePrice: string;          // Excel: '平均售价' (格式: US$xxx.xx)
  refundRate: string;            // Excel: '退款率' (格式: xx.xx%)

  // Excel 库存数据字段
  fbaSellable: number;          // Excel: 'FBA可售'
  inboundShipped: number;       // Excel: '入库已发货'
  fbaUnsellable: number;        // Excel: 'FBA不可售'
  fbaAvailable: number;         // Excel: 'FBA可用'
  fbaInbound: number;           // Excel: 'FBA在途'
  localAvailable: number;       // Excel: '本地仓库存'
  
  // 计算字段
  inventoryPointName?: string;     // 库存点显示名称
  fbaSellableDays?: number;      // Excel: 'FBA可售天数'
  
  // 分析后的字段
  totalInventory?: number;      // 总库存 = FBA可用 + FBA在途 + 本地仓可用
  turnoverDays?: number;        // 库存周转天数
  isTurnoverExceeded?: boolean; // 是否周转超标
  isOutOfStock?: boolean;       // 是否断货
  isZeroSales?: boolean;        // 是否零销量
  isLowInventory?: boolean;     // 是否低库存
  inventoryPoint?: string;      // 库存点（合并后的站点）
  storePrefix?: string;         // 店铺前缀（欧盟库存点显示用）
  
  // Excel 原始中文字段（用于参考）
  站点: string;                 // Excel: '站点'
  品名: string;                 // Excel: '品名'
  店铺: string;                 // Excel: '店铺'
  分类: string;                 // Excel: '分类'
  业务员: string;               // Excel: '业务员'
  产品标签: string;             // Excel: '产品标签'
}

// 库存点接口
export interface InventoryPoint {
  asin: string;                 // 产品ASIN
  productName: string;          // 产品名称
  sku: string;                  // 产品SKU
  productTag: string;           // 产品标签
  salesPerson: string;          // 业务员
  marketplace: string;          // 所属库存点
  averageSales: number;         // 平均销量
  
  // 广告数据 (加总后)
  adImpressions?: number;       // 广告曝光量
  adClicks?: number;            // 广告点击量
  adSpend?: number;             // 广告花费
  adSales?: number;             // 广告销量
  adOrderCount?: number;        // 广告订单量 (加总后)
  
  // 计算广告指标字段
  adCtr?: number;               // 广告点击率 (adClicks / adImpressions)
  adCvr?: number;               // 广告转化率 (adSales / adClicks)
  acoas?: number;               // ACOAS (adSpend / (dailySalesAmount * 7))

  // 库存相关字段
  fbaSellable?: number;         // FBA可售库存
  fbaAvailable: number;         // FBA可用库存
  fbaInbound: number;           // FBA在途库存
  localAvailable: number;       // 本地仓可用库存
  totalInventory: number;       // 总库存 (FBA可用 + FBA在途 + 本地仓)
  sales7Days?: number;          // 7天销量
  
  turnoverDays?: number;        // 库存周转天数
  isTurnoverExceeded?: boolean; // 是否周转超标
  isOutOfStock?: boolean;       // 是否断货
  isZeroSales?: boolean;        // 是否零销量
  isLowInventory?: boolean;     // 是否低库存
  isEffectivePoint?: boolean;   // 是否为有效库存点（日均销售额≥16.7）
  dailySalesAmount?: number;    // 日均销售额
}

// 统计数据接口
export interface AnalysisStats {
  totalInventoryPoints: number;    // 库存点总数
  turnoverExceededCount: number;   // 库存周转较慢产品数量
  lowInventoryCount: number;       // 低库存产品数量
  outOfStockCount: number;         // 缺货产品数量
  zeroSalesCount: number;          // 零销量的库存点数
  effectiveInventoryPointCount: number; // 有效库存点数量（日均销售额≥16.7）
}

// 报表类型定义
export type ReportType = 
  | 'inventory'         // 库存点数据表
  | 'turnoverExceeded'  // 周转超标情况表
  | 'outOfStock'        // 断货情况表
  | 'zeroSales'         // 零销量情况表
  | 'lowInventory'      // 低库存情况表
  | 'salesPerson'       // 业务员统计报表
  | 'all';              // 所有库存点

// 报表生成选项接口
export interface ReportOptions {
  type: ReportType;             // 报表类型
  filters?: {                   // 可选的筛选条件
    salesPerson?: string;       // 按业务员筛选
    marketplace?: string;       // 按库存点筛选
    category?: string;          // 按分类筛选
    productTag?: string;        // 按产品标签筛选
  };
}

// 业务员统计数据接口
export interface SalesPersonStats {
  salesPerson: string;          // 业务员
  totalProducts: number;        // 产品总数
  outOfStock: number;          // 断货产品数量
  lowInventory: number;        // 低库存产品数量
  turnoverExceeded: number;    // 周转超标产品数量
  zeroSales: number;           // 零销量产品数量
  inventoryPointCount: number; // 库存点数量
  effectivePointCount: number; // 有效库存点数量（日均销售额≥16.7）
}

// API响应接口
export interface AnalysisResponse {
  stats: AnalysisStats;                // 统计数据
  salesPersonStats: SalesPersonStats[]; // 业务员统计数据
  inventoryPoints: InventoryPoint[];    // 库存点数据列表
  mergedProducts: ProductData[];        // 合并后的产品数据
}

// 错误响应接口
export interface ErrorResponse {
  error: string;                // 错误信息
  details?: string;             // 详细错误信息（可选）
} 