/**
 * 库存数据一致性验证系统
 * 
 * 核心功能：
 * 1. 数据完整性验证 - 确保源数据和聚合数据一致
 * 2. 业务规则验证 - 检查业务逻辑约束
 * 3. 跨时间维度验证 - 验证不同时间窗口的数据一致性
 * 4. 异常数据检测 - 识别异常值和数据质量问题
 * 5. 自动修复机制 - 自动修复可修复的数据问题
 */

import { db } from '@/db';
import { sql, eq, and, gte, lte } from 'drizzle-orm';
import { inventoryDeals } from '@/db/schema';

// 验证规则类型
export enum ValidationRule {
  DATA_INTEGRITY = 'data_integrity',
  BUSINESS_LOGIC = 'business_logic', 
  CROSS_TEMPORAL = 'cross_temporal',
  ANOMALY_DETECTION = 'anomaly_detection',
  COMPLETENESS = 'completeness'
}

// 验证结果
export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  error_count: number;
  warning_count: number;
  details: ValidationDetail[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  auto_fixable: boolean;
}

// 验证详情
export interface ValidationDetail {
  check_name: string;
  entity_id: string; // ASIN或记录ID
  expected_value?: any;
  actual_value?: any;
  description: string;
  fix_suggestion?: string;
}

// 数据一致性报告
export interface ConsistencyReport {
  validation_id: string;
  target_date: Date;
  validation_time: Date;
  overall_status: 'passed' | 'warning' | 'failed';
  total_records_checked: number;
  rules_results: ValidationResult[];
  auto_fixes_applied: number;
  manual_review_required: boolean;
}

export class InventoryDataValidator {
  
  /**
   * 执行完整的数据一致性验证
   */
  async validateSnapshots(targetDate: Date): Promise<ConsistencyReport> {
    const validationId = `validation_${targetDate.toISOString().split('T')[0]}_${Date.now()}`;
    
    console.log(`🔍 开始数据一致性验证: ${validationId}`);
    
    const report: ConsistencyReport = {
      validation_id: validationId,
      target_date: targetDate,
      validation_time: new Date(),
      overall_status: 'passed',
      total_records_checked: 0,
      rules_results: [],
      auto_fixes_applied: 0,
      manual_review_required: false
    };
    
    try {
      // 获取要验证的快照数据
      const snapshots = await this.getSnapshotsForValidation(targetDate);
      report.total_records_checked = snapshots.length;
      
      if (snapshots.length === 0) {
        report.overall_status = 'failed';
        report.manual_review_required = true;
        return report;
      }
      
      // 执行各种验证规则
      const validationPromises = [
        this.validateDataIntegrity(snapshots, targetDate),
        this.validateBusinessLogic(snapshots),
        this.validateCrossTemporalConsistency(snapshots),
        this.detectAnomalies(snapshots),
        this.validateCompleteness(snapshots, targetDate)
      ];
      
      const results = await Promise.all(validationPromises);
      report.rules_results = results;
      
      // 计算总体状态
      const criticalFailures = results.filter(r => !r.passed && r.severity === 'critical').length;
      const highFailures = results.filter(r => !r.passed && r.severity === 'high').length;
      const warnings = results.filter(r => r.warning_count > 0).length;
      
      if (criticalFailures > 0) {
        report.overall_status = 'failed';
        report.manual_review_required = true;
      } else if (highFailures > 0) {
        report.overall_status = 'warning';
        report.manual_review_required = true;
      } else if (warnings > 0) {
        report.overall_status = 'warning';
      }
      
      // 应用自动修复
      const autoFixResults = await this.applyAutoFixes(results, snapshots);
      report.auto_fixes_applied = autoFixResults.fixes_applied;
      
      // 保存验证报告
      await this.saveValidationReport(report);
      
      console.log(`✅ 数据验证完成: ${report.overall_status}, 检查${report.total_records_checked}条记录`);
      
      return report;
      
    } catch (error) {
      console.error(`❌ 数据验证失败:`, error);
      
      report.overall_status = 'failed';
      report.manual_review_required = true;
      
      await this.saveValidationReport(report);
      throw error;
    }
  }
  
