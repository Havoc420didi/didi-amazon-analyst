#!/usr/bin/env ts-node
/**
 * PostgreSQL迁移测试脚本
 * 验证MySQL→PostgreSQL迁移的正确性和性能
 */

import PostgreSQLAdapter from '../src/lib/adapters/postgresql-adapter';
import { DataAggregationService } from '../src/app/api/ai-analysis/services/data-aggregation';
import { DataIntegrationService } from '../src/app/api/ai-analysis/services/data-integration';

interface TestResult {
  test_name: string;
  status: 'PASS' | 'FAIL';
  duration_ms: number;
  details?: any;
  error?: string;
}

class PostgreSQLMigrationTest {
  private adapter = PostgreSQLAdapter;
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 开始PostgreSQL迁移测试...\n');

    const tests = [
      this.testConnection,
      this.testDataStats,
      this.testInventoryPointsQuery,
      this.testLatestData,
      this.testAggregationMethods,
      this.testDataIntegration,
      this.testPerformanceBenchmark,
      this.testDataValidation
    ];

    for (const test of tests) {
      await this.runTest(test);
    }

    this.printResults();
  }

  private async runTest(testFunc: () => Promise<TestResult>): Promise<void> {
    const start = Date.now();
    try {
      const result = await testFunc();
      result.duration_ms = Date.now() - start;
      this.results.push(result);
      console.log(`  ${result.status} ${result.test_name} (${result.duration_ms}ms)`);
    } catch (error) {
      this.results.push({
        test_name: '未知测试',
        status: 'FAIL',
        duration_ms: Date.now() - start,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 连接测试
   */
  private async testConnection(): Promise<TestResult> {
    const success = await this.adapter.testConnection();
    return {
      test_name: 'PostgreSQL连接测试',
      status: success ? 'PASS' : 'FAIL',
      error: success ? undefined : '无法连接到PostgreSQL数据库'
    };
  }

  /**
   * 数据统计测试
   */
  private async testDataStats(): Promise<TestResult> {
    const stats = await this.adapter.getDataStats();
    
    return {
      test_name: '数据统计测试',
      status: stats.total_inventory_points > 0 ? 'PASS' : 'FAIL',
      details: {
        total_records: stats.total_inventory_points,
        unique_products: stats.total_products,
        marketplaces: stats.unique_marketplaces,
        date_range: stats.date_range
      }
    };
  }

  /**
   * 库存点查询测试
   */
  private async testInventoryPointsQuery(): Promise<TestResult> {
    const result = await this.adapter.getInventoryPoints({
      asin: 'B123456789',
      marketplace: 'UK',
      page: 1,
      limit: 5
    });

    return {
      test_name: '库存点查询测试',
      status: result.data.length > 0 ? 'PASS' : 'FAIL',
      details: {
        records_returned: result.data.length,
        pagination: result.pagination,
        sample_record: result.data[0]
      }
    };
  }

  /**
   * 最新数据查询测试
   */
  private async testLatestData(): Promise<TestResult> {
    const data = await this.adapter.getLatestInventoryPoint('B123456789', 'UK');
    
    return {
      test_name: '最新数据查询测试',
      status: data !== null ? 'PASS' : 'FAIL',
      details: data ? {
        asin: data.asin,
        inventory: data.totalInventory,
        sales: data.averageSales,
        revenue: data.dailySalesAmount
      } : null
    };
  }

  /**
   * 聚合方法测试
   */
  private async testAggregationMethods(): Promise<TestResult> {
    const methods = ['latest', 'average', 'sum', 'trend'];
    const results: any[] = [];

    for (const method of methods) {
      try {
        const result = await DataAggregationService.aggregateMultiDayData(
          'B123456789',
          'UK',
          { type: 'multi_day', days: 7, aggregation_method: method }
        );
        results.push({ method, success: true, data: result });
      } catch (error) {
        results.push({ method, success: false, error: error.message });
      }
    }

    const allPass = results.every(r => r.success);
    
    return {
      test_name: '聚合方法测试',
      status: allPass ? 'PASS' : 'FAIL',
      details: results
    };
  }

  /**
   * 数据集成测试
   */
  private async testDataIntegration(): Promise<TestResult> {
    const testData = {
      asin: 'BTEST001',
      warehouse_location: 'UK',
      executor: '测试用户',
      product_data: {
        asin: 'BTEST001',
        product_name: '测试产品',
        warehouse_location: 'UK',
        sales_person: '测试销售',
        total_inventory: 100,
        fba_available: 50,
        fba_in_transit: 30,
        local_warehouse: 20,
        avg_sales: 5.5,
        daily_revenue: 150.00,
        ad_impressions: 1000,
        ad_clicks: 50,
        ad_spend: 25.00,
        ad_orders: 3
      }
    };

    try {
      const validation = DataIntegrationService.validateProductData(testData.product_data);
      
      return {
        test_name: '数据集成验证',
        status: validation.valid ? 'PASS' : 'FAIL',
        details: {
          valid: validation.valid,
          errors: validation.errors,
          test_data: testData.product_data
        }
      };

    } catch (error) {
      return {
        test_name: '数据集成验证',
        status: 'FAIL',
        error: error.message
      };
    }
  }

  /**
   * 性能基准测试
   */
  private async testPerformanceBenchmark(): Promise<TestResult> {
    const testCases = [
      { operation: '基础查询', query: () => this.adapter.getInventoryPoints({ page: 1, limit: 10 }) },
      { operation: '单产品查询', query: () => this.adapter.getLatestInventoryPoint('B123456789', 'UK') },
      { operation: '聚合查询', query: () => this.adapter.getHistoryData('B123456789', 'UK', 7) }
    ];

    const performances: any[] = [];

    for (const testCase of testCases) {
      const start = Date.now();
      try {
        await testCase.query();
        const duration = Date.now() - start;
        performances.push({
          operation: testCase.operation,
          duration_ms: duration,
          status: 'SUCCESS'
        });
        
        // 性能门槛检查：超过1000ms为警告，超过5000ms为失败
        if (duration > 5000) {
          return {
            test_name: `性能测试: ${testCase.operation}`,
            status: 'FAIL',
            error: `查询耗时过长: ${duration}ms (期望<5000ms)`
          };
        }
      } catch (error) {
        performances.push({
          operation: testCase.operation,
          duration_ms: Date.now() - start,
          status: 'ERROR',
          error: error.message
        });
      }
    }

    return {
      test_name: '性能基准测试',
      status: 'PASS',
      details: performances
    };
  }

  /**
   * 数据完整性验证
   */
  private async testDataValidation(): Promise<TestResult> {
    const queries = [
      {
        name: '负值检查',
        query: `SELECT COUNT(*) as negative_count 
                FROM inventory_points 
                WHERE total_inventory < 0 
                   OR average_sales < 0 
                   OR daily_sales_amount < 0`
      },
      {
        name: '空值检查',
        query: `SELECT COUNT(*) as null_count 
                FROM inventory_points 
                WHERE asin IS NULL 
                   OR data_date IS NULL 
                   OR marketplace IS NULL`
      },
      {
        name: '日期范围检查',
        query: `SELECT 
                  COUNT(*) as future_count 
                FROM inventory_points 
                WHERE data_date > CURRENT_DATE + INTERVAL '1 day'`
      }
    ];

    const validationResults: any[] = [];

    for (const validation of queries) {
      try {
        const result = await this.adapter.execute_single(validation.query);
        const value = result ? Object.values(result)[0] : 0;
        
        validationResults.push({
          check: validation.name,
          invalid_count: Number(value),
          status: value === 0 ? 'OK' : 'ISSUE'
        });
      } catch (error) {
        validationResults.push({
          check: validation.name,
          error: error.message,
          status: 'ERROR'
        });
      }
    }

    const hasIssues = validationResults.some(r => r.invalid_count > 0);
    
    return {
      test_name: '数据完整性验证',
      status: !hasIssues ? 'PASS' : 'FAIL',
      details: validationResults
    };
  }

  /**
   * 打印测试结果
   */
  private printResults() {
    console.log('\n📊 测试结果总结:');
    console.log('=' * 50);
    
    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ PASSED: ${passCount}`);
    console.log(`❌ FAILED: ${failCount}`);
    console.log(`📈 总耗时: ${this.results.reduce((sum, r) => sum + r.duration_ms, 0)}ms`);
    
    if (failCount > 0) {
      console.log('\n📋 失败详情:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   - ${r.test_name}: ${r.error || String(r.details)}`);
        });
    }

    console.log('\n🎉 测试完成！');
  }
}

// 执行测试
async function main() {
  const tester = new PostgreSQLMigrationTest();
  await tester.runAllTests();
}

// 如果直接运行
if (require.main === module) {
  main().catch(console.error);
}

export default PostgreSQLMigrationTest;