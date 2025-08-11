#!/usr/bin/env ts-node

/**
 * TypeScript 数据库数据检查脚本
 * 这是一个完全只读的脚本，用于检查 PostgreSQL 数据库中的数据情况
 * 不会执行任何写操作，仅用于数据分析和诊断
 */

import { Client } from 'pg';

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'amazon_analyst',
  password: 'amazon_analyst_2024',
  database: 'amazon_analyst',
  ssl: false, // 本地开发环境禁用SSL
  application_name: 'read-only-data-checker'
};

interface TableInfo {
  schemaname: string;
  tablename: string;
  tableowner: string;
  size: string;
  count?: number;
}

interface TableSample {
  columns: string[];
  sampleData: any[];
  dataTypes: Record<string, string>;
}

class SafeDatabaseChecker {
  private client: Client;

  constructor(config: typeof dbConfig) {
    this.client = new Client(config);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      // 设置为只读模式
      await this.client.query('SET TRANSACTION READ ONLY');
      console.log('✅ 成功安全连接到 PostgreSQL 数据库 (只读模式)');
    } catch (error) {
      console.error('❌ 数据库连接失败:', (error as Error).message);
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.client.query('SELECT 1 AS connected');
      return result.rows[0].connected === 1;
    } catch {
      return false;
    }
  }

  async getTableList(): Promise<TableInfo[]> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        tableowner,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY schemaname, tablename
    `;
    
    const result = await this.client.query(query);
    return result.rows as TableInfo[];
  }

  async getTableRowCount(fullTableName: string): Promise<number | null> {
    const safeName = this.quoteIdentifiers(fullTableName);
    const query = `SELECT COUNT(*) as count FROM ${safeName}`;
    
    try {
      const result = await this.client.query(query);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.warn(`⚠️  无法从表 ${fullTableName} 获取行数`, (error as Error).message);
      return null;
    }
  }

  async getTableStructure(fullTableName: string) {
    const parts = fullTableName.split('.');
    const schema = parts.length > 1 ? parts[0] : 'public';
    const tableName = parts.length > 1 ? parts[1] : fullTableName;
    
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        character_maximum_length,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;
    
    const result = await this.client.query(query, [schema, tableName]);
    return result.rows;
  }

  async getTableSampleData(fullTableName: string, limit: number = 3): Promise<TableSample> {
    const safeName = this.quoteIdentifiers(fullTableName);
    
    // 获取结构信息
    const structure = await this.getTableStructure(fullTableName);
    const columns = structure.map(col => col.column_name);
    
    // 获取样本数据
    const dataQuery = `SELECT * FROM ${safeName} LIMIT $1`;
    const result = await this.client.query(dataQuery, [limit]);
    
    return {
      columns,
      sampleData: result.rows,
      dataTypes: structure.reduce((acc, col) => {
        acc[col.column_name] = col.data_type;
        return acc;
      }, {} as Record<string, string>)
    };
  }

  async getDatabaseInfo() {
    const query = `
      SELECT 
        current_database() as database,
        version() as version,
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        pg_postmaster_start_time() as start_time,
        NOW() as current_time
    `;
    
    const result = await this.client.query(query);
    return result.rows[0];
  }

  private quoteIdentifiers(identifier: string): string {
    // 安全转义标识符，防止 SQL 注入
    return identifier.split('.').map(part => `"${part.replace(/"/g, '""')}"`).join('.');
  }

  async analyzeDatabase(): Promise<void> {
    console.log('🔍 开始 PostgreSQL 数据库数据检查\n');
    console.log('🛡️  注意：此脚本为只读模式，不会修改任何数据\n');

    try {
      // 1. 基础信息
      const dbInfo = await this.getDatabaseInfo();
      console.log('📊 数据库基础信息:');
      console.log(`   数据库: ${dbInfo.database}`);
      console.log(`   版本: ${dbInfo.version.split(' ')[1]}`);
      console.log(`   总大小: ${dbInfo.total_size}`);
      console.log(`   启动时间: ${dbInfo.start_time}`);
      console.log(`   当前时间: ${dbInfo.current_time}\n`);

      // 2. 获取所有表
      const tables = await this.getTableList();
      
      if (tables.length === 0) {
        console.log('📭 未找到用户表');
        return;
      }

      console.log(`📋 发现 ${tables.length} 个用户表:`);
      
      // 3. 检查每个表的数据量
      let totalRecords = 0;
      const tableStats = [];
      
      for (const table of tables) {
        const count = await this.getTableRowCount(`${table.schemaname}.${table.tablename}`);
        if (count !== null) {
          tableStats.push({
            ...table,
            count,
            hasData: count > 0
          });
          
          const status = count > 0 ? '✅' : '⚪';
          console.log(`   ${status} ${table.schemaname}.${table.tablename}: ${count.toLocaleString()} 行 (${table.size})`);
          totalRecords += count;
        }
      }

      console.log(`\n�� 整体统计:`);
      console.log(`   总表数: ${tables.length}`);
      console.log(`   有数据的表: ${tableStats.filter(t => t.hasData).length}`);
      console.log(`   总记录数: ${totalRecords.toLocaleString()}`);

      // 4. 显示数据密度分布
      const withData = tableStats.filter(t => t.hasData).sort((a, b) => b.count - a.count);
      const empty = tableStats.filter(t => !t.hasData);

      if (withData.length > 0) {
        console.log(`\n🎯 数据分布:`);
        console.log(`   💾 有数据: ${withData.length} 个表`);
        console.log(`   📭 空表: ${empty.length} 个表`);

        // 显示前5个数据最多的表
        console.log(`\n🏆 数据最多的表 (前5):`);
        withData.slice(0, 5).forEach((table, index) => {
          console.log(`   ${index + 1}. ${table.schemaname}.${table.tablename}: ${table.count.toLocaleString()} 行`);
        });
      }

      // 5. 详细检查前3个有数据的表
      if (withData.length > 0) {
        console.log(`\n📖 详细检查:`);
        for (const table of withData.slice(0, 3)) {
          const fullName = `${table.schemaname}.${table.tablename}`;
          console.log(`\n--- ${fullName} ---`);
          console.log(`   🔢 行数: ${table.count.toLocaleString()}`);
          console.log(`   📱 大小: ${table.size}`);

          try {
            const structure = await this.getTableStructure(fullName);
            const columns = structure.length;
            console.log(`   📋 列数: ${columns}`);

            if (columns > 0) {
              console.log(`   🏷️  主要列: ${structure.slice(0, 5).map(c => c.column_name).join(', ')}${columns > 5 ? '...' : ''}`);
            }

            // 获取前几条记录样本
            if (table.count > 0) {
              const sample = await this.getTableSampleData(fullName, 2);
              console.log(`   📄 前 ${sample.sampleData.length} 条记录:`);
              
              sample.sampleData.forEach((row, index) => {
                const preview = Object.values(row)
                  .slice(0, 5)
                  .map(val => val?.toString().substring(0, 50) || 'NULL')
                  .join(' | ');
                
                console.log(`      记录${index + 1}: ${preview}...`);
              });
            }
          } catch (error) {
            console.error(`   ❌ 检查表 ${fullName} 时出错:`, (error as Error).message);
          }
        }
      }

    } catch (error) {
      console.error('❌ 数据库分析失败:', (error as Error).message);
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      console.log('\n🔌 数据库连接已安全关闭');
    }
  }
}

// CLI 执行
async function runDatabaseCheck(): Promise<void> {
  const checker = new SafeDatabaseChecker(dbConfig);
  
  try {
    const isConnected = await checker.checkConnection();
    if (!isConnected) {
      console.log('🔄 正在尝试连接数据库...');
    }
    
    await checker.connect();
    await checker.analyzeDatabase();
    
  } catch (error) {
    console.error('❌ 程序执行错误:', (error as Error).message);
    console.log('\nℹ️  请检查以下事项:');
    console.log('   1. PostgreSQL 服务是否正在运行？');
    console.log('   2. 数据库配置是否正确？');
    console.log('   3. 数据库用户是否有访问权限？');
    console.log('   4. 网络连接是否正常？');
  } finally {
    await checker.close();
  }
}

// 模块导出
export { SafeDatabaseChecker };

// 允许直接运行
if (require.main === module) {
  runDatabaseCheck().catch(console.error);
}

// 添加清理处理
process.on('beforeExit', async () => {
  console.log('🧹 清理资源...');
});

process.on('SIGINT', () => {
  console.log('\n✅ 用户中断，程序安全退出');
  process.exit(0);
});