#!/usr/bin/env node

// 分批处理剩余ASIN组合的库存快照生成
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

// 时间窗口配置
const TIME_WINDOWS = [
  { code: 'T1', days: 1, description: 'T-1 (1天)' },
  { code: 'T3', days: 3, description: 'T-3到T-1 (3天)' },
  { code: 'T7', days: 7, description: 'T-7到T-1 (7天)' },
  { code: 'T30', days: 30, description: 'T-30到T-1 (30天)' }
];

async function generateRemainingBatches() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 20,
    });

    try {
        console.log('📦 分批处理剩余ASIN组合\n');
        
        // 设置目标日期
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - 1);
        targetDate.setHours(0, 0, 0, 0);
        
        const dataStartDate = new Date(targetDate);
        dataStartDate.setDate(dataStartDate.getDate() - 60);
        
        console.log(`📅 目标快照日期: ${targetDate.toISOString().split('T')[0]}`);

        // 1. 获取已处理的ASIN组合
        const processedAsins = await sql.unsafe(`
            SELECT DISTINCT 
                asin,
                warehouse_location
            FROM inventory_deals
            WHERE snapshot_date = $1;
        `, [targetDate]);
        
        const processedSet = new Set(
            processedAsins.map(item => `${item.asin}|${item.warehouse_location}`)
        );
        
        console.log(`✅ 已处理组合: ${processedSet.size} 个`);

        // 2. 获取所有待处理的ASIN组合
        const allAsinGroups = await sql.unsafe(`
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
            HAVING COUNT(*) >= 3
            ORDER BY asin, marketplace_id;
        `, [dataStartDate, targetDate]);
        
        // 过滤出未处理的组合
        const remainingGroups = allAsinGroups.filter(group => {
            const key = `${group.asin}|${group.marketplace_id}`;
            return !processedSet.has(key);
        });
        
        console.log(`📊 总ASIN组合: ${allAsinGroups.length} 个`);
        console.log(`🔄 剩余待处理: ${remainingGroups.length} 个`);
        
        if (remainingGroups.length === 0) {
            console.log('✅ 所有ASIN组合已处理完成！');
            return;
        }

        // 3. 分批处理策略
        const BATCH_SIZE = 15; // 每批处理15个ASIN组合
        const totalBatches = Math.ceil(remainingGroups.length / BATCH_SIZE);
        let processedCount = 0;
        let totalInserted = 0;
        
        console.log(`\n📦 分批处理策略:`);
        console.log(`   📝 批次大小: ${BATCH_SIZE} 个ASIN组合/批`);
        console.log(`   📊 总批次数: ${totalBatches} 批`);
        console.log(`   ⏱️ 预计时间: ${(totalBatches * 2).toFixed(0)} 分钟\n`);

        // 4. 开始分批处理
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batch = remainingGroups.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
            const batchId = `inventory_deals_batch_${batchIndex + 1}_${Date.now()}`;
            
            console.log(`🔄 处理批次 ${batchIndex + 1}/${totalBatches} (${batch.length} 个组合)`);
            console.log(`   📦 批次ID: ${batchId}`);
            
            const batchStartTime = Date.now();
            let batchInserted = 0;
            
            for (const group of batch) {
                try {
                    // 获取该组合的源数据
                    const sourceData = await sql.unsafe(`
                        SELECT 
                            asin, data_date,
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
                            COALESCE(ad_orders, 0) as ad_orders
                        FROM product_analytics 
                        WHERE data_date >= $1 AND data_date <= $2
                          AND asin = $3 AND COALESCE(marketplace_id, 'default') = $4
                        ORDER BY data_date;
                    `, [dataStartDate, targetDate, group.asin, group.marketplace_id]);
                    
                    // 生成4个时间窗口的快照
                    for (const timeWindow of TIME_WINDOWS) {
                        const windowEndDate = targetDate;
                        const windowStartDate = new Date(targetDate);
                        windowStartDate.setDate(windowStartDate.getDate() - (timeWindow.days - 1));
                        
                        const windowRecords = sourceData.filter(record => {
                            const recordDate = new Date(record.data_date);
                            return recordDate >= windowStartDate && recordDate <= windowEndDate;
                        });
                        
                        const latestRecord = windowRecords.length > 0 
                            ? windowRecords[windowRecords.length - 1] 
                            : { dev_name: group.dev_name, spu_name: group.spu_name, fba_inventory: 0, total_inventory: 0 };
                        
                        const totalSalesAmount = windowRecords.reduce((sum, r) => sum + parseFloat(r.sales_amount || 0), 0);
                        const totalSalesQuantity = windowRecords.reduce((sum, r) => sum + parseInt(r.sales_quantity || 0), 0);
                        const totalAdImpressions = windowRecords.reduce((sum, r) => sum + parseInt(r.impressions || 0), 0);
                        const totalAdClicks = windowRecords.reduce((sum, r) => sum + parseInt(r.clicks || 0), 0);
                        const totalAdSpend = windowRecords.reduce((sum, r) => sum + parseFloat(r.ad_cost || 0), 0);
                        const totalAdOrders = windowRecords.reduce((sum, r) => sum + parseInt(r.ad_orders || 0), 0);
                        
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
                        
                        // 插入记录
                        await sql.unsafe(`
                            INSERT INTO inventory_deals (
                                snapshot_date, asin, product_name, sales_person, warehouse_location,
                                time_window, time_window_days, window_start_date, window_end_date,
                                fba_available, fba_in_transit, local_warehouse, total_inventory,
                                total_sales_amount, total_sales_quantity, avg_daily_sales, avg_daily_revenue,
                                total_ad_impressions, total_ad_clicks, total_ad_spend, total_ad_orders,
                                ad_ctr, ad_conversion_rate, acos, inventory_turnover_days, inventory_status,
                                source_records_count, calculation_method, data_completeness_score,
                                batch_id, processing_duration_ms
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                                $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
                            )
                            ON CONFLICT (asin, warehouse_location, snapshot_date, time_window)
                            DO NOTHING;
                        `, [
                            targetDate.toISOString().split('T')[0], group.asin,
                            latestRecord.spu_name || '', latestRecord.dev_name || '', group.marketplace_id,
                            timeWindow.code, timeWindow.days,
                            windowStartDate.toISOString().split('T')[0], windowEndDate.toISOString().split('T')[0],
                            latestRecord.fba_inventory || 0, 0, 0, latestRecord.total_inventory || 0,
                            totalSalesAmount, totalSalesQuantity, avgDailySales, avgDailyRevenue,
                            totalAdImpressions, totalAdClicks, totalAdSpend, totalAdOrders,
                            adCtr, adConversionRate, acos, Math.min(inventoryTurnoverDays, 999), inventoryStatus,
                            windowRecords.length, 'sum_aggregate', windowRecords.length > 0 ? 1.00 : 0.00,
                            batchId, Date.now() - batchStartTime
                        ]);
                        
                        batchInserted++;
                        totalInserted++;
                    }
                    
                    processedCount++;
                    
                    // 显示进度
                    if (processedCount % 5 === 0) {
                        console.log(`     ✅ 已处理 ${processedCount}/${remainingGroups.length} 个组合`);
                    }
                    
                } catch (error) {
                    console.error(`     ❌ 处理 ${group.asin} @ ${group.marketplace_id} 失败:`, error.message);
                }
            }
            
            const batchDuration = Date.now() - batchStartTime;
            console.log(`   ✅ 批次 ${batchIndex + 1} 完成: 插入 ${batchInserted} 条记录，耗时 ${(batchDuration/1000).toFixed(1)}秒`);
            
            // 每3个批次显示总进度
            if ((batchIndex + 1) % 3 === 0) {
                const overallProgress = ((batchIndex + 1) / totalBatches * 100).toFixed(1);
                console.log(`   📊 总体进度: ${overallProgress}%，已插入 ${totalInserted} 条记录\n`);
            }
        }

        // 5. 最终验证
        console.log('\n📊 处理完成，最终验证:');
        const finalStats = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT warehouse_location) as unique_warehouses,
                SUM(total_sales_amount) as total_sales
            FROM inventory_deals
            WHERE snapshot_date = $1;
        `, [targetDate]);
        
        const stats = finalStats[0];
        console.log(`   📝 总记录数: ${stats.total_records}`);
        console.log(`   🏷️ 独特ASIN: ${stats.unique_asins}`);
        console.log(`   🏪 独特仓库: ${stats.unique_warehouses}`);
        console.log(`   💰 总销售额: $${parseFloat(stats.total_sales || 0).toFixed(2)}`);
        console.log(`   📊 本次新增: ${totalInserted} 条记录`);

        console.log('\n🎉 剩余ASIN组合分批处理完成！');

    } catch (error) {
        console.error('❌ 分批处理时发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

generateRemainingBatches().catch(console.error);