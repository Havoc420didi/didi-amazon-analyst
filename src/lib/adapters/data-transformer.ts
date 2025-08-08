/**
 * 数据转换器
 * 负责数据格式转换、计算和标准化处理
 */

export class DataTransformer {
  
  /**
   * 格式化百分比数据
   * @param value 原始数值 (0-1 或 0-100)
   * @param isDecimal 是否为小数形式 (0-1)
   * @returns 格式化后的百分比数值
   */
  formatPercentage(value: any, isDecimal: boolean = true): number {
    // 安全地转换为数字
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    
    if (!numValue || isNaN(numValue)) return 0;
    
    // 如果是小数形式 (0-1)，转换为百分比
    if (isDecimal && numValue <= 1) {
      return parseFloat((numValue * 100).toFixed(2));
    }
    
    // 如果已经是百分比形式，直接返回
    return parseFloat(numValue.toFixed(2));
  }

  /**
   * 安全除法运算
   * @param numerator 分子
   * @param denominator 分母
   * @param decimalPlaces 小数位数
   * @returns 计算结果
   */
  safeDivide(numerator: number, denominator: number, decimalPlaces: number = 2): number {
    if (!denominator || denominator === 0 || isNaN(numerator) || isNaN(denominator)) {
      return 0;
    }
    
    const result = numerator / denominator;
    return parseFloat(result.toFixed(decimalPlaces));
  }

  /**
   * 计算广告平均点击成本 (CPC)
   * @param adSpend 广告花费
   * @param clicks 点击量
   * @returns CPC值
   */
  calculateCPC(adSpend: number, clicks: number): number {
    return this.safeDivide(adSpend, clicks, 2);
  }

  /**
   * 计算广告投资回报率 (ROAS)
   * @param adSales 广告销售额
   * @param adSpend 广告花费
   * @returns ROAS值
   */
  calculateROAS(adSales: number, adSpend: number): number {
    return this.safeDivide(adSales, adSpend, 2);
  }

  /**
   * 计算广告点击率 (CTR)
   * @param clicks 点击量
   * @param impressions 曝光量
   * @returns CTR百分比
   */
  calculateCTR(clicks: number, impressions: number): number {
    const ctr = this.safeDivide(clicks, impressions, 4);
    return this.formatPercentage(ctr, true);
  }

  /**
   * 计算广告转化率 (CVR)
   * @param orders 订单量
   * @param clicks 点击量
   * @returns CVR百分比
   */
  calculateCVR(orders: number, clicks: number): number {
    const cvr = this.safeDivide(orders, clicks, 4);
    return this.formatPercentage(cvr, true);
  }

  /**
   * 计算ACOAS (广告成本占销售比)
   * @param adSpend 广告花费
   * @param dailySalesAmount 日均销售额
   * @returns ACOAS百分比
   */
  calculateACOAS(adSpend: number, dailySalesAmount: number): number {
    const weeklySales = dailySalesAmount * 7;
    const acoas = this.safeDivide(adSpend, weeklySales, 4);
    return this.formatPercentage(acoas, true);
  }

  /**
   * 计算库存周转天数
   * @param totalInventory 总库存
   * @param averageSales 平均销量
   * @returns 周转天数
   */
  calculateTurnoverDays(totalInventory: number, averageSales: number): number {
    if (!averageSales || averageSales <= 0) {
      return totalInventory > 0 ? 999 : 0;
    }
    
    return this.safeDivide(totalInventory, averageSales, 1);
  }

  /**
   * 计算日均销售额
   * @param averageSales 平均销量
   * @param averagePrice 平均价格
   * @returns 日均销售额
   */
  calculateDailySalesAmount(averageSales: number, averagePrice: number): number {
    return this.safeDivide(averageSales * averagePrice, 1, 2);
  }

