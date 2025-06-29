import { NextRequest, NextResponse } from 'next/server';
import { InventoryFilterParamsSchema } from '@/lib/inventory-schema';
import { getInventoryRecords, getLatestInventoryRecords } from '@/models/inventory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const rawParams = {
      sales_person: searchParams.get('sales_person') || undefined,
      asin: searchParams.get('asin') || undefined,
      warehouse_location: searchParams.get('warehouse_location') || undefined,
      inventory_status: searchParams.get('inventory_status') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      sort_by: searchParams.get('sort_by') || undefined,
      sort_order: searchParams.get('sort_order') as 'asc' | 'desc' || undefined,
      latest_only: searchParams.get('latest_only') === 'true', // 是否只获取最新记录
    };

    // 验证参数
    const validatedParams = InventoryFilterParamsSchema.parse(rawParams);

    // 根据是否需要最新记录选择不同的查询方法
    const result = rawParams.latest_only 
      ? await getLatestInventoryRecords(validatedParams)
      : await getInventoryRecords(validatedParams);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Inventory query error:', error);
    
    if (error instanceof Error && error.message.includes('Invalid')) {
      return NextResponse.json(
        { 
          success: false, 
          message: '查询参数无效: ' + error.message 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        message: '查询失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';