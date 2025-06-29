import { db } from '@/db';
import { aiAnalysisTasks } from '@/db/schema';
import { 
  AIAnalysisTask, 
  CreateAnalysisTask, 
  AnalysisTaskQueryParams,
  PaginatedAnalysisResponse,
  TaskRating,
  AnalysisStats,
  AnalysisStatus
} from '@/types/ai-analysis';
import { eq, and, desc, asc, count, avg, sql } from 'drizzle-orm';
import { DeepseekAnalysisService } from '@/services/ai-analysis';

export class AIAnalysisModel {
  // 创建新的分析任务
  static async createTask(data: CreateAnalysisTask): Promise<AIAnalysisTask> {
    const taskNumber = DeepseekAnalysisService.generateTaskNumber();
    
    const [task] = await db().insert(aiAnalysisTasks).values({
      task_number: taskNumber,
      asin: data.asin,
      warehouse_location: data.warehouse_location,
      executor: data.executor,
      product_data: JSON.stringify(data.product_data),
      status: 'pending',
    }).returning();

    return task as AIAnalysisTask;
  }

  // 获取单个任务
  static async getTask(id: number): Promise<AIAnalysisTask | null> {
    const [task] = await db()
      .select()
      .from(aiAnalysisTasks)
      .where(eq(aiAnalysisTasks.id, id));

    return task as AIAnalysisTask || null;
  }

  // 根据任务编号获取任务
  static async getTaskByNumber(taskNumber: string): Promise<AIAnalysisTask | null> {
    const [task] = await db()
      .select()
      .from(aiAnalysisTasks)
      .where(eq(aiAnalysisTasks.task_number, taskNumber));

    return task as AIAnalysisTask || null;
  }

  // 更新任务状态
  static async updateTaskStatus(
    id: number, 
    status: AnalysisStatus, 
    additionalData: Partial<AIAnalysisTask> = {}
  ): Promise<AIAnalysisTask | null> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const [task] = await db()
      .update(aiAnalysisTasks)
      .set(updateData)
      .where(eq(aiAnalysisTasks.id, id))
      .returning();