  /**
   * 判断库存是否为有效库存点
   * @param dailySalesAmount 日均销售额
   * @param threshold 阈值，默认16.7
   * @returns 是否为有效库存点
   */
  isEffectivePoint(dailySalesAmount: number, threshold: number = 16.7): boolean {
    return dailySalesAmount >= threshold;
  }

  /**
   * 判断库存周转是否超标
   * @param turnoverDays 周转天数
   * @param threshold 阈值，默认100天
   * @returns 是否超标
   */
  isTurnoverExceeded(turnoverDays: number, threshold: number = 100): boolean {
    return turnoverDays > threshold;
  }

  /**
   * 判断是否断货
   * @param fbaAvailable FBA可用库存
   * @param threshold 阈值，默认0
   * @returns 是否断货
   */
  isOutOfStock(fbaAvailable: number, threshold: number = 0): boolean {
    return fbaAvailable <= threshold;
  }

  /**
   * 判断是否低库存
   * @param turnoverDays 周转天数
   * @param threshold 阈值，默认45天
   * @returns 是否低库存
   */
  isLowInventory(turnoverDays: number, threshold: number = 45): boolean {
    return turnoverDays > 0 && turnoverDays <= threshold;
  }

  /**
   * 判断是否零销量
   * @param sales7Days 7天销量
   * @returns 是否零销量
   */
  isZeroSales(sales7Days: number): boolean {
    return sales7Days <= 0;
  }

  /**
   * 格式化货币金额
   * @param amount 金额
   * @param currency 货币符号
   * @param decimalPlaces 小数位数
   * @returns 格式化后的金额字符串
   */
  formatCurrency(amount: number, currency: string = '$', decimalPlaces: number = 2): string {
    if (!amount || isNaN(amount)) return `${currency}0.00`;
    
    return `${currency}${amount.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })}`;
  }

  /**
   * 格式化数字（添加千位分隔符）
   * @param value 数值
   * @param decimalPlaces 小数位数
   * @returns 格式化后的数字字符串
   */
  formatNumber(value: number, decimalPlaces: number = 0): string {
    if (!value || isNaN(value)) return '0';
    
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  }

  /**
   * 格式化任务类型显示名称
   * @param taskType 任务类型
   * @returns 显示名称
   */
  formatTaskType(taskType: string): string {
    const typeMap: Record<string, string> = {
      'product_analytics': '产品分析数据',
      'fba_inventory': 'FBA库存数据',
      'inventory_details': '库存明细数据',
    };
    
    return typeMap[taskType] || taskType;
  }

  /**
   * 格式化库存状态
   * @param point 库存点数据
   * @returns 状态描述
   */
  formatInventoryStatus(point: {
    isEffective: boolean;
    isTurnoverExceeded: boolean;
    isOutOfStock: boolean;
    isLowInventory: boolean;
    isZeroSales: boolean;
  }): {
    status: 'excellent' | 'good' | 'warning' | 'danger';
    label: string;
    description: string;
  } {
    if (point.isOutOfStock) {
      return {
        status: 'danger',
        label: '断货',
        description: 'FBA可用库存不足',
      };
    }
    
    if (point.isZeroSales) {
      return {
        status: 'danger',
        label: '零销量',
        description: '7天内无销量记录',
      };
    }
    
    if (point.isTurnoverExceeded) {
      return {
        status: 'warning',
        label: '周转超标',
        description: '库存周转天数超过100天',
      };
    }
    
    if (point.isLowInventory) {
      return {
        status: 'warning',
        label: '低库存',
        description: '库存周转天数在45天以内',
      };
    }
    
    if (point.isEffective) {
      return {
        status: 'excellent',
        label: '优秀',
        description: '日均销售额超过16.7美元',
      };
    }
    
    return {
      status: 'good',
      label: '正常',
      description: '库存状态正常',
    };
  }

