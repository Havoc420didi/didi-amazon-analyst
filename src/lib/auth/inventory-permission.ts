/**
 * 库存点权限管理系统
 * 基于operator_name的权限控制
 */

import { eq, and, or, inArray, isNull, gte, lte } from 'drizzle-orm';
import { db } from '@/db/config';
import { inventorypointsRight, operatorVisibility, inventoryDeals, users } from '@/db/schema';
import { revalidatePath } from 'next/cache';

export interface PermissionQueryResult {
  records: any[];
  totalCount: number;
  hasMasked: boolean;
  permissions: {
    canViewAll: boolean;
    visibleWarehouses: string[];
    visibleSalesPersons: string[];
    visibleAsins: string[];
  };
}

export interface PermissionConfig {
  operator_name: string;
  operator_uuid: string;
  warehouse_location?: string;
  asin?: string;
  access_level: 'full' | 'masked' | 'restricted';
  view_sensitivity_data: boolean;
  sales_person?: string;
  effective_date?: Date;
  expiry_date?: Date;
  granted_by: string;
  remarks?: string;
}

/**
 * 检查用户权限
 */
export async function checkUserPermission(
  operator_name: string, 
  warehouse: string, 
  asin?: string
): Promise<{
  hasAccess: boolean;
  accessLevel: string;
  canViewFullData: boolean;
  canSkipMasking?: boolean;
}> {
  const [userRights] = await db
    .select()
    .from(inventorypointsRight)
    .where(
      and(
        eq(inventorypointsRight.operator_name, operator_name),
        eq(inventorypointsRight.warehouse_location, warehouse),
        eq(inventorypointsRight.is_active, true),
        or(
          isNull(inventorypointsRight.expiry_date),
          gte(inventorypointsRight.expiry_date, new Date())
        )
      )
    )
    .limit(1);

  if (!userRights) {
    return {
      hasAccess: false,
      accessLevel: 'none',
      canViewFullData: false
    };
  }

  // 检查是否特定ASIN权限
  if (asin && userRights.asin && userRights.asin !== asin) {
    return {
      hasAccess: false,
      accessLevel: 'none',
      canViewFullData: false
    };
  }

  return {
    hasAccess: true,
    accessLevel: userRights.access_level,
    canViewFullData: 
      userRights.access_level === 'full' && userRights.view_sensitivity_data,
    canSkipMasking: 
      userRights.access_level === 'full' && userRights.view_sensitivity_data
  };
}

/**
 * 获取用户的可见仓库列表
 */
export async function getUserVisibleWarehouses(operator_name: string): Promise<string[]> {
  const rights = await db
    .select({ warehouse_location: inventorypointsRight.warehouse_location })
    .from(inventorypointsRight)
    .where(
      and(
        eq(inventorypointsRight.operator_name, operator_name),
        eq(inventorypointsRight.is_active, true),
        or(
          isNull(inventorypointsRight.expiry_date),
          gte(inventorypointsRight.expiry_date, new Date())
        )
      )
    );

  return rights.map(r => r.warehouse_location);
}

/**
 * 获取用户的数据可见性配置
 */
export async function getOperatorVisibilityConfig(operator_uuid: string) {
  const [config] = await db
    .select()
    .from(operatorVisibility)
    .where(eq(operatorVisibility.operator_uuid, operator_uuid));

  if (!config) {
    return {
      visible_warehouses: [],
      visible_sales_persons: [],
      visible_asins: [],
      masking_rules: {},
      skip_masking_for_assigned: true,
      default_access_level: 'full'
    };
  }

  return {
    visible_warehouses: JSON.parse(config.visible_warehouses || '[]'),
    visible_sales_persons: JSON.parse(config.visible_sales_persons || '[]'),
    visible_asins: JSON.parse(config.visible_asins || '[]'),
    masking_rules: JSON.parse(config.masking_rules || '{}'),
    skip_masking_for_assigned: config.skip_masking_for_assigned,
    default_access_level: config.default_access_level
  };
}

/**
 * 筛选用户可见的库存数据（包含权限判断和脱敏处理）
 */
