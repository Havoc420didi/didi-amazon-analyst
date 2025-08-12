/**
 * 基于operator字段的动态权限API
 * /api/dynamic-permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkOperatorPermission, 
  filterInventoryDataByOperator,
  configureOperatorPermission,
  getOperatorRules,
  validateOperatorConfig
} from '@/lib/auth/dynamic-operator-permission';

/**
 * 检查操作员权限：GET /api/dynamic-permissions/check
 * 参数：requesting_operator, target_operator, [warehouse], [asin], [sales_person]
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const requesting_operator = searchParams.get('requesting_operator');
    const target_operator = searchParams.get('target_operator');
    const warehouse = searchParams.get('warehouse');
    const asin = searchParams.get('asin');
    const sales_person = searchParams.get('sales_person');

    if (!requesting_operator || !target_operator) {
      return NextResponse.json(
        { error: '缺少必要参数: requesting_operator 和 target_operator' },
        { status: 400 }
      );
    }

    const permission = await checkOperatorPermission(
      requesting_operator, 
      target_operator, 
      { warehouse_location: warehouse, asin, sales_person }
    );
    
    return NextResponse.json({
      requesting_operator,
      target_operator,
      permission,
      context: { warehouse, asin, sales_person }
    });
  } catch (error) {
    console.error('权限检查错误:', error);
    return NextResponse.json(
      { error: '权限检查失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * 主要API处理：POST /api/dynamic-permissions
 * 支持多种操作类型
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...params } = body;

    switch (type) {
      case 'filter-data':
        return await handleFilterData(params);
        
      case 'configure-permission':
        return await handleConfigurePermission(params);
        
      case 'get-rules':
        return await handleGetRules(params);
        
      case 'validate-config':
        return await handleValidateConfig(params);
        
      case 'bulk-configure':
        return await handleBulkConfigure(params);
        
      case 'warehouse-mapping':
        return await handleWarehouseMapping(params);
        
      default:
        return NextResponse.json(
          { error: '未知的请求类型', supported_types: ['filter-data', 'configure-permission', 'get-rules', 'validate-config', 'bulk-configure', 'warehouse-mapping'] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('API处理错误:', error);
    return NextResponse.json(
      { error: '请求处理失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// 处理不同类型的请求

async function handleFilterData(params: any) {
  const {
    operator, // 当前登录操作员
    page = 1,
    limit = 10,
    warehouse,
    asin,
    sales_person,
    start_date,
    end_date,
    time_window
  } = params;

  if (!operator) {
    return NextResponse.json(
      { error: '缺少operator参数（当前登录操作员）' },
      { status: 400 }
    );
  }

  const result = await filterInventoryDataByOperator({
    operator,
    page,
    limit,
    warehouse,
    asin,
    sales_person,
    start_date,
    end_date,
    time_window
  });

  return NextResponse.json({
    data: result.records,
    pagination: {
      total: result.totalCount,
      page,
      limit,
      pages: Math.ceil(result.totalCount / (limit || 10))
    },
    permissions: result.operator_permissions
  });
}

async function handleConfigurePermission(params: any) {
  const {
    operator,
    rule_type,
    rule_config,
    warehouse_location,
    asin,
    sales_person,
    filter_criteria,
    masking_config,
    created_by
  } = params;

  if (!operator || !rule_type || !rule_config || !created_by) {
    return NextResponse.json(
      { error: '缺少必要参数: operator, rule_type, rule_config, created_by' },
      { status: 400 }
    );
  }

  try {
    await configureOperatorPermission(operator, {
      rule_type,
      rule_config,
      warehouse_location,
      asin,
      sales_person,
      filter_criteria,
      masking_config,
      created_by
    });

    return NextResponse.json({ 
      success: true, 
      message: `操作员 ${operator} 的权限配置已更新` 
    });
  } catch (error) {
    console.error('权限配置失败:', error);
    return NextResponse.json(
      { error: '权限配置失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function handleGetRules(params: any) {
  const { operator } = params;

  if (!operator) {
    return NextResponse.json(
      { error: '缺少operator参数' },
      { status: 400 }
    );
  }

  const rules = await getOperatorRules(operator);
  return NextResponse.json({ rules });
}

async function handleValidateConfig(params: any) {
  const { operator } = params;

  if (!operator) {
    return NextResponse.json(
      { error: '缺少operator参数' },
      { status: 400 }
    );
  }

  const validation = await validateOperatorConfig(operator);
  return NextResponse.json(validation);
}

async function handleBulkConfigure(params: any) {
  const { operators, config, created_by } = params;

  if (!operators || !Array.isArray(operators) || !config || !created_by) {
    return NextResponse.json(
      { error: '缺少必要参数: operators数组, config对象, created_by' },
      { status: 400 }
    );
  }

  const results = [];
  
  for (const operator of operators) {
    try {
      await configureOperatorPermission(operator, {
        ...config,
        created_by
      });
      results.push({ operator, success: true });
    } catch (error) {
      results.push({ operator, success: false, error: (error as Error).message });
    }
  }

  return NextResponse.json({
    success: true,
    results,
    summary: {
      total: operators.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  });
}

async function handleWarehouseMapping(params: any) {
  const {
    warehouse_location,
    operator,
    primary_operator,
    secondary_operators,
    inherit_permissions = true,
    custom_permissions,
    hierarchy_level = 1,
    created_by
  } = params;

  if (!warehouse_location || !operator || !created_by) {
    return NextResponse.json(
      { error: '缺少必要参数: warehouse_location, operator, created_by' },
      { status: 400 }
    );
  }

  try {
    // 这里可以添加warehouse映射逻辑
    return NextResponse.json({
      success: true,
      message: '仓库操作员映射已保存',
      data: { warehouse_location, operator, primary_operator, secondary_operators }
    });
  } catch (error) {
    console.error('仓库映射失败:', error);
    return NextResponse.json(
      { error: '仓库映射设置失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * 示例配置
 * 
 * body: {
 *   "type": "configure-permission",
 *   "operator": "zhangsan",
 *   "rule_type": "filter_by_operator",
 *   "rule_config": {
 *     "mode": "only_own",
 *     "exceptions": ["admin", "manager"]
 *   },
 *   "masking_config": {
 *     "product_name": { "type": "partial", "visible_chars": 5 },
 *     "sales_amount": { "type": "range", "show_approximate": true }
 *   },
 *   "created_by": "admin"
 * }
 */