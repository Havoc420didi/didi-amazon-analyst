#!/usr/bin/env node

// 直接使用 postgres 包查询 Product_Analytics2 数据
const postgres = require('postgres');

// 设置数据库连接
const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

async function queryProductAnalytics2() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 10,
    });

    try {
        
        console.log('🔄 开始查询 Product_Analytics2 数据...\n');

        // 1. 检查表是否存在
        console.log('📋 1. 检查表存在性');
        const tableCheck = await sql.unsafe(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'product_analytics2'
            );
        `);
        
        const tableExists = tableCheck[0]?.exists;
        console.log(`   Product_Analytics2表存在: ${tableExists ? '✅ 是' : '❌ 否'}`);
        
        if (!tableExists) {
            console.log('\n❌ 表不存在，无法查询数据');
            return;
        }

        // 2. 数据概览统计
        console.log('\n📊 2. 数据概览统计');
        const statsQuery = `
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT brand_name) as unique_brands,
                COUNT(DISTINCT data_date) as unique_dates,
                MIN(data_date) as earliest_date,
                MAX(data_date) as latest_date,
                SUM(COALESCE(sales_amount, 0)) as total_sales,
                SUM(COALESCE(ad_cost, 0)) as total_ad_cost,
                AVG(COALESCE(sales_amount, 0)) as avg_sales
            FROM product_analytics2;
        `;
        
        const statsResult = await pgClient.query(statsQuery);
        if (statsResult.success && statsResult.data?.length > 0) {
            const stats = statsResult.data[0];
            console.log(`   总记录数: ${stats.total_records}`);
            console.log(`   独特ASIN数: ${stats.unique_asins}`);
            console.log(`   独特品牌数: ${stats.unique_brands}`);
            console.log(`   数据天数: ${stats.unique_dates}`);
            console.log(`   日期范围: ${stats.earliest_date} 到 ${stats.latest_date}`);
            console.log(`   总销售额: $${parseFloat(stats.total_sales || 0).toFixed(2)}`);
            console.log(`   总广告费用: $${parseFloat(stats.total_ad_cost || 0).toFixed(2)}`);
            console.log(`   平均销售额: $${parseFloat(stats.avg_sales || 0).toFixed(2)}`);
        }

        // 3. 30天内数据统计
        console.log('\n📅 3. 最近30天数据统计');
        const recent30Query = `
            SELECT 
                COUNT(*) as recent_records,
                COUNT(DISTINCT asin) as recent_asins,
                SUM(COALESCE(sales_amount, 0)) as recent_sales,
                SUM(COALESCE(ad_cost, 0)) as recent_ad_cost,
                AVG(COALESCE(sales_amount, 0)) as recent_avg_sales
            FROM product_analytics2
            WHERE data_date >= CURRENT_DATE - INTERVAL '30 days';
        `;
        
        const recent30Result = await pgClient.query(recent30Query);
        if (recent30Result.success && recent30Result.data?.length > 0) {
            const recent = recent30Result.data[0];
            console.log(`   30天内记录数: ${recent.recent_records}`);
            console.log(`   30天内ASIN数: ${recent.recent_asins}`);
            console.log(`   30天内销售额: $${parseFloat(recent.recent_sales || 0).toFixed(2)}`);
            console.log(`   30天内广告费用: $${parseFloat(recent.recent_ad_cost || 0).toFixed(2)}`);
            console.log(`   30天内平均销售额: $${parseFloat(recent.recent_avg_sales || 0).toFixed(2)}`);
        }

        // 4. 最新数据样本（前10条）
        console.log('\n📋 4. 最新数据样本 (前10条)');
        const sampleQuery = `
            SELECT 
                asin, 
                data_date, 
                COALESCE(brand_name, 'N/A') as brand,
                COALESCE(sales_amount, 0) as sales,
                COALESCE(sales_quantity, 0) as quantity,
                COALESCE(ad_cost, 0) as ad_cost,
                COALESCE(ad_sales, 0) as ad_sales,
                COALESCE(fba_inventory, 0) as inventory,
                COALESCE(title, 'N/A') as title
            FROM product_analytics2 
            ORDER BY data_date DESC, id DESC 
            LIMIT 10;
        `;
        
        const sampleResult = await pgClient.query(sampleQuery);
        if (sampleResult.success && sampleResult.data?.length > 0) {
            sampleResult.data.forEach((row, index) => {
                console.log(`\n   ${index + 1}. ASIN: ${row.asin}`);
                console.log(`      日期: ${row.data_date}`);
                console.log(`      品牌: ${row.brand}`);
                console.log(`      标题: ${row.title.length > 50 ? row.title.substring(0, 50) + '...' : row.title}`);
                console.log(`      销售额: $${parseFloat(row.sales).toFixed(2)}`);
                console.log(`      销售数量: ${row.quantity}`);
                console.log(`      广告费用: $${parseFloat(row.ad_cost).toFixed(2)}`);
                console.log(`      广告销售: $${parseFloat(row.ad_sales).toFixed(2)}`);
                console.log(`      FBA库存: ${row.inventory}`);
            });
        } else {
            console.log('   没有找到数据样本');
        }

        // 5. 使用预定义视图查询
        console.log('\n🔍 5. 使用 product_analytics_30day_view 视图查询');
        const viewQuery = `
            SELECT COUNT(*) as view_records
            FROM product_analytics_30day_view;
        `;
        
        const viewResult = await pgClient.query(viewQuery);
        if (viewResult.success && viewResult.data?.length > 0) {
            console.log(`   30天视图记录数: ${viewResult.data[0].view_records}`);
        }

        // 6. 热门品牌排行
        console.log('\n🏆 6. 热门品牌排行 (按销售额，前5名)');
        const topBrandsQuery = `
            SELECT 
                COALESCE(brand_name, 'Unknown') as brand,
                COUNT(*) as product_count,
                SUM(COALESCE(sales_amount, 0)) as total_sales,
                AVG(COALESCE(sales_amount, 0)) as avg_sales
            FROM product_analytics2
            WHERE data_date >= CURRENT_DATE - INTERVAL '30 days'
              AND brand_name IS NOT NULL 
              AND brand_name != ''
            GROUP BY brand_name
            ORDER BY total_sales DESC
            LIMIT 5;
        `;
        
        const topBrandsResult = await pgClient.query(topBrandsQuery);
        if (topBrandsResult.success && topBrandsResult.data?.length > 0) {
            topBrandsResult.data.forEach((brand, index) => {
                console.log(`   ${index + 1}. ${brand.brand}`);
                console.log(`      产品数量: ${brand.product_count}`);
                console.log(`      总销售额: $${parseFloat(brand.total_sales).toFixed(2)}`);
                console.log(`      平均销售额: $${parseFloat(brand.avg_sales).toFixed(2)}\n`);
            });
        }

        console.log('✅ Product_Analytics2 数据查询完成！');

    } catch (error) {
        console.error('❌ 查询过程中发生错误:', error.message);
        if (error.message.includes('Cannot resolve')) {
            console.log('\n💡 提示: 可能需要先编译TypeScript文件或使用其他方法');
        }
    }
}

queryProductAnalytics2().catch(console.error);