#!/usr/bin/env node

// 生产级 inventory_deals 库存点快照表数据生成脚本
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

// 时间窗口配置
const TIME_WINDOWS = [
  { code: 'T1', days: 1, description: 'T-1 (1天)' },
  { code: 'T3', days: 3, description: 'T-3到T-1 (3天)' },
  { code: 'T7', days: 7, description: 'T-7到T-1 (7天)' },
  { code: 'T30', days: 30, description: 'T-30到T-1 (30天)' }
];

async function generateInventoryDealsProduction() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 20,
    });

    try {
        console.log('🚀 开始生成 inventory_deals 库存点快照表数据\\n');
        
        // 设置目标日期为昨天 (T-1)
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - 1);
        targetDate.setHours(0, 0, 0, 0);
        
        console.log(`📅 目标快照日期 (T-1): ${targetDate.toISOString().split('T')[0]}`);

        // 生成批次ID
        const batchId = `inventory_deals_${targetDate.toISOString().split('T')[0]}_${Date.now()}`;
        console.log(`📦 批次ID: ${batchId}`);

        // 1. 获取所有需要聚合的ASIN组合
        console.log('\\n📋 1. 获取所有ASIN-市场组合:');
        
        const dataStartDate = new Date(targetDate);
        dataStartDate.setDate(dataStartDate.getDate() - 60);
        
        const asinGroups = await sql.unsafe(`
            SELECT 
                asin,
                COALESCE(marketplace_id, 'default') as marketplace_id,
                COUNT(*) as record_count,
                MAX(COALESCE(dev_name, '')) as dev_name,
                MAX(COALESCE(spu_name, '')) as spu_name
            FROM product_analytics 
            WHERE data_date >= $1 
              AND data_date <= $2
              AND asin IS NOT NULL
            GROUP BY asin, COALESCE(marketplace_id, 'default')
            HAVING COUNT(*) >= 5
            ORDER BY asin, marketplace_id;
        `, [dataStartDate, targetDate]);
        
        console.log(`   找到 ${asinGroups.length} 个ASIN-市场组合需要处理`);
        
        if (asinGroups.length === 0) {
            console.log('❌ 没有可处理的ASIN组合');
            return;
        }

        // 2. 清理已存在的同日期数据
        console.log('\\n🗑️ 2. 清理已存在的快照数据:');
        const deleteResult = await sql.unsafe(`
            DELETE FROM inventory_deals 
            WHERE snapshot_date = $1;
        `, [targetDate]);
        
        console.log(`   删除了 ${deleteResult.count || 0} 条已存在记录`);

        // 3. 批量生成快照数据
        console.log('\\n⚡ 3. 开始批量生成快照数据:');
        
        const BATCH_SIZE = 50; // 每批处理50个ASIN组合
        let totalInserted = 0;
        let processedGroups = 0;
        
        for (let i = 0; i < asinGroups.length; i += BATCH_SIZE) {
            const batch = asinGroups.slice(i, i + BATCH_SIZE);
            console.log(`   处理批次 ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(asinGroups.length/BATCH_SIZE)} (${batch.length} 个组合)`);
            
            const batchStartTime = Date.now();
            
            // 获取当前批次的所有源数据
            const batchAsins = batch.map(g => `'${g.asin}'`).join(',');
            const batchMarkets = batch.map(g => `'${g.marketplace_id}'`).join(',');
            
            const sourceData = await sql.unsafe(`
                SELECT 
                    asin,
                    data_date,
                    COALESCE(marketplace_id, 'default') as marketplace_id,
                    COALESCE(dev_name, '') as dev_name,
                    COALESCE(spu_name, '') as spu_name,
                    COALESCE(fba_inventory, 0) as fba_inventory,
                    COALESCE(total_inventory, 0) as total_inventory,
                    COALESCE(sales_amount, 0) as sales_amount,
                    COALESCE(sales_quantity, 0) as sales_quantity,
                    COALESCE(impressions, 0) as impressions,
                    COALESCE(clicks, 0) as clicks,
                    COALESCE(ad_cost, 0) as ad_cost,
                    COALESCE(ad_orders, 0) as ad_orders,
                    COALESCE(ad_conversion_rate, 0) as ad_conversion_rate,
                    COALESCE(acos, 0) as acos
                FROM product_analytics 
                WHERE data_date >= $1 
                  AND data_date <= $2
                  AND asin IN (${batchAsins})
                ORDER BY asin, marketplace_id, data_date;
            `, [dataStartDate, targetDate]);
            
            // 按ASIN+市场分组
            const groupedData = {};
            for (const record of sourceData) {
                const key = `${record.asin}|${record.marketplace_id}`;
                if (!groupedData[key]) {
                    groupedData[key] = [];
                }
                groupedData[key].push(record);
            }
            
            // 为每个组合生成4个时间窗口的快照
            const snapshotRecords = [];
            
            for (const group of batch) {
                const groupKey = `${group.asin}|${group.marketplace_id}`;
                const records = groupedData[groupKey] || [];
                
                if (records.length === 0) {
                    console.log(`     ⚠️ ${groupKey} 没有找到源数据，跳过`);
                    continue;
                }
                
                for (const timeWindow of TIME_WINDOWS) {
                    // 计算窗口范围
                    const windowEndDate = targetDate;
                    const windowStartDate = new Date(targetDate);
                    windowStartDate.setDate(windowStartDate.getDate() - (timeWindow.days - 1));
                    
                    // 过滤窗口内数据
                    const windowRecords = records.filter(record => {
                        const recordDate = new Date(record.data_date);
                        return recordDate >= windowStartDate && recordDate <= windowEndDate;
                    });
                    
                    // 聚合计算
                    const latestRecord = windowRecords.length > 0 
                        ? windowRecords[windowRecords.length - 1] 
                        : { dev_name: group.dev_name, spu_name: group.spu_name, fba_inventory: 0, total_inventory: 0 };
                    
                    const totalSalesAmount = windowRecords.reduce((sum, r) => sum + parseFloat(r.sales_amount || 0), 0);
                    const totalSalesQuantity = windowRecords.reduce((sum, r) => sum + parseInt(r.sales_quantity || 0), 0);
                    const totalAdImpressions = windowRecords.reduce((sum, r) => sum + parseInt(r.impressions || 0), 0);
                    const totalAdClicks = windowRecords.reduce((sum, r) => sum + parseInt(r.clicks || 0), 0);
                    const totalAdSpend = windowRecords.reduce((sum, r) => sum + parseFloat(r.ad_cost || 0), 0);
                    const totalAdOrders = windowRecords.reduce((sum, r) => sum + parseInt(r.ad_orders || 0), 0);
                    
                    // 计算衍生指标
                    const avgDailySales = timeWindow.days > 0 ? (totalSalesQuantity / timeWindow.days) : 0;
                    const avgDailyRevenue = timeWindow.days > 0 ? (totalSalesAmount / timeWindow.days) : 0;
                    const adCtr = totalAdImpressions > 0 ? (totalAdClicks / totalAdImpressions) : 0;
                    const adConversionRate = totalAdClicks > 0 ? (totalAdOrders / totalAdClicks) : 0;
                    const acos = totalSalesAmount > 0 ? (totalAdSpend / totalSalesAmount) : 0;
                    const inventoryTurnoverDays = avgDailySales > 0 && latestRecord.total_inventory > 0 
                        ? (latestRecord.total_inventory / avgDailySales) : 999;
                    
                    let inventoryStatus = '正常';
                    if (inventoryTurnoverDays <= 7) inventoryStatus = '短缺';
                    else if (inventoryTurnoverDays <= 30) inventoryStatus = '正常';
                    else if (inventoryTurnoverDays <= 60) inventoryStatus = '充足';
                    else inventoryStatus = '积压';
                    
                    snapshotRecords.push([
                        targetDate.toISOString().split('T')[0], // snapshot_date
                        group.asin, // asin
                        latestRecord.spu_name || '', // product_name
                        latestRecord.dev_name || '', // sales_person
                        group.marketplace_id, // warehouse_location
                        timeWindow.code, // time_window
                        timeWindow.days, // time_window_days
                        windowStartDate.toISOString().split('T')[0], // window_start_date
                        windowEndDate.toISOString().split('T')[0], // window_end_date
                        latestRecord.fba_inventory || 0, // fba_available
                        0, // fba_in_transit
                        0, // local_warehouse
                        latestRecord.total_inventory || 0, // total_inventory
                        totalSalesAmount, // total_sales_amount
                        totalSalesQuantity, // total_sales_quantity
                        avgDailySales, // avg_daily_sales
                        avgDailyRevenue, // avg_daily_revenue
                        totalAdImpressions, // total_ad_impressions
                        totalAdClicks, // total_ad_clicks
                        totalAdSpend, // total_ad_spend
                        totalAdOrders, // total_ad_orders
                        adCtr, // ad_ctr
                        adConversionRate, // ad_conversion_rate
                        acos, // acos
                        Math.min(inventoryTurnoverDays, 999), // inventory_turnover_days
                        inventoryStatus, // inventory_status
                        windowRecords.length, // source_records_count
                        'sum_aggregate', // calculation_method
                        windowRecords.length > 0 ? 1.00 : 0.00, // data_completeness_score
                        batchId, // batch_id
                        Date.now() - batchStartTime // processing_duration_ms
                    ]);
                }
                
                processedGroups++;
            }
            
            // 批量插入数据
            if (snapshotRecords.length > 0) {
                const placeholders = snapshotRecords.map((_, index) => {
                    const start = index * 29 + 1;
                    const values = Array.from({length: 29}, (_, i) => `$${start + i}`);
                    return `(${values.join(', ')})`;
                }).join(', ');
                
                const insertQuery = `
                    INSERT INTO inventory_deals (
                        snapshot_date, asin, product_name, sales_person, warehouse_location,
                        time_window, time_window_days, window_start_date, window_end_date,
                        fba_available, fba_in_transit, local_warehouse, total_inventory,
                        total_sales_amount, total_sales_quantity, avg_daily_sales, avg_daily_revenue,
                        total_ad_impressions, total_ad_clicks, total_ad_spend, total_ad_orders,
                        ad_ctr, ad_conversion_rate, acos, inventory_turnover_days, inventory_status,
                        source_records_count, calculation_method, data_completeness_score,
                        batch_id, processing_duration_ms
                    ) VALUES ${placeholders}
                    ON CONFLICT (asin, warehouse_location, snapshot_date, time_window)
                    DO UPDATE SET
                        product_name = EXCLUDED.product_name,
                        sales_person = EXCLUDED.sales_person,
                        fba_available = EXCLUDED.fba_available,
                        total_inventory = EXCLUDED.total_inventory,
                        total_sales_amount = EXCLUDED.total_sales_amount,
                        total_sales_quantity = EXCLUDED.total_sales_quantity,
                        avg_daily_sales = EXCLUDED.avg_daily_sales,
                        avg_daily_revenue = EXCLUDED.avg_daily_revenue,
                        total_ad_impressions = EXCLUDED.total_ad_impressions,
                        total_ad_clicks = EXCLUDED.total_ad_clicks,
                        total_ad_spend = EXCLUDED.total_ad_spend,
                        total_ad_orders = EXCLUDED.total_ad_orders,
                        ad_ctr = EXCLUDED.ad_ctr,
                        ad_conversion_rate = EXCLUDED.ad_conversion_rate,
                        acos = EXCLUDED.acos,
                        inventory_turnover_days = EXCLUDED.inventory_turnover_days,
                        inventory_status = EXCLUDED.inventory_status,
                        source_records_count = EXCLUDED.source_records_count,
                        data_completeness_score = EXCLUDED.data_completeness_score,
                        processing_duration_ms = EXCLUDED.processing_duration_ms,
                        updated_at = CURRENT_TIMESTAMP;
                `;
                
                await sql.unsafe(insertQuery, snapshotRecords.flat());
                
                totalInserted += snapshotRecords.length;
                console.log(`     ✅ 插入 ${snapshotRecords.length} 条快照记录`);
            }
            
            const batchDuration = Date.now() - batchStartTime;
            console.log(`     ⏱️ 批次处理耗时: ${batchDuration}ms`);
        }

        // 4. 验证生成结果
        console.log('\\n✅ 4. 验证生成结果:');
        
        const verificationResult = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT warehouse_location) as unique_warehouses,
                COUNT(DISTINCT time_window) as time_windows,
                SUM(total_sales_amount) as total_sales,
                AVG(data_completeness_score) as avg_completeness
            FROM inventory_deals 
            WHERE snapshot_date = $1 AND batch_id = $2;
        `, [targetDate, batchId]);
        
        const result = verificationResult[0];
        console.log(`   生成记录总数: ${result.total_records}`);
        console.log(`   涉及ASIN数: ${result.unique_asins}`);
        console.log(`   涉及仓库数: ${result.unique_warehouses}`);
        console.log(`   时间窗口数: ${result.time_windows}`);
        console.log(`   总销售额: $${parseFloat(result.total_sales || 0).toFixed(2)}`);
        console.log(`   平均数据完整性: ${parseFloat(result.avg_completeness || 0).toFixed(2)}`);
        
        // 5. 数据质量检查
        console.log('\\n🔍 5. 数据质量检查:');
        
        const qualityCheck = await sql.unsafe(`
            SELECT 
                time_window,
                COUNT(*) as record_count,
                COUNT(CASE WHEN total_sales_amount > 0 THEN 1 END) as records_with_sales,
                COUNT(CASE WHEN total_inventory > 0 THEN 1 END) as records_with_inventory,
                AVG(inventory_turnover_days) as avg_turnover_days
            FROM inventory_deals 
            WHERE snapshot_date = $1 AND batch_id = $2
            GROUP BY time_window
            ORDER BY time_window_days;
        `, [targetDate, batchId]);
        
        console.log('   时间窗口质量报告:');
        qualityCheck.forEach(check => {
            console.log(`     ${check.time_window}: ${check.record_count} 条记录, ${check.records_with_sales} 有销售, ${check.records_with_inventory} 有库存`);
        });

        console.log('\\n🎉 inventory_deals 快照数据生成完成!');
        console.log(`📊 总计处理: ${processedGroups} 个ASIN组合, 生成 ${totalInserted} 条快照记录`);
        console.log(`🏷️ 批次ID: ${batchId}`);

    } catch (error) {
        console.error('❌ 生成过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

generateInventoryDealsProduction().catch(console.error);