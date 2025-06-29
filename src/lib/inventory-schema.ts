import { z } from 'zod';

// 库存状态枚举
export const InventoryStatusEnum = z.enum(['库存不足', '周转合格', '周转超标']);

// 库存点枚举
export const WarehouseLocationEnum = z.enum(['英国', '欧盟', '加拿大', '澳大利亚', '美国', '日本']);

// 库存记录创建Schema
export const CreateInventoryRecordSchema = z.object({
  asin: z.string().min(1, 'ASIN不能为空').max(50, 'ASIN长度不能超过50个字符'),
  product_name: z.string().min(1, '品名不能为空').max(500, '品名长度不能超过500个字符'),
  sales_person: z.string().min(1, '业务员不能为空').max(100, '业务员名称长度不能超过100个字符'),
  warehouse_location: WarehouseLocationEnum,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为YYYY-MM-DD'),
  
  // 库存数据 - 默认为0
  fba_available: z.number().int().min(0, 'FBA可用数量不能为负数').optional().default(0),
  fba_in_transit: z.number().int().min(0, 'FBA在途数量不能为负数').optional().default(0),
  local_warehouse: z.number().int().min(0, '本地仓数量不能为负数').optional().default(0),
  total_inventory: z.number().int().min(0, '总库存不能为负数').optional().default(0),
  
  // 销售数据
  avg_sales: z.number().min(0, '平均销量不能为负数').optional().default(0),
  daily_revenue: z.number().min(0, '日均销售额不能为负数').optional().default(0),
  inventory_turnover_days: z.number().min(0, '库存周转天数不能为负数').nullable().optional(),
  inventory_status: InventoryStatusEnum.nullable().optional(),
  
  // 广告数据
  ad_impressions: z.number().int().min(0, '广告曝光量不能为负数').optional().default(0),
  ad_clicks: z.number().int().min(0, '广告点击量不能为负数').optional().default(0),
  ad_spend: z.number().min(0, '广告花费不能为负数').optional().default(0),
  ad_orders: z.number().int().min(0, '广告订单量不能为负数').optional().default(0),
  ad_ctr: z.number().min(0).max(1, '广告点击率必须在0-1之间').nullable().optional(),
  ad_conversion_rate: z.number().min(0).max(1, '广告转化率必须在0-1之间').nullable().optional(),
  acos: z.number().min(0, 'ACOS不能为负数').nullable().optional(),
});

// 批量创建Schema
export const BulkCreateInventoryRecordsSchema = z.array(CreateInventoryRecordSchema);

// 库存记录筛选参数Schema
export const InventoryFilterParamsSchema = z.object({
  sales_person: z.string().optional(),
  asin: z.string().optional(),
  warehouse_location: WarehouseLocationEnum.optional(),
  inventory_status: InventoryStatusEnum.optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
  sort_by: z.enum([
    'id', 'asin', 'product_name', 'sales_person', 'warehouse_location', 'date',
    'fba_available', 'fba_in_transit', 'local_warehouse', 'total_inventory',
    'avg_sales', 'daily_revenue', 'inventory_turnover_days', 'inventory_status',
    'ad_impressions', 'ad_clicks', 'ad_spend', 'ad_orders', 'ad_ctr', 
    'ad_conversion_rate', 'acos', 'created_at', 'updated_at'
  ]).optional().default('date'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Excel行数据Schema (对应CSV格式)
export const ExcelRowSchema = z.object({
  'ASIN': z.string().min(1),
  '品名': z.string().min(1),
  '业务员': z.string().min(1),
  '库存点': WarehouseLocationEnum,
  'FBA可用': z.number().int().min(0),
  'FBA在途': z.number().int().min(0),
  '本地仓': z.number().int().min(0),
  '平均销量': z.number().min(0),
  '日均销售额': z.number().min(0),
  '总库存': z.number().int().min(0),
  '广告曝光量': z.number().int().min(0),
  '广告点击量': z.number().int().min(0),
  '广告花费': z.number().min(0),
  '广告订单量': z.number().int().min(0),
  '库存周转天数': z.number().min(0),
  '库存状态': InventoryStatusEnum,
  '广告点击率': z.number().min(0).max(1),
  '广告转化率': z.number().min(0).max(1),
  'ACOAS': z.number().min(0),
});

// 将Excel行数据转换为数据库记录
export function transformExcelRowToRecord(
  excelRow: z.infer<typeof ExcelRowSchema>,
  date: string
): z.infer<typeof CreateInventoryRecordSchema> {
  return {
    asin: excelRow.ASIN,
    product_name: excelRow.品名,
    sales_person: excelRow.业务员,
    warehouse_location: excelRow.库存点,
    date,
    fba_available: excelRow.FBA可用,
    fba_in_transit: excelRow.FBA在途,
    local_warehouse: excelRow.本地仓,
    total_inventory: excelRow.总库存,
    avg_sales: excelRow.平均销量,
    daily_revenue: excelRow.日均销售额,
    inventory_turnover_days: excelRow.库存周转天数,
    inventory_status: excelRow.库存状态,
    ad_impressions: excelRow.广告曝光量,
    ad_clicks: excelRow.广告点击量,
    ad_spend: excelRow.广告花费,
    ad_orders: excelRow.广告订单量,
    ad_ctr: excelRow.广告点击率,
    ad_conversion_rate: excelRow.广告转化率,
    acos: excelRow.ACOAS,
  };
}

// 类型导出
export type CreateInventoryRecord = z.infer<typeof CreateInventoryRecordSchema>;
export type InventoryFilterParams = z.infer<typeof InventoryFilterParamsSchema>;
export type ExcelRow = z.infer<typeof ExcelRowSchema>;
export type InventoryStatus = z.infer<typeof InventoryStatusEnum>;
export type WarehouseLocation = z.infer<typeof WarehouseLocationEnum>;