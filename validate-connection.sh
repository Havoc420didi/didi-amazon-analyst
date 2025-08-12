#!/bin/bash

# 数据库连接验证脚本
set -e

echo "🌍 测试远程PostgreSQL数据库连接"
echo "=================================="
echo "主机: 8.219.185.28"
echo "端口: 5432"
echo "数据库: amazon_analyst"
echo "用户: amazon_analyst"
echo ""

# 创建临时的验证文件
cat > validate-db.js << 'EOF'
process.env.DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');

async function testConnection() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectTimeoutMillis: 10000,
    });
    
    console.log("🔍 正在连接远程数据库...");
    
    const client = await pool.connect();
    console.log("✅ 数据库连接成功！");
    
    // 测试查询
    const result = await client.query('SELECT version()');
    console.log("📊 PostgreSQL版本:", result.rows[0].version);
    
    // 检查表
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log("\n📋 数据库中的表:");
    tables.rows.forEach((table, i) => {
      console.log(`  ${i+1}. ${table.table_name}`);
    });
    
    client.release();
    await pool.end();
    
    echo "\n🎉 数据库连接验证完成！"
    exit 0
    
  } catch (error) {
    console.error("❌ 连接失败:", error.message);
    exit 1
  }
}

testConnection();
EOF

# 运行验证
node validate-db.js

# 清理临时文件
rm -f validate-db.js