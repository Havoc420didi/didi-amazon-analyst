#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

// 默认连接到本地PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'amazon_analyst',
  password: 'amazon_analyst_2024',
  database: 'amazon_analyst'
});

async function checkTables() {
  try {
    console.log('🗄️ 检查PostgreSQL数据库表结构...\n');
    
    // 1. 检查所有表
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tables = await pool.query(tableQuery);
    console.log('✅ 找到的表：');
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    if (tables.rows.length === 0) {
      console.log('❌ 没有找到任何表');
      return;
    }

    // 2. 检查每个表的结构
    for (const table of tables.rows) {
      console.log(`\n📊 ${table.table_name} 表结构：`);
      
      const columnQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        ORDER BY ordinal_position;
      `;
      
      const columns = await pool.query(columnQuery, [table.table_name]);
      
      columns.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
      });

      // 3. 检查索引
      const indexQuery = `
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = $1;
      `;
      
      const indexes = await pool.query(indexQuery, [table.table_name]);
      if (indexes.rows.length > 0) {
        console.log(`  🔑 索引：`);
        indexes.rows.forEach(idx => {
          console.log(`    - ${idx.indexname}`);
        });
      }

      // 4. 检查数据量
      const countQuery = `SELECT COUNT(*) as count FROM "${table.table_name}";`;
      const count = await pool.query(countQuery);
      console.log(`  📈 记录数：${count.rows[0].count}`);
    }

    // 5. 检查特殊的需求：product_inventory表
    console.log('\n🔍 查找product_inventory相关表...');
    const productRelatedQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%product%' OR table_name LIKE '%inventory%')
      ORDER BY table_name;
    `;
    
    const productTables = await pool.query(productRelatedQuery);
    console.log('📦 产品/库存相关表：');
    productTables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.log('\n💡 请确保：');
    console.log('  1. PostgreSQL正在运行');
    console.log('  2. 数据库amazon_analyst已创建');
    console.log('  3. 用户amazon_analyst已创建并有权限');
    console.log('\n🎯 使用以下命令初始化数据库：');
    console.log('   pnpm db:push');
    console.log('   pnpm db:migrate');
  } finally {
    await pool.end();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  checkTables().catch(console.error);
}

module.exports = { checkTables };