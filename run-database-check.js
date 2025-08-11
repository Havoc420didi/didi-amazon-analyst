#!/usr/bin/env node

/**
 * 数据库检查启动器
 * 使用 npx 运行数据库检查，不需要额外安装
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function checkPrerequisites() {
  console.log('🔍 检查运行环境...');
  
  const checks = [
    {
      name: 'Node.js',
      check: () => process.version
    },
    {
      name: 'PostgreSQL Driver',
      check: () => {
        try {
          require.resolve('pg');
          return 'Installed';
        } catch {
          throw new Error('PostgreSQL 驱动 (pg) 未安装');
        }
      }
    }
  ];

  checks.forEach(({ name, check }) => {
    try {
      const result = check();
      console.log(`  ✅ ${name}: ${result}`);
    } catch (error) {
      console.log(`  ❌ ${name}: ${error.message}`);
      throw error;
    }
  });

  console.log('✅ 环境检查通过\n');
}

function getDatabaseConfig() {
  // 检查环境配置
  const envFiles = ['.env', '.env.postgresql', '.env.local'];
  const rootPath = path.join(__dirname);
  
  for (const envFile of envFiles) {
    const envPath = path.join(rootPath, envFile);
    if (fs.existsSync(envPath)) {
      console.log(`📁 使用配置文件: ${envFile}`);
      
      // 简单的环境变量解析
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      const config = {};
      lines.forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          config[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      });
      
      const dbConfig = {
        host: config.POSTGRESQL_HOST || 'localhost',
        port: parseInt(config.POSTGRESQL_PORT) || 5432,
        database: config.POSTGRESQL_DATABASE || 'amazon_analyst',
        user: config.POSTGRESQL_USER || 'amazon_analyst',
        password: config.POSTGRESQL_PASSWORD || 'amazon_analyst_2024'
      };
      
      console.log(`   数据库: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
      return dbConfig;
    }
  }
  
  console.log('📁 使用默认配置');
  return {
    host: 'localhost',
    port: 5432,
    database: 'amazon_analyst',
    user: 'amazon_analyst',
    password: 'amazon_analyst_2024'
  };
}

async function runWithTimeout(scriptPath, timeout = 30000) {
  console.log(`🚀 正在执行: ${path.basename(scriptPath)}\n`);
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    try {
      const result = execSync(`node "${scriptPath}"`, {
        timeout,
        stdio: 'inherit',
        cwd: __dirname,
        env: {
          ...process.env,
          NODE_ENV: 'development'
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`\n✅ 执行完成 (${duration}ms)`);
      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.status === 'ETIMEDOUT') {
        console.error(`\n⏰ 执行超时 (${timeout}ms)`);
      } else {
        console.error(`\n❌ 执行失败 (${duration}ms):`, error.message || error);
      }
      reject(error);
    }
  });
}

function showUsage() {
  console.log(`
📖 使用方式:
  快速检查:        npx tsx check-database.ts
  使用 Node:       node check-database-data.js
  使用此启动器:    node run-database-check.js

🔧 可选项:
  
1. 检查是否有PG驱动:
   npm install pg --save-dev
   
2. 使用 tsx 运行 TypeScript:
   npm install -g tsx
   npx tsx check-database.ts

3. 调整数据库配置:
   编辑 .env.postgresql 文件
   
🚫 安全声明:
   这些脚本使用 TRANSACTION READ ONLY 模式
   任何写操作都会被数据库引擎拒绝
   
⚠️  注意事项:
   - 确保 PostgreSQL 服务正在运行
   - 检查网络连接可访问
   - 验证用户名和密码
   - 确认数据库名称正确
`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }
  
  try {
    // 检查环境
    checkPrerequisites();
    
    // 显示数据库配置
    getDatabaseConfig();
    
    // 运行主要的检查脚本
    const jsScript = path.join(__dirname, 'check-database-data.js');
    const tsScript = path.join(__dirname, 'check-database.ts');
    
    let scriptPath;
    if (fs.existsSync(jsScript)) {
      scriptPath = jsScript;
    } else if (fs.existsSync(tsScript)) {
      scriptPath = tsScript;
    }
    
    if (scriptPath) {
      await runWithTimeout(scriptPath);
    } else {
      console.error('❌ 找不到数据库检查脚本');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n🔧 问题解决建议:');
    console.log('');
    console.log('1. 安装依赖:');
    console.log('   npm install pg --save-dev');
    console.log('');
    console.log('2. 检查PostgreSQL:')
    console.log('   psql -h localhost -U amazon_analyst -d amazon_analyst');
    console.log('');
    console.log('3. 验证环境变量:')
    console.log('   检查 .env.postgresql 文件中的配置');
    console.log('');
    console.log('4. 使用简化脚本:');
    console.log('   npx tsx check-database.ts --help');
    
    process.exit(1);
  }
}

// 导出模块功能
module.exports = {
  checkPrerequisites,
  getDatabaseConfig,
  runWithTimeout
};

// 执行
if (require.main === module) {
  main().catch(console.error);
}

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 未处理Promise拒绝:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n👋 用户中断，安全退出');
  process.exit(0);
});