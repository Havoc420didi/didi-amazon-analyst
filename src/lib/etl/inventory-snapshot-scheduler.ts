/**
 * 库存快照ETL调度系统
 * 负责定时执行库存快照聚合任务，处理数据同步和错误恢复
 * 
 * 执行策略：
 * 1. 每日02:00执行前一天的快照生成
 * 2. 支持手动触发和补数据
 * 3. 失败重试机制和告警通知
 * 4. 数据质量检查和一致性验证
 */

import cron from 'node-cron';
import { InventorySnapshotAggregator } from './inventory-snapshot-aggregator';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// 任务执行状态
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running', 
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

// 任务执行记录
export interface TaskExecution {
  task_id: string;
  execution_date: Date;
  target_date: Date; // 要处理的T-1日期
  status: TaskStatus;
  start_time: Date;
  end_time?: Date;
  duration_ms?: number;
  records_processed: number;
  error_message?: string;
  retry_count: number;
  data_quality_score: number;
}

// 数据质量检查结果
export interface QualityCheck {
  check_name: string;
  passed: boolean;
  expected_value?: number;
  actual_value?: number;
  threshold?: number;
  description: string;
}

export class InventorySnapshotScheduler {
  private aggregator: InventorySnapshotAggregator;
  private maxRetries = 3;
  private retryDelayMs = 5 * 60 * 1000; // 5分钟
  
  constructor() {
    this.aggregator = new InventorySnapshotAggregator();
  }
  
  /**
   * 启动定时任务调度
   */
  startScheduler() {
    console.log('📅 启动库存快照ETL调度器');
    
    // 每日02:00执行快照生成 (避开业务高峰期)
    cron.schedule('0 2 * * *', async () => {
      await this.executeDailySnapshot();
    }, {
      timezone: 'Asia/Shanghai',
      scheduled: true
    });
    
    // 每小时检查失败任务并重试 
    cron.schedule('0 * * * *', async () => {
      await this.retryFailedTasks();
    }, {
      timezone: 'Asia/Shanghai',
      scheduled: true
    });
    
    console.log('✅ ETL调度器已启动 - 每日02:00执行快照生成');
  }
  
  /**
   * 执行每日快照生成任务
   */
  async executeDailySnapshot(): Promise<TaskExecution> {
    const taskId = `daily_${new Date().toISOString().split('T')[0]}_${Date.now()}`;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1); // T-1
    
    console.log(`🚀 开始执行每日快照任务: ${taskId}`);
    console.log(`📊 目标日期: ${targetDate.toDateString()}`);
    
    const execution: TaskExecution = {
      task_id: taskId,
      execution_date: new Date(),
      target_date: targetDate,
      status: TaskStatus.RUNNING,
      start_time: new Date(),
      records_processed: 0,
      retry_count: 0,
      data_quality_score: 0
    };
    
