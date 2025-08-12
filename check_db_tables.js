#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkDatabaseTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRESQL_URL,
  });

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    // 1. 检查所有表格
    console.log('\n📋 现有数据库表格列表:');
    const tablesQuery = `
      SELECT 
        table_name,
        table_type,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    console.table(tablesResult.rows);

    // 2. 检查product_analytics2表是否存在
    console.log('\n🔍 检查product_analytics2表:');
    const checkProductAnalytics2Query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'product_analytics2'
      ORDER BY ordinal_position;
    `;
    
    const productAnalytics2Result = await client.query(checkProductAnalytics2Query);
    
    if (productAnalytics2Result.rows.length > 0) {
      console.log('✅ product_analytics2表存在，包含以下字段:');
      console.table(productAnalytics2Result.rows);
    } else {
      console.log('❌ product_analytics2表不存在');
    }

    // 3. 检查inventory_deals表是否存在
    console.log('\n🔍 检查inventory_deals表:');
    const checkInventoryDealsQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'inventory_deals'
      ORDER BY ordinal_position;
    `;
    
    const inventoryDealsResult = await client.query(checkInventoryDealsQuery);
    
    if (inventoryDealsResult.rows.length > 0) {
      console.log('✅ inventory_deals表存在，包含以下字段:');
      console.table(inventoryDealsResult.rows);
    } else {
      console.log('❌ inventory_deals表不存在');
    }

    // 4. 检查表的数据量
    console.log('\n📊 各表数据量统计:');
    const countQuery = `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC;
    `;
    
    const countResult = await client.query(countQuery);
    console.table(countResult.rows);

    // 5. 检查索引
    console.log('\n🔗 主要表的索引信息:');
    const indexQuery = `
      SELECT 
        t.table_name,
        i.indexname,
        i.indexdef
      FROM pg_indexes i
      JOIN information_schema.tables t ON i.tablename = t.table_name
      WHERE t.table_schema = 'public'
        AND t.table_name IN ('product_analytics2', 'inventory_deals', 'inventory_records')
      ORDER BY t.table_name, i.indexname;
    `;
    
    const indexResult = await client.query(indexQuery);
    if (indexResult.rows.length > 0) {
      console.table(indexResult.rows);
    } else {
      console.log('没有找到相关表的索引信息');
    }

  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    await client.end();
  }
}

// 执行检查
checkDatabaseTables();