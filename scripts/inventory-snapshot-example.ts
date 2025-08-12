/**
 * 库存快照聚合系统完整使用示例
 * 
 * 这个脚本演示如何使用库存快照系统的各个组件:
 * 1. 数据聚合
 * 2. ETL调度
 * 3. 性能优化
 * 4. 数据验证
 */

import { InventorySnapshotAggregator } from '../src/lib/aggregation/inventory-snapshot-aggregator';
import { snapshotScheduler, SnapshotETLController } from '../src/lib/etl/inventory-snapshot-scheduler';
import { performanceOptimizer, PerformanceMonitor } from '../src/lib/optimization/inventory-performance-optimizer';
import { dataValidator } from '../src/lib/validation/inventory-data-validator';

async function main() {
  console.log('🚀 库存快照聚合系统演示\n');
  
  try {
    // 1. 初始化系统优化
    console.log('📊 1. 初始化性能优化...');
    await initializeOptimization();
    
    // 2. 执行单日快照生成
    console.log('\n📈 2. 执行单日快照生成...');
    await demonstrateSingleDaySnapshot();
    
    // 3. 批量补数据演示
    console.log('\n🔄 3. 批量补数据演示...');
    await demonstrateBackfillData();
    
    // 4. 数据验证演示
    console.log('\n🔍 4. 数据验证演示...');
    await demonstrateDataValidation();
    
    // 5. 启动定时调度
    console.log('\n⏰ 5. 启动定时调度...');
    await demonstrateScheduler();
    
    // 6. 性能监控报告
    console.log('\n📊 6. 性能监控报告...');
    showPerformanceReport();
    
    console.log('\n✅ 演示完成!');
    
  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  }
}

/**
 * 初始化性能优化
 */
async function initializeOptimization() {
  console.log('  🔧 创建优化索引...');
  await performanceOptimizer.createOptimizedIndexes();
  
  console.log('  📊 更新表统计信息...');
  await performanceOptimizer.updateTableStatistics();
  
  console.log('  🛠️ 维护分区表...');
  await performanceOptimizer.maintainPartitions();
  
  console.log('  ✅ 性能优化初始化完成');
}

/**
 * 演示单日快照生成
 */
async function demonstrateSingleDaySnapshot() {
  const startTime = Date.now();
  
  // 生成昨天的快照
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  console.log(`  📅 生成 ${yesterday.toDateString()} 的库存快照...`);
  
  const aggregator = new InventorySnapshotAggregator();
  const snapshots = await aggregator.generateSnapshotsForDate(yesterday);
  
  const duration = Date.now() - startTime;
  PerformanceMonitor.recordMetric('single_day_snapshot', duration);
  
  console.log(`  ✅ 生成完成: ${snapshots.length}条记录，耗时: ${duration}ms`);
  
  // 展示快照数据示例
  if (snapshots.length > 0) {
    console.log('\n  📊 快照数据示例:');
    const sample = snapshots[0];
    console.log(`    ASIN: ${sample.asin}`);
    console.log(`    产品名称: ${sample.product_name}`);
    console.log(`    库存点: ${sample.warehouse_location}`);
    console.log(`    时间窗口: ${sample.time_window} (${sample.time_window_days}天)`);
    console.log(`    总库存: ${sample.total_inventory}`);
    console.log(`    总销售额: ${sample.total_sales_amount}`);
    console.log(`    库存周转天数: ${sample.inventory_turnover_days}`);
    console.log(`    库存状态: ${sample.inventory_status}`);
    console.log(`    广告点击率: ${(sample.ad_ctr * 100).toFixed(3)}%`);
    console.log(`    数据完整性: ${sample.data_completeness_score}`);
  }
}

/**
 * 演示批量补数据
 */
