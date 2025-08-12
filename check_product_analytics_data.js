#!/usr/bin/env node

// 检查 product_analytics 表中的数据情况
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

async function checkProductAnalyticsData() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 10,
    });

    try {
        console.log('🔍 检查 product_analytics 表数据情况\n');

        // 1. 基础统计
        console.log('📊 1. 基础统计信息:');
        const basicStats = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT marketplace_id) as unique_marketplaces,
                COUNT(DISTINCT data_date) as unique_dates,
                MIN(data_date) as earliest_date,
                MAX(data_date) as latest_date
            FROM product_analytics;
        `);
        
        const stats = basicStats[0];
        console.log(`   总记录数: ${stats.total_records}`);
        console.log(`   独特ASIN数: ${stats.unique_asins}`);
        console.log(`   独特市场数: ${stats.unique_marketplaces}`);
        console.log(`   独特日期数: ${stats.unique_dates}`);
        console.log(`   日期范围: ${stats.earliest_date} 到 ${stats.latest_date}`);

        // 2. 字段非零值统计
        console.log('\n📈 2. 字段非零值统计:');
        const fieldStats = await sql.unsafe(`
            SELECT 
                COUNT(CASE WHEN sales_amount > 0 THEN 1 END) as sales_amount_non_zero,
                COUNT(CASE WHEN sales_quantity > 0 THEN 1 END) as sales_quantity_non_zero,
                COUNT(CASE WHEN fba_inventory > 0 THEN 1 END) as fba_inventory_non_zero,
                COUNT(CASE WHEN total_inventory > 0 THEN 1 END) as total_inventory_non_zero,
                COUNT(CASE WHEN impressions > 0 THEN 1 END) as impressions_non_zero,
                COUNT(CASE WHEN clicks > 0 THEN 1 END) as clicks_non_zero,
                COUNT(CASE WHEN ad_cost > 0 THEN 1 END) as ad_cost_non_zero,
                COUNT(CASE WHEN ad_orders > 0 THEN 1 END) as ad_orders_non_zero,
                COUNT(CASE WHEN ad_sales > 0 THEN 1 END) as ad_sales_non_zero,
                COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as title_non_empty,
                COUNT(CASE WHEN spu_name IS NOT NULL AND spu_name != '' THEN 1 END) as spu_name_non_empty,
                COUNT(CASE WHEN operator_name IS NOT NULL AND operator_name != '' THEN 1 END) as operator_name_non_empty,
                COUNT(CASE WHEN dev_name IS NOT NULL AND dev_name != '' THEN 1 END) as dev_name_non_empty
            FROM product_analytics;
        `);
        
        const fieldStat = fieldStats[0];
        const total = stats.total_records;
        
        console.log(`   销售额 > 0: ${fieldStat.sales_amount_non_zero} (${(fieldStat.sales_amount_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   销售量 > 0: ${fieldStat.sales_quantity_non_zero} (${(fieldStat.sales_quantity_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   FBA库存 > 0: ${fieldStat.fba_inventory_non_zero} (${(fieldStat.fba_inventory_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   总库存 > 0: ${fieldStat.total_inventory_non_zero} (${(fieldStat.total_inventory_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   广告曝光 > 0: ${fieldStat.impressions_non_zero} (${(fieldStat.impressions_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   广告点击 > 0: ${fieldStat.clicks_non_zero} (${(fieldStat.clicks_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   广告花费 > 0: ${fieldStat.ad_cost_non_zero} (${(fieldStat.ad_cost_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   广告订单 > 0: ${fieldStat.ad_orders_non_zero} (${(fieldStat.ad_orders_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   广告销售额 > 0: ${fieldStat.ad_sales_non_zero} (${(fieldStat.ad_sales_non_zero/total*100).toFixed(1)}%)`);
        console.log(`   产品标题非空: ${fieldStat.title_non_empty} (${(fieldStat.title_non_empty/total*100).toFixed(1)}%)`);
        console.log(`   SPU名称非空: ${fieldStat.spu_name_non_empty} (${(fieldStat.spu_name_non_empty/total*100).toFixed(1)}%)`);
        console.log(`   操作员名称非空: ${fieldStat.operator_name_non_empty} (${(fieldStat.operator_name_non_empty/total*100).toFixed(1)}%)`);
        console.log(`   开发者名称非空: ${fieldStat.dev_name_non_empty} (${(fieldStat.dev_name_non_empty/total*100).toFixed(1)}%)`);

        // 3. 最近7天的数据情况
        console.log('\n📅 3. 最近7天数据情况:');
        const recentStats = await sql.unsafe(`
            SELECT 
                data_date,
                COUNT(*) as record_count,
                COUNT(CASE WHEN sales_amount > 0 THEN 1 END) as sales_records,
                COUNT(CASE WHEN fba_inventory > 0 THEN 1 END) as inventory_records,
                COUNT(CASE WHEN ad_cost > 0 THEN 1 END) as ad_records,
                AVG(sales_amount) as avg_sales,
                AVG(fba_inventory) as avg_fba_inventory,
                AVG(ad_cost) as avg_ad_cost
            FROM product_analytics 
            WHERE data_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY data_date
            ORDER BY data_date DESC;
        `);
        
        console.log('   日期 | 记录数 | 有销售 | 有库存 | 有广告 | 平均销售额 | 平均FBA库存 | 平均广告费');
        console.log('   -----|--------|--------|--------|--------|------------|-------------|----------');
        recentStats.forEach(row => {
            console.log(`   ${row.data_date} | ${row.record_count.toString().padStart(6)} | ${row.sales_records.toString().padStart(6)} | ${row.inventory_records.toString().padStart(6)} | ${row.ad_records.toString().padStart(6)} | $${parseFloat(row.avg_sales || 0).toFixed(2).padStart(10)} | ${parseFloat(row.avg_fba_inventory || 0).toFixed(0).padStart(11)} | $${parseFloat(row.avg_ad_cost || 0).toFixed(2).padStart(8)}`);
        });

        // 4. 样本数据检查
        console.log('\n🎯 4. 样本数据检查 (前5条):');
        const sampleData = await sql.unsafe(`
            SELECT 
                asin,
                data_date,
                marketplace_id,
                title,
                spu_name,
                operator_name,
                dev_name,
                sales_amount,
                sales_quantity,
                fba_inventory,
                total_inventory,
                impressions,
                clicks,
                ad_cost,
                ad_orders,
                ad_sales
            FROM product_analytics 
            ORDER BY data_date DESC, asin
            LIMIT 5;
        `);
        
        sampleData.forEach((record, index) => {
            console.log(`\n   记录 ${index + 1}:`);
            console.log(`     ASIN: ${record.asin}`);
            console.log(`     日期: ${record.data_date}`);
            console.log(`     市场: ${record.marketplace_id || 'NULL'}`);
            console.log(`     标题: ${record.title || 'NULL'}`);
            console.log(`     SPU名称: ${record.spu_name || 'NULL'}`);
            console.log(`     操作员: ${record.operator_name || 'NULL'}`);
            console.log(`     开发者: ${record.dev_name || 'NULL'}`);
            console.log(`     销售额: $${parseFloat(record.sales_amount || 0).toFixed(2)}`);
            console.log(`     销售量: ${record.sales_quantity || 0}`);
            console.log(`     FBA库存: ${record.fba_inventory || 0}`);
            console.log(`     总库存: ${record.total_inventory || 0}`);
            console.log(`     广告曝光: ${record.impressions || 0}`);
            console.log(`     广告点击: ${record.clicks || 0}`);
            console.log(`     广告花费: $${parseFloat(record.ad_cost || 0).toFixed(2)}`);
            console.log(`     广告订单: ${record.ad_orders || 0}`);
            console.log(`     广告销售额: $${parseFloat(record.ad_sales || 0).toFixed(2)}`);
        });

        // 5. 数据质量问题分析
        console.log('\n⚠️ 5. 数据质量问题分析:');
        
        // 检查空值情况
        const nullStats = await sql.unsafe(`
            SELECT 
                COUNT(CASE WHEN title IS NULL THEN 1 END) as title_null,
                COUNT(CASE WHEN spu_name IS NULL THEN 1 END) as spu_name_null,
                COUNT(CASE WHEN operator_name IS NULL THEN 1 END) as operator_name_null,
                COUNT(CASE WHEN dev_name IS NULL THEN 1 END) as dev_name_null,
                COUNT(CASE WHEN marketplace_id IS NULL THEN 1 END) as marketplace_id_null,
                COUNT(CASE WHEN fba_inventory IS NULL THEN 1 END) as fba_inventory_null,
                COUNT(CASE WHEN total_inventory IS NULL THEN 1 END) as total_inventory_null
            FROM product_analytics;
        `);
        
        const nullStat = nullStats[0];
        console.log(`   标题为NULL: ${nullStat.title_null} (${(nullStat.title_null/total*100).toFixed(1)}%)`);
        console.log(`   SPU名称为NULL: ${nullStat.spu_name_null} (${(nullStat.spu_name_null/total*100).toFixed(1)}%)`);
        console.log(`   操作员为NULL: ${nullStat.operator_name_null} (${(nullStat.operator_name_null/total*100).toFixed(1)}%)`);
        console.log(`   开发者为NULL: ${nullStat.dev_name_null} (${(nullStat.dev_name_null/total*100).toFixed(1)}%)`);
        console.log(`   市场ID为NULL: ${nullStat.marketplace_id_null} (${(nullStat.marketplace_id_null/total*100).toFixed(1)}%)`);
        console.log(`   FBA库存为NULL: ${nullStat.fba_inventory_null} (${(nullStat.fba_inventory_null/total*100).toFixed(1)}%)`);
        console.log(`   总库存为NULL: ${nullStat.total_inventory_null} (${(nullStat.total_inventory_null/total*100).toFixed(1)}%)`);

        // 6. 建议改进措施
        console.log('\n💡 6. 建议改进措施:');
        console.log('   🔧 数据源问题:');
        console.log('      - 检查数据同步脚本是否正确获取了所有字段');
        console.log('      - 验证API接口是否返回了完整的数据');
        console.log('      - 确认数据清洗逻辑是否正确处理了空值');
        console.log('   📊 字段映射问题:');
        console.log('      - 产品名称: 优先使用title，备选spu_name');
        console.log('      - 业务员: 优先使用operator_name，备选dev_name');
        console.log('      - 库存: 使用fba_inventory和total_inventory');
        console.log('   🎯 数据质量提升:');
        console.log('      - 增加数据验证规则');
        console.log('      - 改进空值处理逻辑');
        console.log('      - 优化字段映射策略');

    } catch (error) {
        console.error('❌ 检查过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

checkProductAnalyticsData().catch(console.error); 