import { NextRequest, NextResponse } from 'next/server';
import { getInventoryLocationHistory } from '@/models/inventory';
import { WarehouseLocationEnum } from '@/lib/inventory-schema';

interface RouteParams {
  params: Promise<{ location: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { location } = await params;
    const { searchParams } = new URL(request.url);
    
    // 验证库存点参数
    const locationResult = WarehouseLocationEnum.safeParse(location);
    if (!locationResult.success) {
      return NextResponse.json(
        { success: false, message: '无效的库存点参数，支持的值: 英国, 欧盟' },
        { status: 400 }
      );
    }

    const asin = searchParams.get('asin') || undefined;
    const date_from = searchParams.get('date_from') || undefined;
    const date_to = searchParams.get('date_to') || undefined;

    // 验证日期格式
    if (date_from && !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      return NextResponse.json(
        { success: false, message: '开始日期格式无效，请使用YYYY-MM-DD格式' },
        { status: 400 }
      );
    }

    if (date_to && !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      return NextResponse.json(
        { success: false, message: '结束日期格式无效，请使用YYYY-MM-DD格式' },
        { status: 400 }
      );
    }

    const records = await getInventoryLocationHistory(
      locationResult.data,
      asin,
      date_from,
      date_to
    );

    return NextResponse.json({
      success: true,
      data: {
        location: locationResult.data,
        records,
        total: records.length
      }
    });

  } catch (error) {
    console.error('Inventory location history error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '获取库存点历史数据失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';