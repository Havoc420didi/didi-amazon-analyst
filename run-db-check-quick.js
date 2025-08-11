#!/usr/bin/env node

/**
 * 快速PostgreSQL数据库检查脚本
 * 使用项目现有postgres驱动，无需额外依赖
 */

async function checkDatabase() {
  try {
    // 动态导入（基于项目实际配置）
    const { default: postgres } = await import('postgres');
    
    const sql = postgres(
      process.env.DATABASE_URL || 
      'postgresql://amazon_analyst:amazon_analyst_2024@localhost:5432/amazon_analyst'
    );

    console.log('🔍 PostgreSQL数据库检查 (安全只读)');
    console.log('🛡️ 仅查询，不修改任何数据\n');

    // 1. 版本检查
    const version = await sql`SELECT version()`;
    console.log('📊 数据库信息:');
    console.log(`   版本: ${version[0]?.version?.split(' ')[1] || '未知'}`);
    console.log(`   URL: ${process.env.DATABASE_URL ? '已配置' : '使用默认'}`);
    console.log('');

    // 2. 获取表列表
    const tables = await sql`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY tablename
    `;

    if (!tables || tables.length === 0) {
      console.log('📭 未发现用户表');
      return;
    }

    console.log(`📋 发现 ${tables.length} 个用户表:`);
    
    // 3. 检查每个表的数据
    let totalRecords = 0;
    const tableStats = [];
    
    for (const table of tables) {
      try {
        const fullName = `${table.schemaname}.${table.tablename}`;
        
        // 获取行数
        const count = await sql.unsafe(`
          SELECT COUNT(*)::int as count FROM ${fullName}
        `);
        
        const rowCount = count[0]?.count || 0;
        const hasData = rowCount > 0;
        const status = hasData ? '✅' : '⚪';
        
        console.log(`   ${status} ${table.schemaname}.${table.tablename}: ${rowCount.toLocaleString()} 行 (${table.size})`);
        
        tableStats.push({
          ...table,
          count: rowCount,
          hasData,
          status
        });
        
        totalRecords += rowCount;
      } catch (error) {
        // 跳过无法访问的表
        console.log(`   ❌ ${table.schemaname}.${table.tablename}: 无法访问`);
      }
    }

    console.log('');
    console.log('📊 数据统计:');
    console.log(`   📦 总表数: ${tables.length}`);
    console.log(`   ✅ 有数据: ${tableStats.filter(t => t.hasData).length} 个表`);
    console.log(`   📄 总记录: ${totalRecords.toLocaleString()}`);

    // 4. 显示详细数据表
    const dataTables = tableStats.filter(t => t.hasData).sort((a, b) => b.count - a.count);
    
    if (dataTables.length > 0) {
      console.log('\n💾 数据详情:');
      for (let i = 0; i < Math.min(3, dataTables.length); i++) {
        const table = dataTables[i];
        console.log(`\n${i+1}. ${table.schemaname}.${table.tablename}`);
        console.log(`   📊 ${table.count.toLocaleString()} 行记录 (${table.size})`);
      }
    }

    // 5. 获取第一个表的数据样本
    if (dataTables[0]) {
      const firstTable = dataTables[0];
      const fullName = `"${firstTable.schemaname}"."${firstTable.tablename}"`;
      
      try {
        // 获取列信息
        const columns = await sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = ${firstTable.schemaname} 
            AND table_name = ${firstTable.tablename}
          ORDER BY ordinal_position
        `;

        console.log(`\n🎯 ${fullName} 数据预览:`);
        console.log(`   📋 列: ${columns.slice(0, 5).map(c => c.column_name).join(', ')}`);

        // 获取前几条记录
        const samples = await sql.unsafe(`
          SELECT * FROM ${fullName} LIMIT 3
        `);

        if (samples && samples.length > 0) {
          console.log(`   📄 前${samples.length}条记录:`);
          samples.forEach((row, idx) => {
            const preview = Object.entries(row)
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${String(v).substring(0, 20)}`)
              .join(' | ');
            console.log(`      ${idx+1}: ${preview}...`);
          });
        }
      } catch (error) {
        console.log(`   ⚠️  数据样本获取失败`);
      }
    }

    // 6. 数据库时间
    const dbTime = await sql`SELECT NOW() as now`;
    console.log(`\n⏰ 检查时间: ${dbTime[0]?.now}`);
    
    await sql.end(); // 关闭连接
    
  } catch (error) {
    console.error('❌ 数据库检查失败:', error.message);
    console.log('\n🔧 可能的原因：');
    console.log('  1. PostgreSQL服务未运行');
    console.log('  2. 数据库配置错误');
    console.log('  3. 网络连接问题');
    console.log('  4. 权限不足');
  }
}

// 执行检查
console.log('开始 PostgreSQL 数据库检查...');
checkDatabase().then(() => {
  console.log('\n✅ 检查完成！');
}).catch(console.error);