  /**
   * 数据完整性验证
   * 验证聚合数据与源数据的一致性
   */
  private async validateDataIntegrity(
    snapshots: any[], 
    targetDate: Date
  ): Promise<ValidationResult> {
    
    const details: ValidationDetail[] = [];
    let error_count = 0;
    let warning_count = 0;
    
    // 按ASIN+warehouse_location分组验证
    const groupedSnapshots = this.groupSnapshots(snapshots);
    
    for (const [groupKey, groupSnapshots] of Object.entries(groupedSnapshots)) {
      const [asin, warehouseLocation] = groupKey.split('|');
      
      // 获取源数据进行对比验证
      const sourceData = await this.getSourceDataForValidation(asin, warehouseLocation, targetDate);
      
      // 验证每个时间窗口的聚合结果
      for (const snapshot of groupSnapshots) {
        const windowValidation = await this.validateTimeWindowIntegrity(
          snapshot, 
          sourceData,
          asin,
          warehouseLocation
        );
        
        if (!windowValidation.passed) {
          details.push(windowValidation);
          error_count++;
        }
      }
    }
    
    return {
      rule: ValidationRule.DATA_INTEGRITY,
      passed: error_count === 0,
      error_count,
      warning_count,
      details,
      severity: error_count > 0 ? 'high' : 'low',
      auto_fixable: false // 数据完整性问题需要重新聚合
    };
  }
  
  /**
   * 业务逻辑验证
   * 验证计算结果的业务合理性
   */
  private async validateBusinessLogic(snapshots: any[]): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let error_count = 0;
    let warning_count = 0;
    
    for (const snapshot of snapshots) {
      // 规则1: 库存周转天数合理性检查
      if (snapshot.inventory_turnover_days < 0 || snapshot.inventory_turnover_days > 9999) {
        details.push({
          check_name: 'inventory_turnover_range',
          entity_id: `${snapshot.asin}|${snapshot.warehouse_location}|${snapshot.time_window}`,
          actual_value: snapshot.inventory_turnover_days,
          description: '库存周转天数超出合理范围 (0-9999)',
          fix_suggestion: '检查库存数据和销量数据的准确性'
        });
        error_count++;
      }
      
      // 规则2: 广告指标逻辑一致性
      const expectedCtr = snapshot.total_ad_impressions > 0 
        ? snapshot.total_ad_clicks / snapshot.total_ad_impressions
        : 0;
      
      if (Math.abs(snapshot.ad_ctr - expectedCtr) > 0.001) {
        details.push({
          check_name: 'ad_ctr_calculation',
          entity_id: `${snapshot.asin}|${snapshot.warehouse_location}|${snapshot.time_window}`,
          expected_value: expectedCtr.toFixed(6),
          actual_value: snapshot.ad_ctr,
          description: '广告点击率计算不一致',
          fix_suggestion: '重新计算CTR = 点击量 / 曝光量'
        });
        error_count++;
      }
      
      // 规则3: 广告转化率合理性
      const expectedConversionRate = snapshot.total_ad_clicks > 0
        ? snapshot.total_ad_orders / snapshot.total_ad_clicks
        : 0;
        
      if (Math.abs(snapshot.ad_conversion_rate - expectedConversionRate) > 0.001) {
        details.push({
          check_name: 'ad_conversion_calculation',
          entity_id: `${snapshot.asin}|${snapshot.warehouse_location}|${snapshot.time_window}`,
          expected_value: expectedConversionRate.toFixed(6),
          actual_value: snapshot.ad_conversion_rate,
          description: '广告转化率计算不一致',
          fix_suggestion: '重新计算转化率 = 订单量 / 点击量'
        });
        error_count++;
      }
      
      // 规则4: 销售数据逻辑检查
      const expectedAvgDailySales = snapshot.total_sales_quantity / snapshot.time_window_days;
      if (Math.abs(snapshot.avg_daily_sales - expectedAvgDailySales) > 0.01) {
        details.push({
          check_name: 'avg_daily_sales_calculation',
          entity_id: `${snapshot.asin}|${snapshot.warehouse_location}|${snapshot.time_window}`,
          expected_value: expectedAvgDailySales.toFixed(2),
          actual_value: snapshot.avg_daily_sales,
          description: '日均销量计算不一致',
          fix_suggestion: '重新计算日均销量 = 总销量 / 时间窗口天数'
        });
        error_count++;
      }
      
      // 规则5: 库存状态与周转天数一致性
      const expectedStatus = this.calculateExpectedInventoryStatus(snapshot.inventory_turnover_days);
      if (snapshot.inventory_status !== expectedStatus) {
        details.push({
          check_name: 'inventory_status_consistency',
          entity_id: `${snapshot.asin}|${snapshot.warehouse_location}|${snapshot.time_window}`,
          expected_value: expectedStatus,
          actual_value: snapshot.inventory_status,
          description: '库存状态与周转天数不一致',
          fix_suggestion: '根据周转天数重新计算库存状态'
        });
        warning_count++;
      }
    }
    
