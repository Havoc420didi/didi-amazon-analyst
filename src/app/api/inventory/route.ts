import { NextRequest, NextResponse } from 'next/server';
import { SaiHuAdapter } from '@/lib/adapters/saihu-adapter';

const saiHuAdapter = new SaiHuAdapter();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const asin = searchParams.get('asin') || undefined;
    const marketplace = searchParams.get('warehouse_location') || undefined;
    const salesPerson = searchParams.get('sales_person') || undefined;
    const dateFrom = searchParams.get('date_from') || undefined;
    const dateTo = searchParams.get('date_to') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const latestOnly = searchParams.get('latest_only') === 'true';
    const sortBy = searchParams.get('sort_by') || 'date';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    // 如果请求最新数据，调整查询参数
    if (latestOnly) {
      // 获取最新数据时，限制为1条记录
      const result = await saiHuAdapter.getInventoryPoints({
        asin,
        marketplace,
        salesPerson,
        startDate: dateFrom,
        endDate: dateTo,
        page: 1,
        limit: 1
      });

      // 转换数据格式以匹配前端期望的格式
      const transformedData = result.data.map(point => ({
        id: point.id,
        asin: point.asin,
        product_name: point.productName,
        sales_person: point.salesPerson || '未分配',
        warehouse_location: point.marketplace,
        date: point.dataDate,
        fba_available: point.inventory.fbaAvailable,
        fba_in_transit: point.inventory.fbaInbound,
        local_warehouse: point.inventory.localAvailable,
        total_inventory: point.inventory.total,
        avg_sales: point.sales.averageSales,
        daily_revenue: point.sales.dailySalesAmount,
        inventory_turnover_days: point.sales.turnoverDays,
        inventory_status: point.status.isOutOfStock ? '库存不足' : 
                          point.status.isTurnoverExceeded ? '周转超标' : '周转合格',
        ad_impressions: point.advertising.impressions,
        ad_clicks: point.advertising.clicks,
        ad_spend: point.advertising.spend,
        ad_orders: 0, // AdMetrics接口中没有orders字段，使用默认值
        ad_ctr: point.advertising.ctr,
        ad_conversion_rate: point.advertising.cvr,
        acos: point.advertising.acoas,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        analysis_count: 0
      }));

      return NextResponse.json({
        success: true,
        data: transformedData,
        pagination: {
          page: 1,
          limit: 1,
          total: result.total,
          total_pages: 1
        }
      });
    }

    // 使用MySQL数据源获取库存点数据
    const result = await saiHuAdapter.getInventoryPoints({
      asin,
      marketplace,
      salesPerson,
      startDate: dateFrom,
      endDate: dateTo,
      page,
      limit
    });

    // 转换数据格式以匹配前端期望的格式
    const transformedData = result.data.map(point => ({
      id: point.id,
      asin: point.asin,
      product_name: point.productName,
      sales_person: point.salesPerson || '未分配',
      warehouse_location: point.marketplace,
      date: point.dataDate,
      fba_available: point.inventory.fbaAvailable,
      fba_in_transit: point.inventory.fbaInbound,
      local_warehouse: point.inventory.localAvailable,
      total_inventory: point.inventory.total,
      avg_sales: point.sales.averageSales,
      daily_revenue: point.sales.dailySalesAmount,
      inventory_turnover_days: point.sales.turnoverDays,
      inventory_status: point.status.isOutOfStock ? '库存不足' : 
                        point.status.isTurnoverExceeded ? '周转超标' : '周转合格',
      ad_impressions: point.advertising.impressions,
      ad_clicks: point.advertising.clicks,
      ad_spend: point.advertising.spend,
      ad_orders: 0, // AdMetrics接口中没有orders字段，使用默认值
      ad_ctr: point.advertising.ctr,
      ad_conversion_rate: point.advertising.cvr,
      acos: point.advertising.acoas,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      analysis_count: 0
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.totalPages
      }
    });

  } catch (error) {
    console.error('Inventory query error:', error);
    
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