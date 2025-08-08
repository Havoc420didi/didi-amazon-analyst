import { NextRequest, NextResponse } from 'next/server';
import { SaiHuAdapter } from '@/lib/adapters/saihu-adapter';

const saiHuAdapter = new SaiHuAdapter();

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

    // 使用MySQL数据源获取统计信息
    const dashboardData = await saiHuAdapter.getAdDashboard({
      start_date: date_from,
      end_date: date_to
    });

    // 转换数据格式以匹配前端期望的格式
    const stats = {
      total_products: dashboardData.summary.totalProducts || 0,
      total_inventory: dashboardData.summary.totalInventory || 0,
      total_daily_revenue: dashboardData.summary.totalDailySales || 0,
      total_ad_spend: dashboardData.summary.totalAdSpend || 0,
      inventory_status_distribution: {
        '库存不足': dashboardData.inventoryPoints?.filter(p => p.status.isOutOfStock).length || 0,
        '周转合格': dashboardData.inventoryPoints?.filter(p => p.status.isEffective && !p.status.isTurnoverExceeded).length || 0,
        '周转超标': dashboardData.inventoryPoints?.filter(p => p.status.isTurnoverExceeded).length || 0,
      },
      warehouse_distribution: dashboardData.distribution?.reduce((acc, item) => {
        acc[item.marketplace] = item.pointCount || 0;
        return acc;
      }, {} as Record<string, number>) || {}
    };

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