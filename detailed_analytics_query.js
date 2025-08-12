#!/usr/bin/env node

const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

async function detailedAnalytics() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 10,
    });

    try {
        console.log('🔄 详细分析 product_analytics 表数据...\n');
        
        // 1. 销售表现分析
        console.log('💰 销售表现统计:');
        const salesStats = await sql.unsafe(`
            SELECT 
                SUM(sales_amount) as total_sales,
                SUM(sales_quantity) as total_quantity,
                AVG(sales_amount) as avg_sales,
                COUNT(CASE WHEN sales_amount > 0 THEN 1 END) as products_with_sales,
                COUNT(*) as total_products
            FROM product_analytics
            WHERE data_date >= CURRENT_DATE - INTERVAL '30 days';
        `);
        
        const sales = salesStats[0];
        console.log(`   总销售额: $${parseFloat(sales.total_sales || 0).toFixed(2)}`);
        console.log(`   总销售数量: ${sales.total_quantity || 0}`);
        console.log(`   平均销售额: $${parseFloat(sales.avg_sales || 0).toFixed(2)}`);
        console.log(`   有销售的产品数: ${sales.products_with_sales}/${sales.total_products}`);
        console.log(`   销售产品占比: ${((sales.products_with_sales / sales.total_products) * 100).toFixed(1)}%`);

        // 2. 广告表现分析
        console.log('\n📢 广告表现统计:');
        const adStats = await sql.unsafe(`
            SELECT 
                SUM(ad_cost) as total_ad_cost,
                SUM(ad_sales) as total_ad_sales,
                SUM(impressions) as total_impressions,
                SUM(clicks) as total_clicks,
                COUNT(CASE WHEN ad_cost > 0 THEN 1 END) as products_with_ads,
                AVG(CASE WHEN ad_cost > 0 THEN ad_cost END) as avg_ad_cost
            FROM product_analytics
            WHERE data_date >= CURRENT_DATE - INTERVAL '30 days';
        `);
        
        const ads = adStats[0];
        const acos = ads.total_ad_sales > 0 ? (ads.total_ad_cost / ads.total_ad_sales * 100) : 0;
        const ctr = ads.total_impressions > 0 ? (ads.total_clicks / ads.total_impressions * 100) : 0;
        
        console.log(`   总广告费用: $${parseFloat(ads.total_ad_cost || 0).toFixed(2)}`);
        console.log(`   总广告销售: $${parseFloat(ads.total_ad_sales || 0).toFixed(2)}`);
        console.log(`   ACOS: ${acos.toFixed(2)}%`);
        console.log(`   总曝光量: ${ads.total_impressions || 0}`);
        console.log(`   总点击量: ${ads.total_clicks || 0}`);
        console.log(`   CTR: ${ctr.toFixed(3)}%`);
        console.log(`   投放广告的产品数: ${ads.products_with_ads}`);

        // 3. 品牌表现排行
        console.log('\n🏆 品牌销售排行榜 (前10名):');
        const brandRanking = await sql.unsafe(`
            SELECT 
                COALESCE(brand_name, 'Unknown') as brand,
                COUNT(DISTINCT asin) as product_count,
                SUM(sales_amount) as total_sales,
                SUM(ad_cost) as total_ad_cost,
                AVG(sales_amount) as avg_sales_per_product
            FROM product_analytics
            WHERE data_date >= CURRENT_DATE - INTERVAL '30 days'
              AND brand_name IS NOT NULL 
              AND brand_name != ''
            GROUP BY brand_name
            HAVING SUM(sales_amount) > 0
            ORDER BY total_sales DESC
            LIMIT 10;
        `);
        
        brandRanking.forEach((brand, i) => {
            console.log(`   ${i+1}. ${brand.brand}`);
            console.log(`      产品数: ${brand.product_count}`);
            console.log(`      销售额: $${parseFloat(brand.total_sales).toFixed(2)}`);
            console.log(`      广告费: $${parseFloat(brand.total_ad_cost || 0).toFixed(2)}`);
            console.log(`      平均销售: $${parseFloat(brand.avg_sales_per_product).toFixed(2)}`);
            console.log('');
        });

        // 4. 表现最佳的产品
        console.log('🌟 销售表现最佳产品 (前5名):');
        const topProducts = await sql.unsafe(`
            SELECT 
                asin,
                COALESCE(brand_name, 'Unknown') as brand,
                SUM(sales_amount) as total_sales,
                SUM(sales_quantity) as total_quantity,
                SUM(ad_cost) as total_ad_cost,
                COUNT(*) as days_count
            FROM product_analytics
            WHERE data_date >= CURRENT_DATE - INTERVAL '30 days'
              AND sales_amount > 0
            GROUP BY asin, brand_name
            ORDER BY total_sales DESC
            LIMIT 5;
        `);
        
        topProducts.forEach((product, i) => {
            console.log(`   ${i+1}. ASIN: ${product.asin}`);
            console.log(`      品牌: ${product.brand}`);
            console.log(`      总销售额: $${parseFloat(product.total_sales).toFixed(2)}`);
            console.log(`      总销售量: ${product.total_quantity}`);
            console.log(`      广告费用: $${parseFloat(product.total_ad_cost || 0).toFixed(2)}`);
            console.log(`      数据天数: ${product.days_count}`);
            console.log('');
        });

        // 5. 日期分布分析
        console.log('📅 数据日期分布:');
        const dateDistribution = await sql.unsafe(`
            SELECT 
                data_date::date as date,
                COUNT(*) as product_count,
                COUNT(CASE WHEN sales_amount > 0 THEN 1 END) as sales_count,
                SUM(sales_amount) as daily_sales
            FROM product_analytics
            WHERE data_date >= CURRENT_DATE - INTERVAL '10 days'
            GROUP BY data_date::date
            ORDER BY data_date DESC
            LIMIT 10;
        `);
        
        dateDistribution.forEach(day => {
            console.log(`   ${day.date}: ${day.product_count}个产品, ${day.sales_count}个有销售, 总销售$${parseFloat(day.daily_sales || 0).toFixed(2)}`);
        });

        console.log('\n✅ 详细分析完成!');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await sql.end();
    }
}

detailedAnalytics().catch(console.error);