#!/usr/bin/env node

/**
 * 远程数据库连接验证脚本
 * 测试本地是否可以连接到远程PostgreSQL数据库
 */

const { Pool } = require('pg');
require('dotenv').config();

// 使用环境变量中的远程数据库配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst',
  connectTimeoutMillis: 10000, // 10秒超时
  statement_timeout: 30000,    // 30秒查询超时
});

async function testRemoteConnection() {
  console.log('🌍 测试远程数据库连接...');
  console.log(`主机: 8.219.185.28:5432`);
  console.log(`数据库: amazon_analyst`);
  console.log(`用户: amazon_analyst`);
  
  try {
    console.time('远程连接测试');
    
    const client = await pool.connect();
    console.log('✅ 远程数据库连接成功！');
    
    // 测试基本查询
    const result = await client.query('SELECT now() as current_time, version() as pg_version');
    console.log(`🕐 服务器时间: ${result.rows[0].current_time}`);
    console.log(`📊 PostgreSQL版本: ${result.rows[0].pg_version}`);
    
    // 检查数据库包含的表
    const tablesResult = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 远程数据库中的表:');
    tablesResult.rows.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.table_name}`);
    });
    
    // 检查核心数据量
    const dataCheck = await client.query(`
      SELECT 
        'users' as table_name, count(*) as row_count FROM users
      UNION ALL
      SELECT 
        'inventory_records' as table_name, count(*) as row_count FROM inventory_records
      UNION ALL
      SELECT 
        'ai_analysis_tasks' as table_name, count(*) as row_count FROM ai_analysis_tasks
      ORDER BY row_count DESC
    `);
    
    console.log('\n📊 主要数据表记录数:');
    dataCheck.rows.forEach(row => {
      console.log(`  ${row.table_name}: ${row.row_count} 条记录`);
    });
    
    console.timeEnd('远程连接测试');
    client.release();
    
  } catch (error) {
    console.error('❌ 远程数据库连接失败:');
    console.error('错误信息:', error.message);
    
    // 提供详细的故障排查信息
    console.log('\n🔧 故障排查建议:');
    console.log('1. 检查服务器防火墙是否开放5432端口');
    console.log('2. 确认PostgreSQL配置允许外部连接');
    console.log('3. 验证密码是否正确');
    console.log('4. 检查网络连接：ping 8.219.185.28');
    console.log('5. 使用telnet测试端口：telnet 8.219.185.28 5432');
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行测试
if (require.main === module) {
  testRemoteConnection();
}

module.exports = { testRemoteConnection };