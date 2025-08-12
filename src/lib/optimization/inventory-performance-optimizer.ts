/**
 * 库存快照聚合系统性能优化方案
 * 
 * 优化策略：
 * 1. 索引设计优化 - 多维度复合索引
 * 2. 查询优化 - SQL分解和并行查询
 * 3. 分批处理 - 避免大批量操作锁表
 * 4. 缓存策略 - Redis缓存热点数据
 * 5. 分区策略 - 按日期分区表
 * 6. 读写分离 - 查询走只读副本
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';

// 索引优化配置
export const INDEX_OPTIMIZATION_CONFIG = {
  // product_analytics表索引优化
  product_analytics: {
    // 主要聚合查询索引 - 支持按ASIN+日期范围+市场快速查找
    aggregation_primary: {
      name: 'idx_pa_aggregation_primary',
      columns: ['asin', 'marketplace_id', 'data_date', 'dev_name'],
      type: 'BTREE',
      description: '支持主要聚合查询的复合索引'
    },
    // 时间范围查询索引 - 分区裁剪优化
    time_range: {
      name: 'idx_pa_time_range',
      columns: ['data_date', 'asin', 'marketplace_id'], 
      type: 'BTREE',
      description: '支持时间范围查询和分区裁剪'
    },
    // 库存数据查询索引
    inventory_data: {
      name: 'idx_pa_inventory',
      columns: ['total_inventory', 'fba_inventory', 'data_date'],
      type: 'BTREE', 
      description: '支持库存数据过滤和排序'
    },
    // 广告数据聚合索引
    ad_metrics: {
      name: 'idx_pa_ad_metrics',
      columns: ['asin', 'data_date', 'impressions', 'clicks', 'ad_cost'],
      type: 'BTREE',
      description: '支持广告数据聚合计算'
    },
    // 覆盖索引 - 包含大部分查询需要的列
    covering_index: {
      name: 'idx_pa2_covering',
      columns: ['asin', 'marketplace_id', 'data_date'],
      includes: ['sales_amount', 'sales_quantity', 'impressions', 'clicks', 'ad_cost', 'ad_orders'],
      type: 'BTREE',
      description: '覆盖索引，减少回表查询'
    }
  },
  
  // inventory_deals表索引优化
  inventory_deals: {
    // 已在schema中定义的索引基础上的额外优化
    time_series_query: {
      name: 'idx_id_time_series',
      columns: ['asin', 'warehouse_location', 'snapshot_date DESC', 'time_window'],
      type: 'BTREE',
      description: '支持时间序列分析查询'
    },
    // 聚合分析索引
    analytical: {
      name: 'idx_id_analytical',
      columns: ['snapshot_date', 'inventory_status', 'total_inventory DESC'],
      type: 'BTREE',
      description: '支持聚合分析和报表生成'
    }
  }
} as const;

// 查询优化配置
export const QUERY_OPTIMIZATION_CONFIG = {
  // 批量大小配置
  batch_sizes: {
    source_data_fetch: 5000,      // 源数据获取批量大小
    aggregation_process: 1000,    // 聚合处理批量大小  
    insert_batch: 500,           // 插入操作批量大小
    update_batch: 200            // 更新操作批量大小
  },
  
  // 并行处理配置
  parallel_config: {
    max_concurrent_groups: 4,     // 最大并发处理组数
    connection_pool_size: 10,     // 数据库连接池大小
    query_timeout: 60000         // 查询超时时间（毫秒）
  },
  
  // 分区表配置
  partitioning: {
    enabled: true,
    strategy: 'monthly',          // 按月分区
    retention_months: 24,         // 保留24个月数据
    auto_maintenance: true        // 自动分区维护
  }
} as const;

export class InventoryPerformanceOptimizer {
  
  /**
   * 创建优化索引
   */
  async createOptimizedIndexes(): Promise<void> {
    console.log('🚀 开始创建性能优化索引...');
    
    try {
      // 创建product_analytics表的优化索引
      await this.createProductAnalysis2Indexes();
      
      // 创建inventory_deals表的优化索引
      await this.createInventoryDealsIndexes();
      
      console.log('✅ 优化索引创建完成');
      
    } catch (error) {
      console.error('❌ 创建优化索引失败:', error);
      throw error;
    }
  }
  
  /**
   * 创建product_analytics表的索引
   */
  private async createProductAnalysis2Indexes(): Promise<void> {
    const config = INDEX_OPTIMIZATION_CONFIG.product_analytics;
    
    // 主要聚合查询索引
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS ${config.aggregation_primary.name}
      ON product_analytics (${config.aggregation_primary.columns.join(', ')});
    `));
    
    // 时间范围查询索引
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS ${config.time_range.name}
      ON product_analytics (${config.time_range.columns.join(', ')});
    `));
    
    // 库存数据查询索引
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS ${config.inventory_data.name}
      ON product_analytics (${config.inventory_data.columns.join(', ')});
    `));
    
    // 广告数据聚合索引
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS ${config.ad_metrics.name}
      ON product_analytics (${config.ad_metrics.columns.join(', ')});
    `));
    
    console.log('📊 product_analytics表索引创建完成');
  }
  
  /**
   * 创建inventory_deals表的索引
   */
  private async createInventoryDealsIndexes(): Promise<void> {
    const config = INDEX_OPTIMIZATION_CONFIG.inventory_deals;
    
    // 时间序列查询索引
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS ${config.time_series_query.name}
      ON inventory_deals (${config.time_series_query.columns.join(', ')});
    `));
    
    // 聚合分析索引
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS ${config.analytical.name}
      ON inventory_deals (${config.analytical.columns.join(', ')});
    `));
    
    console.log('📈 inventory_deals表索引创建完成');
  }
  
  /**
   * 分析表统计信息并更新
   */
  async updateTableStatistics(): Promise<void> {
    console.log('📊 开始更新表统计信息...');
    
    try {
      // 分析product_analytics表
      await db.execute(sql.raw(`ANALYZE product_analytics;`));
      
      // 分析inventory_deals表  
      await db.execute(sql.raw(`ANALYZE inventory_deals;`));
      
      console.log('✅ 表统计信息更新完成');
      
    } catch (error) {
      console.error('❌ 更新表统计信息失败:', error);
      throw error;
    }
  }
  
  /**
   * 优化的源数据获取查询
   * 使用分批查询避免大结果集
   */
  async optimizedSourceDataFetch(
    targetDate: Date,
    offset: number = 0,
    limit: number = QUERY_OPTIMIZATION_CONFIG.batch_sizes.source_data_fetch
  ): Promise<any[]> {
    
    const endDate = targetDate;
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 60);
    
    // 优化的查询 - 使用索引提示和批量获取
    const query = sql.raw(`
      SELECT /*+ USE INDEX (idx_pa2_aggregation_primary) */
        asin,
        data_date,
        marketplace_id,
        dev_name,
        spu_name,
        COALESCE(fba_inventory, 0) as fba_inventory,
        COALESCE(total_inventory, 0) as total_inventory,
        COALESCE(sales_amount, 0) as sales_amount,
        COALESCE(sales_quantity, 0) as sales_quantity,
        COALESCE(impressions, 0) as impressions,
        COALESCE(clicks, 0) as clicks,
        COALESCE(ad_cost, 0) as ad_cost,
        COALESCE(ad_orders, 0) as ad_orders,
        COALESCE(ad_conversion_rate, 0) as ad_conversion_rate,
        COALESCE(acos, 0) as acos
      FROM product_analytics 
      WHERE data_date >= $1 
        AND data_date <= $2
        AND asin IS NOT NULL 
        AND marketplace_id IS NOT NULL
      ORDER BY asin, marketplace_id, data_date
      LIMIT $3 OFFSET $4
    `, [startDate, endDate, limit, offset]);
    
    const result = await db.execute(query);
    return result.rows;
  }
  
  /**
   * 并行分组聚合处理
   * 将数据分组后并行处理，提高聚合效率
   */
  async parallelGroupAggregation(sourceData: any[]): Promise<any[]> {
    const { max_concurrent_groups } = QUERY_OPTIMIZATION_CONFIG.parallel_config;
    
    // 按ASIN分组
    const groupedByAsin = this.groupByAsin(sourceData);
    const asinGroups = Object.keys(groupedByAsin);
    
    // 分批并行处理
    const results: any[] = [];
    
    for (let i = 0; i < asinGroups.length; i += max_concurrent_groups) {
      const batch = asinGroups.slice(i, i + max_concurrent_groups);
      
      // 并行处理当前批次
      const batchPromises = batch.map(async (asin) => {
        return await this.processAsinGroup(groupedByAsin[asin], asin);
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
      
      console.log(`✅ 并行处理批次 ${Math.floor(i/max_concurrent_groups) + 1}/${Math.ceil(asinGroups.length/max_concurrent_groups)}`);
    }
    
    return results;
  }
  
  /**
   * 优化的批量插入
   * 使用COPY或批量INSERT提高插入性能
   */
  async optimizedBatchInsert(records: any[]): Promise<void> {
    const batchSize = QUERY_OPTIMIZATION_CONFIG.batch_sizes.insert_batch;
    
    console.log(`🚀 开始批量插入${records.length}条记录，批量大小: ${batchSize}`);
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        // 使用ON CONFLICT DO UPDATE处理重复数据
        const placeholders = batch.map((_, index) => {
          const baseIndex = index * 30; // 根据字段数量调整
          return `($${baseIndex + 1}, $${baseIndex + 2}, ..., $${baseIndex + 30})`;
        }).join(', ');
        
        // 优化的批量插入SQL（简化示例）
        const insertQuery = sql.raw(`
          INSERT INTO inventory_deals (
            snapshot_date, asin, product_name, sales_person, warehouse_location,
            time_window, time_window_days, window_start_date, window_end_date,
            fba_available, total_inventory, total_sales_amount, total_sales_quantity,
            avg_daily_sales, avg_daily_revenue, total_ad_impressions, total_ad_clicks,
            total_ad_spend, total_ad_orders, ad_ctr, ad_conversion_rate, acos,
            inventory_turnover_days, inventory_status, source_records_count,
            data_completeness_score, batch_id, processing_duration_ms,
            created_at, updated_at
          ) VALUES ${placeholders}
          ON CONFLICT (asin, warehouse_location, snapshot_date, time_window)
          DO UPDATE SET
            product_name = EXCLUDED.product_name,
            sales_person = EXCLUDED.sales_person,
            fba_available = EXCLUDED.fba_available,
            total_inventory = EXCLUDED.total_inventory,
            total_sales_amount = EXCLUDED.total_sales_amount,
            total_sales_quantity = EXCLUDED.total_sales_quantity,
            avg_daily_sales = EXCLUDED.avg_daily_sales,
            avg_daily_revenue = EXCLUDED.avg_daily_revenue,
            total_ad_impressions = EXCLUDED.total_ad_impressions,
            total_ad_clicks = EXCLUDED.total_ad_clicks,
            total_ad_spend = EXCLUDED.total_ad_spend,
            total_ad_orders = EXCLUDED.total_ad_orders,
            ad_ctr = EXCLUDED.ad_ctr,
            ad_conversion_rate = EXCLUDED.ad_conversion_rate,
            acos = EXCLUDED.acos,
            inventory_turnover_days = EXCLUDED.inventory_turnover_days,
            inventory_status = EXCLUDED.inventory_status,
            source_records_count = EXCLUDED.source_records_count,
            data_completeness_score = EXCLUDED.data_completeness_score,
            updated_at = CURRENT_TIMESTAMP
        `, batch.flat());
        
        await db.execute(insertQuery);
        
        console.log(`✅ 批量插入完成 ${i + batch.length}/${records.length}`);
        
      } catch (error) {
        console.error(`❌ 批量插入失败 batch ${Math.floor(i/batchSize) + 1}:`, error);
        throw error;
      }
    }
  }
  
  /**
   * 分区表维护
   */
  async maintainPartitions(): Promise<void> {
    const config = QUERY_OPTIMIZATION_CONFIG.partitioning;
    
    if (!config.enabled) {
      return;
    }
    
    console.log('🛠️ 开始分区表维护...');
    
    try {
      // 创建下个月的分区
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      await this.createMonthlyPartition('product_analytics', nextMonth);
      await this.createMonthlyPartition('inventory_deals', nextMonth);
      
      // 删除过期分区
      if (config.auto_maintenance) {
        await this.dropExpiredPartitions(config.retention_months);
      }
      
      console.log('✅ 分区表维护完成');
      
    } catch (error) {
      console.error('❌ 分区表维护失败:', error);
      throw error;
    }
  }
  
  /**
   * 创建月度分区
   */
  private async createMonthlyPartition(tableName: string, date: Date): Promise<void> {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const partitionName = `${tableName}_y${year}m${month}`;
    
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, date.getMonth() + 1, 1).toISOString().split('T')[0];
    
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS ${partitionName} 
      PARTITION OF ${tableName}
      FOR VALUES FROM ('${startDate}') TO ('${endDate}');
    `));
    
    console.log(`📅 创建分区: ${partitionName}`);
  }
  
  /**
   * 删除过期分区
   */
  private async dropExpiredPartitions(retentionMonths: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    
    // 查询并删除过期分区
    const expiredPartitions = await db.execute(sql.raw(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE tablename LIKE '%_y%m%' 
        AND tablename LIKE 'product_analytics_%' 
        OR tablename LIKE 'inventory_deals_%'
    `));
    
    for (const partition of expiredPartitions.rows) {
      // 解析分区日期并检查是否过期
      const match = partition.tablename.match(/_y(\d{4})m(\d{2})$/);
      if (match) {
        const partitionDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1);
        if (partitionDate < cutoffDate) {
          await db.execute(sql.raw(`DROP TABLE IF EXISTS ${partition.tablename};`));
          console.log(`🗑️ 删除过期分区: ${partition.tablename}`);
        }
      }
    }
  }
  
  /**
   * 辅助方法：按ASIN分组
   */
  private groupByAsin(sourceData: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const record of sourceData) {
      const key = record.asin;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(record);
    }
    
    return grouped;
  }
  
  /**
   * 辅助方法：处理ASIN组
   */
  private async processAsinGroup(records: any[], asin: string): Promise<any[]> {
    // 这里实现单个ASIN组的聚合处理逻辑
    // 具体实现会调用InventorySnapshotAggregator的相关方法
    console.log(`🔄 处理ASIN组: ${asin}, ${records.length}条记录`);
    
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return []; // 返回聚合结果
  }
}

// 性能监控工具
export class PerformanceMonitor {
  private static metrics: Record<string, number[]> = {};
  
  /**
   * 记录操作性能
   */
  static recordMetric(operation: string, durationMs: number): void {
    if (!this.metrics[operation]) {
      this.metrics[operation] = [];
    }
    this.metrics[operation].push(durationMs);
    
    // 只保留最近100次记录
    if (this.metrics[operation].length > 100) {
      this.metrics[operation].shift();
    }
  }
  
  /**
   * 获取性能统计
   */
  static getStats(operation: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const records = this.metrics[operation];
    if (!records || records.length === 0) {
      return null;
    }
    
    const sorted = [...records].sort((a, b) => a - b);
    const count = records.length;
    const sum = records.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p95Index = Math.floor(count * 0.95);
    const p95 = sorted[p95Index];
    
    return { count, avg, min, max, p95 };
  }
  
  /**
   * 获取所有操作的性能报告
   */
  static getReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    for (const operation of Object.keys(this.metrics)) {
      report[operation] = this.getStats(operation);
    }
    
    return report;
  }
}

// 导出优化器单例
export const performanceOptimizer = new InventoryPerformanceOptimizer();