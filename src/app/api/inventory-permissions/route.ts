/**
 * 库存点权限管理API
 * /api/inventory-permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkUserPermission, 
  getUserVisibleWarehouses, 
  getOperatorVisibilityConfig,
  assignPermission,
  configureOperatorVisibility,
  filterInventoryDataByPermission
} from '@/lib/auth/inventory-permission';

interface APIRequest {
  operator_name: string;
  operator_uuid: string;
  warehouse_location?: string;
  asin?: string;
  access_level: 'full' | 'masked' | 'restricted';
  view_sensitivity_data: boolean;
  sales_person?: string;
  effective_date?: string;
  expiry_date?: string;
  granted_by: string;
  remarks?: string;
}

/**
 * 权限检查：GET /api/inventory-permissions/check
 * 参数：operator_name, warehouse_location, [asin]
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const operator_name = searchParams.get('operator_name');
    const warehouse_location = searchParams.get('warehouse_location');
    const asin = searchParams.get('asin');

    if (!operator_name || !warehouse_location) {
      return NextResponse.json(
        { error: '缺少必要的参数: operator_name 和 warehouse_location' },
        { status: 400 }
      );
    }

    const permission = await checkUserPermission(operator_name, warehouse_location, asin || undefined);
    
    return NextResponse.json(permission);
  } catch (error) {
    console.error('权限检查错误:', error);
    return NextResponse.json(
      { error: '权限检查失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * 获取用户可见仓库列表：GET /api/inventory-permissions/warehouses
 * 参数：operator_name
 */
export async function POST(request: NextRequest) {
  try {
    const { type, ...params } = await request.json();

    switch (type) {
      case 'visible-warehouses':
        return handleGetVisibleWarehouses(params.operator_name);
        
      case 'visibility-config':
        return handleGetVisibilityConfig(params.operator_uuid);
        
      case 'filter-data':
        return handleFilterInventoryData(params);
        
      case 'assign-permission':
        return handleAssignPermission(params);
        
      case 'configure-visibility':
        return handleConfigureVisibility(params);
        
      default:
        return NextResponse.json(
          { error: '未知的请求类型' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('API请求处理错误:', error);
    return NextResponse.json(
      { error: '请求处理失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function handleGetVisibleWarehouses(operator_name: string) {
  if (!operator_name) {
    return NextResponse.json(
      { error: '缺少operator_name参数' },
      { status: 400 }
    );
  }

  const warehouses = await getUserVisibleWarehouses(operator_name);
  return NextResponse.json({ warehouses });
}

async function handleGetVisibilityConfig(operator_uuid: string) {
  if (!operator_uuid) {
    return NextResponse.json(
      { error: '缺少operator_uuid参数' },
      { status: 400 }
    );
  }

  const config = await getOperatorVisibilityConfig(operator_uuid);
  return NextResponse.json({ config });
}

async function handleFilterInventoryData(params: any) {
  const {
    operator_name,
    page = 1,
    limit = 10,
    warehouse,
    asin,
    sales_person,
    start_date,
    end_date,
    time_window
  } = params;

  if (!operator_name) {
    return NextResponse.json(
      { error: '缺少operator_name参数' },
      { status: 400 }
    );
  }

  const result = await filterInventoryDataByPermission(operator_name, {
    page,
    limit,
    warehouse,
    asin,
    sales_person,
    start_date,
    end_date,
    time_window
  });

  return NextResponse.json(result);
}

async function handleAssignPermission(params: any) {
  const {
    operator_name,
    operator_uuid,
    warehouse_location,
    asin,
    access_level,
    view_sensitivity_data,
    sales_person,
    effective_date,
    expiry_date,
    granted_by,
    remarks
  } = params;

  // 验证必填字段
  if (!operator_name || !operator_uuid || !warehouse_location || !granted_by) {
    return NextResponse.json(
      { error: '缺少必要的权限配置参数' },
      { status: 400 }
    );
  }

  try {
    await assignPermission({
      operator_name,
      operator_uuid,
      warehouse_location,
      asin,
      access_level,
      view_sensitivity_data,
      sales_person,
      effective_date: effective_date ? new Date(effective_date) : undefined,
      expiry_date: expiry_date ? new Date(expiry_date) : undefined,
      granted_by,
      remarks
    });

    return NextResponse.json({ 
      success: true, 
      message: '权限分配成功' 
    });
  } catch (error) {
    console.error('权限分配失败:', error);
    return NextResponse.json(
      { error: '权限分配失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function handleConfigureVisibility(params: any) {
  const {
    operator_uuid,
    operator_name,
    visible_warehouses,
    visible_sales_persons,
    visible_asins,
    masking_rules,
    updated_by
  } = params;

  if (!operator_uuid || !operator_name || !updated_by) {
    return NextResponse.json(
      { error: '缺少必要的可见性配置参数' },
      { status: 400 }
    );
  }

  try {
    await configureOperatorVisibility({
      operator_uuid,
      operator_name,
      visible_warehouses,
      visible_sales_persons,
      visible_asins,
      masking_rules,
      updated_by
    });

    return NextResponse.json({ 
      success: true, 
      message: '可见性配置更新成功' 
    });
  } catch (error) {
    console.error('可见性配置更新失败:', error);
    return NextResponse.json(
      { error: '可见性配置更新失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}