export async function filterInventoryDataByPermission(
  operator_name: string,
  queryParams: {
    page?: number;
    limit?: number;
    warehouse?: string;
    asin?: string;
    sales_person?: string;
    start_date?: string;
    end_date?: string;
    time_window?: string;
  }
): Promise<PermissionQueryResult> {
  const perPage = queryParams.limit || 10;
  const offset = ((queryParams.page || 1) - 1) * perPage;

  // 获取用户权限配置
  const [user] = await db
    .select({ uuid: users.uuid })
    .from(users)
    .where(eq(users.username, operator_name))
    .limit(1);

  if (!user) {
    return {
      records: [],
      totalCount: 0,
      hasMasked: true,
      permissions: {
        canViewAll: false,
        visibleWarehouses: [],
        visibleSalesPersons: [],
        visibleAsins: []
      }
    };
  }

  const visibilityConfig = await getOperatorVisibilityConfig(user.uuid);

  // 构建权限过滤器
  const permissionFilters = [];
  
  if (visibilityConfig.visible_warehouses.length > 0) {
    permissionFilters.push(inArray(inventoryDeals.warehouse_location, visibilityConfig.visible_warehouses));
  }
  
  if (visibilityConfig.visible_sales_persons.length > 0) {
    permissionFilters.push(inArray(inventoryDeals.sales_person, visibilityConfig.visible_sales_persons));
  }
  
  if (visibilityConfig.visible_asins && visibilityConfig.visible_asins.length > 0) {
    permissionFilters.push(inArray(inventoryDeals.asin, visibilityConfig.visible_asins));
  }

  // 其他查询参数
  const queryFilters = [];
  if (queryParams.warehouse) {
    queryFilters.push(eq(inventoryDeals.warehouse_location, queryParams.warehouse));
  }
  if (queryParams.asin) {
    queryFilters.push(eq(inventoryDeals.asin, queryParams.asin));
  }
  if (queryParams.sales_person) {
    queryFilters.push(eq(inventoryDeals.sales_person, queryParams.sales_person));
  }
  if (queryParams.start_date) {
    queryFilters.push(gte(inventoryDeals.snapshot_date, new Date(queryParams.start_date)));
  }
  if (queryParams.end_date) {
    queryFilters.push(lte(inventoryDeals.snapshot_date, new Date(queryParams.end_date)));
  }
  if (queryParams.time_window) {
    queryFilters.push(eq(inventoryDeals.time_window, queryParams.time_window));
  }

  // 组合所有条件
  const whereClause = and(
    ...queryFilters,
    ...(permissionFilters.length > 0 ? [or(...permissionFilters)] : [])
  );

  // 查询总数
  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(inventoryDeals)
    .where(whereClause);

  // 查询数据
  const records = await db
    .select()
    .from(inventoryDeals)
    .where(whereClause)
    .orderBy(inventoryDeals.snapshot_date.desc())
    .limit(perPage)
    .offset(offset);

  // 应用脱敏
  const canViewAll = visibilityConfig.default_access_level === 'full';
  const hasMasked = !canViewAll;

  const maskedRecords = canViewAll ? records : records.map(record => {
    if (visibilityConfig.skip_masking_for_assigned) {
      return record; // 如果配置为跳过分配数据的脱敏
    }

    return {
      ...record,
      // 脱敏处理示例
      product_name: maskProductName(record.product_name),
      asin: maskAsin(record.asin),
      sales_person: maskSalesPerson(record.sales_person)
    };
  });

  return {
    records: maskedRecords,
    totalCount: Number(totalCount),
    hasMasked,
    permissions: {
      canViewAll,
      visibleWarehouses: visibilityConfig.visible_warehouses,
      visibleSalesPersons: visibilityConfig.visible_sales_persons,
      visibleAsins: visibilityConfig.visible_asins || []
    }
  };
}

/**
 * 添加或更新用户权限
 */
export async function assignPermission(config: PermissionConfig) {
  await db.insert(inventorypointsRight)
    .values({
      operator_name: config.operator_name,
      operator_uuid: config.operator_uuid,
      warehouse_location: config.warehouse_location,
      asin: config.asin,
      access_level: config.access_level,
      view_sensitivity_data: config.view_sensitivity_data,
      sales_person: config.sales_person,
      effective_date: config.effective_date || new Date(),
      expiry_date: config.expiry_date,
      granted_by: config.granted_by,
      remarks: config.remarks
    })
    .onConflictDoUpdate({
      target: [
        inventorypointsRight.operator_uuid,
        inventorypointsRight.warehouse_location,
        inventorypointsRight.asin
      ],
      set: {
        access_level: config.access_level,
        view_sensitivity_data: config.view_sensitivity_data,
        updated_at: new Date()
      }
    });

  revalidatePath('/api/inventory');
}

/**
 * 批量配置操作员可见性
 */
export async function configureOperatorVisibility(params: {
  operator_uuid: string;
  operator_name: string;
  visible_warehouses: string[];
  visible_sales_persons: string[];
  visible_asins?: string[];
  masking_rules?: any;
  updated_by: string;
}) {
  await db.insert(operatorVisibility)
    .values({
      operator_uuid: params.operator_uuid,
      operator_name: params.operator_name,
      visible_warehouses: JSON.stringify(params.visible_warehouses),
      visible_sales_persons: JSON.stringify(params.visible_sales_persons),
      visible_asins: params.visible_asins ? JSON.stringify(params.visible_asins) : undefined,
      masking_rules: params.masking_rules ? JSON.stringify(params.masking_rules) : undefined,
      updated_by: params.updated_by,
      last_updated: new Date()
    })
    .onConflictDoUpdate({
      target: operatorVisibility.operator_uuid,
      set: {
        visible_warehouses: JSON.stringify(params.visible_warehouses),
        visible_sales_persons: JSON.stringify(params.visible_sales_persons),
        visible_asins: params.visible_asins ? JSON.stringify(params.visible_asins) : undefined,
        masking_rules: params.masking_rules ? JSON.stringify(params.masking_rules) : undefined,
        updated_by: params.updated_by,
        last_updated: new Date()
      }
    });

  revalidatePath('/api/inventory');
}

/**
 * 脱敏工具函数
 */
function maskProductName(productName: string): string {
  if (!productName) return '';
  if (productName.length <= 6) return productName;
  return productName.substring(0, 4) + '*'.repeat(Math.min(10, productName.length - 4));
}

function maskAsin(asin: string): string {
  if (!asin || asin.length < 8) return asin;
  return asin.substring(0, 3) + '****' + asin.substring(asin.length - 2);
}

function maskSalesPerson(salesPerson: string): string {
  if (!salesPerson) return '';
  if (salesPerson.length <= 2) return salesPerson;
  return salesPerson.charAt(0) + '*'.repeat(salesPerson.length - 2) + salesPerson.slice(-1);
}

// Helper function for count in PostgreSQL
function count() {
  return {
    count: sql`COUNT(*)`
  };
}

// Import sql for count function
import { sql } from 'drizzle-orm';