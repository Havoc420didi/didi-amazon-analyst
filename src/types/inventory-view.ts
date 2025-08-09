export interface InventoryPoint {
  asin: string;
  productName: string;
  marketplace: string; // 英国/欧盟/其他站点
  salesPerson?: string;

  // 库存数据
  totalInventory: number;
  fbaAvailable: number;
  fbaInbound: number;
  localAvailable: number;

  // 销售与周转
  averageSales: number; // 平均销量
  dailySalesAmount: number; // 日均销售额（金额）
  turnoverDays: number; // 库存周转天数

  // 广告数据
  adImpressions: number;
  adClicks: number;
  adSpend: number;
  adOrderCount: number;

  // 状态标记
  isOutOfStock: boolean;
  isLowInventory: boolean;
  isTurnoverExceeded: boolean;
  isZeroSales: boolean;

  // 可选数据日期
  dataDate?: string;
}


