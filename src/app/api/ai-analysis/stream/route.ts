import { NextRequest } from 'next/server';
import { getStreamingAnalysisService, StreamingAnalysisService } from '@/services/streaming-analysis';
import { ProductAnalysisData, AnalysisPeriod } from '@/types/ai-analysis';
import { z } from 'zod';
import { AIAnalysisModel } from '@/models/ai-analysis';
import DataAggregationService from '@/app/api/ai-analysis/services/data-aggregation';

// 提取“综合分析报告”段落，如果未找到则返回原文
function extractReport(full: string): string {
  const key = '综合分析报告';
  const idx = full.indexOf(key);
  return idx !== -1 ? full.slice(idx) : full;
}

// 请求参数验证schema
const analysisPeriodSchema = z.object({
  type: z.enum(['single_day', 'multi_day']),
  days: z.number().min(1).max(30),
  end_date: z.string().optional(),
  aggregation_method: z.enum(['average', 'sum', 'latest', 'trend'])
}).optional();

const productDataSchema = z.object({
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
});

const streamAnalysisSchema = z.object({
  asin: z.string().min(1, 'ASIN不能为空'),
  warehouse_location: z.string().min(1, '库存点不能为空'),
  executor: z.string().optional(),
  analysis_period: analysisPeriodSchema,
  product_data: productDataSchema.optional(),
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

    const { asin, warehouse_location, analysis_period, product_data: bodyProductData, executor } = validationResult.data as { asin: string; warehouse_location: string; analysis_period?: AnalysisPeriod; product_data?: ProductAnalysisData; executor?: string };
    
    // 如果提供了多日分析配置，则进行后端聚合以生成产品数据
    let product_data: ProductAnalysisData | undefined = bodyProductData;
    if (analysis_period && analysis_period.type === 'multi_day') {
      try {
        product_data = await DataAggregationService.aggregateMultiDayData(
          asin,
          warehouse_location,
          analysis_period
        );
      } catch (aggregationError: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: '多日数据聚合失败',
            details: aggregationError?.message || '未知错误',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!product_data) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少产品数据' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 防止中间层缓冲
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
            executor: executor || 'external-helios-api',
            product_data: product_data
          });

          // 更新任务状态为处理中
          await AIAnalysisModel.updateTaskStatus(analysisTask.id, 'processing');
          
          // 准备外部 API 请求数据
          const externalPayload = {
            payload: {
              asin: product_data.asin,
              marketplace: product_data.warehouse_location || 'CN',
              fba_available: product_data.fba_available || 0,
              fba_in_transit: product_data.fba_in_transit || 0,
              local_warehouse: product_data.local_warehouse || 0,
              avg_sales: product_data.avg_sales || 0,
              daily_revenue: product_data.daily_revenue || 0,
              ad_impressions: product_data.ad_impressions || 0,
              ad_clicks: product_data.ad_clicks || 0,
              ad_spend: product_data.ad_spend || 0,
              ad_orders: product_data.ad_orders || 0,
              acos: product_data.ad_spend && product_data.ad_orders && product_data.avg_sales
                ? (product_data.ad_spend / (product_data.ad_orders * (product_data.daily_revenue / product_data.avg_sales))) 
                : 0,
              acoas: product_data.ad_spend && product_data.daily_revenue 
                ? (product_data.ad_spend / product_data.daily_revenue) 
                : 0
            }
          };

          console.log('[Stream] Calling external Helios API with payload:', externalPayload);
          
          // 调用外部 Helios API
          const response = await fetch('http://localhost:8000/api/helios/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(externalPayload)
          });

          if (!response.ok) {
            throw new Error(`External API error: ${response.status} ${response.statusText}`);
          }

          // 处理流式响应
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body from external API');
          }

          const decoder = new TextDecoder();
          let buffer = '';
          let fullContent = '';
          let saved = false;
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            // 解码并累积数据
            buffer += decoder.decode(value, { stream: true });
            
            // 按行分割处理
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留最后一个不完整的行

            for (const rawLine of lines) {
              const line = rawLine.trimEnd();
              if (line.trim() === '') continue;

              // 仅处理数据行，忽略 event: 等控制行
              if (!line.startsWith('data: ')) continue;

              const data = line.substring(6);
              if (data === '[DONE]') {
                // 上游完成标识，延后统一保存
                continue;
              }

              try {
                const event = JSON.parse(data);
                // 提取正文增量
                let content: string = '';
                if (typeof event?.content === 'string') content = event.content;
                else if (typeof event?.delta?.content === 'string') content = event.delta.content as string;
                else if (typeof event?.message === 'string') content = event.message as string;
                else if (typeof event?.text === 'string') content = event.text as string;
                else if (typeof event?.token === 'string') content = event.token as string;
                else if (typeof event?.output === 'string') content = event.output as string;
                else if (typeof event?.chunk === 'string') content = event.chunk as string;

                if (content) {
                  // 累积用于保存
                  fullContent += content;
                  // 只向前端转发规范化的正文事件
                  const outEvt = `data: ${JSON.stringify({ type: 'message', content })}\n\n`;
                  controller.enqueue(encoder.encode(outEvt));
                }

                // 错误事件处理
                if (event?.type === 'error') {
                  await AIAnalysisModel.updateTaskStatus(analysisTask.id, 'failed');
                }
              } catch (e) {
                // 忽略无法解析为 JSON 的行
              }
            }
          }
          
          // 处理剩余的 buffer（不转发控制行）
          // 不需要再将原始 buffer 透传
          
          // 发送结束信号
          // 在流结束时保存一次，保证一定落库
          if (!saved) {
            const processingTime = Math.floor((Date.now() - startTime) / 1000);
            await AIAnalysisModel.saveAnalysisResult(
              analysisTask.id,
              extractReport(fullContent) || JSON.stringify({ message: '分析完成', timestamp: new Date().toISOString() }),
              processingTime,
              0
            );
            saved = true;
          }
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