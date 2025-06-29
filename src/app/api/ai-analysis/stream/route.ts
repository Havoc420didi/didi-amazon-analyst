import { NextRequest } from 'next/server';
import { getStreamingAnalysisService, StreamingAnalysisService } from '@/services/streaming-analysis';
import { ProductAnalysisData } from '@/types/ai-analysis';
import { z } from 'zod';
import { AIAnalysisModel } from '@/models/ai-analysis';

// 请求参数验证schema
const streamAnalysisSchema = z.object({
  asin: z.string().min(1, 'ASIN不能为空'),
  warehouse_location: z.string().min(1, '库存点不能为空'),
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
    const validationResult = streamAnalysisSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '请求参数无效',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { product_data } = validationResult.data;

    // 验证产品数据完整性
    const validation = StreamingAnalysisService.validateProductData(product_data);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '产品数据验证失败',
          details: validation.errors
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 创建SSE响应头
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // 创建可读流
    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let analysisTask: any = null;
        const startTime = Date.now();
        
        try {
          // 创建分析任务记录
          analysisTask = await AIAnalysisModel.createTask({
            asin: product_data.asin,
            warehouse_location: product_data.warehouse_location,
            executor: 'streaming-analysis',
            product_data: product_data
          });

          // 更新任务状态为处理中
          await AIAnalysisModel.updateTaskStatus(analysisTask.id, 'processing');
          
          const streamingService = getStreamingAnalysisService();
          let fullContent = '';
          
          // 开始流式分析
          for await (const event of streamingService.streamAnalysis(product_data)) {
            // 格式化SSE事件
            const sseEvent = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(sseEvent));
            
            // 收集完整内容
            if (event.type === 'completed') {
              fullContent = event.content;
              
              // 保存分析结果到数据库
              const processingTime = Date.now() - startTime;
              await AIAnalysisModel.saveAnalysisResult(
                analysisTask.id,
                fullContent,
                processingTime,
                0 // tokens_used 暂时设为0，后续可以从AI服务获取
              );
              
              break;
            }
            
            // 如果是错误事件，更新任务状态
            if (event.type === 'error') {
              await AIAnalysisModel.updateTaskStatus(analysisTask.id, 'failed');
              break;
            }
          }
          
          // 发送结束信号
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          
        } catch (error) {
          console.error('Stream analysis error:', error);
          
          // 如果任务已创建，更新状态为失败
          if (analysisTask) {
            try {
              await AIAnalysisModel.updateTaskStatus(analysisTask.id, 'failed');
            } catch (updateError) {
              console.error('Failed to update task status:', updateError);
            }
          }
          
          // 发送错误事件
          const errorEvent = {
            type: 'error',
            step: '系统错误',
            content: `分析过程中出现系统错误: ${error instanceof Error ? error.message : '未知错误'}`,
            timestamp: Date.now(),
            progress: 0
          };
          
          const sseEvent = `data: ${JSON.stringify(errorEvent)}\n\n`;
          controller.enqueue(encoder.encode(sseEvent));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    });

    return new Response(readable, { headers });

  } catch (error) {
    console.error('Stream API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 处理OPTIONS请求（CORS预检）
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}