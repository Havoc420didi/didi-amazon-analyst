import { NextRequest, NextResponse } from 'next/server';
import { getInventoryStats } from '@/models/inventory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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

    const stats = await getInventoryStats(date_from, date_to);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Inventory stats error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '获取统计信息失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';