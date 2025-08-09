import { NextRequest, NextResponse } from 'next/server';
import { AIAnalysisModel } from '@/models/ai-analysis';
import { AnalysisTaskQueryParams } from '@/types/ai-analysis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const queryParams: AnalysisTaskQueryParams = {
      asin: searchParams.get('asin') || undefined,
      warehouse_location: searchParams.get('warehouse_location') || undefined,
      status: searchParams.get('status') as any || undefined,
      executor: searchParams.get('executor') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sort_by: searchParams.get('sort_by') as any || 'created_at',
      sort_order: searchParams.get('sort_order') as any || 'desc'
    };

    // 验证分页参数
    if ((queryParams.page ?? 1) < 1) queryParams.page = 1;
    if ((queryParams.limit ?? 20) < 1 || (queryParams.limit ?? 20) > 100) queryParams.limit = 20;

    const result = await AIAnalysisModel.queryTasks(queryParams);

    // 处理返回的产品数据，解析JSON字符串
    const processedData = result.data.map(task => {
      let productData = null;
      try {
        productData = JSON.parse(task.product_data);
      } catch (error) {
        console.error(`Failed to parse product data for task ${task.id}:`, error);
        productData = { error: '数据解析失败' };
      }

      return {
        ...task,
        product_data: productData
      };
    });

    return NextResponse.json({
      success: true,
      data: processedData,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Query analysis tasks error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}

// 获取统计信息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'stats') {
      const stats = await AIAnalysisModel.getStats();
      return NextResponse.json({
        success: true,
        data: stats
      });
    }

    if (action === 'latest') {
      const { asin, warehouse_location } = body;
      
      if (!asin || !warehouse_location) {
        return NextResponse.json({
          success: false,
          error: 'ASIN和库存点不能为空'
        }, { status: 400 });
      }

      const task = await AIAnalysisModel.getLatestAnalysis(asin, warehouse_location);
      
      if (!task) {
        return NextResponse.json({
          success: true,
          data: null,
          message: '暂无分析记录'
        });
      }

      // 解析产品数据
      let productData = null;
      try {
        productData = JSON.parse(task.product_data);
      } catch (error) {
        console.error('Failed to parse product data:', error);
        productData = { error: '数据解析失败' };
      }

      return NextResponse.json({
        success: true,
        data: {
          ...task,
          product_data: productData
        }
      });
    }

    if (action === 'history') {
      const { asin, warehouse_location, limit = 10 } = body;
      
      if (!asin || !warehouse_location) {
        return NextResponse.json({
          success: false,
          error: 'ASIN和库存点不能为空'
        }, { status: 400 });
      }

      const tasks = await AIAnalysisModel.getAnalysisHistory(asin, warehouse_location, limit);
      
      return NextResponse.json({
        success: true,
        data: tasks.map(task => ({
          ...task,
          product_data: (() => {
            try {
              return JSON.parse(task.product_data);
            } catch (error) {
              console.error('Failed to parse product data:', error);
              return { error: '数据解析失败' };
            }
          })()
        }))
      });
    }

    if (action === 'cleanup') {
      const deletedCount = await AIAnalysisModel.cleanupOldTasks();
      return NextResponse.json({
        success: true,
        message: `已清理 ${deletedCount} 个旧任务`,
        data: { deleted_count: deletedCount }
      });
    }

    return NextResponse.json({
      success: false,
      error: '不支持的操作'
    }, { status: 400 });

  } catch (error) {
    console.error('Analysis action error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}