    return task as AIAnalysisTask || null;
  }

  // 保存分析结果
  static async saveAnalysisResult(
    id: number,
    analysisContent: string,
    processingTime: number,
    tokensUsed: number
  ): Promise<AIAnalysisTask | null> {
    return this.updateTaskStatus(id, 'completed', {
      analysis_content: analysisContent,
      processing_time: processingTime,
      tokens_used: tokensUsed,
    });
  }

  // 查询任务列表
  static async queryTasks(params: AnalysisTaskQueryParams): Promise<PaginatedAnalysisResponse<AIAnalysisTask>> {
    const {
      asin,
      warehouse_location,
      status,
      executor,
      date_from,
      date_to,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = params;

    // 构建WHERE条件
    const conditions = [];
    
    if (asin) {
      conditions.push(eq(aiAnalysisTasks.asin, asin));
    }
    if (warehouse_location) {
      conditions.push(eq(aiAnalysisTasks.warehouse_location, warehouse_location));
    }
    if (status) {
      conditions.push(eq(aiAnalysisTasks.status, status));
    }
    if (executor) {
      conditions.push(eq(aiAnalysisTasks.executor, executor));
    }
    if (date_from) {
      conditions.push(sql`${aiAnalysisTasks.created_at} >= ${date_from}`);
    }
    if (date_to) {
      conditions.push(sql`${aiAnalysisTasks.created_at} <= ${date_to}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 排序
    const orderBy = sort_order === 'desc' ? desc(aiAnalysisTasks[sort_by]) : asc(aiAnalysisTasks[sort_by]);

    // 查询总数
    const [countResult] = await db()
      .select({ count: count() })
      .from(aiAnalysisTasks)
      .where(whereClause);

    const total = countResult.count;

    // 查询数据
    const tasks = await db()
      .select()
      .from(aiAnalysisTasks)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data: tasks as AIAnalysisTask[],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    };
  }

  // 获取特定产品的最新分析
  static async getLatestAnalysis(asin: string, warehouseLocation: string): Promise<AIAnalysisTask | null> {
    const [task] = await db()
      .select()
      .from(aiAnalysisTasks)
      .where(
        and(
          eq(aiAnalysisTasks.asin, asin),
          eq(aiAnalysisTasks.warehouse_location, warehouseLocation),
          eq(aiAnalysisTasks.status, 'completed')
        )
      )
      .orderBy(desc(aiAnalysisTasks.completed_at))
      .limit(1);

    return task as AIAnalysisTask || null;
  }

  // 获取特定产品的分析历史
  static async getAnalysisHistory(asin: string, warehouseLocation: string, limit: number = 10): Promise<AIAnalysisTask[]> {
    const tasks = await db()
      .select()
      .from(aiAnalysisTasks)
      .where(
        and(
          eq(aiAnalysisTasks.asin, asin),
          eq(aiAnalysisTasks.warehouse_location, warehouseLocation),
          eq(aiAnalysisTasks.status, 'completed')
        )
      )
      .orderBy(desc(aiAnalysisTasks.completed_at))
      .limit(limit);

    return tasks as AIAnalysisTask[];
  }

  // 任务评价
  static async rateTask(id: number, rating: TaskRating): Promise<AIAnalysisTask | null> {
    const [task] = await db()
      .update(aiAnalysisTasks)
      .set({
        rating: rating.rating,
        rating_feedback: rating.feedback || null,
        updated_at: new Date().toISOString()
      })
      .where(eq(aiAnalysisTasks.id, id))
      .returning();

    return task as AIAnalysisTask || null;
  }

  // 获取统计信息
  static async getStats(): Promise<AnalysisStats> {
    // 基础统计
    const [basicStats] = await db()
      .select({
        total_tasks: count(),
        avg_processing_time: avg(aiAnalysisTasks.processing_time),
        total_tokens: sql<number>`sum(${aiAnalysisTasks.tokens_used})`,
      })
      .from(aiAnalysisTasks);

    // 状态分布
    const statusStats = await db()
      .select({
        status: aiAnalysisTasks.status,
        count: count()
      })
      .from(aiAnalysisTasks)
      .groupBy(aiAnalysisTasks.status);

    // 评分分布
    const ratingStats = await db()
      .select({
        rating: aiAnalysisTasks.rating,
        count: count()
      })
      .from(aiAnalysisTasks)
      .where(sql`${aiAnalysisTasks.rating} IS NOT NULL`)
      .groupBy(aiAnalysisTasks.rating);

    // 构建结果
    const stats: AnalysisStats = {
      total_tasks: basicStats.total_tasks,
      completed_tasks: 0,
      pending_tasks: 0,
      failed_tasks: 0,
      avg_processing_time: Math.round(basicStats.avg_processing_time || 0),
      total_tokens_used: basicStats.total_tokens || 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    // 状态分布
    statusStats.forEach(stat => {
      switch (stat.status) {
        case 'completed':
          stats.completed_tasks = stat.count;
          break;
        case 'pending':
          stats.pending_tasks = stat.count;
          break;
        case 'failed':
          stats.failed_tasks = stat.count;
          break;
      }
    });

    // 评分分布
    ratingStats.forEach(stat => {
      if (stat.rating && stat.rating >= 1 && stat.rating <= 5) {
        stats.rating_distribution[stat.rating as keyof typeof stats.rating_distribution] = stat.count;
      }
    });

    return stats;
  }

  // 删除任务
  static async deleteTask(id: number): Promise<boolean> {
    const result = await db()
      .delete(aiAnalysisTasks)
      .where(eq(aiAnalysisTasks.id, id));

    return result.count > 0;
  }

  // 清理旧任务（保留最近30天）
  static async cleanupOldTasks(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db()
      .delete(aiAnalysisTasks)
      .where(sql`${aiAnalysisTasks.created_at} < ${thirtyDaysAgo.toISOString()}`);

    return result.count;
  }
}