async function demonstrateBackfillData() {
  const startTime = Date.now();
  
  // 补最近3天的数据
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // 昨天
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 2); // 3天前
  
  console.log(`  🔄 补数据: ${startDate.toDateString()} 到 ${endDate.toDateString()}`);
  
  const results = await SnapshotETLController.triggerBackfill(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );
  
  const duration = Date.now() - startTime;
  PerformanceMonitor.recordMetric('backfill_data', duration);
  
  console.log(`  ✅ 补数据完成:`);
  console.log(`    总任务数: ${results.total_tasks}`);
  console.log(`    成功任务: ${results.successful_tasks}`);
  console.log(`    失败任务: ${results.failed_tasks}`);
  console.log(`    执行时长: ${duration}ms`);
  
  // 展示失败任务详情
  if (results.failed_tasks > 0) {
    console.log('  ⚠️ 失败任务详情:');
    results.results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`    - ${r.target_date}: ${r.error_message}`);
    });
  }
}

/**
 * 演示数据验证
 */
async function demonstrateDataValidation() {
  const startTime = Date.now();
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  console.log(`  🔍 验证 ${yesterday.toDateString()} 的快照数据...`);
  
  const report = await dataValidator.validateSnapshots(yesterday);
  
  const duration = Date.now() - startTime;
  PerformanceMonitor.recordMetric('data_validation', duration);
  
  console.log(`  ✅ 验证完成:`);
  console.log(`    验证ID: ${report.validation_id}`);
  console.log(`    总体状态: ${report.overall_status}`);
  console.log(`    检查记录数: ${report.total_records_checked}`);
  console.log(`    自动修复数: ${report.auto_fixes_applied}`);
  console.log(`    需人工review: ${report.manual_review_required ? '是' : '否'}`);
  console.log(`    执行时长: ${duration}ms`);
  
  // 展示验证详情
  console.log('\n  📋 验证规则结果:');
  report.rules_results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`    ${status} ${result.rule}: 错误${result.error_count}个, 警告${result.warning_count}个`);
    
    // 展示前3个问题详情
    if (result.details.length > 0) {
      result.details.slice(0, 3).forEach(detail => {
        console.log(`      - ${detail.check_name}: ${detail.description}`);
      });
      
      if (result.details.length > 3) {
        console.log(`      ... 还有${result.details.length - 3}个问题`);
      }
    }
  });
}

/**
 * 演示定时调度器
 */
async function demonstrateScheduler() {
  console.log('  ⏰ 启动ETL调度器...');
  
  // 启动调度器 (在实际环境中会持续运行)
  snapshotScheduler.startScheduler();
  
  console.log('  ✅ 调度器已启动');
  console.log('    - 每日02:00执行快照生成');
  console.log('    - 每小时检查失败任务并重试');
  
  // 手动触发一次任务演示
  console.log('\n  🔧 手动触发任务演示...');
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  try {
    const result = await SnapshotETLController.triggerManualSnapshot(
      yesterday.toISOString().split('T')[0]
    );
    
    console.log(`  ✅ 手动任务完成:`);
    console.log(`    任务ID: ${result.task_id}`);
    console.log(`    处理记录: ${result.records_processed}`);
    console.log(`    数据质量: ${result.data_quality_score}`);
    console.log(`    执行时长: ${result.duration_ms}ms`);
    
  } catch (error) {
    console.log(`  ❌ 手动任务失败: ${error}`);
  }
}

/**
 * 显示性能监控报告
 */
function showPerformanceReport() {
  console.log('  📊 性能监控报告:');
  
  const report = PerformanceMonitor.getReport();
  
  if (Object.keys(report).length === 0) {
    console.log('    暂无性能数据');
    return;
  }
  
  console.log('    操作性能统计:');
  Object.entries(report).forEach(([operation, stats]) => {
    if (stats) {
      console.log(`      ${operation}:`);
      console.log(`        平均耗时: ${stats.avg.toFixed(2)}ms`);
      console.log(`        最小耗时: ${stats.min}ms`);
      console.log(`        最大耗时: ${stats.max}ms`);
      console.log(`        95%分位: ${stats.p95}ms`);
      console.log(`        执行次数: ${stats.count}`);
    }
  });
  
  // 性能建议
  console.log('\n  💡 性能优化建议:');
  Object.entries(report).forEach(([operation, stats]) => {
    if (stats) {
      if (stats.avg > 10000) { // 超过10秒
        console.log(`    ⚠️ ${operation} 平均耗时较长，建议进一步优化`);
      }
      
      if (stats.p95 > stats.avg * 3) { // P95显著高于平均值
        console.log(`    ⚠️ ${operation} 性能不稳定，存在性能尖刺`);
      }
    }
  });
}

