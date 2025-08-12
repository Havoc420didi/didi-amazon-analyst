#!/usr/bin/env node

// 完整生产级 inventory_deals 库存点快照表数据生成脚本
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

// 时间窗口配置
const TIME_WINDOWS = [
  { code: 'T1', days: 1, description: 'T-1 (1天)' },
  { code: 'T3', days: 3, description: 'T-3到T-1 (3天)' },
  { code: 'T7', days: 7, description: 'T-7到T-1 (7天)' },
  { code: 'T30', days: 30, description: 'T-30到T-1 (30天)' }
];

async function generateFullInventoryDeals() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 30,
    });

    try {
        console.log('🚀 开始完整生成 inventory_deals 库存点快照表数据\n');
        
        const startTime = Date.now();
        
        // 设置目标日期为昨天 (T-1)
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - 1);
        targetDate.setHours(0, 0, 0, 0);
        
        console.log(`📅 目标快照日期 (T-1): ${targetDate.toISOString().split('T')[0]}`);

        // 生成批次ID
        const batchId = `inventory_deals_full_${targetDate.toISOString().split('T')[0]}_${Date.now()}`;
        console.log(`📦 批次ID: ${batchId}`);

        // 1. 获取所有需要聚合的ASIN组合
        console.log('\n📋 1. 获取所有ASIN-市场组合:');
        
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
            HAVING COUNT(*) >= 3
            ORDER BY asin, marketplace_id;
        `, [dataStartDate, targetDate]);
        
        console.log(`   找到 ${asinGroups.length} 个ASIN-市场组合需要处理`);
        
        if (asinGroups.length === 0) {
            console.log('❌ 没有可处理的ASIN组合');
            return;
        }

        // 2. 清理已存在的同日期数据
        console.log('\n🗑️ 2. 清理已存在的快照数据:');
        const deleteResult = await sql.unsafe(`
            DELETE FROM inventory_deals 
            WHERE snapshot_date = $1;
        `, [targetDate]);
        
        console.log(`   删除了 ${deleteResult.count || 0} 条已存在记录`);

        // 3. 批量生成快照数据
        console.log('\n⚡ 3. 开始批量生成快照数据:');
        
        const BATCH_SIZE = 25; // 每批处理25个ASIN组合
        let totalInserted = 0;
        let processedGroups = 0;
        let processedBatches = 0;
        
        for (let i = 0; i < asinGroups.length; i += BATCH_SIZE) {
            const batch = asinGroups.slice(i, i + BATCH_SIZE);
            processedBatches++;
            
            console.log(`   📦 处理批次 ${processedBatches}/${Math.ceil(asinGroups.length/BATCH_SIZE)} (${batch.length} 个组合)`);
            
            const batchStartTime = Date.now();
            
            // 为当前批次中的每个ASIN组合生成快照
            for (const group of batch) {
                try {
                    // 获取该组合的源数据
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
                            COALESCE(ad_orders, 0) as ad_orders
                        FROM product_analytics 
                        WHERE data_date >= $1 
                          AND data_date <= $2
                          AND asin = $3
                          AND COALESCE(marketplace_id, 'default') = $4
                        ORDER BY data_date;
                    `, [dataStartDate, targetDate, group.asin, group.marketplace_id]);
                    
                    // 为每个时间窗口生成快照
                    for (const timeWindow of TIME_WINDOWS) {
                        const windowEndDate = targetDate;
                        const windowStartDate = new Date(targetDate);
                        windowStartDate.setDate(windowStartDate.getDate() - (timeWindow.days - 1));
                        
                        // 过滤窗口内数据
                        const windowRecords = sourceData.filter(record => {
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
                        
                        // 插入单条记录
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
                            DO UPDATE SET
                                product_name = EXCLUDED.product_name,
                                sales_person = EXCLUDED.sales_person,
                                total_sales_amount = EXCLUDED.total_sales_amount,
                                total_sales_quantity = EXCLUDED.total_sales_quantity,
                                updated_at = CURRENT_TIMESTAMP;
                        `, [
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
                        
                        totalInserted++;
                    }
                    
                    processedGroups++;
                    
                    // 每处理10个组合显示一次进度
                    if (processedGroups % 10 === 0) {
                        console.log(`     ✅ 已处理 ${processedGroups}/${asinGroups.length} 个ASIN组合`);
                    }
                    
                } catch (error) {
                    console.error(`     ❌ 处理 ${group.asin} @ ${group.marketplace_id} 失败:`, error.message);
                }
            }
            
            const batchDuration = Date.now() - batchStartTime;
            console.log(`     ⏱️ 批次 ${processedBatches} 完成，耗时: ${batchDuration}ms，平均每组合: ${(batchDuration/batch.length).toFixed(1)}ms`);
            
            // 每处理几个批次后显示进度和内存使用情况
            if (processedBatches % 5 === 0) {
                const memUsage = process.memoryUsage();
                console.log(`     📊 内存使用: RSS: ${(memUsage.rss/1024/1024).toFixed(1)}MB, Heap: ${(memUsage.heapUsed/1024/1024).toFixed(1)}MB`);
            }
        }

        // 4. 验证生成结果
        console.log('\n✅ 4. 验证生成结果:');
        
        const verificationResult = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT warehouse_location) as unique_warehouses,
                COUNT(DISTINCT time_window) as time_windows,
                SUM(total_sales_amount) as total_sales,
                SUM(total_sales_quantity) as total_quantity,
                AVG(data_completeness_score) as avg_completeness,
                COUNT(CASE WHEN total_sales_amount > 0 THEN 1 END) as records_with_sales,
                COUNT(CASE WHEN total_inventory > 0 THEN 1 END) as records_with_inventory
            FROM inventory_deals 
            WHERE snapshot_date = $1 AND batch_id = $2;
        `, [targetDate, batchId]);
        
        const result = verificationResult[0];
        console.log(`   📝 生成记录总数: ${result.total_records}`);
        console.log(`   🏷️ 涉及ASIN数: ${result.unique_asins}`);
        console.log(`   🏪 涉及仓库数: ${result.unique_warehouses}`);
        console.log(`   ⏰ 时间窗口数: ${result.time_windows}`);
        console.log(`   💰 总销售额: $${parseFloat(result.total_sales || 0).toFixed(2)}`);
        console.log(`   📊 总销售量: ${result.total_quantity}`);
        console.log(`   ✅ 平均数据完整性: ${parseFloat(result.avg_completeness || 0).toFixed(2)}`);
        console.log(`   💸 有销售记录: ${result.records_with_sales} (${(result.records_with_sales/result.total_records*100).toFixed(1)}%)`);
        console.log(`   📦 有库存记录: ${result.records_with_inventory} (${(result.records_with_inventory/result.total_records*100).toFixed(1)}%)`);

        // 5. 时间窗口质量检查
        console.log('\n🔍 5. 时间窗口质量检查:');
        
        const qualityCheck = await sql.unsafe(`
            SELECT 
                time_window,
                COUNT(*) as record_count,
                COUNT(CASE WHEN total_sales_amount > 0 THEN 1 END) as records_with_sales,
                SUM(total_sales_amount) as window_total_sales,
                AVG(inventory_turnover_days) as avg_turnover_days,
                COUNT(CASE WHEN inventory_status = '积压' THEN 1 END) as backlog_count,
                COUNT(CASE WHEN inventory_status = '正常' THEN 1 END) as normal_count,
                COUNT(CASE WHEN inventory_status = '充足' THEN 1 END) as sufficient_count,
                COUNT(CASE WHEN inventory_status = '短缺' THEN 1 END) as shortage_count
            FROM inventory_deals 
            WHERE snapshot_date = $1 AND batch_id = $2
            GROUP BY time_window, time_window_days
            ORDER BY time_window_days;
        `, [targetDate, batchId]);
        
        console.log('   ⏰ 时间窗口质量报告:');
        qualityCheck.forEach(check => {
            console.log(`     ${check.time_window}:`);
            console.log(`       📝 记录数: ${check.record_count}`);
            console.log(`       💰 有销售: ${check.records_with_sales} (${(check.records_with_sales/check.record_count*100).toFixed(1)}%)`);
            console.log(`       💸 总销售额: $${parseFloat(check.window_total_sales || 0).toFixed(2)}`);
            console.log(`       🔄 平均周转天数: ${parseFloat(check.avg_turnover_days || 0).toFixed(1)}`);
            console.log(`       📊 库存状态分布: 积压${check.backlog_count}, 正常${check.normal_count}, 充足${check.sufficient_count}, 短缺${check.shortage_count}`);
        });

        // 6. ASIN完整性检查
        const asinIntegrityCheck = await sql.unsafe(`
            SELECT 
                asin,
                warehouse_location,
                COUNT(DISTINCT time_window) as window_count
            FROM inventory_deals
            WHERE snapshot_date = $1 AND batch_id = $2
            GROUP BY asin, warehouse_location
            HAVING COUNT(DISTINCT time_window) != 4;
        `, [targetDate, batchId]);
        
        if (asinIntegrityCheck.length === 0) {
            console.log('\n✅ 6. ASIN完整性检查: 所有ASIN组合都有完整的4个时间窗口 ✓');
        } else {
            console.log(`\n⚠️ 6. ASIN完整性检查: 发现 ${asinIntegrityCheck.length} 个ASIN组合缺少时间窗口`);
        }

        const totalDuration = Date.now() - startTime;
        const avgTimePerGroup = totalDuration / processedGroups;
        
        console.log('\n🎉 完整库存快照数据生成完成!');
        console.log(`📊 处理统计:`);
        console.log(`   🏷️ 处理ASIN组合: ${processedGroups} 个`);
        console.log(`   📝 生成快照记录: ${totalInserted} 条`);
        console.log(`   📦 处理批次: ${processedBatches} 个`);
        console.log(`   ⏱️ 总耗时: ${(totalDuration/1000).toFixed(1)} 秒`);
        console.log(`   ⚡ 平均每组合: ${avgTimePerGroup.toFixed(1)} 毫秒`);
        console.log(`   🏷️ 批次ID: ${batchId}`);

    } catch (error) {
        console.error('❌ 生成过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

generateFullInventoryDeals().catch(console.error);