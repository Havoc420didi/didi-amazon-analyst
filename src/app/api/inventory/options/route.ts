import { NextRequest, NextResponse } from 'next/server';
import { getSalesPersonList, getAsinList } from '@/models/inventory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'sales_person' | 'asin'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

    let data;

    switch (type) {
      case 'sales_person':
        data = await getSalesPersonList();
        break;
      case 'asin':
        data = await getAsinList(limit);
        break;
      default:
        // 返回所有选项
        const [salesPersons, asins] = await Promise.all([
          getSalesPersonList(),
          getAsinList(limit)
        ]);
        data = {
          sales_persons: salesPersons,
          asins: asins,
          warehouse_locations: ['英国', '欧盟'],
          inventory_statuses: ['库存不足', '周转合格', '周转超标']
        };
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Inventory options error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '获取选项列表失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';