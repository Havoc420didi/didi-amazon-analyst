#!/usr/bin/env node

// 验证生成的 inventory_deals 数据
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

async function verifyInventoryDeals() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 10,
    });

    try {
        console.log('🔍 验证 inventory_deals 表数据\\n');

        // 1. 基础统计
        console.log('📊 1. 基础统计信息:');
        const basicStats = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT warehouse_location) as unique_warehouses,
                COUNT(DISTINCT time_window) as time_windows,
                COUNT(DISTINCT snapshot_date) as snapshot_dates,
                SUM(total_sales_amount) as total_sales,
                AVG(data_completeness_score) as avg_completeness
            FROM inventory_deals;
        `);
        
        const stats = basicStats[0];
        console.log(`   总记录数: ${stats.total_records}`);
        console.log(`   独特ASIN数: ${stats.unique_asins}`);
        console.log(`   独特仓库数: ${stats.unique_warehouses}`);
        console.log(`   时间窗口数: ${stats.time_windows}`);
        console.log(`   快照日期数: ${stats.snapshot_dates}`);
        console.log(`   总销售额: $${parseFloat(stats.total_sales || 0).toFixed(2)}`);
        console.log(`   平均数据完整性: ${parseFloat(stats.avg_completeness || 0).toFixed(2)}`);

        // 2. 时间窗口分布
        console.log('\\n⏰ 2. 时间窗口分布:');
        const timeWindowStats = await sql.unsafe(`
            SELECT 
                time_window,
                time_window_days,
                COUNT(*) as record_count,
                AVG(total_sales_amount) as avg_sales,
                AVG(total_sales_quantity) as avg_quantity,
                AVG(inventory_turnover_days) as avg_turnover
            FROM inventory_deals
            GROUP BY time_window, time_window_days
            ORDER BY time_window_days;
        `);
        
        timeWindowStats.forEach(tw => {
            console.log(`   ${tw.time_window} (${tw.time_window_days}天): ${tw.record_count} 条记录`);
            console.log(`     平均销售额: $${parseFloat(tw.avg_sales || 0).toFixed(2)}`);
            console.log(`     平均销售量: ${parseFloat(tw.avg_quantity || 0).toFixed(1)}`);
            console.log(`     平均周转天数: ${parseFloat(tw.avg_turnover || 0).toFixed(1)}`);
        });

        // 3. ASIN样本数据
        console.log('\\n🎯 3. ASIN样本数据 (前5个):');
        const sampleData = await sql.unsafe(`
            SELECT 
                asin,
                warehouse_location,
                time_window,
                total_sales_amount,
                total_sales_quantity,
                inventory_turnover_days,
                inventory_status,
                source_records_count
            FROM inventory_deals
            ORDER BY asin, warehouse_location, time_window_days
            LIMIT 20;
        `);
        
        let currentAsin = '';
        sampleData.forEach(record => {
            if (record.asin !== currentAsin) {
                currentAsin = record.asin;
                console.log(`\\n   ASIN: ${record.asin} @ ${record.warehouse_location}`);
            }
            console.log(`     ${record.time_window}: $${parseFloat(record.total_sales_amount).toFixed(2)} sales, ${record.total_sales_quantity} qty, ${record.source_records_count} records`);
            console.log(`       周转天数: ${parseFloat(record.inventory_turnover_days).toFixed(1)}, 状态: ${record.inventory_status}`);
        });

        // 4. 数据质量检查
        console.log('\\n🔍 4. 数据质量检查:');
        
        // 检查每个ASIN是否有4个时间窗口
        const asinWindowCount = await sql.unsafe(`
            SELECT 
                asin,
                warehouse_location,
                COUNT(DISTINCT time_window) as window_count
            FROM inventory_deals
            GROUP BY asin, warehouse_location
            HAVING COUNT(DISTINCT time_window) != 4;
        `);
        
        if (asinWindowCount.length === 0) {
            console.log('   ✅ 所有ASIN组合都有完整的4个时间窗口');
        } else {
            console.log(`   ⚠️ 发现 ${asinWindowCount.length} 个ASIN组合缺少时间窗口:`);
            asinWindowCount.forEach(item => {
                console.log(`     ${item.asin} @ ${item.warehouse_location}: 只有 ${item.window_count} 个窗口`);
            });
        }

        // 检查库存状态分布
        const inventoryStatusDist = await sql.unsafe(`
            SELECT 
                inventory_status,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
            FROM inventory_deals
            GROUP BY inventory_status
            ORDER BY count DESC;
        `);
        
        console.log('\\n   📦 库存状态分布:');
        inventoryStatusDist.forEach(status => {
            console.log(`     ${status.inventory_status}: ${status.count} 条 (${status.percentage}%)`);
        });

        console.log('\\n✅ inventory_deals 数据验证完成!');

    } catch (error) {
        console.error('❌ 验证过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

verifyInventoryDeals().catch(console.error);