#!/usr/bin/env node

/**
 * PostgreSQL 数据库检查脚本（安全只读版）
 * 使用项目现有 postgres 驱动，无需额外安装依赖
 * 仅读取数据，不修改任何内容
 */

// 使用项目现有的 postgres 客户端
const { pgClient } = require('./src/lib/database/pg-client');
const path = require('path');

/**
 * 安全的只读数据库检查器
 */
async function checkDatabaseData() {
  console.log('🔍 开始 PostgreSQL 数据库数据检查 (使用项目现有驱动)');
  console.log('🛡️  只读模式 - 不会修改任何数据');
  console.log('');

  try {
    // 1. 检查数据库连接状态
    const status = await pgClient.getDatabaseStatus();
    console.log('📊 数据库连接状态:');
    
    if (!status.connected) {
      console.log('  ❌ 数据库连接失败');
      console.log('  🔧 错误信息:', status.error);
      return;
    }
    
    console.log('  ✅ 连接成功');
    console.log(`  📝 版本: ${status.version.split(' ')[1]}`);
    console.log(`  🔗 总连接: ${status.totalConnections} (活跃: ${status.activeConnections})`);
    console.log('');

    // 2. 获取所有用户表
    const tablesResult = await pgClient.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    const tables = tablesResult.data || [];
    
    if (tables.length === 0) {
      console.log('📭 未找到用户表');
      return;
    }

    console.log(`📋 发现 ${tables.length} 个用户表:`);
    
    // 3. 分析每个表
    let totalRecords = 0;
    const tableStats = [];
    
    for (const table of tables) {
      const fullName = `"${table.schemaname}"."${table.tablename}"`;
      
      try {
        // 获取行数
        const countResult = await pgClient.query(`
          SELECT COUNT(*) as count FROM ${fullName}
        `);
        
        const rowCount = parseInt(countResult.data?.[0]?.count || '0');
        
        // 获取列信息
        const columnsResult = await pgClient.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [table.schemaname, table.tablename]);

        const columns = columnsResult.data || [];
        
        const hasData = rowCount > 0;
        const status = hasData ? '✅' : '⚪';
        
        console.log(`  ${status} ${table.schemaname}.${table.tablename}: ${rowCount.toLocaleString()} 行`);
        
        tableStats.push({
          ...table,
          count: rowCount,
          columns: columns.length,
          hasData,
          columnList: columns.slice(0, 5).map(c => c.column_name)
        });
        
        totalRecords += rowCount;
      } catch (error) {
        console.error(`  ❌ 检查 ${table.schemaname}.${table.tablename} 出错:`, error);
      }
    }

    console.log('');
    console.log('📊 整体统计:');
    console.log(`  🏗️  总表数: ${tables.length}`);
    console.log(`  ✅ 有数据表: ${tableStats.filter(t => t.hasData).length}`);
    console.log(`  ⚪ 空表数: ${tableStats.filter(t => !t.hasData).length}`);
    console.log(`  📊 总记录数: ${totalRecords.toLocaleString()}`);

    // 4. 显示数据详情
    const populatedTables = tableStats.filter(t => t.hasData);
    
    if (populatedTables.length > 0) {
      console.log('');
      console.log('🏆 有数据表详情:');
      
      populatedTables.forEach((table, index) => {
        console.log(`\n--- ${index + 1}. ${table.schemaname}.${table.tablename} ---`);
        console.log(`   📊 行数: ${table.count.toLocaleString()}`);
        console.log(`   📏 大小: ${table.size}`);
        console.log(`   📋 列数: ${table.columns}`);
        if (table.columnList.length > 0) {
          console.log(`   🏷️  列: ${table.columnList.join(', ')}`);
        }

        // 如果是数据表，获取第一行样本
        if (table.count > 0) {
          getTableSample(table.schemaname, table.tablename);
        }
      });
    }

    console.log('');
    console.log('📅 检查完成时间:', new Date().toLocaleString());

  } catch (error) {
    console.error('❌ 数据库检查失败:', error);
    console.log('');
    console.log('🔧 可能的原因:');
    console.log('  1. PostgreSQL 服务未运行');
    console.log('  2. 数据库配置不正确');
    console.log('  3. 数据库不存在或为空');
    console.log('  4. 权限问题');
  }
}

/**
 * 获取表的样本数据
 */
async function getTableSample(schema, table) {
  try {
    const fullName = `"${schema}"."${table}"`;
    
    // 获取第一行样本
    const sampleResult = await pgClient.query(`
      SELECT * FROM ${fullName} LIMIT 1
    `);
    
    if (sampleResult.data && sampleResult.data.length > 0) {
      const row = sampleResult.data[0];
      const sample = Object.entries(row)
        .slice(0, 5)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');
      
      console.log(`   📄 样本数据: ${sample}...`);
    }
  } catch (error) {
    // 跳过样本获取，不影响主要检查
    console.log(`   ⚠️  无法获取样本数据`);
  }
}

/**
 * 单独检查库存数据
 */
async function checkInventoryData() {
  console.log('');
  console.log('🔍 专门检查库存数据...');
  
  // 检查可能的库存相关表
  const inventoryTables = [
    'inventory', 
    'products', 
    'items', 
    'stock', 
    'product_inventory'
  ];

  for (const tableName of inventoryTables) {
    try {
      // 检查是否存在任何schema下的这个表
      const exists = await pgClient.query(`
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename ILIKE '%${tableName}%'
      `);
      
      if (exists.data && exists.data.length > 0) {
        for (const tableInfo of exists.data) {
          const count = await pgClient.query(`
            SELECT COUNT(*) as count FROM "${tableInfo.schemaname}"."${tableInfo.tablename}"
          `);
          
          const rowCount = parseInt(count.data?.[0]?.count || '0');
          
          if (rowCount > 0) {
            console.log(`  📦 ${tableInfo.schemaname}.${tableInfo.tablename}: ${rowCount} 条库存记录`);
          }
        }
      }
    } catch (error) {
      // 忽略不存在的表错误
    }
  }
}

// 主执行逻辑
if (require.main === module) {
  console.log('开始 PostgreSQL 数据库数据检查...');
  console.log('================================');
  console.log();

  checkDatabaseData()
    .then(() => {
      console.log('');
      console.log('✅ 数据库检查完成！');
    })
    .catch((error) => {
      console.error('❌ 检查失败:', error);
      process.exit(1);
    });
}

// 导出功能供其他脚本使用
module.exports = {
  checkDatabaseData,
  getTableSample
};