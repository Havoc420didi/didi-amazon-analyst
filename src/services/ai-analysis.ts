import { deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { ProductAnalysisData, AIAnalysisResult } from '@/types/ai-analysis';

// Deepseek AI分析服务类
export class DeepseekAnalysisService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.model = 'deepseek-chat';
    
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }
  }

  // 生成分析提示词
  private buildAnalysisPrompt(productData: ProductAnalysisData): string {
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

    return `你是一位资深的亚马逊运营专家，请基于以下产品数据进行深度分析并给出专业的运营决策建议：

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

## 任务目标
根据我提供的单品（ASIN）在特定市场（库存点）的各项数据指标，生成一份结构清晰、逻辑严谨的“分析日志”。这份日志必须包含两个部分：“分析”和“行动”。

## 输出要求
1.  **语言**: 使用简体中文。
2.  **格式**: 严格按照以下格式输出，不要有任何多余的解释或客套话。
    分析：[你的分析内容]
    行动：[你的具体行动建议]
3.  **语气**: 专业、客观、数据驱动、简洁明了。
4.  **原则**:
    * 所有分析和建议都必须基于我提供的数据。
    * 如果数据中没有提供明确的“好”或“坏”的基准，请结合你的专家知识进行判断（例如，普遍认为广告转化率 > 10% 是不错的表现）。
    * 行动建议必须是具体的、可操作的步骤，而不是模糊的描述。

## 数据分析框架
请遵循以下逻辑思路进行分析：

1.  **库存健康度分析**:
    * 检查“库存状态”，并结合“库存周转天数”进行判断。周转天数是否过长（如 > 90天）或过短（如 < 40天，发铁路运输补货会有断货风险），周转天数 = (总库存 / 日均销量)。
    * 综合 FBA可用、FBA在途、本地仓库存，评估总库存量是否合理。注意品名和备注中可能提到的特殊情况（如“共用库存”）。
    * 基于“平均销量”，预测当前总库存还能维持多久的销售。

2.  **广告绩效分析**:
    * **基础指标**: 评估“广告点击率 (CTR)”和“广告转化率 (CVR)”。它们是否在健康范围内？（例如，CTR < 0.4% 可能偏低，CVR < 8% 可能有优化空间）。转化率<10%：检查Listing质量或者降低价格。点击率<0.5%：优化主图，降低价格，提高竞价。
    * **成本效益**: 分析“ACOAS (广告成本销售比)”。这个数值是过高、合理还是偏低？将“广告花费”与“广告订单量”带来的销售额（需要根据日均销售额和平均销量估算客单价）进行对比。合理的ACOAS是大于7%并且小于15%，如果过低，代表没有得到足够的推广，过高则推广成本占比过高，会导致毛利率比较低。
    * **关联分析**: 将曝光量、点击量、花费和订单量联系起来。是否存在“高曝光、低点击”（可能主图或标题吸引力不足）、“高点击、低转化”（可能落地页、价格、Review有问题）或“高花费、低订单”（广告活动效益差）的情况？

3.  **综合诊断与行动建议**:
	- **主要矛盾**：主要矛盾就2个：转化率和流量，先要解决转化率问题，在转化率不达标的时候，不应该花超过5美金/天的广告，因为流量很贵，如果宝贵的流量进入了你的页面，但却没有转化为订单，那么这就是可耻的浪费。
    * **分析部分**: 综合以上所有信息，用几句话总结当前产品的核心优势、主要问题和潜在风险。例如：“库存周转健康，但广告效率低下，转化率过低是当前主要矛盾。”
    * **行动部分**: 针对分析中发现的问题，提出精准的行动指令。
        * **库存问题**: 建议“加快清货”、“创建移除订单”、“联系供应商补货”或“从本地仓调拨至FBA”。
        * **广告问题**: 建议“降低无效关键词的出价”、“暂停表现差的广告活动”、“优化广告素材（主图/视频）”、“提高高效关键词的出价”、“增加表现好的广告位置（如搜索结果顶部）的竞价系数”等。
        * **报BD秒杀**：只要有BD的资格，尽量报BD，要注意备足库存。如果当前库存足够，就报最近时间的BD。如果库存不足，可以先报3周后的BD，然后空运补货过去。防止BD资格消失。

## 背景知识
### 知识1 什么样的转化率叫合格？

一般来说，客单价越底，转化率应该越高。 
7-10美金，18% ；
10-15美金，15% ；
15-20美金，13% ；
20-25美金，10% ；
25-30美金，8% ；
30-35美金，6% ；
35以上 4%-5%

### 知识2 如何提升转化率？

通常最快速的提升转化率的方法是降低价格，降低价格可以使用Coupon，PD，也可以直接降价。 但如果后面要做Best Deal，那么最好用Coupon。

提升转化率更高阶的方法： 
1 优化图片和标题、要点、EBC 
2 优化你的流量来源，找更精准的词去提升排名 

### 知识3 如何提升流量？

第一种是从亚马逊平台站内获得流量。 **亚马逊的流量是一个关键词排名的游戏**，我们需要针对关键词去做运营。这也是为什么在日志中要记录关键词排名。 关键词排名和你在这个关键词下产生的订单数量强相关。

我们应该选择转化率比较好，又有一定搜索量的关键词，通过广告去增加我们在这个关键词下的出单数量，从而提升我们的关键词排名，增加我们的流量。

## 强制规则
- 如果ACOS大于60%或者ACOAS大于25%，立即降低广告BID 10%或者更多。
- 如果转化率小于合理转化率的80%，则立即把广告bid降低到0.1，优化链接或者调整促销后再去测试广告。例如9美金产品的合理转化率是18%，那么小于18%乘以0.7 = 12.6%的转化率的产品，应该立即把广告bid降低到0.1，优化链接或者调整促销后再去测试广告。
- Coupon比例正常不能高于20%，最多是15%，如果要高于20%需要向主管申请。
- 不能创建移除订单。
- 转化率达到合理范围的广告计划，不能关闭，如果要降低广告花费，可以把广告预算调到1，广告BID调整到0.1。
- 不要调整广告的竞价系数
- 提升关键词排名或者增加销量优先考虑7 天限时秒杀（Best Deal）这个手段。
- 在ACOAS 高于15%时，不能增加广告预算。
- 对于转化率达到合理区间的关键词，可以每次提升10%-15%的BID
- 对于ACOS >45%的无效关键词，可以将 BID 下调 10%，观察 3 天后继续优化。
- 点击率高于0.5%，就不用优化点击率了。
- 不要推荐具体的关键词，可以用”核心关键词“或者”精准长尾词“，这样的说法。
- 节日类产品，很容易过季，不能补货

# 输出案例
## 分析：
1. **库存健康度**: 库存严重过剩。总库存2495件，基于日均11.8的销量，库存周转天数高达211.4天，远超于90天的健康范围，库存状态为“周转超标”，存在极高的长期仓储费风险和资金积压问题。
    
2. **广告绩效**: 广告效率偏低，是当前亟待解决的核心问题。
    
    - **转化率**: 根据约$8.96的客单价（$105.73 / 11.8），15%的广告转化率（CVR）未达到该价格区间20%的优秀标准。这是导致广告效益不佳的根本原因。
        
    - **成本效益**: 15.12%的ACOAS已达到15%合理区间的上限，表明广告成本占比较高，挤压了利润空间。
        
    - **点击率**: 0.54%的广告点击率（CTR）尚在0.5%的可接受基准线上，说明主图和标题有一定吸引力，但主要问题出在流量进入页面后的转化环节。
        
3. **综合诊断**: 当前的主要矛盾是转化率不足。这个问题直接导致了广告投入产出比不佳，并且使得庞大的库存无法被有效消化。必须优先解决转化率问题，才能继而解决库存积压的风险。
    

## 行动：

1. **提升转化率与销量**: 立即创建一个15%的Coupon，以最快速度提升转化率和日均销量，开始消化积压库存。持续监控开启后3天内的转化率和销量数据。
    
2. **控制广告成本**: 鉴于转化率偏低及ACOAS偏高，立即将所有广告活动的出价（BID）统一降低10%，以控制广告花费，提升利润率。
    
3. **库存管控**: 立即暂停向该ASIN的英国库存点进行任何形式的补货（包括本地仓调拨），直到库存周转天数下降至90天以内。
    
4. **优化详情页面**: 在执行价格促销的同时，对产品详情页面（Listing）进行优化。重点检查和改进描述要点（Bullet Points）和A+页面，确保其能够清晰地传达产品价值，以提升长期自然转化率。

请立即开始分析并生成“分析日志”。
`;
  }

  // 解析分析结果
  private parseAnalysisResult(content: string): {
    recommendations: {
      inventory_action: string;
      sales_strategy: string;
      ad_optimization: string;
      risk_level: 'low' | 'medium' | 'high';
    };
  } {
    // 提取各部分内容
    const inventoryMatch = content.match(/### 库存管理\s*([\s\S]*?)(?=###|$)/);
    const salesMatch = content.match(/### 销售策略\s*([\s\S]*?)(?=###|$)/);
    const adMatch = content.match(/### 广告优化\s*([\s\S]*?)(?=###|$)/);
    const riskMatch = content.match(/## 🚨 风险等级\s*([\s\S]*?)(?=##|$)/);

    // 确定风险等级
    let risk_level: 'low' | 'medium' | 'high' = 'medium';
    if (riskMatch && riskMatch[1]) {
      const riskText = riskMatch[1].toLowerCase();
      if (riskText.includes('低风险') || riskText.includes('low')) {
        risk_level = 'low';
      } else if (riskText.includes('高风险') || riskText.includes('high')) {
        risk_level = 'high';
      }
    }

    return {
      recommendations: {
        inventory_action: inventoryMatch ? inventoryMatch[1].trim() : '未能解析库存建议',
        sales_strategy: salesMatch ? salesMatch[1].trim() : '未能解析销售策略',
        ad_optimization: adMatch ? adMatch[1].trim() : '未能解析广告优化建议',
        risk_level
      }
    };
  }

  // 生成AI分析
  async generateAnalysis(productData: ProductAnalysisData): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildAnalysisPrompt(productData);
      
      const result = await generateText({
        model: deepseek(this.model),
        prompt,
        maxTokens: 2000,
        temperature: 0.7,
      });

      const processingTime = Date.now() - startTime;
      const parsedResult = this.parseAnalysisResult(result.text);

      return {
        analysis_content: result.text,
        processing_time: processingTime,
        tokens_used: result.usage?.totalTokens || 0,
        recommendations: parsedResult.recommendations
      };
    } catch (error) {
      console.error('Deepseek analysis failed:', error);
      throw new Error(`AI分析生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 生成任务编号
  static generateTaskNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `AI${timestamp}${random}`.toUpperCase();
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
let analysisService: DeepseekAnalysisService | null = null;

export function getAnalysisService(): DeepseekAnalysisService {
  if (!analysisService) {
    analysisService = new DeepseekAnalysisService();
  }
  return analysisService;
}