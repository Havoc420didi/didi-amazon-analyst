// 库存状态枚举
export type InventoryStatus = '库存不足' | '周转合格' | '周转超标';

// 库存点枚举  
export type WarehouseLocation = '英国' | '欧盟';

// 库存记录基础接口
export interface InventoryRecord {
  id: number;
  asin: string;
  product_name: string;
  sales_person: string;
  warehouse_location: WarehouseLocation;
  date: string; // ISO date string
  
  // 库存数据
  fba_available: number;
  fba_in_transit: number;
  local_warehouse: number;
  total_inventory: number;
  
  // 销售数据
  avg_sales: number;
  daily_revenue: number;
  inventory_turnover_days: number | null;
  inventory_status: InventoryStatus | null;
  
  // 广告数据
  ad_impressions: number;
  ad_clicks: number;
  ad_spend: number;
  ad_orders: number;
  ad_ctr: number | null;
  ad_conversion_rate: number | null;
  acos: number | null;
  
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

// 创建库存记录输入接口
export interface CreateInventoryRecord {
  asin: string;
  product_name: string;
  sales_person: string;
  warehouse_location: WarehouseLocation;
  date: string;
  fba_available?: number;
  fba_in_transit?: number;
  local_warehouse?: number;
  total_inventory?: number;
  avg_sales?: number;
  daily_revenue?: number;
  inventory_turnover_days?: number | null;
  inventory_status?: InventoryStatus | null;
  ad_impressions?: number;
  ad_clicks?: number;
  ad_spend?: number;
  ad_orders?: number;
  ad_ctr?: number | null;
  ad_conversion_rate?: number | null;
  acos?: number | null;
}

// 库存记录查询筛选参数
export interface InventoryFilterParams {
  sales_person?: string;
  asin?: string;
  warehouse_location?: WarehouseLocation;
  inventory_status?: InventoryStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: keyof InventoryRecord;
  sort_order?: 'asc' | 'desc';
}

// 库存统计信息
export interface InventoryStats {
  total_products: number;
  total_inventory: number;
  total_daily_revenue: number;
  total_ad_spend: number;
  inventory_status_distribution: {
    [key in InventoryStatus]: number;
  };
  warehouse_distribution: {
    [key in WarehouseLocation]: number;
  };
}

// 库存趋势数据
export interface InventoryTrend {
  date: string;
  total_inventory: number;
  daily_revenue: number;
  ad_spend: number;
  inventory_status_counts: {
    [key in InventoryStatus]: number;
  };
}

// Excel上传处理结果
export interface ExcelUploadResult {
  success: boolean;
  message: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  errors?: {
    row: number;
    message: string;
    data?: any;
  }[];
}

// API响应包装器
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// 库存点详情页数据
export interface InventoryLocationDetail {
  location: WarehouseLocation;
  latest_date: string;
  total_products: number;
  total_inventory: number;
  daily_revenue: number;
  ad_spend: number;
  records: InventoryRecord[];
  trends: InventoryTrend[];
}

// 单品历史数据
export interface ProductHistory {
  asin: string;
  product_name: string;
  warehouse_location: WarehouseLocation;
  sales_person: string;
  records: InventoryRecord[];
  trends: {
    inventory_trend: { date: string; value: number }[];
    sales_trend: { date: string; value: number }[];
    ad_performance: { date: string; spend: number; revenue: number; acos: number }[];
  };
}

// Excel原始数据格式（用于数据集成服务）
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

// 库存点数据（处理后的数据格式）
export interface InventoryPoint {
  asin: string;
  productName: string;
  salesPerson: string;
  marketplace: string;
  totalInventory: number;
  fbaAvailable: number;
  fbaInbound: number;
  localAvailable: number;
  averageSales: number;
  dailySalesAmount: number;
  turnoverDays: number;
  adImpressions: number;
  adClicks: number;
  adSpend: number;
  adOrderCount: number;
  
  // 计算得出的状态
  isOutOfStock: boolean;
  isLowInventory: boolean;
  isTurnoverExceeded: boolean;
  isEffectiveInventoryPoint: boolean;
  
  // 其他属性
  productTag?: string;
  fbaSellable?: number;
  averagePrice?: string;
}