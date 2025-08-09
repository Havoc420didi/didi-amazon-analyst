/**
 * 批量AI分析API
 * 支持Excel数据批量分析，集成现有库存点合并逻辑
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIAnalysisModel } from '@/models/ai-analysis';
import { getHeliosAgent } from '@/app/api/ai-analysis/agents/helios-agent';
import DataIntegrationService, { type ProductData } from '@/app/api/ai-analysis/services/data-integration';
// import { ProductData } from '@/types/inventory';
import { ProductAnalysisData } from '@/types/ai-analysis';
import { z } from 'zod';

// 批量分析请求参数验证schema
const batchAnalysisSchema = z.object({
  executor: z.string().min(1, '执行人不能为空'),
  analysis_type: z.enum(['all', 'priority', 'custom']).default('all'),
  filter_criteria: z.object({
    min_daily_revenue: z.number().optional(),
    max_inventory_days: z.number().optional(),
    min_inventory_days: z.number().optional(),
    include_zero_sales: z.boolean().default(false),
    marketplaces: z.array(z.string()).optional(),
    sales_persons: z.array(z.string()).optional()
  }).optional(),
  products_data: z.array(z.object({
    asin: z.string(),
    sku: z.string().optional(),
    productName: z.string(),
    salesPerson: z.string(),
    marketplace: z.string(),
    // 库存数据
    fbaAvailable: z.number().min(0),
    fbaInbound: z.number().min(0), 
    localAvailable: z.number().min(0).optional(),
    // 销售数据
    averageSales: z.number().min(0),
    sales7Days: z.number().min(0).optional(),
    // 广告数据
    adImpressions: z.number().min(0).optional(),
    adClicks: z.number().min(0).optional(),
    adSpend: z.number().min(0).optional(),
    adOrderCount: z.number().min(0).optional(),
    // 其他可选字段
    productTag: z.string().optional(),
    fbaSellable: z.number().optional(),
    averagePrice: z.string().optional()
  })).min(1, '产品数据不能为空')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证请求参数
    const validationResult = batchAnalysisSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '请求参数无效',
        details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      }, { status: 400 });
    }

    const { executor, analysis_type, filter_criteria, products_data } = validationResult.data;

    // 转换产品数据格式为标准ProductData
    const productDataList: ProductData[] = products_data.map(product => ({
      ...product,
      localAvailable: product.localAvailable || 0,
      sales7Days: product.sales7Days || 0,
      adImpressions: product.adImpressions || 0,
      adClicks: product.adClicks || 0,
      adSpend: product.adSpend || 0,
      adOrderCount: product.adOrderCount || 0,
      productTag: product.productTag || '',
      fbaSellable: product.fbaSellable || product.fbaAvailable,
      averagePrice: product.averagePrice || '0'
    }));

    console.log(`Received ${productDataList.length} products for batch analysis`);

    // 使用数据集成服务处理Excel数据
    const analysisDataList = await DataIntegrationService.processExcelDataForAI(productDataList);
    console.log(`Processed into ${analysisDataList.length} analysis data points`);

    // 应用过滤条件
    let filteredData = analysisDataList;
    if (filter_criteria && analysis_type !== 'all') {
      filteredData = applyFilterCriteria(analysisDataList, filter_criteria);
      console.log(`Filtered to ${filteredData.length} products based on criteria`);
    }

    // 根据分析类型选择产品
    let selectedData: ProductAnalysisData[] = [];
    switch (analysis_type) {
      case 'all':
        selectedData = filteredData;
        break;
      case 'priority':
        selectedData = selectPriorityProducts(filteredData);
        break;
      case 'custom':
        selectedData = filteredData;
        break;
    }

    if (selectedData.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有符合条件的产品需要分析'
      }, { status: 400 });
    }

    console.log(`Selected ${selectedData.length} products for analysis`);

    // 创建批量分析任务
    const batchId = generateBatchId();
    const tasks: any[] = [];

    for (const productData of selectedData) {
      // 检查是否已有近期分析
      const recentTasks = await AIAnalysisModel.queryTasks({
        asin: productData.asin,
        warehouse_location: productData.warehouse_location,
        status: 'completed',
        limit: 1
      });

      // 如果24小时内有分析，跳过
      const shouldSkip = recentTasks.data.length > 0 && 
        (Date.now() - new Date(recentTasks.data[0].created_at).getTime()) < 24 * 60 * 60 * 1000;

      if (shouldSkip) {
        console.log(`Skipping ${productData.asin}-${productData.warehouse_location}: analyzed within 24h`);
        continue;
      }

      // 创建分析任务
      const task = await AIAnalysisModel.createTask({
        asin: productData.asin,
        warehouse_location: productData.warehouse_location,
        executor,
        product_data: productData,
        batch_id: batchId
      });

      tasks.push(task);
    }

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '所有产品在24小时内都已分析过，无需重复分析'
      }, { status: 400 });
    }

    // 异步处理批量分析
    processBatchAnalysisAsync(tasks, selectedData).catch(error => {
      console.error(`Batch analysis ${batchId} failed:`, error);
    });

    return NextResponse.json({
      success: true,
      message: `批量分析任务已创建，共${tasks.length}个产品`,
      data: {
        batch_id: batchId,
        total_tasks: tasks.length,
        task_ids: tasks.map(t => t.id),
        estimated_completion_time: Math.ceil(tasks.length * 30 / 60) // 预估完成时间（分钟）
      }
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}

/**
 * 应用过滤条件
 */