/**
 * API使用演示
 */
function demonstrateApiUsage() {
  console.log('\n📡 API使用示例:');
  
  console.log('1. 手动触发快照生成:');
  console.log(`   POST /api/inventory-snapshot`);
  console.log(`   {`);
  console.log(`     "action": "manual_snapshot",`);
  console.log(`     "target_date": "2024-08-10"`);
  console.log(`   }`);
  
  console.log('\n2. 批量补数据:');
  console.log(`   POST /api/inventory-snapshot`);
  console.log(`   {`);
  console.log(`     "action": "backfill",`);
  console.log(`     "start_date": "2024-08-05",`);
  console.log(`     "end_date": "2024-08-10"`);
  console.log(`   }`);
  
  console.log('\n3. 查询任务状态:');
  console.log(`   GET /api/inventory-snapshot?task_id=xxx`);
  
  console.log('\n4. 查询聚合数据:');
  console.log(`   SELECT * FROM inventory_deals`);
  console.log(`   WHERE snapshot_date = '2024-08-10'`);
  console.log(`     AND asin = 'B08N5WRWNW'`);
  console.log(`     AND warehouse_location = 'EU'`);
  console.log(`   ORDER BY time_window_days;`);
}

/**
 * 业务场景使用示例
 */
function showBusinessScenarios() {
  console.log('\n🏢 业务场景使用示例:');
  
  console.log('\n场景1: 库存预警分析');
  console.log('  查询库存状态为"短缺"的产品:');
  console.log(`  SELECT asin, product_name, warehouse_location, total_inventory, inventory_turnover_days`);
  console.log(`  FROM inventory_deals`);
  console.log(`  WHERE snapshot_date = CURRENT_DATE - 1`);
  console.log(`    AND time_window = 'T7'`);
  console.log(`    AND inventory_status = '短缺'`);
  console.log(`  ORDER BY inventory_turnover_days ASC;`);
  
  console.log('\n场景2: 销售趋势对比');
  console.log('  对比不同时间窗口的销售表现:');
  console.log(`  SELECT asin, product_name,`);
  console.log(`    MAX(CASE WHEN time_window = 'T1' THEN avg_daily_sales END) as daily_1d,`);
  console.log(`    MAX(CASE WHEN time_window = 'T7' THEN avg_daily_sales END) as daily_7d,`);
  console.log(`    MAX(CASE WHEN time_window = 'T30' THEN avg_daily_sales END) as daily_30d`);
  console.log(`  FROM inventory_deals`);
  console.log(`  WHERE snapshot_date = CURRENT_DATE - 1`);
  console.log(`    AND warehouse_location = 'US'`);
  console.log(`  GROUP BY asin, product_name;`);
  
  console.log('\n场景3: 广告效果分析');
  console.log('  分析广告投放效果:');
  console.log(`  SELECT asin, product_name, warehouse_location,`);
  console.log(`    total_ad_impressions, total_ad_clicks, total_ad_spend,`);
  console.log(`    ad_ctr, ad_conversion_rate, acos`);
  console.log(`  FROM inventory_deals`);
  console.log(`  WHERE snapshot_date = CURRENT_DATE - 1`);
  console.log(`    AND time_window = 'T30'`);
  console.log(`    AND total_ad_spend > 100`);
  console.log(`  ORDER BY acos ASC;`);
}

// 执行演示
if (require.main === module) {
  main()
    .then(() => {
      demonstrateApiUsage();
      showBusinessScenarios();
      process.exit(0);
    })
    .catch((error) => {
      console.error('演示失败:', error);
      process.exit(1);
    });
}

export { main as runInventorySnapshotDemo };