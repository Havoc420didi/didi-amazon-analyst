/**
 * 库存点权限中间件
 * 用于处理数据脱敏和权限验证
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { filterInventoryDataByPermission } from '@/lib/auth/inventory-permission';

/**
 * 库存数据权限检查中间件
 */
export async function inventoryPermissionMiddleware(
  request: NextRequest,
  next: () => Promise<NextResponse>
) {
  const path = request.nextUrl.pathname;
  
  // 只对库存相关API应用权限检查
  if (!path.startsWith('/api/inventory')) {
    return next();
  }

  // 检查用户是否已登录
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json(
      { error: '未登录用户' },
      { status: 401 }
    );
  }

  // 对于GET请求，根据operator_name进行权限过滤
  if (request.method === 'GET') {
    const searchParams = request.nextUrl.searchParams;
    const operator_name = searchParams.get('operator_name') || session.user.username;
    
    // 验证操作员是否为自己或有权限代理
    if (operator_name !== session.user.username) {
      // 这里可以添加管理员权限检查逻辑
      const hasAdminPermission = await checkAdminPermission(session.user.username);
      if (!hasAdminPermission) {
        return NextResponse.json(
          { error: '无权查看其他操作员的数据' },
          { status: 403 }
        );
      }
    }

    // 获取查询参数并应用权限过滤
    const queryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      warehouse: searchParams.get('warehouse') || undefined,
      asin: searchParams.get('asin') || undefined,
      sales_person: searchParams.get('sales_person') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      time_window: searchParams.get('time_window') || undefined,
    };

    try {
      const result = await filterInventoryDataByPermission(operator_name, queryParams);
      
      // 添加权限相关的响应头
      const response = NextResponse.json(result);
      response.headers.set('X-Permissions-Status', result.hasMasked ? 'masked' : 'full');
      response.headers.set('X-Visible-Warehouses', result.permissions.visibleWarehouses.join(','));
      
      return response;
    } catch (error) {
      console.error('权限过滤错误:', error);
      return NextResponse.json(
        { error: '数据权限检查失败' },
        { status: 500 }
      );
    }
  }

  return next();
}

/**
 * 检查用户是否具有管理员权限
 */
async function checkAdminPermission(username: string): Promise<boolean> {
  // 这里可以连接数据库检查管理员权限
  // 或者从session中获取用户角色信息
  
  // 暂时返回false，实际应用中需要实现具体的权限检查逻辑
  return username === 'admin' || username.startsWith('system');
}

/**
 * Next.js中间件配置
 */
import { NextMiddleware } from 'next/server';

export const inventoryMiddleware: NextMiddleware = async (request) => {
  // 使用中间件处理
  return inventoryPermissionMiddleware(request, async () => {
    // 正常请求处理
    return NextResponse.next();
  });
};