function applyFilterCriteria(data: ProductAnalysisData[], criteria: any): ProductAnalysisData[] {
  return data.filter(item => {
    // 最小日收入过滤
    if (criteria.min_daily_revenue && item.daily_revenue < criteria.min_daily_revenue) {
      return false;
    }

    // 库存天数范围过滤
    if (criteria.max_inventory_days && (item.inventory_turnover_days ?? Infinity) > criteria.max_inventory_days) {
      return false;
    }
    if (criteria.min_inventory_days && (item.inventory_turnover_days ?? 0) < criteria.min_inventory_days) {
      return false;
    }

    // 零销量过滤
    if (!criteria.include_zero_sales && item.avg_sales === 0) {
      return false;
    }

    // 市场过滤
    if (criteria.marketplaces && criteria.marketplaces.length > 0) {
      if (!criteria.marketplaces.includes(item.warehouse_location)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 选择优先级产品（有问题的产品优先）
 */
function selectPriorityProducts(data: ProductAnalysisData[]): ProductAnalysisData[] {
  const priorityData = data.filter(item => {
    // 库存不足
    if ((item.inventory_turnover_days ?? 0) < 40) return true;
    
    // 库存积压
    if ((item.inventory_turnover_days ?? 0) > 90) return true;
    
    // 转化率问题（需要计算）
    const avgPrice = item.avg_sales > 0 ? item.daily_revenue / item.avg_sales : 0;
    const standardCvr = DataIntegrationService.calculateStandardConversionRate(avgPrice);
    const actualCvr = item.ad_clicks > 0 ? (item.ad_orders / item.ad_clicks) * 100 : 0;
    if (actualCvr < standardCvr * 0.9) return true;
    
    // ACOAS过高
    if ((item.acos ?? 0) > 0.15) return true;
    
    // 日收入较高的产品
    if (item.daily_revenue >= 50) return true;
    
    return false;
  });

  // 按日收入降序排列，优先分析重要产品
  return priorityData.sort((a, b) => b.daily_revenue - a.daily_revenue);
}

/**
 * 生成批次ID
 */
function generateBatchId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `BATCH_${timestamp}_${random}`.toUpperCase();
}

/**
 * 异步处理批量分析
 */
async function processBatchAnalysisAsync(tasks: any[], analysisData: ProductAnalysisData[]) {
  const heliosAgent = getHeliosAgent();
  const batchId = tasks[0]?.batch_id;

  console.log(`Starting batch analysis ${batchId} with ${tasks.length} tasks`);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const productData = analysisData.find(d => d.asin === task.asin && d.warehouse_location === task.warehouse_location);
    
    if (!productData) {
      console.error(`Product data not found for task ${task.id}`);
      await AIAnalysisModel.updateTaskStatus(task.id, 'failed', {
        analysis_content: '产品数据丢失'
      });
      continue;
    }

    try {
      // 更新任务状态
      await AIAnalysisModel.updateTaskStatus(task.id, 'processing');

      // 增强数据
      const enhancedData = DataIntegrationService.enhanceAnalysisData(productData);

      // 执行分析
      const result = await heliosAgent.analyze(enhancedData);

      // 保存结果
      await AIAnalysisModel.saveAnalysisResult(
        task.id,
        result.analysis_content,
        result.processing_time,
        result.tokens_used,
        {
          analysis_method: 'helios_agent_batch',
          batch_id: batchId,
          batch_position: i + 1,
          batch_total: tasks.length
        }
      );

      console.log(`Batch ${batchId}: Task ${i + 1}/${tasks.length} completed (${task.asin})`);

      // 短暂延迟避免API限制
      if (i < tasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`Batch ${batchId}: Task ${task.id} failed:`, error);
      await AIAnalysisModel.updateTaskStatus(task.id, 'failed', {
        analysis_content: `分析失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }
  }

  console.log(`Batch analysis ${batchId} completed`);
}

/**
 * 获取批量分析状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');

    if (!batchId) {
      return NextResponse.json({
        success: false,
        error: 'batch_id参数是必需的'
      }, { status: 400 });
    }

    // 查询批次任务
    const tasks = await AIAnalysisModel.queryTasks({
      limit: 1000 // 假设单批次不超过1000个任务
    });

    if (tasks.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未找到指定批次的任务'
      }, { status: 404 });
    }

    // 统计状态
    const statusCounts = tasks.data.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalTasks = tasks.data.length;
    const completedTasks = statusCounts.completed || 0;
    const failedTasks = statusCounts.failed || 0;
    const processingTasks = statusCounts.processing || 0;
    const pendingTasks = statusCounts.pending || 0;

    const progress = Math.round((completedTasks / totalTasks) * 100);
    const isCompleted = completedTasks + failedTasks === totalTasks;

    return NextResponse.json({
      success: true,
      data: {
        batch_id: batchId,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        failed_tasks: failedTasks,
        processing_tasks: processingTasks,
        pending_tasks: pendingTasks,
        progress_percentage: progress,
        is_completed: isCompleted,
        status_breakdown: statusCounts,
        tasks: tasks.data.map(task => ({
          id: task.id,
          asin: task.asin,
          warehouse_location: task.warehouse_location,
          status: task.status,
          created_at: task.created_at,
          completed_at: task.completed_at
        }))
      }
    });

  } catch (error) {
    console.error('Get batch status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}