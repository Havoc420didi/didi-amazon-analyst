import { deepseek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';
import { ProductAnalysisData } from '@/types/ai-analysis';

// 流式分析事件类型
export interface StreamingEvent {
  type: 'thinking' | 'analysis' | 'recommendation' | 'completed' | 'error';
  step: string;
  content: string;
  timestamp: number;
  progress?: number;
}

// 流式AI分析服务类
export class StreamingAnalysisService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.model = 'deepseek-chat';
    
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }
  }

  // 构建分析提示词（重用现有逻辑，但添加思维过程输出）
  private buildStreamingPrompt(productData: ProductAnalysisData): string {
    const {
      asin,
      product_name,
      warehouse_location,
      total_inventory,
      fba_available,
      fba_in_transit,
      local_warehouse,
      avg_sales,
      daily_revenue,
      inventory_turnover_days,
      inventory_status,
      ad_impressions,
      ad_clicks,
      ad_spend,
      ad_orders,
      acos,
      trends = { inventory_change: 0, revenue_change: 0, sales_change: 0 },
      history = []
    } = productData;

    return `你是一位资深的亚马逊运营专家，请基于以下产品数据进行深度分析并给出专业的运营决策建议。

**重要：请在分析过程中，逐步输出你的思考过程，使用以下格式标记：**

[THINKING] 思考过程...
[ANALYSIS] 具体分析...
[RECOMMENDATION] 建议内容...

## 产品基本信息
- 产品名称：${product_name}
- ASIN：${asin}
- 库存点：${warehouse_location}

## 库存状况分析
- 总库存：${total_inventory}件
- FBA可用库存：${fba_available}件
- FBA在途库存：${fba_in_transit}件
- 本地仓库存：${local_warehouse}件
- 库存状态：${inventory_status || '未知'}
- 库存周转天数：${inventory_turnover_days || '未知'}天

## 销售表现分析
- 平均日销量：${avg_sales}件
- 日均销售额：$${daily_revenue}
- 库存变化趋势：${trends.inventory_change > 0 ? '+' : ''}${trends.inventory_change.toFixed(1)}%
- 销售额变化趋势：${trends.revenue_change > 0 ? '+' : ''}${trends.revenue_change.toFixed(1)}%
- 销量变化趋势：${trends.sales_change > 0 ? '+' : ''}${trends.sales_change.toFixed(1)}%

## 广告投放数据
- 广告曝光量：${ad_impressions.toLocaleString()}次
- 广告点击量：${ad_clicks}次
- 广告花费：$${ad_spend}
- 广告订单数：${ad_orders}个
- ACOS：${acos ? `${(acos * 100).toFixed(2)}%` : '未知'}

${history.length > 0 ? `## 历史趋势数据
最近${history.length}天的表现：
${history.map((h, i) => `${i + 1}. ${h.date}: 库存${h.inventory}件, 销售额$${h.revenue}, 销量${h.sales}件`).join('\n')}` : ''}

## 分析要求

请按照以下步骤进行分析，每个步骤都要展示思考过程：

1. **[THINKING] 数据概览和初印象**
   - 先整体浏览所有数据，说出你的第一印象
   
2. **[ANALYSIS] 库存健康度分析**
   - 检查库存周转是否合理
   - 评估各渠道库存分布
   
3. **[THINKING] 销售表现评估思路**
   - 思考如何评估当前销售表现
   
4. **[ANALYSIS] 销售数据深度分析**
   - 分析销售趋势和潜在问题
   
5. **[THINKING] 广告效果评估思路**
   - 思考广告数据反映的问题
   
6. **[ANALYSIS] 广告效果分析**
   - 详细分析广告投放效果
   
7. **[THINKING] 综合诊断思路**
   - 综合所有数据，思考主要矛盾
   
8. **[RECOMMENDATION] 具体行动建议**
   - 给出具体可执行的建议

请开始你的分析过程：`;
  }

  // 流式生成分析
  async *streamAnalysis(productData: ProductAnalysisData): AsyncIterable<StreamingEvent> {
    const startTime = Date.now();
    let step = 1;
    const totalSteps = 8;

    try {
      // 发送初始化事件
      yield {
        type: 'thinking',
        step: '初始化',
        content: '正在连接AI模型，准备开始分析...',
        timestamp: Date.now(),
        progress: 0
      };

      const prompt = this.buildStreamingPrompt(productData);
      
      // 使用streamText进行流式生成
      const { textStream } = await streamText({
        model: deepseek(this.model),
        prompt,
        maxTokens: 3000,
        temperature: 0.7,
      });

      let accumulatedContent = '';
      let currentType: StreamingEvent['type'] = 'thinking';
      let currentStep = '准备分析';
      let currentSectionContent = '';

      // 处理流式数据
      for await (const delta of textStream) {
        accumulatedContent += delta;
        
        // 检查是否有新的标记
        const newMarkFound = delta.includes('[THINKING]') || delta.includes('[ANALYSIS]') || delta.includes('[RECOMMENDATION]');
        
        if (newMarkFound) {
          // 如果找到新标记，先发送当前累积的内容
          if (currentSectionContent.trim()) {
            yield {
              type: currentType,
              step: currentStep,
              content: currentSectionContent,
              timestamp: Date.now(),
              progress: Math.min((step / totalSteps) * 100, 90),
              isUpdate: false
            };
          }
          
          // 处理新标记
          if (delta.includes('[THINKING]')) {
            currentType = 'thinking';
            currentStep = '思考过程';
            const content = delta.replace('[THINKING]', '').trim();
            currentSectionContent = content;
            step++;
          } else if (delta.includes('[ANALYSIS]')) {
            currentType = 'analysis';
            currentStep = '深度分析';
            const content = delta.replace('[ANALYSIS]', '').trim();
            currentSectionContent = content;
            step++;
          } else if (delta.includes('[RECOMMENDATION]')) {
            currentType = 'recommendation';
            currentStep = '行动建议';
            const content = delta.replace('[RECOMMENDATION]', '').trim();
            currentSectionContent = content;
            step++;
          }
        } else {
          // 累积当前段落的内容
          currentSectionContent += delta;
        }
        
        // 实时更新当前段落的内容
        yield {
          type: currentType,
          step: currentStep,
          content: currentSectionContent,
          timestamp: Date.now(),
          progress: Math.min((step / totalSteps) * 100, 90),
          isUpdate: true
        };

        // 添加小延迟，模拟真实思考过程
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 发送完成事件
      yield {
        type: 'completed',
        step: '分析完成',
        content: accumulatedContent,
        timestamp: Date.now(),
        progress: 100
      };

    } catch (error) {
      console.error('Streaming analysis failed:', error);
      yield {
        type: 'error',
        step: '分析失败',
        content: `分析过程中出现错误: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now(),
        progress: 0
      };
    }
  }

  // 从内容中提取步骤信息
  private extractStepFromContent(content: string): string {
    // 尝试提取中文步骤描述
    const stepMatches = content.match(/[：:]\s*(.+?)(?=\s|$)/);
    if (stepMatches && stepMatches[1]) {
      return stepMatches[1].substring(0, 20); // 限制长度
    }
    
    // 默认步骤名称
    if (content.includes('数据概览')) return '数据概览';
    if (content.includes('库存')) return '库存分析';
    if (content.includes('销售')) return '销售分析';
    if (content.includes('广告')) return '广告分析';
    if (content.includes('建议') || content.includes('行动')) return '行动建议';
    
    return '分析中';
  }

  // 验证产品数据完整性
  static validateProductData(data: ProductAnalysisData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.asin) errors.push('ASIN不能为空');
    if (!data.product_name) errors.push('产品名称不能为空');
    if (!data.warehouse_location) errors.push('库存点不能为空');
    if (data.total_inventory < 0) errors.push('总库存不能为负数');
    if (data.avg_sales < 0) errors.push('平均销量不能为负数');
    if (data.daily_revenue < 0) errors.push('日均销售额不能为负数');

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 单例模式导出
let streamingService: StreamingAnalysisService | null = null;

export function getStreamingAnalysisService(): StreamingAnalysisService {
  if (!streamingService) {
    streamingService = new StreamingAnalysisService();
  }
  return streamingService;
}