    try {
      // 保存任务开始记录
      await this.saveTaskExecution(execution);
      
      // 执行快照生成
      const snapshots = await this.aggregator.generateSnapshotsForDate(targetDate);
      
      // 数据质量检查
      const qualityChecks = await this.performQualityChecks(snapshots, targetDate);
      const qualityScore = this.calculateQualityScore(qualityChecks);
      
      if (qualityScore < 0.8) {
        throw new Error(`数据质量评分过低: ${qualityScore}, 需要人工检查`);
      }
      
      // 保存快照数据
      await this.aggregator.saveSnapshots(snapshots);
      
      // 更新任务完成状态
      execution.status = TaskStatus.COMPLETED;
      execution.end_time = new Date();
      execution.duration_ms = execution.end_time.getTime() - execution.start_time.getTime();
      execution.records_processed = snapshots.length;
      execution.data_quality_score = qualityScore;
      
      await this.saveTaskExecution(execution);
      
      // 发送成功通知
      await this.sendSuccessNotification(execution, qualityChecks);
      
      console.log(`✅ 快照任务完成: ${snapshots.length}条记录，质量评分: ${qualityScore}`);
      
      return execution;
      
    } catch (error) {
      console.error(`❌ 快照任务失败:`, error);
      
      execution.status = TaskStatus.FAILED;
      execution.end_time = new Date();
      execution.duration_ms = execution.end_time.getTime() - execution.start_time.getTime();
      execution.error_message = error instanceof Error ? error.message : String(error);
      
      await this.saveTaskExecution(execution);
      await this.sendFailureNotification(execution);
      
      return execution;
    }
  }
  
  /**
   * 手动触发指定日期的快照生成
   */
  async executeManualSnapshot(targetDate: Date): Promise<TaskExecution> {
    const taskId = `manual_${targetDate.toISOString().split('T')[0]}_${Date.now()}`;
    
    console.log(`🔧 手动触发快照任务: ${targetDate.toDateString()}`);
    
    const execution: TaskExecution = {
      task_id: taskId,
      execution_date: new Date(),
      target_date: targetDate,
      status: TaskStatus.RUNNING,
      start_time: new Date(),
      records_processed: 0,
      retry_count: 0,
      data_quality_score: 0
    };
    
    // 执行逻辑同executeDailySnapshot，可以抽取公共方法
    return await this.executeSnapshotTask(execution);
  }
  
  /**
   * 补数据 - 批量生成历史日期的快照
   */
  async backfillSnapshots(startDate: Date, endDate: Date): Promise<TaskExecution[]> {
    console.log(`🔄 开始补数据: ${startDate.toDateString()} 到 ${endDate.toDateString()}`);
    
    const results: TaskExecution[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      try {
        console.log(`📊 处理日期: ${currentDate.toDateString()}`);
        const result = await this.executeManualSnapshot(new Date(currentDate));
        results.push(result);
        
        // 避免过快执行，给数据库一些喘息时间
        await this.sleep(2000); 
        
      } catch (error) {
        console.error(`❌ 补数据失败 ${currentDate.toDateString()}:`, error);
        
        const failedExecution: TaskExecution = {
          task_id: `backfill_${currentDate.toISOString().split('T')[0]}_failed`,
          execution_date: new Date(),
          target_date: new Date(currentDate),
          status: TaskStatus.FAILED,
          start_time: new Date(),
          end_time: new Date(),
          duration_ms: 0,
          records_processed: 0,
          retry_count: 0,
          data_quality_score: 0,
          error_message: error instanceof Error ? error.message : String(error)
        };
        
        results.push(failedExecution);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`✅ 补数据完成，成功: ${results.filter(r => r.status === TaskStatus.COMPLETED).length}，失败: ${results.filter(r => r.status === TaskStatus.FAILED).length}`);
    
    return results;
  }
  
  /**
   * 重试失败的任务
   */
  async retryFailedTasks(): Promise<void> {
    // 查找24小时内失败且重试次数未超限的任务
    const failedTasks = await this.getRetryableTasks();
    
    if (failedTasks.length === 0) {
      return;
    }
    
    console.log(`🔄 发现${failedTasks.length}个可重试任务`);
    
    for (const task of failedTasks) {
      try {
        console.log(`🔄 重试任务: ${task.task_id}`);
        
        // 更新重试状态
        task.status = TaskStatus.RETRYING;
        task.retry_count += 1;
        await this.saveTaskExecution(task);
        
        // 执行重试
        const result = await this.executeManualSnapshot(task.target_date);
        
        if (result.status === TaskStatus.COMPLETED) {
          console.log(`✅ 任务重试成功: ${task.task_id}`);
        }
        
      } catch (error) {
        console.error(`❌ 任务重试失败: ${task.task_id}`, error);
        
        task.status = TaskStatus.FAILED;
        task.error_message = error instanceof Error ? error.message : String(error);
        await this.saveTaskExecution(task);
      }
      
      // 重试间隔
      await this.sleep(this.retryDelayMs);
    }
  }
  
  /**
   * 执行快照任务的通用方法
   */
  private async executeSnapshotTask(execution: TaskExecution): Promise<TaskExecution> {
    try {
      await this.saveTaskExecution(execution);
      
      const snapshots = await this.aggregator.generateSnapshotsForDate(execution.target_date);
      const qualityChecks = await this.performQualityChecks(snapshots, execution.target_date);
      const qualityScore = this.calculateQualityScore(qualityChecks);
      
      if (qualityScore < 0.8) {
        throw new Error(`数据质量评分过低: ${qualityScore}`);
      }
      
      await this.aggregator.saveSnapshots(snapshots);
      
      execution.status = TaskStatus.COMPLETED;
      execution.end_time = new Date();
      execution.duration_ms = execution.end_time.getTime() - execution.start_time.getTime();
      execution.records_processed = snapshots.length;
      execution.data_quality_score = qualityScore;
      
      await this.saveTaskExecution(execution);
      
      return execution;
      
    } catch (error) {
      execution.status = TaskStatus.FAILED;
      execution.end_time = new Date();
      execution.duration_ms = execution.end_time.getTime() - execution.start_time.getTime();
      execution.error_message = error instanceof Error ? error.message : String(error);
      
      await this.saveTaskExecution(execution);
      
      throw error;
    }
  }
  
  /**
   * 数据质量检查
   */
  private async performQualityChecks(
    snapshots: any[],
    targetDate: Date
  ): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];
    
    // 检查1: 记录数量合理性
    const expectedRecordsMin = 100; // 基于历史数据预估
    const actualRecords = snapshots.length;
    checks.push({
      check_name: 'record_count',
      passed: actualRecords >= expectedRecordsMin,
      expected_value: expectedRecordsMin,
      actual_value: actualRecords,
      description: `记录数量检查 (最少${expectedRecordsMin}条)`
    });
    
    // 检查2: 时间窗口完整性
    const expectedTimeWindows = 4;
    const uniqueTimeWindows = new Set(snapshots.map(s => s.time_window)).size;
    checks.push({
      check_name: 'time_windows_complete',
      passed: uniqueTimeWindows === expectedTimeWindows,
      expected_value: expectedTimeWindows,
      actual_value: uniqueTimeWindows,
      description: '时间窗口完整性检查'
    });
    
    // 检查3: 数据完整性评分
    const avgCompletenessScore = snapshots.length > 0 
      ? snapshots.reduce((sum, s) => sum + s.data_completeness_score, 0) / snapshots.length
      : 0;
    checks.push({
      check_name: 'data_completeness',
      passed: avgCompletenessScore >= 0.8,
      expected_value: 0.8,
      actual_value: Number(avgCompletenessScore.toFixed(3)),
      description: '数据完整性评分检查'
    });
    
    // 检查4: 关键指标非空
    const recordsWithInventory = snapshots.filter(s => s.total_inventory > 0).length;
    const inventoryDataRate = snapshots.length > 0 ? recordsWithInventory / snapshots.length : 0;
    checks.push({
      check_name: 'inventory_data_rate',
      passed: inventoryDataRate >= 0.3,
      expected_value: 0.3,
      actual_value: Number(inventoryDataRate.toFixed(3)),
      description: '库存数据可用性检查'
    });
    
    // 检查5: 异常值检测
    const abnormalRecords = snapshots.filter(s => 
      s.inventory_turnover_days > 1000 || 
      s.total_sales_amount < 0 ||
      s.total_ad_spend < 0
    ).length;
    const abnormalRate = snapshots.length > 0 ? abnormalRecords / snapshots.length : 0;
    checks.push({
      check_name: 'abnormal_values',
      passed: abnormalRate <= 0.1,
      expected_value: 0.1,
      actual_value: Number(abnormalRate.toFixed(3)),
      description: '异常值检测'
    });
    
    console.log('🔍 数据质量检查结果:', checks);
    return checks;
  }
  
  /**
   * 计算数据质量总评分
   */
  private calculateQualityScore(checks: QualityCheck[]): number {
    if (checks.length === 0) return 0;
    
    const passedChecks = checks.filter(c => c.passed).length;
    return Number((passedChecks / checks.length).toFixed(3));
  }
  
  /**
   * 保存任务执行记录
   */
  private async saveTaskExecution(execution: TaskExecution): Promise<void> {
    // 这里应该保存到数据库的任务执行表
    // 暂用console输出示意
    console.log(`💾 保存任务执行记录: ${execution.task_id} - ${execution.status}`);
    
    // 实际实现：
    // await db.insert(taskExecutions).values(execution)
    //   .onConflictDoUpdate({
    //     target: [taskExecutions.task_id],
    //     set: execution
    //   });
  }
  
  /**
   * 获取可重试的失败任务
   */
  private async getRetryableTasks(): Promise<TaskExecution[]> {
    // 从数据库查询失败任务
    // 条件：状态为FAILED，重试次数<maxRetries，创建时间在24小时内
    return []; // 示例返回
  }
  
  /**
   * 发送成功通知
   */
  private async sendSuccessNotification(
    execution: TaskExecution, 
    qualityChecks: QualityCheck[]
  ): Promise<void> {
    const message = `✅ 库存快照任务成功完成
任务ID: ${execution.task_id}
处理日期: ${execution.target_date.toDateString()}
处理记录: ${execution.records_processed}条
执行时长: ${execution.duration_ms}ms
数据质量: ${execution.data_quality_score}
通过检查: ${qualityChecks.filter(c => c.passed).length}/${qualityChecks.length}`;
    
    console.log('📧 发送成功通知:', message);
    // 实际发送邮件/钉钉/企业微信通知
  }
  
  /**
   * 发送失败通知
   */
  private async sendFailureNotification(execution: TaskExecution): Promise<void> {
    const message = `❌ 库存快照任务执行失败
任务ID: ${execution.task_id}
处理日期: ${execution.target_date.toDateString()}
错误信息: ${execution.error_message}
重试次数: ${execution.retry_count}/${this.maxRetries}`;
    
    console.error('🚨 发送失败告警:', message);
    // 实际发送告警通知，需要立即处理
  }
  
  /**
   * 工具方法：等待
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例实例
export const snapshotScheduler = new InventorySnapshotScheduler();

// API路由处理方法
export class SnapshotETLController {
  
  /**
   * 手动触发快照生成
   */
  static async triggerManualSnapshot(targetDate: string) {
    try {
      const date = new Date(targetDate);
      const result = await snapshotScheduler.executeManualSnapshot(date);
      
      return {
        success: result.status === TaskStatus.COMPLETED,
        task_id: result.task_id,
        records_processed: result.records_processed,
        duration_ms: result.duration_ms,
        data_quality_score: result.data_quality_score,
        error_message: result.error_message
      };
    } catch (error) {
      throw new Error(`手动快照生成失败: ${error}`);
    }
  }
  
  /**
   * 批量补数据
   */
  static async triggerBackfill(startDate: string, endDate: string) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        throw new Error('开始日期不能晚于结束日期');
      }
      
      const results = await snapshotScheduler.backfillSnapshots(start, end);
      
      return {
        success: true,
        total_tasks: results.length,
        successful_tasks: results.filter(r => r.status === TaskStatus.COMPLETED).length,
        failed_tasks: results.filter(r => r.status === TaskStatus.FAILED).length,
        results: results.map(r => ({
          target_date: r.target_date.toDateString(),
          status: r.status,
          records_processed: r.records_processed,
          error_message: r.error_message
        }))
      };
    } catch (error) {
      throw new Error(`批量补数据失败: ${error}`);
    }
  }
  
  /**
   * 获取任务执行状态
   */
  static async getTaskStatus(taskId?: string) {
    // 从数据库查询任务状态
    return {
      recent_tasks: [], // 最近的任务执行记录
      running_tasks: [], // 正在运行的任务
      failed_tasks: []   // 失败的任务
    };
  }
}