import { NextRequest, NextResponse } from 'next/server';
import { AIAnalysisModel } from '@/models/ai-analysis';
import { getAnalysisService, DeepseekAnalysisService } from '@/services/ai-analysis';
import { CreateAnalysisTask, ProductAnalysisData } from '@/types/ai-analysis';
import { z } from 'zod';

// 请求参数验证schema
const generateAnalysisSchema = z.object({
  asin: z.string().min(1, 'ASIN不能为空'),
  warehouse_location: z.string().min(1, '库存点不能为空'),
  executor: z.string().min(1, '执行人不能为空'),
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

    const { asin, warehouse_location, executor, product_data } = validationResult.data;

    // 验证产品数据完整性
    const validation = DeepseekAnalysisService.validateProductData(product_data);
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
      product_data
    });

    // 异步处理分析（不阻塞响应）
    processAnalysisAsync(task.id, product_data).catch(error => {
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

// 异步处理分析任务
async function processAnalysisAsync(taskId: number, productData: ProductAnalysisData) {
  try {
    // 更新任务状态为处理中
    await AIAnalysisModel.updateTaskStatus(taskId, 'processing');

    // 调用AI服务生成分析
    const analysisService = getAnalysisService();
    const result = await analysisService.generateAnalysis(productData);

    // 保存分析结果
    await AIAnalysisModel.saveAnalysisResult(
      taskId,
      result.analysis_content,
      result.processing_time,
      result.tokens_used
    );

    console.log(`Analysis task ${taskId} completed successfully`);
  } catch (error) {
    console.error(`Analysis task ${taskId} processing error:`, error);
    throw error;
  }
}