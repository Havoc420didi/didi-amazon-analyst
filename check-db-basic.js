#!/usr/bin/env node

/**
 * 基础数据库检查
 * 使用Node.js子进程运行psql命令检查PostgreSQL数据
 */

const { execSync } = require('child_process');

function executeQuery(query) {
  try {
    const cmd = `
      PGPASSWORD=amazon_analyst_2024 psql \
      -h localhost \
      -p 5432 \
      -U amazon_analyst \
      -d amazon_analyst \
      -t -c "${query.replace(/"/g, '\\"')}"
    `;
    
    const result = execSync(cmd, { 
      encoding: 'utf8', 
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000
    });
    
    return result.trim();
  } catch (error) {
    return null;
  }
}

async function checkDatabase() {
  console.log('🔍 PostgreSQL 数据库基础检查');
  console.log('================================');
  console.log('');

  try {
    // 1. 检查数据库连接
    console.log('📊 数据库连接测试...');
    const dbTest = executeQuery('SELECT current_database()');
    if (!dbTest || !dbTest.match(/amazon_analyst/)) {
      console.log('❌ 数据库连接失败');
      console.log('');
      console.log('🔧 请确保:');
      console.log('   1. PostgreSQL正在运行');
      console.log('   2. 数据库amazon_analyst存在');
      console.log('   3. 用户amazon_analyst和密码正确');
      return;
    }
    
    console.log('✅ 连接成功');
    console.log('');

    // 2. 获取数据库信息
    const version = executeQuery('SELECT version()').split(/\s+/)[1];
    const size = executeQuery('SELECT pg_size_pretty(pg_database_size(current_database()))');
    
    console.log('📊 数据库信息:');
    console.log(`   数据库: ${executeQuery('SELECT current_database()')}`);
    console.log(`   版本: ${version}`);
    console.log(`   大小: ${size}`);
    console.log(`   时间: ${executeQuery('SELECT NOW()')}`);
    console.log('');

    // 3. 获取表列表
    const tables = executeQuery(`
      SELECT schemaname || '.' || tablename || ' (' || pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) || ')'
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY tablename
    `).split('\n').filter(Boolean);

    if (tables.length === 0) {
      console.log('📭 未找到用户表');
      return;
    }

    console.log(`📋 发现 ${tables.length} 个用户表:`);
    tables.forEach((table, i) => {
      console.log(`  ${i + 1}. ${table.trim()}`);
    });
    console.log('');

    // 4. 获取数据表统计
    const tableList = executeQuery(`
      SELECT schemaname || '.' || tablename as fullname
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
    `).split('\n').filter(Boolean);

    console.log('📊 各表数据统计:');
    let totalRecords = 0;
    const dataTables = [];

    for (const tableName of tableList) {
      const trimmedName = tableName.trim();
      if (!trimmedName) continue;

      try {
        const [schema, table] = trimmedName.split('.');
        
        // 获取行数
        const countQuery = `SELECT COUNT(*)::int FROM "${schema}"."${table}"`;
        const count = executeQuery(countQuery);
        
        if (count && !isNaN(parseInt(count))) {
          const rowCount = parseInt(count);
          const icon = rowCount > 0 ? '✅' : '⚪';
          console.log(`   ${icon} ${trimmedName}: ${rowCount.toLocaleString()} 行`);
          
          totalRecords += rowCount;
          if (rowCount > 0) {
            dataTables.push({ name: trimmedName, count: rowCount });
          }
        }
      } catch (error) {
        console.log(`   ❌ ${tableName.trim()}: 无法访问`);
      }
    }

    console.log('');
    console.log('📈 整体统计:');
    console.log(`   🏗️  总表数: ${tableList.length}`);
    console.log(`   ✅ 有数据表: ${dataTables.length}`);
    console.log(`   📊 总记录: ${totalRecords.toLocaleString()}`);

    // 5. 显示数据最多的表
    if (dataTables.length > 0) {
      console.log('\n🎯 数据最多的表:');
      dataTables
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .forEach((table, i) => {
          console.log(`   ${i + 1}. ${table.name}: ${table.count.toLocaleString()} 行`);
        });

      // 6. 获取第一个表的样本
      const firstTable = dataTables[0];
      const [schema, table] = firstTable.name.split('.');
      
      console.log(`\n📝 ${firstTable.name} 数据样本:`);
      
      // 获取列信息
      const columns = executeQuery(`
        SELECT string_agg(column_name, ', ') 
        FROM information_schema.columns 
        WHERE table_schema = '${schema}' AND table_name = '${table}' 
        ORDER BY ordinal_position LIMIT 5
      `);
      
      if (columns) {
        console.log(`   📋 主要列: ${columns}`);
      }

      // 获取样本数据
      const sample = executeQuery(`
        SELECT * FROM "${schema}"."${table}" LIMIT 2
      `);

      if (sample) {
        const lines = sample.split('\n').filter(l => l.trim());
        lines.forEach((line, idx) => {
          const preview = line.trim().substring(0, 80);
          console.log(`   ${idx+1}. ${preview}${preview.length > 80 ? '...' : ''}`);
        });
      }
    }

    console.log('');
    console.log('✅ 数据库数据检查完成！');
    console.log(`📅 检查时间: ${new Date().toLocaleString()}`);

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.log('');
    console.log('🔧 请检查:');
    console.log('   1. PostgreSQL是否运行');
    console.log('   2. 是否安装postgres: psql --version');
    console.log('   3. 数据库配置是否正确');
    console.log('   4. 用户权限是否足够');
  }
}

// 检查psql命令
function checkPsql() {
  try {
    execSync('psql --version', { stdio: 'pipe' });
    return true;
  } catch {
    console.log('❌ 未发现psql命令');
    console.log('');
    console.log('📦 安装方式:');
    console.log('   macOS: brew install postgresql');
    console.log('   Ubuntu: sudo apt install postgresql-client');
    console.log('   Windows: 安装PostgreSQL');
    return false;
  }
}

// 主入口
if (require.main === module) {
  console.log('开始 PostgreSQL 数据库数据检查...\n');
  
  if (checkPsql()) {
    checkDatabase();
  }
}

module.exports = { checkDatabase };