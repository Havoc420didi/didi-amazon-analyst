/**
 * 业务规则引擎
 * 集成和扩展现有的17条强制业务规则，确保AI建议符合实际业务约束
 */

import { ProductAnalysisData } from '@/types/ai-analysis';

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'advertising' | 'inventory' | 'pricing' | 'operations';
  condition: (data: ProductAnalysisData, actions: string[]) => boolean;
  violation: string;
  suggestion: string;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  violation: string;
  suggestion: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}

/**
 * 业务规则引擎类
 */
export class BusinessRulesEngine {
  private rules: BusinessRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 初始化所有业务规则
   */
  private initializeRules(): void {
    this.rules = [
      // 1. ACOAS控制规则
      {
        id: 'acoas_critical_high',
        name: 'ACOAS过高紧急控制',
        description: 'ACOAS大于25%时必须立即降低广告BID',
        priority: 'critical',
        category: 'advertising',
        condition: (data, actions) => {
          if ((data.acos ?? 0) > 0.25) {
            const hasBidReduction = actions.some(action => 
              action.includes('BID降低') || action.includes('降低出价') || action.includes('降低')
            );
            return !hasBidReduction;
          }
          return false;
        },
        violation: 'ACOAS超过25%，但未包含降低BID的措施',
        suggestion: '立即将所有广告活动BID降低20%以上'
      },

      {
        id: 'acoas_high',
        name: 'ACOAS高风险控制',
        description: 'ACOAS大于60%时必须立即暂停广告',
        priority: 'critical',
        category: 'advertising',
        condition: (data, actions) => {
          if ((data.acos ?? 0) > 0.60) {
            const hasPause = actions.some(action => 
              action.includes('暂停') || action.includes('关闭')
            );
            return !hasPause;
          }
          return false;
        },
        violation: 'ACOAS超过60%，但未暂停广告投放',
        suggestion: '立即暂停所有广告活动，优化后再重新投放'
      },

      // 2. 转化率控制规则
      {
        id: 'cvr_low_bid_control',
        name: '转化率过低BID控制',
        description: '转化率小于合理转化率80%时必须降BID至0.1',
        priority: 'critical',
        category: 'advertising',
        condition: (data, actions) => {
          const avgPrice = data.avg_sales > 0 ? data.daily_revenue / data.avg_sales : 0;
          const standardCvr = this.getStandardConversionRate(avgPrice);
          const actualCvr = data.ad_clicks > 0 ? (data.ad_orders / data.ad_clicks) * 100 : 0;
          
          if (actualCvr < standardCvr * 0.8) {
            const hasLowBid = actions.some(action => 
              action.includes('BID降低') || action.includes('限制广告') || action.includes('0.1')
            );
            return !hasLowBid;
          }
          return false;
        },
        violation: '转化率低于标准80%，但未将BID降至最低',
        suggestion: '立即将广告BID降至0.1，优化转化率后再提升'
      },

      // 3. Coupon比例限制
      {
        id: 'coupon_limit',
        name: 'Coupon比例限制',
        description: 'Coupon比例不能超过20%',
        priority: 'high',
        category: 'pricing',
        condition: (data, actions) => {
          const couponActions = actions.filter(action => 
            action.includes('Coupon') || action.includes('折扣')
          );
          
          return couponActions.some(action => {
            const percentMatch = action.match(/(\d+)%/);
            if (percentMatch) {
              const percent = parseInt(percentMatch[1]);
              return percent > 20;
            }
            return false;
          });
        },
        violation: 'Coupon比例超过20%限制',
        suggestion: '将Coupon比例调整至15-20%之间，或申请主管审批'
      },

      // 4. 节日产品补货限制
      {
        id: 'seasonal_restock_ban',
        name: '节日产品补货禁令',
        description: '节日类产品不能补货',
        priority: 'high',
        category: 'inventory',
        condition: (data, actions) => {
          const productName = data.product_name.toLowerCase();
          const seasonalKeywords = [
            'christmas', 'halloween', 'valentine', 'easter', 
            'spring', 'summer', 'winter', 'holiday', 'xmas',
            '圣诞', '万圣节', '情人节', '复活节', '春季', '夏季', '冬季', '节日'
          ];
          
          const isSeasonalProduct = seasonalKeywords.some(keyword => 
            productName.includes(keyword)
          );
          
          if (isSeasonalProduct) {
            const hasRestockAction = actions.some(action => 
              action.includes('补货') || action.includes('备货')
            );
            return hasRestockAction;
          }
          return false;
        },
        violation: '节日类产品建议补货，但此类产品易过季',
        suggestion: '停止补货计划，通过促销清理现有库存'
      },

      // 5. 转化率达标广告保护
      {
        id: 'good_ad_protection',
        name: '优质广告保护',
        description: '转化率达标的广告不能关闭',
        priority: 'medium',
        category: 'advertising',
        condition: (data, actions) => {
          const avgPrice = data.avg_sales > 0 ? data.daily_revenue / data.avg_sales : 0;
          const standardCvr = this.getStandardConversionRate(avgPrice);
          const actualCvr = data.ad_clicks > 0 ? (data.ad_orders / data.ad_clicks) * 100 : 0;
          
          if (actualCvr >= standardCvr * 0.9) { // 转化率达标
            const hasCloseAction = actions.some(action => 
              action.includes('关闭') || action.includes('暂停广告')
            );
            return hasCloseAction;
          }
          return false;
        },
        violation: '转化率达标的广告不应关闭',
        suggestion: '保留达标广告，如需控制花费可调整预算至最低或降低BID'
      },

      // 6. 竞价系数调整限制
      {
        id: 'bid_modifier_ban',
        name: '竞价系数调整禁令',
        description: '不要调整广告的竞价系数',
        priority: 'medium',
        category: 'advertising',
        condition: (data, actions) => {
          return actions.some(action => 
            action.includes('竞价系数') || action.includes('调整系数')
          );
        },
        violation: '建议调整竞价系数，但此操作不被允许',
        suggestion: '通过调整BID出价而非竞价系数来优化广告表现'
      },

      // 7. BD优先策略
      {
        id: 'best_deal_priority',
        name: 'BD秒杀优先策略',
        description: '提升销量优先考虑7天限时秒杀',
        priority: 'medium',
        category: 'operations',
        condition: (data, actions) => {
          const needsSalesBoost = data.avg_sales < 5 || data.daily_revenue < 50;
          if (needsSalesBoost) {
            const hasBDSuggestion = actions.some(action => 
              action.includes('BD') || action.includes('秒杀') || action.includes('Best Deal')
            );
            return !hasBDSuggestion;
          }
          return false;
        },
        violation: '需要提升销量但未考虑BD秒杀',
        suggestion: '申请7天限时秒杀(Best Deal)，快速提升销量和排名'
      },

      // 8. 高ACOAS广告预算限制
      {
        id: 'high_acoas_budget_ban',
        name: '高ACOAS预算限制',
        description: '在ACOAS高于15%时不能增加广告预算',
        priority: 'high',
        category: 'advertising',
        condition: (data, actions) => {
          if ((data.acos ?? 0) > 0.15) {
            const hasBudgetIncrease = actions.some(action => 
              action.includes('预算提升') || action.includes('增加预算') || action.includes('扩大投放')
            );
            return hasBudgetIncrease;
          }
          return false;
        },
        violation: 'ACOAS高于15%时不应增加广告预算',
        suggestion: '先优化转化率和广告效率，ACOAS降至15%以下后再考虑增加预算'
      },

      // 9. 达标关键词BID提升
      {
        id: 'good_keyword_bid_boost',
        name: '达标关键词BID提升',
        description: '转化率达标的关键词可以提升10-15%的BID',
        priority: 'low',
        category: 'advertising',
        condition: (data, actions) => {
          const avgPrice = data.avg_sales > 0 ? data.daily_revenue / data.avg_sales : 0;
          const standardCvr = this.getStandardConversionRate(avgPrice);
          const actualCvr = data.ad_clicks > 0 ? (data.ad_orders / data.ad_clicks) * 100 : 0;
          
          if (actualCvr >= standardCvr * 0.9 && (data.acos ?? 0) <= 0.15) {
            const hasBidBoost = actions.some(action => 
              action.includes('BID提升') || action.includes('提升BID')
            );
            return !hasBidBoost;
          }
          return false;
        },
        violation: '转化率达标且ACOAS合理，可以提升BID',
        suggestion: '对达标关键词BID提升10-15%，获得更多优质流量'
      },

      // 10. 无效关键词优化
      {
        id: 'ineffective_keyword_optimization',
        name: '无效关键词优化',
        description: 'ACOS >45%的无效关键词需要优化',
        priority: 'medium',
        category: 'advertising',
        condition: (data, actions) => {
          if ((data.acos ?? 0) > 0.45) {
            const hasKeywordOptimization = actions.some(action => 
              action.includes('关键词') || action.includes('无效词') || action.includes('暂停')
            );
            return !hasKeywordOptimization;
          }
          return false;
        },
        violation: 'ACOS过高但未优化无效关键词',
        suggestion: '暂停ACOS超过45%的无效关键词，观察3天后继续优化'
      },

      // 11. 点击率优化阈值
      {
        id: 'ctr_optimization_threshold',
        name: '点击率优化阈值',
        description: '点击率高于0.5%时不需要优化',
        priority: 'low',
        category: 'advertising',
        condition: (data, actions) => {
          const ctr = data.ad_impressions > 0 ? (data.ad_clicks / data.ad_impressions) * 100 : 0;
          if (ctr >= 0.5) {
            const hasCtrOptimization = actions.some(action => 
              action.includes('点击率') || action.includes('主图') || action.includes('标题')
            );
            return hasCtrOptimization;
          }
          return false;
        },
        violation: '点击率已达标但仍建议优化',
        suggestion: '点击率0.5%以上无需优化，重点关注转化率提升'
      },

      // 12. 移除订单禁令
      {
        id: 'removal_order_ban',
        name: '移除订单禁令',
        description: '不能创建移除订单',
        priority: 'critical',
        category: 'inventory',
        condition: (data, actions) => {
          return actions.some(action => 
            action.includes('移除订单') || action.includes('销毁库存')
          );
        },
        violation: '不能创建移除订单销毁库存',
        suggestion: '通过促销、捐赠或退回本地仓等方式处理滞销库存'
      }
    ];
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
   * 验证行动建议是否违反业务规则
   */
  validateActions(productData: ProductAnalysisData, actions: string[]): RuleViolation[] {
    const violations: RuleViolation[] = [];

    this.rules.forEach(rule => {
      if (rule.condition(productData, actions)) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          violation: rule.violation,
          suggestion: rule.suggestion,
          priority: rule.priority,
          category: rule.category
        });
      }
    });

    // 按优先级排序
    violations.sort((a, b) => {
      const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return violations;
  }

  /**
   * 获取所有规则信息
   */
  getAllRules(): BusinessRule[] {
    return [...this.rules];
  }

  /**
   * 根据类别获取规则
   */
  getRulesByCategory(category: string): BusinessRule[] {
    return this.rules.filter(rule => rule.category === category);
  }

  /**
   * 根据优先级获取规则
   */
  getRulesByPriority(priority: 'critical' | 'high' | 'medium' | 'low'): BusinessRule[] {
    return this.rules.filter(rule => rule.priority === priority);
  }

  /**
   * 修正违规行动建议
   */
  correctViolatingActions(
    productData: ProductAnalysisData, 
    actions: string[], 
    violations: RuleViolation[]
  ): string[] {
    let correctedActions = [...actions];

    violations.forEach(violation => {
      switch (violation.ruleId) {
        case 'acoas_critical_high':
          // 添加BID降低措施
          correctedActions.push('立即将所有广告活动BID降低20%');
          break;

        case 'acoas_high':
          // 添加暂停广告措施
          correctedActions = correctedActions.filter(action => 
            !action.includes('广告') || action.includes('暂停')
          );
          correctedActions.push('立即暂停所有广告活动');
          break;

        case 'cvr_low_bid_control':
          // 添加最低BID措施
          correctedActions.push('将广告BID降至0.1，优化转化率后再调整');
          break;

        case 'coupon_limit':
          // 修正Coupon比例
          correctedActions = correctedActions.map(action => {
            if (action.includes('Coupon') || action.includes('折扣')) {
              return action.replace(/(\d+)%/g, (match, percent) => {
                const num = parseInt(percent);
                return num > 20 ? '18%' : match;
              });
            }
            return action;
          });
          break;

        case 'seasonal_restock_ban':
          // 移除补货建议
          correctedActions = correctedActions.filter(action => 
            !action.includes('补货') && !action.includes('备货')
          );
          correctedActions.push('通过促销清理现有库存，不建议补货');
          break;

        case 'high_acoas_budget_ban':
          // 移除预算增加建议
          correctedActions = correctedActions.filter(action => 
            !action.includes('预算提升') && !action.includes('增加预算')
          );
          break;

        case 'removal_order_ban':
          // 移除移除订单建议
          correctedActions = correctedActions.filter(action => 
            !action.includes('移除订单') && !action.includes('销毁库存')
          );
          break;
      }
    });

    return correctedActions;
  }

  /**
   * 生成规则合规报告
   */
  generateComplianceReport(
    productData: ProductAnalysisData, 
    actions: string[]
  ): {
    compliant: boolean;
    violations: RuleViolation[];
    correctedActions: string[];
    summary: string;
  } {
    const violations = this.validateActions(productData, actions);
    const correctedActions = violations.length > 0 ? 
      this.correctViolatingActions(productData, actions, violations) : actions;

    const criticalCount = violations.filter(v => v.priority === 'critical').length;
    const highCount = violations.filter(v => v.priority === 'high').length;

    let summary = '';
    if (violations.length === 0) {
      summary = '所有行动建议均符合业务规则要求';
    } else {
      summary = `发现${violations.length}个规则违反`;
      if (criticalCount > 0) summary += `，包括${criticalCount}个严重违规`;
      if (highCount > 0) summary += `，${highCount}个高风险违规`;
      summary += '，已自动修正';
    }

    return {
      compliant: violations.length === 0,
      violations,
      correctedActions,
      summary
    };
  }
}

// 单例模式导出
let rulesEngine: BusinessRulesEngine | null = null;

export function getRulesEngine(): BusinessRulesEngine {
  if (!rulesEngine) {
    rulesEngine = new BusinessRulesEngine();
  }
  return rulesEngine;
}

export default BusinessRulesEngine;