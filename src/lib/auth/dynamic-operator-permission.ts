/**
 * 基于operator字段的动态权限管理系统
 * 动态根据数据库表中的operator字段控制权限，而非固定权限分类
 */

import { eq, and, or, inArray, isNull, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db/config';
import { inventorypermissions, operatorpermissionrules, warehouseoperatormapping, inventoryDeals } from '@/db/schema';
import { revalidatePath } from 'next/cache';

export interface OperatorPermission {
  operator: string;
  data_source: string;
  warehouse_location?: string;
  asin?: string;
  sales_person?: string;
  permission_rule: any;
  data_access_level: string;
  masking_config?: any;
  visible_fields?: string[];
  masked_fields?: { [key: string]: any };
}

export interface DynamicPermissionResult {
  hasAccess: boolean;
  canViewOriginalOperator: boolean;
  maskingConfig: any;
  accessibleFields: string[];
  restrictedFields: { [field: string]: string };
}

export interface FilterDataParams {
  page?: number;
  limit?: number;
  operator: string; // 当前登录操作员
  warehouse?: string;
  asin?: string;
  sales_person?: string;
  start_date?: string;
  end_date?: string;
  time_window?: string;
}

/**
 * 检查操作员对数据的权限
 */
export async function checkOperatorPermission(
  requesting_operator: string,
  target_operator: string, // 记录中的operator字段值
  context: {
    warehouse_location?: string;
    asin?: string;
    sales_person?: string;
  } = {}
): Promise<DynamicPermissionResult> {
  
  // 1. 获取特定operator的权限配置
  const [permission] = await db
    .select()
    .from(inventorypermissions)
    .where(
      and(
        eq(inventorypermissions.operator, requesting_operator),
        eq(inventorypermissions.data_source, 'inventory_deals'),
        eq(inventorypermissions.is_active, true),
        or(
          isNull(inventorypermissions.expiry_date),
          gte(inventorypermissions.expiry_date, new Date())
        ),
        // 维度匹配
        or(
          isNull(inventorypermissions.warehouse_location),
          eq(inventorypermissions.warehouse_location, context.warehouse_location || 'ALL')
        ),
        or(
          isNull(inventorypermissions.asin),
          eq(inventorypermissions.asin, context.asin)
        ),
        or(
          isNull(inventorypermissions.sales_person),
          eq(inventorypermissions.sales_person, context.sales_person)
        )
      )
    )
    .orderBy(inventorypermissions.priority || sql`0`) // 按优先级排序
    .limit(1);

  // 2. 如果没有特定权限，使用默认规则
  if (!permission) {
    return await getDefaultOperatorPermission(requesting_operator, target_operator, context);
  }

  // 3. 应用权限规则
  const permission_rule = permission.permission_rule || {};
  
  // 处理基于operator的权限规则
  const result = applyOperatorPermissionRule(
    permission_rule,
    requesting_operator,
    target_operator,
    permission
  );

  return result;
}

/**
 * 应用基于operator的权限规则
 */
function applyOperatorPermissionRule(
  permission_rule: any,
  requesting_operator: string,
  target_operator: string,
  permission: any
): DynamicPermissionResult {
  
  const result: DynamicPermissionResult = {
    hasAccess: false,
    canViewOriginalOperator: false,
    maskingConfig: {},
    accessibleFields: [],
    restrictedFields: {}
  };

  // 处理不同的权限规则类型
  switch (permission.data_access_level) {
    case 'filter_by_operator':
      // 只能看到自己的数据
      result.hasAccess = requesting_operator === target_operator;
      result.canViewOriginalOperator = requesting_operator === target_operator;
      break;

    case 'full_access':
      // 所有人的数据都可以访问
      result.hasAccess = true;
      result.canViewOriginalOperator = true;
      break;

    case 'delegated_only':
      // 只能看到委派的数据或其他特定条件
      const delegated_operators = permission_rule.delegated || [];
      result.hasAccess = delegated_operators.includes(target_operator) || requesting_operator === target_operator;
      result.canViewOriginalOperator = result.hasAccess;
      break;

    case 'team_view':
      // 可以看团队成员的数据
      const team_members = permission_rule.team_members || [];
      const is_teammate = team_members.includes(target_operator);
      result.hasAccess = is_teammate || requesting_operator === target_operator;
      result.canViewOriginalOperator = result.hasAccess;
      break;

    case 'readonly':
    case 'custom':
      // 自定义规则
      result.hasAccess = evaluateCustomPermissionRule(permission_rule, requesting_operator, target_operator);
      result.canViewOriginalOperator = result.hasAccess;
      break;

    case 'all':
    default:
      // 全部数据
      result.hasAccess = true;
      result.canViewOriginalOperator = true;
      break;
  }

  // 设置脱敏配置
  if (permission.masking_config) {
    result.maskingConfig = permission.masking_config;
    
    // 根据operator动态设置脱敏级别
    if (permission.masking_config.operator_based) {
      const maskingByOperator = permission.masking_config.operators || {};
      if (maskingByOperator[target_operator]) {
        result.restrictedFields = maskingByOperator[target_operator];
      }
    }
  }

  return result;
}

/**
 * 获取默认的operator权限
 */
async function getDefaultOperatorPermission(
  requesting_operator: string,
  target_operator: string,
  context: any
): Promise<DynamicPermissionResult> {
  
  // 检查是否有继承的权限规则
  const [defaultRule] = await db
    .select()
    .from(operatorpermissionrules)
    .where(
      and(
        eq(operatorpermissionrules.operator, requesting_operator),
        eq(operatorpermissionrules.rule_type, 'self_only'),
        eq(operatorpermissionrules.is_active, true)
      )
    )
    .limit(1);

  if (defaultRule) {
    return applyOperatorPermissionRule(
      JSON.parse(defaultRule.rule_config || '{}'),
      requesting_operator,
      target_operator,
      defaultRule
    );
  }

  // 默认返回：只能看到自己的数据
  return {
    hasAccess: requesting_operator === target_operator, 
    canViewOriginalOperator: requesting_operator === target_operator,
    maskingConfig: {},
    accessibleFields: [],
    restrictedFields: {}
  };
}

/**
 * 评估自定义权限规则
 */
function evaluateCustomPermissionRule(
  rule_config: any,
  requesting_operator: string,
  target_operator: string
): boolean {
  
  // 规则可以有多种条件：匹配、包含、排除等
  if (rule_config.match) {
    return rule_config.match.includes(target_operator);
  }
  
  if (rule_config.exclude) {
    return !rule_config.exclude.includes(target_operator);
  }
  
  if (rule_config.include_team) {
    return requesting_operator === target_operator || rule_config.include_team === true;
  }
  
  // 默认只允许看自己
  return requesting_operator === target_operator;
}

/**
 * 根据operator过滤数据
 */
export async function filterInventoryDataByOperator(
  params: FilterDataParams
): Promise<{
  records: any[];
  totalCount: number;
  operator_permissions: { [operator: string]: DynamicPermissionResult };
}> {
  
  const perPage = params.limit || 10;
  const offset = ((params.page || 1) - 1) * perPage;

  // 构建基础查询
  const filters = [];
  if (params.warehouse) {
    filters.push(eq(inventoryDeals.warehouse_location, params.warehouse));
  }
  if (params.asin) {
    filters.push(eq(inventoryDeals.asin, params.asin));
  }
  if (params.sales_person) {
    filters.push(eq(inventoryDeals.sales_person, params.sales_person));
  }
  if (params.start_date) {
    filters.push(gte(inventoryDeals.snapshot_date, new Date(params.start_date)));
  }
  if (params.end_date) {
    filters.push(lte(inventoryDeals.snapshot_date, new Date(params.end_date)));
  }
  if (params.time_window) {
    filters.push(eq(inventoryDeals.time_window, params.time_window));
  }

  // 获取所有相关的operator记录
  const baseRecords = await db
    .select()
    .from(inventoryDeals)
    .where(and(...filters))
    .orderBy(inventoryDeals.snapshot_date.desc())
    .limit(perPage)
    .offset(offset);

  // 获取总数
  const [{ count }] = await db
    .select({ count: sql`COUNT(*)` })
    .from(inventoryDeals)
    .where(and(...filters));

  // 处理每条记录的权限
  const permission_results: { [operator: string]: DynamicPermissionResult } = {};
  const filtered_records = [];

  for (const record of baseRecords) {
    const current_record_operator = record.sales_person;
    
    // checkUserPermission instead of session.user.username
    if (!permission_results[current_record_operator]) {
      permission_results[current_record_operator] = await checkOperatorPermission(
        params.operator,  // requesting_operator
        current_record_operator,  // target_operator from the record
        {
          warehouse_location: record.warehouse_location,
          asin: record.asin,
          sales_person: current_record_operator
        }
      );
    }

    const permission = permission_results[current_record_operator];
    
    if (permission.hasAccess) {
      let processedRecord = { ...record };
      
      // 应用字段级权限和脱敏
      processedRecord = applyFieldMasking(processedRecord, permission);
      
      filtered_records.push(processedRecord);
    }
  }

  return {
    records: filtered_records,
    totalCount: Number(count),
    operator_permissions: permission_results
  };
}

/**
 * 应用字段级脱敏
 */
function applyFieldMasking(record: any, permission: DynamicPermissionResult): any {
  const maskedRecord = { ...record };
  
  // 检查哪些字段需要脱敏
  if (permission.maskingConfig.fields) {
    for (const [field, config] of Object.entries(permission.maskingConfig.fields)) {
      if (record[field] !== undefined) {
        maskedRecord[field] = applyFieldMask(record[field], config);
      }
    }
  }
  
  return maskedRecord;
}

/**
 * 应用单个字段的脱敏
 */
function applyFieldMask(value: any, mask_config: any): any {
  if (!value) return value;
  
  switch (mask_config.type) {
    case 'partial':
      return String(value).substring(0, mask_config.visible_chars || 3) + '***';
    
    case 'hash':
      return createHashMask(String(value));
    
    case 'range':
      return maskValueRange(Number(value), mask_config);
    
    case 'hidden':
      return '[权限受限]';
    
    default:
      return value;
  }
}

/**
 * 数值范围脱敏
 */
function maskValueRange(value: number, config: any): string {
  const ranges = config.ranges || [
    { max: 1000, label: '< $1K' },
    { max: 10000, label: '$1K-$10K' },
    { max: 100000, label: '$10K-$100K' },
    { max: Infinity, label: '>$100K' }
  ];
  
  for (const range of ranges) {
    if (value < range.max) {
      return range.label;
    }
  }
  
  return 'Unknown';
}

/**
 * 创建数据哈希（用于脱敏）
 */
function createHashMask(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const hashHex = Math.abs(hash).toString(36);
  return hashHex.substring(0, 8);
}

/**
 * 配置操作员权限规则
 */
export async function configureOperatorPermission(
  operator: string,
  config: {
    rule_type: string;
    rule_config: any;
    filter_criteria?: any;
    masking_config?: any;
    warehouse_location?: string;
    asin?: string;
    sales_person?: string;
    data_source?: string;
    created_by: string;
  }
) {
  await db.insert(inventorypermissions).values({
    operator,
    data_source: config.data_source || 'inventory_deals',
    warehouse_location: config.warehouse_location,
    asin: config.asin,
    sales_person: config.sales_person,
    permission_rule: config.rule_config,
    data_access_level: config.rule_type,
    masking_config: config.masking_config,
    conditions: config.filter_criteria,
    config_author: config.created_by,
    description: `权限配置: ${config.rule_type} - ${operator}`
  });

  revalidatePath('/api/inventory');
}

/**
 * 获取操作员的权限规则定义
 */
export async function getOperatorRules(operator: string): Promise<any[]> {
  const rules = await db
    .select()
    .from(operatorpermissionrules)
    .where(
      and(
        eq(operatorpermissionrules.operator, operator),
        eq(operatorpermissionrules.is_active, true)
      )
    )
    .orderBy(operatorpermissionrules.priority);

  return rules;
}

/**
 * 验证操作员权限配置
 */
export async function validateOperatorConfig(operator: string): Promise<{
  is_valid: boolean;
  errors: string[];
  permissions: any[];
}> {
  const permissions = await getOperatorRules(operator);
  const errors: string[] = [];

  if (permissions.length === 0) {
    errors.push(`操作员 ${operator} 没有任何权限配置`);
  }

  // 验证规则配置
  for (const perm of permissions) {
    try {
      JSON.parse(perm.rule_config || '{}');
    } catch (e) {
      errors.push(`操作员 ${operator} 的规则配置格式不正确`);
    }
  }

  return {
    is_valid: errors.length === 0,
    errors,
    permissions
  };
}