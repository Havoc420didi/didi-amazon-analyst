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
    console.log('[AI-Generate] POST called');
    const body = await request.json();
    try { console.log('[AI-Generate] request body keys', Object.keys(body || {})); } catch {}
    
    // 验证请求参数
    const validationResult = generateAnalysisSchema.safeParse(body);
    if (!validationResult.success) {
      console.warn('[AI-Generate] validation failed', validationResult.error.errors);
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
        console.warn('[AI-Generate] aggregateMultiDayData failed', aggregationError);
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
      console.warn('[AI-Generate] product_data validation failed', validation.errors);
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
      console.log('[AI-Generate] exists processing task', existingTasks.data[0]?.id);
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
    console.log('[AI-Generate] task created', { id: task.id, number: task.task_number });

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

// 异步处理分析任务 - 调用外部 Helios API
async function processAnalysisAsync(taskId: number, productData: ProductAnalysisData) {
  try {
    // 更新任务状态为处理中
    await AIAnalysisModel.updateTaskStatus(taskId, 'processing');

    // 使用数据集成服务增强分析数据
    const enhancedData = DataIntegrationService.enhanceAnalysisData(productData);

    // 准备外部 API 请求数据
    const externalPayload = {
      payload: {
        asin: enhancedData.asin,
        marketplace: enhancedData.warehouse_location || 'CN',
        fba_available: enhancedData.fba_available || 0,
        fba_in_transit: enhancedData.fba_in_transit || 0,
        local_warehouse: enhancedData.local_warehouse || 0,
        avg_sales: enhancedData.avg_sales || 0,
        daily_revenue: enhancedData.daily_revenue || 0,
        ad_impressions: enhancedData.ad_impressions || 0,
        ad_clicks: enhancedData.ad_clicks || 0,
        ad_spend: enhancedData.ad_spend || 0,
        ad_orders: enhancedData.ad_orders || 0,
        acos: enhancedData.ad_spend && enhancedData.ad_orders && enhancedData.avg_sales
          ? (enhancedData.ad_spend / (enhancedData.ad_orders * (enhancedData.daily_revenue / enhancedData.avg_sales))) 
          : 0,
        acoas: enhancedData.ad_spend && enhancedData.daily_revenue 
          ? (enhancedData.ad_spend / enhancedData.daily_revenue) 
          : 0
      }
    };

    console.log(`Task ${taskId}: Calling external Helios API with payload:`, externalPayload);
    
    const startTime = Date.now();
    
    // 调用外部 Helios API
    const response = await fetch('http://localhost:8000/api/helios/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(externalPayload),
      signal: AbortSignal.timeout(120000) // 2分钟超时
    });

    if (!response.ok) {
      throw new Error(`External API error: ${response.status} ${response.statusText}`);
    }

    // 处理流式响应并收集完整内容
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body from external API');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      // 解码并累积数据
      buffer += decoder.decode(value, { stream: true });
      
      // 按行分割处理
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后一个不完整的行
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        // 如果是 SSE 数据行，解析并累积内容
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') break;
          
          try {
            const event = JSON.parse(data);
            // 累积分析内容
            if (event.content) {
              fullContent += event.content + '\n';
            }
          } catch (e) {
            console.warn(`Task ${taskId}: Failed to parse event:`, data);
          }
        }
      }
    }
    
    const processingTime = Math.floor((Date.now() - startTime) / 1000);
    
    // 保存分析结果
    await AIAnalysisModel.saveAnalysisResult(
      taskId,
      extractReport(fullContent) || JSON.stringify({
        message: '分析完成',
        timestamp: new Date().toISOString()
      }),
      processingTime,
      0, // tokens_used 暂时设为0
      {
        analysis_method: 'external_helios_api',
        enhanced_data_used: true,
        rules_engine_applied: false,
      }
    );

    console.log(`Analysis task ${taskId} completed successfully using external Helios API`);
  } catch (error) {
    console.error(`Analysis task ${taskId} processing error:`, error);
    throw error;
  }
}

function extractReport(full: string): string {
  const key = '综合分析报告';
  const idx = full.indexOf(key);
  return idx !== -1 ? full.slice(idx) : full;
}