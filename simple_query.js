#!/usr/bin/env node

const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

async function queryData() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 10,
    });

    try {
        console.log('🔄 连接数据库...');
        
        // 检查 product_analytics 表
        console.log('📋 检查 product_analytics 表 (实际存在的表):');

        // 数据概览
        console.log('\n📊 数据概览:');
        const stats = await sql.unsafe(`
            SELECT 
                COUNT(*) as total,
                MIN(data_date) as min_date,
                MAX(data_date) as max_date,
                COUNT(DISTINCT asin) as unique_asins
            FROM product_analytics;
        `);
        
        const s = stats[0];
        console.log(`   总记录数: ${s.total}`);
        console.log(`   日期范围: ${s.min_date} 到 ${s.max_date}`);
        console.log(`   独特ASIN数: ${s.unique_asins}`);

        // 30天内数据
        console.log('\n📅 30天内数据:');
        const recent = await sql.unsafe(`
            SELECT COUNT(*) as count30
            FROM product_analytics
            WHERE data_date >= CURRENT_DATE - INTERVAL '30 days';
        `);
        console.log(`   30天内记录数: ${recent[0].count30}`);

        // 最新5条记录
        console.log('\n📋 最新5条记录:');
        const samples = await sql.unsafe(`
            SELECT asin, data_date, sales_amount, sales_quantity, ad_cost, brand_name
            FROM product_analytics 
            ORDER BY data_date DESC NULLS LAST, id DESC
            LIMIT 5;
        `);
        
        samples.forEach((row, i) => {
            console.log(`   ${i+1}. ASIN: ${row.asin}, 日期: ${row.data_date}`);
            console.log(`      销售额: $${row.sales_amount || 0}, 数量: ${row.sales_quantity || 0}`);
            console.log(`      广告费: $${row.ad_cost || 0}, 品牌: ${row.brand_name || 'N/A'}`);
            console.log('');
        });

        console.log('✅ 查询完成!');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await sql.end();
    }
}

queryData().catch(console.error);