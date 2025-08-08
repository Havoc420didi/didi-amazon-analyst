import { deepseek } from '@ai-sdk/deepseek';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { ProductAnalysisData } from '@/types/ai-analysis';

export interface StreamingEvent {
  type: 'thinking' | 'analysis' | 'recommendation' | 'completed' | 'error';
  step: string;
  content: string;
  timestamp: number;
  progress?: number;
  isUpdate?: boolean;
}

// 流式AI分析服务类
export class StreamingAnalysisService {
  private deepseekApiKey: string;
  private openaiApiKey: string;
  private preferredProvider: 'deepseek' | 'openai';

  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    
    // 优先使用DeepSeek，如果没有则使用OpenAI
    if (this.deepseekApiKey) {
      this.preferredProvider = 'deepseek';
    } else if (this.openaiApiKey) {
      this.preferredProvider = 'openai';
    } else {
      throw new Error('需要设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 环境变量');
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

**重要：请严格按照以下格式输出分析结果：**

## 分析
1. **库存健康度**: 评估库存周转是否合理，是否存在库存积压或不足的问题
2. **广告绩效**: 分析广告投放效果，包括转化率、点击率、ACOS等关键指标  
3. **综合诊断**: 综合所有数据，识别当前的主要矛盾和核心问题

## 行动
1. **具体行动**: 列出3-4个具体的、可立即执行的行动步骤
2. **优先级**: 明确行动的优先级和紧急程度
3. **预期效果**: 说明每个行动预期的效果和时间周期

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

请开始你的分析：`;
  }

  // 流式生成分析
  async *streamAnalysis(productData: ProductAnalysisData): AsyncIterable<StreamingEvent> {
    let step = 1;
    const totalSteps = 4;

    try {
      // 发送初始化事件
      yield {
        type: 'thinking',
        step: '准备分析',
        content: '正在连接AI模型，准备开始分析...',
        timestamp: Date.now(),
        isUpdate: false
      };

      const prompt = this.buildStreamingPrompt(productData);
      
      let textStream;
      
      // 根据可用的API密钥选择AI提供商
      if (this.preferredProvider === 'deepseek' && this.deepseekApiKey) {
        const result = streamText({
          model: deepseek('deepseek-chat'),
          prompt,
          maxTokens: 3000,
          temperature: 0.7,
        });
        textStream = result.textStream;
      } else if (this.openaiApiKey) {
        const result = streamText({
          model: openai('gpt-4o-mini'),
          prompt,
          maxTokens: 3000,
          temperature: 0.7,
        });
        textStream = result.textStream;
      } else {
        throw new Error('没有可用的AI API密钥');
      }

      let accumulatedContent = '';
      let currentType: StreamingEvent['type'] = 'thinking';
      let currentStep = '准备分析';
      let currentSectionContent = '';

      // 处理流式数据 - 增强版，确保每个步骤清晰同步
      for await (const delta of textStream) {
        accumulatedContent += delta;
        
        // 检查是否有新的主要部分标记
        const hasAnalysis = accumulatedContent.includes('## 分析') || accumulatedContent.includes('**分析**');
        const hasAction = accumulatedContent.includes('## 行动') || accumulatedContent.includes('**行动**');
        
        // 如果找到分析部分且当前类型不匹配，则切换类型
        if (hasAnalysis && currentType !== 'analysis') {
          // 发送当前累积的内容
          if (currentSectionContent.trim()) {
            yield {
              type: currentType,
              step: currentStep,
              content: currentSectionContent,
              timestamp: Date.now(),
              isUpdate: false
            };
          }
          
          currentType = 'analysis';
          currentStep = '深度分析';
          currentSectionContent = '';
          step++;
        } else if (hasAction && currentType !== 'recommendation') {
          // 发送当前累积的内容
          if (currentSectionContent.trim()) {
            yield {
              type: currentType,
              step: currentStep,
              content: currentSectionContent,
              timestamp: Date.now(),
              isUpdate: false
            };
          }
          
          currentType = 'recommendation';
          currentStep = '行动建议';
          currentSectionContent = '';
          step++;
        }
        
        // 累积当前段落的内容
        currentSectionContent += delta;
        
        // 实时更新当前段落的内容（只在有实际内容时）
        // 使用更智能的内容分割，确保按步骤显示
        const trimmedDelta = delta.trim();
        if (trimmedDelta && trimmedDelta !== '##' && !trimmedDelta.startsWith('##')) {
          // 移除标题标记，保持内容干净
          const cleanDelta = delta.replace(/^\s*#{1,6}\s*/g, '').replace(/^\*\*/g, '').replace(/\*\*$/g, '');
          if (cleanDelta.trim()) {
            yield {
              type: currentType,
              step: currentStep,
              content: cleanDelta,
              timestamp: Date.now(),
              isUpdate: true
            };
          }
        }
      }

      // 发送最后一段内容
      if (currentSectionContent.trim()) {
        yield {
          type: currentType,
          step: currentStep,
          content: currentSectionContent,
          timestamp: Date.now(),
          isUpdate: false
        };
      }

      // 发送完成事件
      yield {
        type: 'completed',
        step: '分析完成',
        content: accumulatedContent,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Streaming analysis failed:', error);
      yield {
        type: 'error',
        step: '分析失败',
        content: `流式分析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      };
    }
  }

  // 从内容中提取步骤信息（已集成到主流程中，保留备用）
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