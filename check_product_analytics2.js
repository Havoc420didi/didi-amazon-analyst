#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkProductAnalytics2Table() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRESQL_URL,
  });

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    // 1. 检查product_analytics2表是否存在
    console.log('\n🔍 检查product_analytics2表状态:');
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'product_analytics2'
      ) as table_exists;
    `;
    
    const tableExistsResult = await client.query(checkTableQuery);
    const tableExists = tableExistsResult.rows[0].table_exists;
    
    if (tableExists) {
      console.log('✅ product_analytics2表已存在');
      
      // 检查表结构
      const structureQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'product_analytics2'
        ORDER BY ordinal_position;
      `;
      
      const structureResult = await client.query(structureQuery);
      console.log('📋 表结构:');
      console.table(structureResult.rows);
      
      // 检查数据量
      const countQuery = `SELECT COUNT(*) as record_count FROM product_analytics2;`;
      const countResult = await client.query(countQuery);
      console.log(`📊 记录数: ${countResult.rows[0].record_count}`);
      
    } else {
      console.log('❌ product_analytics2表不存在');
      
      // 2. 尝试创建表
      console.log('\n🔨 尝试创建product_analytics2表...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS product_analytics2 (
            id SERIAL PRIMARY KEY,
            
            -- 产品基础信息
            product_id VARCHAR(50) NOT NULL,
            asin VARCHAR(20) NOT NULL,
            sku VARCHAR(100),
            parent_asin VARCHAR(20),
            spu VARCHAR(50),
            msku VARCHAR(100),
            spu_name VARCHAR(500),
            title VARCHAR(1000),
            brand VARCHAR(200),
            brand_name VARCHAR(200),
            category_name VARCHAR(500),
            
            -- 数据日期
            data_date DATE NOT NULL,
            open_date DATE,
            
            -- 销售和财务数据
            sales_amount DECIMAL(12,2) DEFAULT 0.00,
            sales_quantity INTEGER DEFAULT 0,
            avg_profit DECIMAL(10,2) DEFAULT 0.00,
            profit_amount DECIMAL(12,2) DEFAULT 0.00,
            profit_rate DECIMAL(5,4) DEFAULT 0.0000,
            buy_box_price DECIMAL(10,2),
            currency VARCHAR(10) DEFAULT 'USD',
            
            -- 广告数据
            impressions BIGINT DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            ad_cost DECIMAL(12,2) DEFAULT 0.00,
            ad_sales DECIMAL(12,2) DEFAULT 0.00,
            ad_orders INTEGER DEFAULT 0,
            ad_conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
            conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
            acos DECIMAL(5,4) DEFAULT 0.0000,
            cpc DECIMAL(10,4) DEFAULT 0.0000,
            cpa DECIMAL(10,4) DEFAULT 0.0000,
            
            -- 会话和流量
            sessions INTEGER DEFAULT 0,
            page_views INTEGER DEFAULT 0,
            
            -- 订单和退货数据
            order_count INTEGER DEFAULT 0,
            refund_count INTEGER DEFAULT 0,
            refund_rate DECIMAL(5,4) DEFAULT 0.0000,
            return_count INTEGER DEFAULT 0,
            return_rate DECIMAL(5,4) DEFAULT 0.0000,
            
            -- 评价数据
            rating DECIMAL(3,2) DEFAULT 0.00,
            rating_count INTEGER DEFAULT 0,
            
            -- 库存信息管理
            available_days DECIMAL(10,1) DEFAULT 0.0,
            fba_inventory INTEGER DEFAULT 0,
            total_inventory INTEGER DEFAULT 0,
            
            -- 业务标识
            marketplace_id VARCHAR(50),
            shop_id VARCHAR(50),
            dev_id VARCHAR(50),
            operator_id VARCHAR(50),
            dev_name VARCHAR(100),
            operator_name VARCHAR(100),
            
            -- 分类和标签
            tag_id VARCHAR(50),
            brand_id VARCHAR(50),
            category_id VARCHAR(50),
            
            -- 状态和分类
            online_status VARCHAR(20),
            asin_type VARCHAR(20),
            stock_status VARCHAR(50),
            is_low_cost_store BOOLEAN DEFAULT FALSE,
            
            -- JSON字段存储多值数据
            shop_ids TEXT,
            dev_ids TEXT,
            operator_ids TEXT,
            marketplace_ids TEXT,
            label_ids TEXT,
            brand_ids TEXT,
            ad_types TEXT,
            
            -- 额外指标JSON
            metrics_json TEXT,
            
            -- 时间戳
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- 业务标识字段
            data_source VARCHAR(20) DEFAULT 'erp_sync',
            batch_id VARCHAR(50),
            sync_status VARCHAR(20) DEFAULT 'active'
        );
      `;
      
      try {
        await client.query(createTableSQL);
        console.log('✅ product_analytics2表创建成功');
        
        // 创建索引
        const createIndexesSQL = `
          -- 创建唯一约束
          ALTER TABLE product_analytics2 
          ADD CONSTRAINT uk_product_date2 
          UNIQUE (product_id, asin, data_date, marketplace_id);
          
          -- 创建索引
          CREATE INDEX idx_asin_date2 ON product_analytics2 (asin, data_date);
          CREATE INDEX idx_date_range2 ON product_analytics2 (data_date);
          CREATE INDEX idx_brand_date2 ON product_analytics2 (brand_id, data_date);
          CREATE INDEX idx_total_inventory2 ON product_analytics2 (total_inventory, data_date);
          CREATE INDEX idx_ad_metrics2 ON product_analytics2 (ad_cost, ad_sales, ad_orders, data_date);
        `;
        
        await client.query(createIndexesSQL);
        console.log('✅ 索引创建成功');
        
      } catch (createError) {
        console.error('❌ 创建表失败:', createError.message);
        console.error('错误详情:', createError);
      }
    }

    // 3. 检查其他相关表
    console.log('\n📋 检查其他相关表:');
    const relatedTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%product%' OR table_name LIKE '%inventory%' OR table_name LIKE '%analytics%')
      ORDER BY table_name;
    `;
    
    const relatedTablesResult = await client.query(relatedTablesQuery);
    console.log('相关表列表:');
    relatedTablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message);
    console.error('错误详情:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 解决方案:');
      console.log('1. 确保PostgreSQL服务正在运行');
      console.log('2. 检查数据库连接配置');
      console.log('3. 使用以下命令启动PostgreSQL:');
      console.log('   brew services start postgresql');
      console.log('   或者');
      console.log('   sudo systemctl start postgresql');
    }
  } finally {
    await client.end();
  }
}

// 执行检查
checkProductAnalytics2Table();