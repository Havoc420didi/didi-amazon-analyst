/**
 * Helios AI智能体 - 基于LangGraph的亚马逊运营分析智能体
 * 实现Helios决策流程图的完整执行逻辑
 */

import { StateGraph, MemorySaver, Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { ProductAnalysisData, AIAnalysisResult, DiagnosisScenario } from '@/types/ai-analysis';
import { InventoryPoint } from '@/types/inventory-view';

// 定义智能体状态
const AgentState = Annotation.Root({
  // 输入数据
  productData: Annotation<ProductAnalysisData | null>({
    default: () => null,
  }),
  inventoryPoint: Annotation<InventoryPoint | null>({
    default: () => null,
  }),
  
  // 分析结果
  validationErrors: Annotation<string[]>({
    default: () => [],
  }),
  inventoryAnalysis: Annotation<any>({
    default: () => null,
  }),
  adPerformanceAnalysis: Annotation<any>({
    default: () => null,
  }),
  salesAnalysis: Annotation<any>({
    default: () => null,
  }),
  
  // 诊断结果
  diagnosisScenario: Annotation<DiagnosisScenario | null>({
    default: () => null,
  }),
  priorityLevel: Annotation<'highest' | 'high' | 'medium' | 'low'>({
    default: () => 'medium',
  }),
  
  // 行动建议
  actionSuggestions: Annotation<string[]>({
    default: () => [],
  }),
  ruleViolations: Annotation<string[]>({
    default: () => [],
  }),
  
  // 最终输出
  analysisReport: Annotation<string>({
    default: () => '',
  }),
  actionPlan: Annotation<string>({
    default: () => '',
  }),
  
  // 处理状态
  messages: Annotation<BaseMessage[]>({
    default: () => [],
  }),
  isComplete: Annotation<boolean>({
    default: () => false,
  }),
  hasErrors: Annotation<boolean>({
    default: () => false,
  }),
});

export type HeliosAgentState = typeof AgentState.State;

/**
 * Helios智能体类
 */
export class HeliosAgent {
  private graph: StateGraph<HeliosAgentState>;
  private memory: MemorySaver;

  constructor() {
    this.memory = new MemorySaver();
    this.graph = this.buildGraph();
  }

  /**
   * 构建LangGraph决策图
   */
  private buildGraph(): StateGraph<HeliosAgentState> {
    const workflow = new StateGraph(AgentState)
      // 数据验证节点
      .addNode("dataValidation", this.dataValidationNode.bind(this))
      
      // 并行分析节点
      .addNode("inventoryAnalysis", this.inventoryAnalysisNode.bind(this))
      .addNode("adPerformanceAnalysis", this.adPerformanceAnalysisNode.bind(this))
      .addNode("salesAnalysis", this.salesAnalysisNode.bind(this))
      
      // 综合诊断节点
      .addNode("comprehensiveDiagnosis", this.comprehensiveDiagnosisNode.bind(this))
      
      // 行动生成节点
      .addNode("actionGeneration", this.actionGenerationNode.bind(this))
      
      // 规则检查节点
      .addNode("ruleValidation", this.ruleValidationNode.bind(this))
      
      // 输出格式化节点
      .addNode("outputFormatting", this.outputFormattingNode.bind(this))
      
      // 错误处理节点
      .addNode("errorHandling", this.errorHandlingNode.bind(this));

    // 定义流程路径
    workflow
      .addEdge("__start__", "dataValidation")
      .addConditionalEdges(
        "dataValidation",
        this.shouldProceedAfterValidation.bind(this),
        {
          continue: "inventoryAnalysis",
          error: "errorHandling"
        }
      )
      
      // 并行分析流程
      .addEdge("inventoryAnalysis", "adPerformanceAnalysis")
      .addEdge("adPerformanceAnalysis", "salesAnalysis")
      .addEdge("salesAnalysis", "comprehensiveDiagnosis")
      
      // 诊断和行动生成
      .addEdge("comprehensiveDiagnosis", "actionGeneration")
      .addEdge("actionGeneration", "ruleValidation")
      
      // 规则检查后的路径
      .addConditionalEdges(
        "ruleValidation",
        this.shouldRegenerateActions.bind(this),
        {
          proceed: "outputFormatting",
          regenerate: "actionGeneration"
        }
      )
      
      .addEdge("outputFormatting", "__end__")
      .addEdge("errorHandling", "__end__");

    return workflow.compile({ checkpointer: this.memory });
  }

  /**
   * 数据验证节点
   */
  private async dataValidationNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { productData } = state;
    const errors: string[] = [];

    if (!productData) {
      errors.push("产品数据不能为空");
      return { validationErrors: errors, hasErrors: true };
    }

    // 验证必需字段
    if (!productData.asin) errors.push("ASIN不能为空");
    if (!productData.product_name) errors.push("产品名称不能为空");
    if (!productData.warehouse_location) errors.push("库存点不能为空");
    if (productData.total_inventory < 0) errors.push("总库存不能为负数");
    if (productData.avg_sales < 0) errors.push("平均销量不能为负数");
    if (productData.daily_revenue < 0) errors.push("日均销售额不能为负数");

    // 验证广告数据合理性
    if (productData.ad_impressions < 0) errors.push("广告曝光量不能为负数");
    if (productData.ad_clicks < 0) errors.push("广告点击量不能为负数");
    if (productData.ad_spend < 0) errors.push("广告花费不能为负数");
    if (productData.ad_orders < 0) errors.push("广告订单数不能为负数");

    // 验证逻辑合理性（聚合数据可能出现不一致，降低严格性）
    if (productData.ad_clicks > productData.ad_impressions * 1.1) {
      errors.push("广告点击量异常偏高，请检查数据");
    }
    if (productData.ad_orders > productData.ad_clicks * 1.1) {
      errors.push("广告订单数异常偏高，请检查数据");
    }

    // 多日聚合数据特殊验证
    if (productData.aggregation_metadata) {
      const { aggregation_metadata } = productData;
      
      if (aggregation_metadata.aggregation_quality === 'poor') {
        errors.push(`数据质量较差(${aggregation_metadata.data_points_count}/${aggregation_metadata.analysis_period.days}天)，建议补充数据后重新分析`);
      }
      
      if (aggregation_metadata.missing_days && aggregation_metadata.missing_days.length > 0) {
        errors.push(`缺失${aggregation_metadata.missing_days.length}天数据: ${aggregation_metadata.missing_days.slice(0, 3).join(', ')}${aggregation_metadata.missing_days.length > 3 ? '等' : ''}`);
      }
    }

    return { 
      validationErrors: errors, 
      hasErrors: errors.length > 0 
    };
  }

  /**
   * 库存分析节点
   */
  private async inventoryAnalysisNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { productData } = state;
    if (!productData) return {};

    const analysis = {
      totalInventory: productData.total_inventory,
      fbaAvailable: productData.fba_available,
      fbaInTransit: productData.fba_in_transit,
      localWarehouse: productData.local_warehouse,
      turnoverDays: productData.inventory_turnover_days,
      avgSales: productData.avg_sales,
      
      // 库存健康度判断
      isInventoryShortage: productData.inventory_turnover_days < 40,
      isInventoryExcess: productData.inventory_turnover_days > 90,
      isHealthyInventory: productData.inventory_turnover_days >= 40 && productData.inventory_turnover_days <= 90,
      
      // 断货风险评估
      outOfStockRisk: productData.fba_available <= 0 ? 'high' : 
                     (productData.fba_available / productData.avg_sales < 3 ? 'medium' : 'low'),
      
      // 库存状态
      inventoryStatus: productData.inventory_status || 'unknown'
    };

    return { inventoryAnalysis: analysis };
  }

  /**
   * 广告性能分析节点
   */
  private async adPerformanceAnalysisNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { productData } = state;
    if (!productData) return {};

    // 计算广告关键指标
    const ctr = productData.ad_impressions > 0 ? 
      (productData.ad_clicks / productData.ad_impressions) * 100 : 0;
    
    const cvr = productData.ad_clicks > 0 ? 
      (productData.ad_orders / productData.ad_clicks) * 100 : 0;
    
    const acoas = productData.acos || 0;
    
    // 根据客单价计算标准转化率
    const avgPrice = productData.daily_revenue / productData.avg_sales;
    const standardCvr = this.getStandardConversionRate(avgPrice);

    const analysis = {
      ctr,
      cvr,
      acoas: acoas * 100, // 转换为百分比
      avgPrice,
      standardCvr,
      
      // 性能评估
      ctrHealth: ctr >= 0.5 ? 'good' : 'poor',
      cvrHealth: cvr >= standardCvr * 0.9 ? 'good' : 'poor',
      acoasHealth: acoas >= 0.07 && acoas <= 0.15 ? 'good' : 
                   (acoas < 0.07 ? 'low' : 'high'),
      
      // 广告效率问题识别
      isConversionLow: cvr < standardCvr * 0.9,
      isAcoasHigh: acoas > 0.15,
      isAcoasLow: acoas < 0.07,
      isCtrLow: ctr < 0.5,
      
      impressions: productData.ad_impressions,
      clicks: productData.ad_clicks,
      spend: productData.ad_spend,
      orders: productData.ad_orders
    };

    return { adPerformanceAnalysis: analysis };
  }

  /**
   * 销售表现分析节点
   */
  private async salesAnalysisNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { productData } = state;
    if (!productData) return {};

    const analysis = {
      avgSales: productData.avg_sales,
      dailyRevenue: productData.daily_revenue,
      avgPrice: productData.daily_revenue / productData.avg_sales,
      
      // 趋势分析
      inventoryTrend: productData.trends?.inventory_change || 0,
      revenueTrend: productData.trends?.revenue_change || 0,
      salesTrend: productData.trends?.sales_change || 0,
      
      // 销售健康度
      isEffectiveInventoryPoint: productData.daily_revenue >= 16.7,
      salesPerformance: productData.avg_sales > 0 ? 'active' : 'inactive'
    };

    return { salesAnalysis: analysis };
  }

  /**
   * 综合诊断节点
   */
  private async comprehensiveDiagnosisNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { inventoryAnalysis, adPerformanceAnalysis } = state;
    
    if (!inventoryAnalysis || !adPerformanceAnalysis) {
      return { hasErrors: true };
    }

    // 按优先级识别主要矛盾
    let diagnosisScenario: DiagnosisScenario;
    let priorityLevel: 'highest' | 'high' | 'medium' | 'low';

    // 1. 库存不足 - 最高优先级
    if (inventoryAnalysis.isInventoryShortage) {
      diagnosisScenario = 'inventory_shortage';
      priorityLevel = 'highest';
    }
    // 2. 转化率不足 - 高优先级
    else if (adPerformanceAnalysis.isConversionLow) {
      diagnosisScenario = 'conversion_insufficient';
      priorityLevel = 'high';
    }
    // 3. 广告投放不足 - 中优先级
    else if (adPerformanceAnalysis.isAcoasLow) {
      diagnosisScenario = 'ad_insufficient';
      priorityLevel = 'medium';
    }
    // 4. 库存积压 - 中优先级
    else if (inventoryAnalysis.isInventoryExcess) {
      diagnosisScenario = 'inventory_excess';
      priorityLevel = 'medium';
    }
    // 5. 广告成本过高 - 中优先级
    else if (adPerformanceAnalysis.isAcoasHigh) {
      diagnosisScenario = 'ad_cost_high';
      priorityLevel = 'medium';
    }
    // 6. 运营健康 - 低优先级
    else {
      diagnosisScenario = 'healthy_operation';
      priorityLevel = 'low';
    }

    return { 
      diagnosisScenario, 
      priorityLevel 
    };
  }

  /**
   * 行动生成节点
   */
  private async actionGenerationNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { diagnosisScenario, inventoryAnalysis, adPerformanceAnalysis } = state;
    
    if (!diagnosisScenario || !inventoryAnalysis || !adPerformanceAnalysis) {
      return { hasErrors: true };
    }

    const actions: string[] = [];

    switch (diagnosisScenario) {
      case 'inventory_shortage':
        actions.push("立即安排空运补货，确保15天内到达FBA仓库");
        actions.push("同时安排海运备货，预计21天后到达");
        actions.push("BD活动延后3周执行，避免断货风险");
        actions.push("适度提价5-10%控制销售速度，延长库存维持时间");
        break;

      case 'conversion_insufficient':
        actions.push(`创建15-18%的Coupon促销，提升转化率至${adPerformanceAnalysis.standardCvr}%以上`);
        actions.push("将广告日预算限制在5美元以内，避免浪费流量");
        actions.push("优化产品Listing的标题和要点，突出核心卖点");
        actions.push("更新A+页面内容，增加产品使用场景展示");
        break;

      case 'ad_insufficient':
        actions.push("广告预算提升50%，从当前水平扩大投放");
        actions.push("核心关键词BID提升10-15%，争取更多曝光");
        actions.push("测试长尾关键词，拓展流量来源");
        actions.push("适当提高广告竞价系数，获得更好广告位");
        break;

      case 'inventory_excess':
        actions.push("立即停止所有补货计划，包括本地仓调拨");
        actions.push("创建15-25%的折扣促销，加速库存周转");
        actions.push("适度增加广告预算20-30%，提升销量");
        actions.push("考虑参与亚马逊官方促销活动清理库存");
        break;

      case 'ad_cost_high':
        actions.push("所有广告活动BID降低10-15%，控制成本");
        actions.push("暂停ACOS超过45%的无效关键词");
        actions.push("优化否定关键词列表，减少无效点击");
        actions.push("重新评估广告结构，关闭表现差的广告组");
        break;

      case 'healthy_operation':
        actions.push("保持当前运营策略，继续监控各项指标");
        actions.push("探索增长机会，考虑扩大广告投放测试");
        actions.push("评估BD秒杀的申请条件和库存准备");
        actions.push("关注竞品动态，准备应对市场变化");
        break;
    }

    return { actionSuggestions: actions };
  }

  /**
   * 规则验证节点
   */
  private async ruleValidationNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { actionSuggestions, adPerformanceAnalysis, inventoryAnalysis } = state;
    const violations: string[] = [];

    if (!actionSuggestions || !adPerformanceAnalysis) {
      return { ruleViolations: violations };
    }

    // 检查强制业务规则
    const acoas = adPerformanceAnalysis.acoas / 100; // 转换回小数

    // 规则1: ACOAS > 25% 必须大幅降低BID
    if (acoas > 0.25) {
      const hasBidReduction = actionSuggestions.some(action => 
        action.includes('BID降低') || action.includes('降低出价')
      );
      if (!hasBidReduction) {
        violations.push("ACOAS超过25%，必须立即降低广告BID");
      }
    }

    // 规则2: CVR < 标准80% 必须降BID至0.1
    const cvr = adPerformanceAnalysis.cvr / 100;
    const standardCvr = adPerformanceAnalysis.standardCvr / 100;
    if (cvr < standardCvr * 0.8) {
      const hasLowBid = actionSuggestions.some(action => 
        action.includes('BID降低') || action.includes('限制广告')
      );
      if (!hasLowBid) {
        violations.push("转化率低于标准80%，必须将BID降至0.1");
      }
    }

    // 规则3: Coupon比例检查
    const couponActions = actionSuggestions.filter(action => 
      action.includes('Coupon') || action.includes('折扣')
    );
    couponActions.forEach(action => {
      const percentMatch = action.match(/(\d+)%/);
      if (percentMatch) {
        const percent = parseInt(percentMatch[1]);
        if (percent > 20) {
          violations.push(`Coupon比例${percent}%超过20%限制，需要主管审批`);
        }
      }
    });

    // 规则4: 节日产品补货检查
    if (inventoryAnalysis && state.productData?.product_name) {
      const productName = state.productData.product_name.toLowerCase();
      const isSeasonalProduct = ['christmas', 'halloween', 'valentine', 'easter', 'spring', 'summer', 'winter', 'holiday'].some(keyword => 
        productName.includes(keyword)
      );
      
      if (isSeasonalProduct) {
        const hasRestockAction = actionSuggestions.some(action => 
          action.includes('补货') || action.includes('备货')
        );
        if (hasRestockAction) {
          violations.push("节日类产品易过季，不建议补货");
        }
      }
    }

    return { ruleViolations: violations };
  }

  /**
   * 输出格式化节点
   */
  private async outputFormattingNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { 
      diagnosisScenario, 
      inventoryAnalysis, 
      adPerformanceAnalysis, 
      salesAnalysis,
      actionSuggestions,
      priorityLevel,
      productData 
    } = state;

    if (!diagnosisScenario || !inventoryAnalysis || !adPerformanceAnalysis || !actionSuggestions) {
      return { hasErrors: true };
    }

    // 生成分析部分
    const analysisReport = this.generateAnalysisReport(
      diagnosisScenario,
      inventoryAnalysis,
      adPerformanceAnalysis,
      salesAnalysis,
      productData
    );

    // 生成行动部分
    const actionPlan = this.generateActionPlan(actionSuggestions, priorityLevel);

    return { 
      analysisReport, 
      actionPlan, 
      isComplete: true 
    };
  }

  /**
   * 错误处理节点
   */
  private async errorHandlingNode(state: HeliosAgentState): Promise<Partial<HeliosAgentState>> {
    const { validationErrors } = state;
    
    const errorReport = `## 数据验证失败\n\n发现以下问题：\n${validationErrors.map(error => `- ${error}`).join('\n')}`;
    
    return {
      analysisReport: errorReport,
      actionPlan: "请修正数据问题后重新分析",
      isComplete: true,
      hasErrors: true
    };
  }

  /**
   * 条件判断：验证后是否继续
   */
  private shouldProceedAfterValidation(state: HeliosAgentState): string {
    return state.hasErrors ? "error" : "continue";
  }

  /**
   * 条件判断：是否需要重新生成行动建议
   */
  private shouldRegenerateActions(state: HeliosAgentState): string {
    // 如果有规则违反且违反数量较少，尝试重新生成
    return (state.ruleViolations && state.ruleViolations.length > 0 && state.ruleViolations.length <= 2) 
      ? "regenerate" : "proceed";
  }

  /**
   * 根据客单价获取标准转化率
   */
  private getStandardConversionRate(avgPrice: number): number {
    if (avgPrice <= 10) return 18;
    if (avgPrice <= 15) return 15;
    if (avgPrice <= 20) return 13;
    if (avgPrice <= 25) return 10;
    if (avgPrice <= 30) return 8;
    if (avgPrice <= 35) return 6;
    return 5; // 35以上
  }

  /**
   * 生成分析报告
   */
  private generateAnalysisReport(
    scenario: DiagnosisScenario,
    inventoryAnalysis: any,
    adAnalysis: any,
    salesAnalysis: any,
    productData: ProductAnalysisData | null
  ): string {
    const scenarioNames = {
      'inventory_shortage': '库存不足',
      'conversion_insufficient': '转化率不足',
      'ad_insufficient': '广告投放不足',
      'inventory_excess': '库存积压',
      'ad_cost_high': '广告成本过高',
      'healthy_operation': '运营健康'
    };

    let report = `## 分析\n\n`;
    
    // 添加聚合分析说明
    if (productData?.aggregation_metadata) {
      const metadata = productData.aggregation_metadata;
      const methodNames = {
        'average': '平均值',
        'sum': '累计',
        'latest': '最新',
        'trend': '趋势加权'
      };
      
      report += `**数据基础**: ${metadata.analysis_period.days}日${methodNames[metadata.analysis_period.aggregation_method]}分析 `;
      report += `(${metadata.date_range.start_date} 至 ${metadata.date_range.end_date})，`;
      report += `实际采集${metadata.data_points_count}天数据，数据质量${metadata.aggregation_quality === 'excellent' ? '优秀' : metadata.aggregation_quality === 'good' ? '良好' : metadata.aggregation_quality === 'fair' ? '一般' : '较差'}。\n\n`;
    }
    
    report += `**主要矛盾**: ${scenarioNames[scenario]}\n\n`;

    // 库存健康度分析
    report += `**库存状况**: `;
    if (inventoryAnalysis.isInventoryShortage) {
      report += `库存严重不足，周转天数仅${inventoryAnalysis.turnoverDays}天，存在断货风险。`;
    } else if (inventoryAnalysis.isInventoryExcess) {
      report += `库存严重积压，周转天数高达${inventoryAnalysis.turnoverDays}天，远超健康范围。`;
    } else {
      report += `库存状况良好，周转天数${inventoryAnalysis.turnoverDays}天在合理范围内。`;
    }
    report += `\n\n`;

    // 广告效率分析
    report += `**广告效率**: `;
    if (adAnalysis.isConversionLow) {
      report += `转化率${adAnalysis.cvr.toFixed(1)}%低于${adAnalysis.standardCvr}%标准，是当前主要瓶颈。`;
    }
    if (adAnalysis.isAcoasHigh) {
      report += `ACOAS ${adAnalysis.acoas.toFixed(1)}%过高，挤压利润空间。`;
    }
    if (adAnalysis.isAcoasLow) {
      report += `ACOAS ${adAnalysis.acoas.toFixed(1)}%偏低，推广力度不足限制增长。`;
    }
    if (adAnalysis.isCtrLow) {
      report += `点击率${adAnalysis.ctr.toFixed(2)}%偏低，主图或标题需要优化。`;
    }
    if (!adAnalysis.isConversionLow && !adAnalysis.isAcoasHigh && !adAnalysis.isAcoasLow && !adAnalysis.isCtrLow) {
      report += `广告各项指标表现良好，CTR ${adAnalysis.ctr.toFixed(2)}%，CVR ${adAnalysis.cvr.toFixed(1)}%，ACOAS ${adAnalysis.acoas.toFixed(1)}%。`;
    }

    return report;
  }

  /**
   * 生成行动计划
   */
  private generateActionPlan(actions: string[], priority: string): string {
    let plan = `## 行动\n\n`;
    
    actions.forEach((action, index) => {
      plan += `${index + 1}. ${action}\n\n`;
    });

    return plan;
  }

  /**
   * 执行分析
   */
  async analyze(productData: ProductAnalysisData): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      const initialState: HeliosAgentState = {
        productData,
        inventoryPoint: null,
        validationErrors: [],
        inventoryAnalysis: null,
        adPerformanceAnalysis: null,
        salesAnalysis: null,
        diagnosisScenario: null,
        priorityLevel: 'medium',
        actionSuggestions: [],
        ruleViolations: [],
        analysisReport: '',
        actionPlan: '',
        messages: [],
        isComplete: false,
        hasErrors: false
      };

      const result = await this.graph.invoke(initialState, {
        configurable: { thread_id: `analysis_${Date.now()}` }
      });

      const processingTime = Date.now() - startTime;
      
      // 组合最终分析内容
      const analysisContent = `${result.analysisReport}\n\n${result.actionPlan}`;

      return {
        analysis_content: analysisContent,
        processing_time: processingTime,
        tokens_used: 0, // LangGraph不直接提供token统计
        recommendations: {
          inventory_action: result.actionSuggestions.filter(a => a.includes('库存') || a.includes('补货')).join('; ') || '无库存操作建议',
          sales_strategy: result.actionSuggestions.filter(a => a.includes('促销') || a.includes('Coupon')).join('; ') || '无销售策略建议',
          ad_optimization: result.actionSuggestions.filter(a => a.includes('广告') || a.includes('BID')).join('; ') || '无广告优化建议',
          risk_level: result.priorityLevel === 'highest' ? 'high' : 
                     result.priorityLevel === 'high' ? 'high' :
                     result.priorityLevel === 'medium' ? 'medium' : 'low'
        }
      };

    } catch (error) {
      console.error('Helios Agent analysis failed:', error);
      throw new Error(`AI智能体分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}

// 单例模式导出
let heliosAgent: HeliosAgent | null = null;

export function getHeliosAgent(): HeliosAgent {
  if (!heliosAgent) {
    heliosAgent = new HeliosAgent();
  }
  return heliosAgent;
}