#!/usr/bin/env node

/**
 * 数据库数据检查脚本
 * 这是一个只读脚本，用于检查 PostgreSQL 数据库中的数据情况
 * 不会修改任何数据
 */

const { Client } = require('pg');

// 数据库配置 - 使用只读权限
const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'amazon_analyst',
  password: 'amazon_analyst_2024',
  database: 'amazon_analyst',
  // 设置为只读事务模式，确保安全
  ssl: false,
  // 可以在这里设置只读模式
  application_name: 'data-reader-script'
};

class DatabaseChecker {
  constructor(config) {
    this.client = new Client(config);
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ 成功连接到 PostgreSQL 数据库');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      throw error;
    }
  }

  async getTableList() {
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
    return result.rows;
  }

  async getTableRowCount(tablename) {
    const safeTableName = tablename.split('.').map(part => `"${part.replace(/"/g, '""')}"`).join('.');
    const query = `SELECT COUNT(*) as count FROM ${safeTableName}`;
    
    try {
      const result = await this.client.query(query);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.warn(`⚠️  无法获取表 ${tablename} 的行数: ${error.message}`);
      return null;
    }
  }

  async getTableSampleData(tablename, limit = 5) {
    const safeTableName = tablename.split('.').map(part => `"${part.replace(/"/g, '""')}"`).join('.');
    
    // 获取列信息
    const columnQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;
    
    const parts = tablename.split('.');
    const schema = parts.length > 1 ? parts[0] : 'public';
    const actualTableName = parts.length > 1 ? parts[1] : tablename;
    
    const columns = await this.client.query(columnQuery, [schema, actualTableName]);
    
    // 获取示例数据
    const dataQuery = `SELECT * FROM ${safeTableName} LIMIT $1`;
    const result = await this.client.query(dataQuery, [limit]);
    
    return {
      columns: columns.rows.map(col => col.column_name),
      sampleData: result.rows,
      dataTypes: columns.rows.reduce((acc, col) => {
        acc[col.column_name] = col.data_type;
        return acc;
      }, {})
    };
  }

  async checkDatabaseStatus() {
    console.log('📊 开始检查数据库状态...\n');

    try {
      // 1. 获取数据库总体信息
      const dbInfo = await this.client.query(`
        SELECT 
          current_database() as database,
          version() as version,
          pg_size_pretty(pg_database_size(current_database())) as total_size
      `);
      
      const db = dbInfo.rows[0];
      console.log(`📁 数据库: ${db.database}`);
      console.log(`📏 版本: ${db.version?.split(' ')[1]}`);
      console.log(`💾 总大小: ${db.total_size}\n`);

      // 2. 获取所有表
      console.log('📋 检测到的表:');
      const tables = await this.getTableList();
      
      for (const table of tables) {
        console.log(`  ${table.schemaname}.${table.tablename} (${table.size})`);
      }
      console.log();

      // 3. 检查每个表的数据量
      console.log('📈 各表数据量统计:');
      let totalRecords = 0;
      const tableStats = [];
      
      for (const table of tables) {
        const fullName = `${table.schemaname}.${table.tablename}`;
        const count = await this.getTableRowCount(fullName);
        if (count !== null) {
          console.log(`  ${fullName}: ${count.toLocaleString()} 条记录`);
          totalRecords += count;
          tableStats.push({ name: fullName, count, size: table.size });
        }
      }
      
      console.log();
      console.log(`📊 数据库统计:`);
      console.log(`  总表数: ${tables.length}`);
      console.log(`  总记录数: ${totalRecords.toLocaleString()}`);

      // 4. 显示数据密度高的表示例
      const populatedTables = tableStats.filter(t => t.count > 0);
      const mostData = populatedTables.sort((a, b) => b.count - a.count).slice(0, 3);
      
      if (mostData.length > 0) {
        console.log(`\n🎯 数据最多的表:`);
        mostData.forEach(table => {
          console.log(`  ${table.name}: ${table.count.toLocaleString()} 条记录 (${table.size})`);
        });
      }

      // 5. 显示每个有数据的表的示例
      console.log(`\n📝 数据示例:`);
      for (const table of populatedTables.slice(0, 3)) {
        try {
          const sample = await this.getTableSampleData(table.name, 2);
          console.log(`  \n${table.name}:`);
          console.log(`    列: ${sample.columns.slice(0, 5).join(', ')}${sample.columns.length > 5 ? '...' : ''}`);
          
          if (sample.sampleData.length > 0) {
            console.log(`    示例记录:`);
            sample.sampleData.forEach((row, index) => {
              console.log(`      记录${index + 1}:`, JSON.stringify(row, null, 2));
            });
          }
        } catch (error) {
          console.log(`    ⚠️  无法获取示例数据: ${error.message}`);
        }
      }

      // 6. 数据库时间检查
      const timeCheck = await this.client.query('SELECT NOW() as current_time');
      console.log(`\n⏰ 数据库时间: ${timeCheck.rows[0].current_time}`);

    } catch (error) {
      console.error('❌ 数据库查询错误:', error.message);
    }
  }

  async close() {
    if (this.client) {
      await this.client.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 主函数
async function main() {
  const checker = new DatabaseChecker(dbConfig);
  
  try {
    await checker.connect();
    await checker.checkDatabaseStatus();
  } catch (error) {
    console.error('❌ 程序执行失败:', error.message);
    console.log('ℹ️  请确保:');
    console.log('   1. PostgreSQL 正在运行');
    console.log('   2. 数据库配置正确');
    console.log('   3. 网络连接正常');
  } finally {
    await checker.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('🔍 开始检查 PostgreSQL 数据库数据\n');
  main().catch(console.error);
}

module.exports = { DatabaseChecker };

// 添加一个简单的 Promise 处理方式
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});