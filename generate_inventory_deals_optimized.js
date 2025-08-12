#!/usr/bin/env node

// 优化版 inventory_deals 库存点快照表数据生成脚本
// 改进与 product_analytics 表的字段映射
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

// 时间窗口配置
const TIME_WINDOWS = [
  { code: 'T1', days: 1, description: 'T-1 (1天)' },
  { code: 'T3', days: 3, description: 'T-3到T-1 (3天)' },
  { code: 'T7', days: 7, description: 'T-7到T-1 (7天)' },
  { code: 'T30', days: 30, description: 'T-30到T-1 (30天)' }
];

async function generateOptimizedInventoryDeals() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 30,
    });

    try {
        console.log('🚀 开始优化生成 inventory_deals 库存点快照表数据\n');
        
        const startTime = Date.now();
        
        // 设置目标日期为昨天 (T-1)
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - 1);
        targetDate.setHours(0, 0, 0, 0);
        
        console.log(`📅 目标快照日期 (T-1): ${targetDate.toISOString().split('T')[0]}`);

        // 生成批次ID
        const batchId = `inventory_deals_optimized_${targetDate.toISOString().split('T')[0]}_${Date.now()}`;
        console.log(`📦 批次ID: ${batchId}`);

        // 1. 获取所有需要聚合的ASIN组合（改进字段映射）
        console.log('\n📋 1. 获取所有ASIN-市场组合:');
        
        const dataStartDate = new Date(targetDate);
        dataStartDate.setDate(dataStartDate.getDate() - 60);
        
        const asinGroups = await sql.unsafe(`
            SELECT 
                asin,
                COALESCE(marketplace_id, 'default') as marketplace_id,
                COUNT(*) as record_count,
                MAX(COALESCE(dev_name, '')) as dev_name,
                MAX(COALESCE(title, spu_name, '')) as product_name,
                MAX(COALESCE(brand_name, brand, '')) as brand_name,
                MAX(COALESCE(category_name, '')) as category_name,
                MAX(COALESCE(sku, '')) as sku,
                MAX(COALESCE(operator_name, dev_name, '')) as sales_person
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

        // 3. 批量生成快照数据（改进字段映射）
        console.log('\n⚡ 3. 开始批量生成快照数据:');
        
        const BATCH_SIZE = 25;
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
                    // 获取该组合的源数据（改进字段映射）
                    const sourceData = await sql.unsafe(`
                        SELECT 
                            asin,
                            data_date,
                            COALESCE(marketplace_id, 'default') as marketplace_id,
                            COALESCE(dev_name, '') as dev_name,
                            COALESCE(operator_name, dev_name, '') as sales_person,
                            COALESCE(title, spu_name, '') as product_name,
                            COALESCE(brand_name, brand, '') as brand_name,
                            COALESCE(category_name, '') as category_name,
                            COALESCE(sku, '') as sku,
                            
                            -- 库存数据（改进映射）
                            COALESCE(fba_inventory, 0) as fba_available,
                            COALESCE(available_days, 0) as fba_in_transit, -- 使用available_days作为在途库存
                            COALESCE(total_inventory - fba_inventory, 0) as local_warehouse, -- 计算本地仓库存
                            COALESCE(total_inventory, 0) as total_inventory,
                            
                            -- 销售数据
                            COALESCE(sales_amount, 0) as sales_amount,
                            COALESCE(sales_quantity, 0) as sales_quantity,
                            
                            -- 广告数据
                            COALESCE(impressions, 0) as impressions,
                            COALESCE(clicks, 0) as clicks,
                            COALESCE(ad_cost, 0) as ad_cost,
                            COALESCE(ad_orders, 0) as ad_orders,
                            COALESCE(ad_sales, 0) as ad_sales,
                            
                            -- 其他指标
                            COALESCE(sessions, 0) as sessions,
                            COALESCE(page_views, 0) as page_views,
                            COALESCE(rating, 0) as rating,
                            COALESCE(rating_count, 0) as rating_count,
                            COALESCE(profit_amount, 0) as profit_amount,
                            COALESCE(profit_rate, 0) as profit_rate,
                            COALESCE(buy_box_price, 0) as buy_box_price
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
                        
                        // 聚合计算（改进逻辑）
                        const latestRecord = windowRecords.length > 0 
                            ? windowRecords[windowRecords.length - 1] 
                            : { 
                                dev_name: group.dev_name, 
                                sales_person: group.sales_person,
                                product_name: group.product_name, 
                                fba_available: 0, 
                                total_inventory: 0 
                            };
                        
                        // 销售数据聚合
                        const totalSalesAmount = windowRecords.reduce((sum, r) => sum + parseFloat(r.sales_amount || 0), 0);
                        const totalSalesQuantity = windowRecords.reduce((sum, r) => sum + parseInt(r.sales_quantity || 0), 0);
                        const totalAdSales = windowRecords.reduce((sum, r) => sum + parseFloat(r.ad_sales || 0), 0);
                        
                        // 广告数据聚合
                        const totalAdImpressions = windowRecords.reduce((sum, r) => sum + parseInt(r.impressions || 0), 0);
                        const totalAdClicks = windowRecords.reduce((sum, r) => sum + parseInt(r.clicks || 0), 0);
                        const totalAdSpend = windowRecords.reduce((sum, r) => sum + parseFloat(r.ad_cost || 0), 0);
                        const totalAdOrders = windowRecords.reduce((sum, r) => sum + parseInt(r.ad_orders || 0), 0);
                        
                        // 其他指标聚合
                        const totalSessions = windowRecords.reduce((sum, r) => sum + parseInt(r.sessions || 0), 0);
                        const totalPageViews = windowRecords.reduce((sum, r) => sum + parseInt(r.page_views || 0), 0);
                        const totalProfit = windowRecords.reduce((sum, r) => sum + parseFloat(r.profit_amount || 0), 0);
                        
                        // 计算衍生指标（改进算法）
                        const avgDailySales = timeWindow.days > 0 ? (totalSalesQuantity / timeWindow.days) : 0;
                        const avgDailyRevenue = timeWindow.days > 0 ? (totalSalesAmount / timeWindow.days) : 0;
                        const avgDailyProfit = timeWindow.days > 0 ? (totalProfit / timeWindow.days) : 0;
                        
                        // 广告指标重新计算
                        const adCtr = totalAdImpressions > 0 ? (totalAdClicks / totalAdImpressions) : 0;
                        const adConversionRate = totalAdClicks > 0 ? (totalAdOrders / totalAdClicks) : 0;
                        const acos = totalAdSales > 0 ? (totalAdSpend / totalAdSales) : 0;
                        
                        // 库存周转天数计算（改进）
                        let inventoryTurnoverDays = 999;
                        if (avgDailySales > 0 && latestRecord.total_inventory > 0) {
                            inventoryTurnoverDays = latestRecord.total_inventory / avgDailySales;
                        } else if (avgDailySales > 0 && latestRecord.total_inventory === 0) {
                            inventoryTurnoverDays = 0; // 无库存
                        }
                        
                        // 库存状态判断（改进逻辑）
                        let inventoryStatus = '正常';
                        if (latestRecord.total_inventory === 0) {
                            inventoryStatus = '断货';
                        } else if (inventoryTurnoverDays <= 7) {
                            inventoryStatus = '短缺';
                        } else if (inventoryTurnoverDays <= 30) {
                            inventoryStatus = '正常';
                        } else if (inventoryTurnoverDays <= 60) {
                            inventoryStatus = '充足';
                        } else {
                            inventoryStatus = '积压';
                        }
                        
                        // 数据完整性评分（改进）
                        const dataCompletenessScore = windowRecords.length > 0 ? 
                            Math.min(1.0, windowRecords.length / timeWindow.days) : 0.0;
                        
                        // 插入单条记录（改进字段映射）
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
                                fba_available = EXCLUDED.fba_available,
                                fba_in_transit = EXCLUDED.fba_in_transit,
                                local_warehouse = EXCLUDED.local_warehouse,
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
                                updated_at = CURRENT_TIMESTAMP;
                        `, [
                            targetDate.toISOString().split('T')[0], // snapshot_date
                            group.asin, // asin
                            latestRecord.product_name || group.product_name || '', // product_name
                            latestRecord.sales_person || group.sales_person || '', // sales_person
                            group.marketplace_id, // warehouse_location
                            timeWindow.code, // time_window
                            timeWindow.days, // time_window_days
                            windowStartDate.toISOString().split('T')[0], // window_start_date
                            windowEndDate.toISOString().split('T')[0], // window_end_date
                            latestRecord.fba_available || 0, // fba_available
                            latestRecord.fba_in_transit || 0, // fba_in_transit
                            latestRecord.local_warehouse || 0, // local_warehouse
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
                            'sum_aggregate_optimized', // calculation_method
                            dataCompletenessScore, // data_completeness_score
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
                COUNT(CASE WHEN total_inventory > 0 THEN 1 END) as records_with_inventory,
                COUNT(CASE WHEN product_name != '' THEN 1 END) as records_with_product_name
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
        console.log(`   🏷️ 有产品名称: ${result.records_with_product_name} (${(result.records_with_product_name/result.total_records*100).toFixed(1)}%)`);

        // 5. 字段映射质量检查
        console.log('\n🔍 5. 字段映射质量检查:');
        
        const mappingQualityCheck = await sql.unsafe(`
            SELECT 
                time_window,
                COUNT(*) as record_count,
                COUNT(CASE WHEN product_name != '' THEN 1 END) as with_product_name,
                COUNT(CASE WHEN sales_person != '' THEN 1 END) as with_sales_person,
                COUNT(CASE WHEN fba_available > 0 THEN 1 END) as with_fba_inventory,
                COUNT(CASE WHEN local_warehouse > 0 THEN 1 END) as with_local_inventory,
                AVG(data_completeness_score) as avg_completeness,
                COUNT(CASE WHEN inventory_status != '积压' THEN 1 END) as normal_status_count
            FROM inventory_deals 
            WHERE snapshot_date = $1 AND batch_id = $2
            GROUP BY time_window, time_window_days
            ORDER BY time_window_days;
        `, [targetDate, batchId]);
        
        console.log('   📊 字段映射质量报告:');
        mappingQualityCheck.forEach(check => {
            console.log(`     ${check.time_window}:`);
            console.log(`       📝 记录数: ${check.record_count}`);
            console.log(`       🏷️ 有产品名称: ${check.with_product_name} (${(check.with_product_name/check.record_count*100).toFixed(1)}%)`);
            console.log(`       👤 有业务员: ${check.with_sales_person} (${(check.with_sales_person/check.record_count*100).toFixed(1)}%)`);
            console.log(`       📦 有FBA库存: ${check.with_fba_inventory} (${(check.with_fba_inventory/check.record_count*100).toFixed(1)}%)`);
            console.log(`       🏪 有本地库存: ${check.with_local_inventory} (${(check.with_local_inventory/check.record_count*100).toFixed(1)}%)`);
            console.log(`       ✅ 平均完整性: ${parseFloat(check.avg_completeness || 0).toFixed(2)}`);
            console.log(`       📈 正常状态: ${check.normal_status_count} (${(check.normal_status_count/check.record_count*100).toFixed(1)}%)`);
        });

        const totalDuration = Date.now() - startTime;
        const avgTimePerGroup = totalDuration / processedGroups;
        
        console.log('\n🎉 优化版库存快照数据生成完成!');
        console.log(`📊 处理统计:`);
        console.log(`   🏷️ 处理ASIN组合: ${processedGroups} 个`);
        console.log(`   📝 生成快照记录: ${totalInserted} 条`);
        console.log(`   📦 处理批次: ${processedBatches} 个`);
        console.log(`   ⏱️ 总耗时: ${(totalDuration/1000).toFixed(1)} 秒`);
        console.log(`   ⚡ 平均每组合: ${avgTimePerGroup.toFixed(1)} 毫秒`);
        console.log(`   🏷️ 批次ID: ${batchId}`);
        console.log(`\n🔧 主要改进:`);
        console.log(`   ✅ 改进产品名称映射 (title > spu_name)`);
        console.log(`   ✅ 改进业务员映射 (operator_name > dev_name)`);
        console.log(`   ✅ 改进库存字段映射 (fba_inventory, available_days, total_inventory)`);
        console.log(`   ✅ 改进库存状态判断逻辑`);
        console.log(`   ✅ 改进数据完整性评分算法`);

    } catch (error) {
        console.error('❌ 生成过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

generateOptimizedInventoryDeals().catch(console.error); 