    return {
      rule: ValidationRule.BUSINESS_LOGIC,
      passed: error_count === 0,
      error_count,
      warning_count,
      details,
      severity: error_count > 10 ? 'high' : error_count > 0 ? 'medium' : 'low',
      auto_fixable: true // 大部分计算错误可以自动修复
    };
  }
  
  /**
   * 跨时间维度一致性验证
   * 验证不同时间窗口之间的数据逻辑
   */
  private async validateCrossTemporalConsistency(snapshots: any[]): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let error_count = 0;
    let warning_count = 0;
    
    // 按ASIN+warehouse_location分组
    const groupedSnapshots = this.groupSnapshots(snapshots);
    
    for (const [groupKey, groupSnapshots] of Object.entries(groupedSnapshots)) {
      if (groupSnapshots.length !== 4) {
        details.push({
          check_name: 'time_windows_complete',
          entity_id: groupKey,
          expected_value: 4,
          actual_value: groupSnapshots.length,
          description: '时间窗口数量不完整',
          fix_suggestion: '检查聚合过程是否生成了所有4个时间窗口'
        });
        error_count++;
        continue;
      }
      
      // 按时间窗口天数排序
      const sortedSnapshots = groupSnapshots.sort((a, b) => a.time_window_days - b.time_window_days);
      
      // 验证累加逻辑 - 短期窗口的数据应该被长期窗口包含
      for (let i = 1; i < sortedSnapshots.length; i++) {
        const shorter = sortedSnapshots[i-1]; // 较短时间窗口
        const longer = sortedSnapshots[i];   // 较长时间窗口
        
        // 销售数据应该是递增的（长期窗口包含短期）
        if (longer.total_sales_amount < shorter.total_sales_amount) {
          details.push({
            check_name: 'cumulative_sales_consistency',
            entity_id: `${groupKey}|${shorter.time_window}->${longer.time_window}`,
            expected_value: `>= ${shorter.total_sales_amount}`,
            actual_value: longer.total_sales_amount,
            description: `${longer.time_window}窗口销售额小于${shorter.time_window}窗口`,
            fix_suggestion: '检查时间窗口的数据范围是否正确'
          });
          error_count++;
        }
        
        // 广告数据应该是递增的
        if (longer.total_ad_impressions < shorter.total_ad_impressions) {
          details.push({
            check_name: 'cumulative_impressions_consistency',
            entity_id: `${groupKey}|${shorter.time_window}->${longer.time_window}`,
            expected_value: `>= ${shorter.total_ad_impressions}`,
            actual_value: longer.total_ad_impressions,
            description: `${longer.time_window}窗口广告曝光量小于${shorter.time_window}窗口`,
            fix_suggestion: '检查广告数据的时间范围聚合'
          });
          warning_count++;
        }
      }
      
      // 验证库存数据一致性 - 所有时间窗口的库存应该相同（都是T-1的值）
      const inventoryValues = groupSnapshots.map(s => s.total_inventory);
      const uniqueInventory = [...new Set(inventoryValues)];
      
      if (uniqueInventory.length > 1) {
        details.push({
          check_name: 'inventory_consistency_across_windows',
          entity_id: groupKey,
          expected_value: '相同库存值',
          actual_value: uniqueInventory.join(', '),
          description: '不同时间窗口的库存数据不一致',
          fix_suggestion: '所有窗口应使用T-1日期的相同库存值'
        });
        error_count++;
      }
    }
    
    return {
      rule: ValidationRule.CROSS_TEMPORAL,
      passed: error_count === 0,
      error_count,
      warning_count,
      details,
      severity: error_count > 5 ? 'high' : error_count > 0 ? 'medium' : 'low',
      auto_fixable: false // 跨时间维度问题通常需要重新聚合
    };
  }
  
  /**
   * 异常数据检测
   * 使用统计方法检测异常值
   */
  private async detectAnomalies(snapshots: any[]): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let error_count = 0;
    let warning_count = 0;
    
    // 计算统计指标用于异常检测
    const stats = this.calculateStatistics(snapshots);
    
    for (const snapshot of snapshots) {
      // 销售额异常检测 (Z-score > 3)
      const salesZScore = Math.abs((snapshot.total_sales_amount - stats.sales_mean) / stats.sales_std);
      if (salesZScore > 3) {
        details.push({
          check_name: 'sales_amount_outlier',
          entity_id: `${snapshot.asin}|${snapshot.warehouse_location}|${snapshot.time_window}`,
          actual_value: snapshot.total_sales_amount,
          description: `销售额异常 (Z-score: ${salesZScore.toFixed(2)})`,
          fix_suggestion: '检查源数据或业务异常情况'
        });
        warning_count++;
      }
      
      // 广告花费异常检测
      const adSpendZScore = Math.abs((snapshot.total_ad_spend - stats.ad_spend_mean) / stats.ad_spend_std);
      if (adSpendZScore > 3) {
        details.push({
          check_name: 'ad_spend_outlier',
          entity_id: `${snapshot.asin}|${snapshot.warehouse_location}|${snapshot.time_window}`,
          actual_value: snapshot.total_ad_spend,
          description: `广告花费异常 (Z-score: ${adSpendZScore.toFixed(2)})`,
          fix_suggestion: '检查广告投放是否有特殊活动'
        });
        warning_count++;
      }
      
      // 库存周转异常检测
      if (snapshot.inventory_turnover_days > stats.turnover_p95 * 2) {
        details.push({
          check_name: 'inventory_turnover_extreme',
          entity_id: `${snapshot.asin}|${snapshot.warehouse_location}|${snapshot.time_window}`,
          actual_value: snapshot.inventory_turnover_days,
          description: `库存周转天数极异常 (超过95%分位数的2倍)`,
          fix_suggestion: '检查是否为滞销产品或数据错误'
        });
        error_count++;
      }
    }
    
    return {
      rule: ValidationRule.ANOMALY_DETECTION,
      passed: error_count === 0,
      error_count,
      warning_count,
      details,
      severity: error_count > 0 ? 'medium' : 'low',
      auto_fixable: false // 异常值需要人工判断
    };
  }
  
  /**
   * 完整性验证
   * 检查数据完整性和覆盖率
   */
  private async validateCompleteness(snapshots: any[], targetDate: Date): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let error_count = 0;
    let warning_count = 0;
    
    // 检查预期的产品数量
    const expectedProductCount = await this.getExpectedProductCount(targetDate);
    const actualProductCount = new Set(snapshots.map(s => `${s.asin}|${s.warehouse_location}`)).size;
    
    if (actualProductCount < expectedProductCount * 0.9) { // 允许10%的数据缺失
      details.push({
        check_name: 'product_coverage',
        entity_id: 'overall',
        expected_value: expectedProductCount,
        actual_value: actualProductCount,
        description: '产品覆盖率不足',
        fix_suggestion: '检查源数据完整性或聚合过程中的过滤条件'
      });
      error_count++;
    }
    
    // 检查数据完整性评分
    const lowCompletenessSnapshots = snapshots.filter(s => s.data_completeness_score < 0.7);
    if (lowCompletenessSnapshots.length > snapshots.length * 0.2) { // 超过20%的记录完整性差
      details.push({
        check_name: 'data_completeness_score',
        entity_id: 'overall',
        actual_value: lowCompletenessSnapshots.length,
        description: '过多记录的数据完整性评分过低',
        fix_suggestion: '检查源数据质量或扩大数据获取范围'
      });
      warning_count++;
    }
    
    // 检查关键字段非空率
    const nonZeroInventoryRate = snapshots.filter(s => s.total_inventory > 0).length / snapshots.length;
    if (nonZeroInventoryRate < 0.5) {
      details.push({
        check_name: 'inventory_data_availability',
        entity_id: 'overall',
        expected_value: '> 50%',
        actual_value: `${(nonZeroInventoryRate * 100).toFixed(1)}%`,
        description: '库存数据可用性过低',
        fix_suggestion: '检查库存数据源或同步机制'
      });
      warning_count++;
    }
    
    return {
      rule: ValidationRule.COMPLETENESS,
      passed: error_count === 0,
      error_count,
      warning_count,
      details,
      severity: error_count > 0 ? 'high' : warning_count > 0 ? 'medium' : 'low',
      auto_fixable: false // 完整性问题需要数据源层面解决
    };
  }
  
  /**
   * 应用自动修复
   */
  private async applyAutoFixes(
    validationResults: ValidationResult[],
    snapshots: any[]
  ): Promise<{ fixes_applied: number; details: string[] }> {
    
    let fixes_applied = 0;
    const fix_details: string[] = [];
    
    for (const result of validationResults) {
      if (!result.auto_fixable || result.details.length === 0) {
        continue;
      }
      
      // 只修复业务逻辑错误
      if (result.rule === ValidationRule.BUSINESS_LOGIC) {
        for (const detail of result.details) {
          const fixed = await this.applySpecificFix(detail, snapshots);
          if (fixed) {
            fixes_applied++;
            fix_details.push(`修复: ${detail.check_name} - ${detail.entity_id}`);
          }
        }
      }
    }
    
    // 批量更新修复的记录
    if (fixes_applied > 0) {
      await this.batchUpdateFixedRecords(snapshots);
    }
    
    return { fixes_applied, details: fix_details };
  }
  
  /**
   * 辅助方法：获取快照数据用于验证
   */
  private async getSnapshotsForValidation(targetDate: Date): Promise<any[]> {
    const result = await db
      .select()
      .from(inventoryDeals)
      .where(eq(inventoryDeals.snapshot_date, targetDate))
      .orderBy(inventoryDeals.asin, inventoryDeals.warehouse_location, inventoryDeals.time_window);
    
    return result;
  }
  
  /**
   * 辅助方法：获取源数据用于对比验证
   */
  private async getSourceDataForValidation(
    asin: string, 
    warehouseLocation: string, 
    targetDate: Date
  ): Promise<any[]> {
    // 获取T-60到T-1的源数据用于验证
    const endDate = targetDate;
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 60);
    
    const query = sql.raw(`
      SELECT * FROM product_analytics 
      WHERE asin = $1 
        AND marketplace_id = $2
        AND data_date >= $3 
        AND data_date <= $4
      ORDER BY data_date
    `, [asin, warehouseLocation, startDate, endDate]);
    
    const result = await db.execute(query);
    return result.rows;
  }
  
  /**
   * 辅助方法：分组快照数据
   */
  private groupSnapshots(snapshots: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const snapshot of snapshots) {
      const key = `${snapshot.asin}|${snapshot.warehouse_location}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(snapshot);
    }
    
    return grouped;
  }
  
  /**
   * 辅助方法：验证单个时间窗口的数据完整性
   */
  private async validateTimeWindowIntegrity(
    snapshot: any,
    sourceData: any[],
    asin: string,
    warehouseLocation: string
  ): Promise<ValidationDetail> {
    
    // 过滤窗口内的源数据
    const windowStart = new Date(snapshot.window_start_date);
    const windowEnd = new Date(snapshot.window_end_date);
    
    const windowSourceData = sourceData.filter(record => {
      const recordDate = new Date(record.data_date);
      return recordDate >= windowStart && recordDate <= windowEnd;
    });
    
    // 验证销售数据聚合
    const expectedTotalSales = windowSourceData.reduce((sum, r) => sum + (r.sales_amount || 0), 0);
    const actualTotalSales = snapshot.total_sales_amount;
    
    if (Math.abs(expectedTotalSales - actualTotalSales) > 0.01) {
      return {
        check_name: 'sales_aggregation_integrity',
        entity_id: `${asin}|${warehouseLocation}|${snapshot.time_window}`,
        expected_value: expectedTotalSales.toFixed(2),
        actual_value: actualTotalSales,
        description: '销售金额聚合结果与源数据不一致',
        fix_suggestion: '重新执行聚合计算'
      };
    }
    
    return {
      check_name: 'time_window_integrity',
      entity_id: `${asin}|${warehouseLocation}|${snapshot.time_window}`,
      description: '时间窗口数据完整性验证通过'
    };
  }
  
  /**
   * 辅助方法：计算统计指标
   */
  private calculateStatistics(snapshots: any[]) {
    const salesAmounts = snapshots.map(s => s.total_sales_amount);
    const adSpends = snapshots.map(s => s.total_ad_spend);
    const turnovers = snapshots.map(s => s.inventory_turnover_days).filter(t => t < 999);
    
    return {
      sales_mean: this.mean(salesAmounts),
      sales_std: this.standardDeviation(salesAmounts),
      ad_spend_mean: this.mean(adSpends),
      ad_spend_std: this.standardDeviation(adSpends),
      turnover_p95: this.percentile(turnovers, 0.95)
    };
  }
  
  /**
   * 辅助方法：计算预期库存状态
   */
  private calculateExpectedInventoryStatus(turnoverDays: number): string {
    if (turnoverDays <= 7) return '短缺';
    if (turnoverDays <= 30) return '正常';  
    if (turnoverDays <= 60) return '充足';
    return '积压';
  }
  
  /**
   * 辅助方法：应用特定修复
   */
  private async applySpecificFix(detail: ValidationDetail, snapshots: any[]): Promise<boolean> {
    // 根据检查类型应用对应的修复逻辑
    const [asin, warehouseLocation, timeWindow] = detail.entity_id.split('|');
    const snapshot = snapshots.find(s => 
      s.asin === asin && 
      s.warehouse_location === warehouseLocation && 
      s.time_window === timeWindow
    );
    
    if (!snapshot) return false;
    
    switch (detail.check_name) {
      case 'ad_ctr_calculation':
        snapshot.ad_ctr = snapshot.total_ad_impressions > 0 
          ? snapshot.total_ad_clicks / snapshot.total_ad_impressions
          : 0;
        return true;
        
      case 'ad_conversion_calculation':
        snapshot.ad_conversion_rate = snapshot.total_ad_clicks > 0
          ? snapshot.total_ad_orders / snapshot.total_ad_clicks
          : 0;
        return true;
        
      case 'avg_daily_sales_calculation':
        snapshot.avg_daily_sales = snapshot.total_sales_quantity / snapshot.time_window_days;
        return true;
        
      case 'inventory_status_consistency':
        snapshot.inventory_status = this.calculateExpectedInventoryStatus(snapshot.inventory_turnover_days);
        return true;
        
      default:
        return false;
    }
  }
  
  /**
   * 辅助方法：批量更新修复的记录
   */
  private async batchUpdateFixedRecords(snapshots: any[]): Promise<void> {
    // 批量更新数据库中的记录
    // 这里需要实现具体的批量更新逻辑
    console.log('🔧 批量更新修复的记录');
  }
  
  /**
   * 辅助方法：保存验证报告
   */
  private async saveValidationReport(report: ConsistencyReport): Promise<void> {
    // 保存验证报告到数据库
    console.log(`📋 保存验证报告: ${report.validation_id}`);
  }
  
  /**
   * 辅助方法：获取预期产品数量
   */
  private async getExpectedProductCount(targetDate: Date): Promise<number> {
    // 从product_analytics估算活跃产品数量
    const result = await db.execute(sql.raw(`
      SELECT COUNT(DISTINCT CONCAT(asin, '|', marketplace_id)) as count
      FROM product_analytics 
      WHERE data_date = $1
    `, [targetDate]));
    
    return result.rows[0]?.count || 0;
  }
  
  // 数学工具方法
  private mean(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }
  
  private standardDeviation(numbers: number[]): number {
    const avg = this.mean(numbers);
    const squareDiffs = numbers.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }
  
  private percentile(numbers: number[], p: number): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] || 0;
  }
}

// 导出验证器单例
export const dataValidator = new InventoryDataValidator();