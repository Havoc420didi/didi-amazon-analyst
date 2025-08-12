#!/usr/bin/env node

/**
 * 快速数据库查看工具
 * 直接连接远程PostgreSQL，无需Studio
 */

const { Pool } = require('pg');
const os = require('os');

// 连接到远程数据库（无需任何额外依赖）
const pool = new Pool({
  host: '8.219.185.28',
  port: 5432,
  database: 'amazon_analyst',
  user: 'amazon_analyst',
  password: 'amazon_analyst_2024',
  ssl: false,
  connectTimeoutMillis: 15000
});

console.clear();
console.log("=== 📊 Amazon Analyst 远程数据库查看器 ===");
console.log("Server: 8.219.185.28:5432");

async function quickDbView() {
  try {
    console.time("数据库连接");
    const client = await pool.connect();
    
    console.log("✅ 远程数据库已连接!");
    console.timeEnd("数据库连接");
    
    // 快速查看所有表
    const tablesQuery = `
      SELECT table_name, 
             pg_class.reltuples::bigint as row_estimate
      FROM information_schema.tables 
      LEFT JOIN pg_class ON pg_class.relname = table_name
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tables = await client.query(tablesQuery);
    
    console.log("\n🗄️  数据库表结构:");
    console.log("-".repeat(50));
    
    for (const table of tables.rows) {
      console.log(`📋 ${table.table_name.padEnd(20)}  ${table.row_estimate || '0'} 条`);
      
      // 查看该表的前5条记录
      try {
        const sample = await client.query(`SELECT * FROM "${table.table_name}" LIMIT 5`);
        if (sample.rows.length > 0) {
          const keys = Object.keys(sample.rows[0]);
          console.log(`   📊 字段: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
        }
        
        // 如果是inventory_records，显示更多信息
        if (table.table_name === 'inventory_records') {
          const summary = await client.query(`
            SELECT 
              COUNT(*) as total_records,
              COUNT(DISTINCT asin) as unique_products,
              COUNT(DISTINCT warehouse_location) as unique_locations,
              MAX(date) as latest_date,
              MIN(date) as earliest_date
            FROM inventory_records
          `);
          
          const summaryData = summary.rows[0];
          console.log(`   📈 总记录: ${summaryData.total_records}`);
          console.log(`   🏷️ 产品: ${summaryData.unique_products}个ASIN`);
          console.log(`   📦 仓库: ${summaryData.unique_locations}个`);
          console.log(`   📅 数据范围: ${summaryData.earliest_date} ~ ${summaryData.latest_date}`);
        }
      } catch (e) {
        // 忽略错误
      }
      
      console.log("-".repeat(35));
    }

    // 核心业务数据摘要
    console.log("\n🎯 核心数据摘要:");
    
    try {
      const userCount = await client.query('SELECT COUNT(*) as users FROM users');
      const inventoryCount = await client.query('SELECT COUNT(*) as inventory FROM inventory_records');
      const aiTasks = await client.query('SELECT COUNT(*) as ai_tasks FROM ai_analysis_tasks');
      const latestInventory = await client.query('SELECT MAX(date) as latest FROM inventory_records');
      
      console.log(`👥 用户数量: ${userCount.rows[0].users}`);
      console.log(`📊 库存记录: ${inventoryCount.rows[0].inventory}`);
      console.log(`🤖 AI分析任务: ${aiTasks.rows[0].ai_tasks}`);
      console.log(`📅 最新库存数据: ${latestInventory.rows[0].latest || '暂无数据'}`);
    } catch (e) {
      console.log("⚠️  部分数据查询异常");
    }

    await client.release();
    await pool.end();
    
    console.log("\n🔍 查看完成!");
    console.log("💡 可以直接使用这个脚本进行数据浏览");
    
  } catch (error) {
    console.error("❌ 连接失败:");
    console.error(`错误: ${error.message}`);
    
    console.log("\n🔧 故障排查:");
    console.log("1. 确认网络访问8.219.185.28:5432");
    console.log("2. 检查数据库服务是否运行");
    console.log("3. 确认用户名密码正确");
    console.log("4. 确认 PostgreSQL 允许远程连接");
  }
}

// 直接运行
if (require.main === module) {
  quickDbView().catch(console.error);
}

module.exports = { quickDbView };