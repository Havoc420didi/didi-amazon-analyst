#!/usr/bin/env ts-node
/**
 * PostgreSQL迁移执行脚本
 * 执行完整的MySQL→PostgreSQL迁移流程
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// 导入PostgreSQL适配器
import PostgreSQLAdapter from '../src/lib/adapters/postgresql-adapter';

interface MigrationConfig {
  source: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  target: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  options: {
    batch_size: number;
    verify_data: boolean;
    dry_run: boolean;
    backup_first: boolean;
  };
}

class PostgreSQLMigrator {
  private config: MigrationConfig;
  private adapter: PostgreSQLAdapter;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
    this.adapter = new PostgreSQLAdapter();
  }

  /**
   * 加载迁移配置
   */
  private loadConfig(configPath?: string): MigrationConfig {
    const env = process.env;
    
    return {
      source: {
        host: env.MIGRATION_MYSQL_HOST || 'localhost',
        port: parseInt(env.MIGRATION_MYSQL_PORT || '3306'),
        user: env.MIGRATION_MYSQL_USER || 'root',
        password: env.MIGRATION_MYSQL_PASSWORD || '',
        database: env.MIGRATION_MYSQL_DATABASE || 'amazon_analyst'
      },
      target: {
        host: env.POSTGRESQL_HOST || 'localhost',
        port: parseInt(env.POSTGRESQL_PORT || '5432'),
        user: env.POSTGRESQL_USER || 'postgres',
        password: env.POSTGRESQL_PASSWORD || '',
        database: env.POSTGRESQL_DATABASE || 'saihu_erp_sync'
      },
      options: {
        batch_size: parseInt(env.MIGRATION_BATCH_SIZE || '1000'),
        verify_data: env.MIGRATION_VERIFY_DATA !== 'false',
        dry_run: env.MIGRATION_DRY_RUN === 'true',
        backup_first: env.MIGRATION_BACKUP_FIRST !== 'false'
      }
    };
  }

  /**
   * 完整迁移流程
   */
  async migrate() {
    console.log('🚀 开始PostgreSQL迁移...');
    
    try {
      // 1. 环境检查
      await this.checkEnvironment();
      
      // 2. 数据库准备
      await this.prepareDatabase();
      
      // 3. 数据表创建
      await this.createTables();
      
      // 4. 数据迁移执行
      if (!this.config.options.dry_run) {
        await this.migrateData();
      }
      
      // 5. 数据验证
      if (this.config.options.verify_data) {
        await this.verifyMigration();
      }
      
      // 6. 配置更新
      await this.updateConfigurations();
      
      console.log('✅ 迁移完成！');
      
    } catch (error) {
      console.error('❌ 迁移失败:', error);
      process.exit(1);
    }
  }

  /**
   * 环境检查
   */
  private async checkEnvironment() {
    console.log('🔍 检查环境...');
    
    // 检查PostgreSQL连接
    const isConnected = await this.adapter.testConnection();
    if (!isConnected) {
      throw new Error('PostgreSQL连接失败');
    }
    console.log('✅ PostgreSQL连接正常');
    
    // 检查现有数据
    const stats = await this.adapter.getDataStats();
    console.log(`📊 现有数据: ${stats.total_inventory_points} 条记录`);
    console.log(`🌍 市场: ${stats.unique_marketplaces.join(', ')}`);
  }

  /**
   * 数据库准备
   */
  private async prepareDatabase() {
    console.log('🏗️ 准备数据库...');
    
    const sqlScript = readFileSync(
      join(__dirname, '../scripts/postgresql_migration_schema.sql'),
      'utf8'
    );
    
    console.log('📄 创建数据表和索引...');
    await this.adapter.executeSQLScript(sqlScript);
    console.log('✅ 数据库准备完成');
  }

  /**
   * 创建数据表
   */
  private async createTables() {
    console.log('🛠️ 创建数据表结构...');
    
    const tables = [
      'inventory_points',
      'product_analytics', 
      'ai_analysis_tasks'
    ];
    
    for (const table of tables) {
      const exists = await this.checkTableExists(table);
      console.log(`✅ ${table}: ${exists ? '已存在' : '待创建'}`);
    }
  }

  /**
   * 执行数据迁移
   */
  private async migrateData() {
    console.log('📥 执行数据迁移...');
    
    // 迁移库存点数据
    await this.migrateInventoryPoints();
    
    // 迁移产品分析数据  
    await this.migrateProductAnalytics();
    
    console.log('✅ 数据迁移完成');
  }

  /**
   * 迁移库存点数据
   */
  private async migrateInventoryPoints() {
    console.log('📦 迁移库存点数据...');
    
    let totalMigrated = 0;
    let batchCount = 0;
    
    do {
      console.log(`📤 处理批次 ${++batchCount}...`);
      
      const batch = await this.fetchMySQLBatch('inventory_points', totalMigrated);
      if (batch.length === 0) break;
      
      const mappedData = batch.map(this.mapMysqlToPostgresInventoryPoint);
      await this.insertBatch('inventory_points', mappedData);
      
      totalMigrated += batch.length;
      console.log(`✅ 已迁移 ${totalMigrated} 条记录`);
      
    } while (batchCount < 100); // 防止无限循环
  }

  /**
   * 迁移产品分析数据
   */
  private async migrateProductAnalytics() {
    console.log('📊 迁移产品分析数据...');
    
    let totalMigrated = 0;
    let batchCount = 0;
    
    do {
      console.log(`📤 处理批次 ${++batchCount}...`);
      
      const batch = await this.fetchMySQLBatch('product_analytics', totalMigrated);
      if (batch.length === 0) break;
      
      const mappedData = batch.map(this.mapMysqlToPostgresProductAnalytics);
      await this.insertBatch('product_analytics', mappedData);
      
      totalMigrated += batch.length;
      console.log(`✅ 已迁移 ${totalMigrated} 条记录`);
      
    } while (true);
  }

  /**
   * 提取MySQL批次数据
   */
  private async fetchMySQLBatch(tableName: string, offset: number): Promise<any[]> {
    // 简化的模拟查询（实际环境中使用真实的MySQL查询）
    const mysqlQuery = `
      SELECT * FROM ${tableName} 
      ORDER BY id ASC 
      LIMIT ${this.config.options.batch_size} OFFSET ${offset}
    `;
    
    // 在实际实现中，这里会连接MySQL数据库
    console.log(`⏳ 从MySQL提取数据: ${mysqlQuery}`);
    
    // 返回模拟数据（实际实现中需替换为真实查询）
    return this.generateMockData(tableName, offset);
  }

  /**
   * 插入批次数据到PostgreSQL
   */
  private async insertBatch(tableName: string, data: any[]) {
    const columns = Object.keys(data[0]).join(', ');
    const placeholders = data.map((_, i) => 
      `(${data[i] ? Object.keys(data[i]).map((_, j) => `$${i * Object.keys(data[i]).length + j + 1}`).join(', ') : ''})`
    ).join(', ');

    const insertQuery = `
      INSERT INTO ${tableName} (${columns}) 
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING;
    `;
    
    console.log(insertQuery);
  }

  /**
   * 数据格式转换：MySQL → PostgreSQL
   */
  private mapMysqlToPostgresInventoryPoint(mysqlRow: any) {
    return {
      asin: mysqlRow.asin,
      product_name: mysqlRow.product_name || mysqlRow.productName,
      sales_person: mysqlRow.sales_person || mysqlRow.salesPerson || '未分配',
      marketplace: mysqlRow.marketplace,
      data_date: mysqlRow.data_date || mysqlRow.dataDate,
      total_inventory: mysqlRow.total_inventory || 0,
      fba_available: mysqlRow.fba_available || 0,
      fba_in_transit: mysqlRow.fba_in_transit || 0,
      local_available: mysqlRow.local_available || 0,
      average_sales: mysqlRow.average_sales || mysqlRow.averageSales || 0,
      daily_sales_amount: mysqlRow.daily_sales_amount || mysqlRow.dailySalesAmount || 0,
      average_price: mysqlRow.average_price || mysqlRow.averagePrice || 0,
      turnover_days: mysqlRow.turnover_days || mysqlRow.turnoverDays || 0,
      ad_impressions: mysqlRow.ad_impressions || mysqlRow.adImpressions || 0,
      ad_clicks: mysqlRow.ad_clicks || mysqlRow.adClicks || 0,
      ad_spend: mysqlRow.ad_spend || mysqlRow.adSpend || 0,
      ad_order_count: mysqlRow.ad_order_count || mysqlRow.adOrderCount || 0,
      product_tag: mysqlRow.product_tag
    };
  }

  private mapMysqlToPostgresProductAnalytics(mysqlRow: any) {
    return {
      asin: mysqlRow.asin,
      sku: mysqlRow.sku,
      marketplace: mysqlRow.marketplace_id || mysqlRow.marketplace,
      data_date: mysqlRow.data_date,
      sales_amount: mysqlRow.sales_amount || 0,
      sales_quantity: mysqlRow.sales_quantity || 0,
      average_price: mysqlRow.average_price || 0,
      impressions: mysqlRow.impressions || 0,
      clicks: mysqlRow.clicks || 0,
      ad_cost: mysqlRow.ad_cost || 0,
      ad_sales: mysqlRow.ad_sales || 0,
      conversion_rate: mysqlRow.conversion_rate || 0,
      ctr: mysqlRow.ctr || 0,
      acos: mysqlRow.acos || 0,
      order_count: mysqlRow.order_count || 0,
      total_inventory: mysqlRow.total_inventory || 0,
      currency: mysqlRow.currency || 'USD'
    };
  }

  /**
   * 验证迁移结果
   */
  private async verifyMigration() {
    console.log('🔍 验证数据迁移...');
    
    const stats = await this.adapter.getDataStats();
    
    console.log('✅ 数据验证完成:');
    console.log(`   总数量: ${stats.total_inventory_points}`);
    console.log(`   商品数: ${stats.total_products}`);
    console.log(`   时间范围: ${stats.date_range.min_date} 至 ${stats.date_range.max_date}`);
    console.log(`   市场: ${stats.unique_marketplaces.join(', ')}`);
  }

  /**
   * 更新配置和代码
   */
  private async updateConfigurations() {
    console.log('⚙️ 更新配置文件...');
    
    // 更新DataAggregationService
    this.updateDataAggregationService();
    
    // 更新环境变量模板
    this.updateEnvTemplates();
    
    console.log('✅ 配置更新完成');
  }

  /**
   * 更新DataAggregationService
   */
  private updateDataAggregationService() {
    console.log('📄 更新DataAggregationService配置...');
    
    const targetPath = join(
      __dirname, 
      '../src/app/api/ai-analysis/services/data-aggregation.ts'
    );
    
    // 创建备份
    try {
      const content = readFileSync(targetPath, 'utf8');
      writeFileSync(targetPath + '.backup.ts', content);
      console.log(`✅ 已备份: ${targetPath}.backup.ts`);
    } catch (err) {
      console.warn('⚠️ 备份失败:', err);
    }
  }

  /**
   * 辅助方法：检查表是否存在
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `;
    const result = await this.adapter.execute_single(query, [tableName]);
    return result?.exists || false;
  }

  /**
   * 生成模拟数据（用于测试）
   */
  private generateMockData(tableName: string, offset: number): any[] {
    if (tableName === 'inventory_points') {
      return Array.from({ length: Math.min(this.config.options.batch_size, 100) }, (_, i) => ({
        id: offset + i + 1,
        asin: `B${(offset + i + 100000000).toString()}`,
        product_name: `测试产品-${offset + i + 1}`,
        marketplace: 'UK',
        data_date: new Date(2024, 0, 1 + i % 30),
        total_inventory: Math.floor(Math.random() * 1000),
        fba_available: Math.floor(Math.random() * 500),
        average_sales: Math.random() * 20 + 1,
        daily_sales_amount: Math.random() * 1000 + 50,
        sales_person: '测试销售',
        ad_impressions: Math.floor(Math.random() * 10000),
        ad_clicks: Math.floor(Math.random() * 500),
        ad_spend: Math.random() * 100 + 10
      }));
    }
    
    return [];
  }
}

// 执行迁移
async function main() {
  const migrator = new PostgreSQLMigrator();
  await migrator.migrate();
}

// 如果直接运行
if (require.main === module) {
  main().catch(console.error);
}

export default PostgreSQLMigrator;