#!/usr/bin/env node

// 查询当前 inventory_deals 表格中的数据
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

async function queryInventoryDeals() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 10,
    });

    try {
        console.log('📊 查询 inventory_deals 表格数据\n');

        // 1. 基础统计信息
        console.log('📈 1. 基础统计信息:');
        const basicStats = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT warehouse_location) as unique_warehouses,
                COUNT(DISTINCT time_window) as time_windows,
                COUNT(DISTINCT snapshot_date) as snapshot_dates,
                COUNT(DISTINCT batch_id) as batch_count,
                MIN(snapshot_date) as earliest_snapshot,
                MAX(snapshot_date) as latest_snapshot,
                SUM(total_sales_amount) as total_sales,
                SUM(total_sales_quantity) as total_quantity,
                AVG(data_completeness_score) as avg_completeness
            FROM inventory_deals;
        `);
        
        const stats = basicStats[0];
        console.log(`   📝 总记录数: ${stats.total_records}`);
        console.log(`   🏷️ 独特ASIN数: ${stats.unique_asins}`);
        console.log(`   🏪 独特仓库数: ${stats.unique_warehouses}`);
        console.log(`   ⏰ 时间窗口数: ${stats.time_windows}`);
        console.log(`   📅 快照日期数: ${stats.snapshot_dates}`);
        console.log(`   📦 批次数: ${stats.batch_count}`);
        console.log(`   📅 最早快照: ${stats.earliest_snapshot}`);
        console.log(`   📅 最新快照: ${stats.latest_snapshot}`);
        console.log(`   💰 总销售额: $${parseFloat(stats.total_sales || 0).toFixed(2)}`);
        console.log(`   📊 总销售量: ${stats.total_quantity}`);
        console.log(`   ✅ 平均数据完整性: ${parseFloat(stats.avg_completeness || 0).toFixed(2)}`);

        // 2. 按快照日期和批次分组
        console.log('\n📅 2. 按快照日期和批次分组:');
        const batchStats = await sql.unsafe(`
            SELECT 
                snapshot_date,
                batch_id,
                COUNT(*) as record_count,
                COUNT(DISTINCT asin) as asin_count,
                SUM(total_sales_amount) as batch_sales,
                MIN(created_at) as created_time
            FROM inventory_deals
            GROUP BY snapshot_date, batch_id
            ORDER BY snapshot_date DESC, created_time DESC;
        `);
        
        batchStats.forEach(batch => {
            console.log(`   📅 ${batch.snapshot_date}:`);
            console.log(`     📦 批次ID: ${batch.batch_id}`);
            console.log(`     📝 记录数: ${batch.record_count}`);
            console.log(`     🏷️ ASIN数: ${batch.asin_count}`);
            console.log(`     💰 销售额: $${parseFloat(batch.batch_sales || 0).toFixed(2)}`);
            console.log(`     ⏰ 创建时间: ${batch.created_time}`);
        });

        // 3. 时间窗口分布详情
        console.log('\n⏰ 3. 时间窗口分布详情:');
        const timeWindowStats = await sql.unsafe(`
            SELECT 
                time_window,
                time_window_days,
                COUNT(*) as record_count,
                COUNT(CASE WHEN total_sales_amount > 0 THEN 1 END) as records_with_sales,
                COUNT(CASE WHEN total_inventory > 0 THEN 1 END) as records_with_inventory,
                SUM(total_sales_amount) as window_total_sales,
                AVG(total_sales_amount) as avg_sales,
                AVG(total_sales_quantity) as avg_quantity,
                AVG(inventory_turnover_days) as avg_turnover,
                MIN(inventory_turnover_days) as min_turnover,
                MAX(inventory_turnover_days) as max_turnover
            FROM inventory_deals
            GROUP BY time_window, time_window_days
            ORDER BY time_window_days;
        `);
        
        timeWindowStats.forEach(tw => {
            console.log(`   ${tw.time_window} (${tw.time_window_days}天窗口):`);
            console.log(`     📝 记录数: ${tw.record_count}`);
            console.log(`     💰 有销售记录: ${tw.records_with_sales} (${(tw.records_with_sales/tw.record_count*100).toFixed(1)}%)`);
            console.log(`     📦 有库存记录: ${tw.records_with_inventory} (${(tw.records_with_inventory/tw.record_count*100).toFixed(1)}%)`);
            console.log(`     💸 窗口总销售: $${parseFloat(tw.window_total_sales || 0).toFixed(2)}`);
            console.log(`     📊 平均销售额: $${parseFloat(tw.avg_sales || 0).toFixed(2)}`);
            console.log(`     📈 平均销售量: ${parseFloat(tw.avg_quantity || 0).toFixed(1)}`);
            console.log(`     🔄 平均周转天数: ${parseFloat(tw.avg_turnover || 0).toFixed(1)}`);
            console.log(`     🔄 周转天数范围: ${parseFloat(tw.min_turnover || 0).toFixed(1)} - ${parseFloat(tw.max_turnover || 0).toFixed(1)}`);
        });

        // 4. ASIN详细数据
        console.log('\n🏷️ 4. 所有ASIN详细数据:');
        const asinData = await sql.unsafe(`
            SELECT 
                asin,
                product_name,
                sales_person,
                warehouse_location,
                time_window,
                time_window_days,
                total_sales_amount,
                total_sales_quantity,
                total_inventory,
                inventory_turnover_days,
                inventory_status,
                source_records_count,
                data_completeness_score,
                window_start_date,
                window_end_date
            FROM inventory_deals
            ORDER BY asin, warehouse_location, time_window_days;
        `);
        
        let currentGroup = '';
        asinData.forEach(record => {
            const groupKey = `${record.asin} @ ${record.warehouse_location}`;
            if (groupKey !== currentGroup) {
                currentGroup = groupKey;
                console.log(`\n   🏷️ ASIN: ${record.asin}`);
                console.log(`     📦 产品名: ${record.product_name || '未知'}`);
                console.log(`     👤 业务员: ${record.sales_person || '未知'}`);
                console.log(`     🏪 仓库位置: ${record.warehouse_location}`);
            }
            console.log(`     ⏰ ${record.time_window} (${record.window_start_date} 到 ${record.window_end_date}):`);
            console.log(`       💰 销售额: $${parseFloat(record.total_sales_amount).toFixed(2)}`);
            console.log(`       📊 销售量: ${record.total_sales_quantity}`);
            console.log(`       📦 库存: ${record.total_inventory}`);
            console.log(`       🔄 周转天数: ${parseFloat(record.inventory_turnover_days).toFixed(1)}`);
            console.log(`       📈 库存状态: ${record.inventory_status}`);
            console.log(`       📝 源记录数: ${record.source_records_count}`);
            console.log(`       ✅ 完整性: ${parseFloat(record.data_completeness_score).toFixed(2)}`);
        });

        // 5. 库存状态分布
        console.log('\n📦 5. 库存状态分布:');
        const inventoryStatusDist = await sql.unsafe(`
            SELECT 
                inventory_status,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
                AVG(inventory_turnover_days) as avg_turnover,
                AVG(total_inventory) as avg_inventory,
                SUM(total_sales_amount) as status_total_sales
            FROM inventory_deals
            GROUP BY inventory_status
            ORDER BY count DESC;
        `);
        
        inventoryStatusDist.forEach(status => {
            console.log(`   📊 ${status.inventory_status}:`);
            console.log(`     📝 记录数: ${status.count} (${status.percentage}%)`);
            console.log(`     🔄 平均周转天数: ${parseFloat(status.avg_turnover).toFixed(1)}`);
            console.log(`     📦 平均库存: ${parseFloat(status.avg_inventory).toFixed(0)}`);
            console.log(`     💰 总销售额: $${parseFloat(status.status_total_sales || 0).toFixed(2)}`);
        });

        // 6. 销售表现TOP记录
        console.log('\n🏆 6. 销售表现TOP记录:');
        const topSales = await sql.unsafe(`
            SELECT 
                asin,
                warehouse_location,
                time_window,
                total_sales_amount,
                total_sales_quantity,
                inventory_turnover_days,
                inventory_status
            FROM inventory_deals
            WHERE total_sales_amount > 0
            ORDER BY total_sales_amount DESC
            LIMIT 10;
        `);
        
        if (topSales.length > 0) {
            console.log('   💰 按销售额排序:');
            topSales.forEach((record, index) => {
                console.log(`     ${index + 1}. ${record.asin} @ ${record.warehouse_location} (${record.time_window}):`);
                console.log(`        💰 销售额: $${parseFloat(record.total_sales_amount).toFixed(2)}`);
                console.log(`        📊 销售量: ${record.total_sales_quantity}`);
                console.log(`        🔄 周转天数: ${parseFloat(record.inventory_turnover_days).toFixed(1)}`);
                console.log(`        📈 库存状态: ${record.inventory_status}`);
            });
        } else {
            console.log('   ⚠️ 暂无销售记录');
        }

        console.log('\n✅ inventory_deals 表格数据查询完成!');

    } catch (error) {
        console.error('❌ 查询过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

queryInventoryDeals().catch(console.error);