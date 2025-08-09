import { NextRequest, NextResponse } from 'next/server';
import { AIAnalysisModel } from '@/models/ai-analysis';
import { getHeliosAgent } from '@/app/api/ai-analysis/agents/helios-agent';
import DataIntegrationService from '@/app/api/ai-analysis/services/data-integration';
import { CreateAnalysisTask, ProductAnalysisData, AnalysisPeriod } from '@/types/ai-analysis';
import DataAggregationService from '@/app/api/ai-analysis/services/data-aggregation';
import { z } from 'zod';

// 分析周期配置验证schema
const analysisPeriodSchema = z.object({
  type: z.enum(['single_day', 'multi_day']),
  days: z.number().min(1).max(30),
  end_date: z.string().optional(),
  aggregation_method: z.enum(['average', 'sum', 'latest', 'trend'])
}).optional();

// 请求参数验证schema
const generateAnalysisSchema = z.object({
  asin: z.string().min(1, 'ASIN不能为空'),
  warehouse_location: z.string().min(1, '库存点不能为空'),
  executor: z.string().min(1, '执行人不能为空'),
  analysis_period: analysisPeriodSchema,
  product_data: z.object({
    asin: z.string(),
    product_name: z.string(),
    warehouse_location: z.string(),
    sales_person: z.string(),
    total_inventory: z.number().min(0),
    fba_available: z.number().min(0),
    fba_in_transit: z.number().min(0),
    local_warehouse: z.number().min(0),
    avg_sales: z.number().min(0),
    daily_revenue: z.number().min(0),
    inventory_turnover_days: z.number().optional(),
    inventory_status: z.string().optional(),
    ad_impressions: z.number().min(0),
    ad_clicks: z.number().min(0),
    ad_spend: z.number().min(0),
    ad_orders: z.number().min(0),
    ad_ctr: z.number().optional(),
    ad_conversion_rate: z.number().optional(),
    acos: z.number().optional(),
    trends: z.object({
      inventory_change: z.number(),
      revenue_change: z.number(),
      sales_change: z.number(),
    }).optional(),
    history: z.array(z.object({
      date: z.string(),
      inventory: z.number(),
      revenue: z.number(),
      sales: z.number(),
    })).optional(),
  })
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证请求参数
    const validationResult = generateAnalysisSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '请求参数无效',
        details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      }, { status: 400 });
    }

    const { asin, warehouse_location, executor, analysis_period, product_data } = validationResult.data;

    let finalProductData: ProductAnalysisData;

    // 如果是多日分析，使用聚合服务获取数据
    if (analysis_period?.type === 'multi_day') {
      try {
        finalProductData = await DataAggregationService.aggregateMultiDayData(
          asin,
          warehouse_location,
          analysis_period
        );
      } catch (aggregationError) {
        return NextResponse.json({
          success: false,
          error: '多日数据聚合失败',
          details: aggregationError instanceof Error ? aggregationError.message : '未知错误'
        }, { status: 400 });
      }
    } else {
      finalProductData = product_data;
    }

    // 使用数据集成服务验证产品数据完整性
    const validation = DataIntegrationService.validateProductData(finalProductData);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: '产品数据验证失败',
        details: validation.errors
      }, { status: 400 });
    }

    // 检查是否有正在处理的任务
    const existingTasks = await AIAnalysisModel.queryTasks({
      asin,
      warehouse_location,
      status: 'processing',
      limit: 1
    });

    if (existingTasks.data.length > 0) {
      return NextResponse.json({
        success: false,
        error: '该产品正在分析中，请稍后再试',
        data: { existing_task_id: existingTasks.data[0].id }
      }, { status: 409 });
    }

    // 创建分析任务
    const task = await AIAnalysisModel.createTask({
      asin,
      warehouse_location,
      executor,
      product_data: finalProductData,
      analysis_period
    });

    // 异步处理分析（不阻塞响应）
    processAnalysisAsync(task.id, finalProductData).catch(error => {
      console.error(`Analysis task ${task.id} failed:`, error);
      // 更新任务状态为失败
      AIAnalysisModel.updateTaskStatus(task.id, 'failed', {
        analysis_content: `分析失败: ${error.message}`
      });
    });

    return NextResponse.json({
      success: true,
      message: '分析任务已创建，正在处理中...',
      data: {
        task_id: task.id,
        task_number: task.task_number,
        status: task.status,
        created_at: task.created_at
      }
    });

  } catch (error) {
    console.error('Generate analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}

// 异步处理分析任务 - 集成LangGraph智能体
async function processAnalysisAsync(taskId: number, productData: ProductAnalysisData) {
  try {
    // 更新任务状态为处理中
    await AIAnalysisModel.updateTaskStatus(taskId, 'processing');

    // 使用数据集成服务增强分析数据
    const enhancedData = DataIntegrationService.enhanceAnalysisData(productData);

    // 仅使用 Helios 智能体；失败则任务失败
    const heliosAgent = getHeliosAgent();
    const result = await heliosAgent.analyze(enhancedData);
    console.log(`Task ${taskId}: Helios Agent analysis completed`);

    // 保存分析结果（仅记录 Helios 方法）
    await AIAnalysisModel.saveAnalysisResult(
      taskId,
      result.analysis_content,
      result.processing_time,
      result.tokens_used,
      {
        analysis_method: 'helios_agent',
        enhanced_data_used: true,
        rules_engine_applied: false,
      }
    );

    console.log(`Analysis task ${taskId} completed successfully using helios_agent`);
  } catch (error) {
    console.error(`Analysis task ${taskId} processing error:`, error);
    throw error;
  }
}