  /**
   * 格式化广告效果等级
   * @param metrics 广告指标
   * @returns 效果等级
   */
  formatAdPerformanceLevel(metrics: {
    ctr: number;
    cvr: number;
    roas: number;
    acoas: number;
  }): {
    level: 'excellent' | 'good' | 'average' | 'poor';
    label: string;
    score: number;
  } {
    // 计算综合得分 (0-100)
    let score = 0;
    
    // CTR评分 (0-25分)
    if (metrics.ctr >= 2) score += 25;
    else if (metrics.ctr >= 1) score += 20;
    else if (metrics.ctr >= 0.5) score += 15;
    else if (metrics.ctr >= 0.1) score += 10;
    
    // CVR评分 (0-25分)
    if (metrics.cvr >= 15) score += 25;
    else if (metrics.cvr >= 10) score += 20;
    else if (metrics.cvr >= 5) score += 15;
    else if (metrics.cvr >= 1) score += 10;
    
    // ROAS评分 (0-25分)
    if (metrics.roas >= 5) score += 25;
    else if (metrics.roas >= 3) score += 20;
    else if (metrics.roas >= 2) score += 15;
    else if (metrics.roas >= 1) score += 10;
    
    // ACOAS评分 (0-25分，越低越好)
    if (metrics.acoas <= 10) score += 25;
    else if (metrics.acoas <= 20) score += 20;
    else if (metrics.acoas <= 30) score += 15;
    else if (metrics.acoas <= 50) score += 10;
    
    // 根据得分确定等级
    if (score >= 80) {
      return { level: 'excellent', label: '优秀', score };
    } else if (score >= 60) {
      return { level: 'good', label: '良好', score };
    } else if (score >= 40) {
      return { level: 'average', label: '一般', score };
    } else {
      return { level: 'poor', label: '较差', score };
    }
  }

  /**
   * 计算数据变化趋势
   * @param current 当前值
   * @param previous 前期值
   * @returns 变化趋势
   */
  calculateTrend(current: number, previous: number): {
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
    changeValue: number;
  } {
    if (!previous || previous === 0) {
      return {
        trend: 'stable',
        changePercent: 0,
        changeValue: 0,
      };
    }
    
    const changeValue = current - previous;
    const changePercent = this.safeDivide(changeValue, Math.abs(previous), 2) * 100;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(changePercent) >= 5) { // 变化超过5%才认为有趋势
      trend = changePercent > 0 ? 'up' : 'down';
    }
    
    return {
      trend,
      changePercent: Math.abs(changePercent),
      changeValue,
    };
  }

  /**
   * 数据清洗和验证
   * @param data 原始数据
   * @returns 清洗后的数据
   */
  cleanData<T extends Record<string, any>>(data: T): T {
    const cleaned = { ...data };
    
    Object.keys(cleaned).forEach(key => {
      const value = cleaned[key];
      
      // 处理数字字段
      if (typeof value === 'string' && !isNaN(Number(value))) {
        cleaned[key] = Number(value);
      }
      
      // 处理空值
      if (value === null || value === undefined || value === '') {
        if (key.includes('quantity') || key.includes('amount') || key.includes('days')) {
          cleaned[key] = 0;
        }
      }
      
      // 处理异常值
      if (typeof value === 'number') {
        if (isNaN(value) || !isFinite(value)) {
          cleaned[key] = 0;
        }
        
        // 处理负数（某些字段不应该为负）
        if (key.includes('quantity') || key.includes('amount') || key.includes('days')) {
          cleaned[key] = Math.max(0, value);
        }
      }
    });
    
    return cleaned;
  }

  /**
   * 批量转换数据
   * @param dataList 数据列表
   * @param transformer 转换函数
   * @returns 转换后的数据列表
   */
  batchTransform<T, R>(
    dataList: T[],
    transformer: (item: T, index: number) => R
  ): R[] {
    if (!Array.isArray(dataList)) {
      return [];
    }
    
    return dataList.map((item, index) => {
      try {
        return transformer(item, index);
      } catch (error) {
        console.error('数据转换失败:', { item, index, error });
        return null;
      }
    }).filter(item => item !== null) as R[];
  }
}