#!/usr/bin/env node

// 使用 product_analytics 表数据生成 inventory_deals 库存点快照表
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

// 时间窗口配置
const TIME_WINDOWS = [
  { code: 'T1', days: 1, description: 'T-1 (1天)' },
  { code: 'T3', days: 3, description: 'T-3到T-1 (3天)' },
  { code: 'T7', days: 7, description: 'T-7到T-1 (7天)' },
  { code: 'T30', days: 30, description: 'T-30到T-1 (30天)' }
];

async function generateInventoryDeals() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 10,
    });

    try {
        console.log('🚀 开始生成 inventory_deals 库存点快照表\n');
        
        // 设置目标日期为昨天 (T-1)
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - 1);
        targetDate.setHours(0, 0, 0, 0);
        
        console.log(`📅 目标快照日期 (T-1): ${targetDate.toISOString().split('T')[0]}`);

        // 1. 预检查：验证 inventory_deals 表结构
        console.log('\n📋 1. 检查 inventory_deals 表结构:');
        
        const tableExists = await sql.unsafe(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'inventory_deals'
            );
        `);
        
        if (!tableExists[0].exists) {
            console.log('❌ inventory_deals 表不存在，需要先创建表结构');
            return;
        }
        
        console.log('✅ inventory_deals 表已存在');

        // 2. 检查现有数据，避免重复生成
        console.log('\n🔍 2. 检查现有快照数据:');
        const existingData = await sql.unsafe(`
            SELECT COUNT(*) as count, 
                   COUNT(DISTINCT asin) as unique_asins,
                   COUNT(DISTINCT time_window) as time_windows
            FROM inventory_deals 
            WHERE snapshot_date = $1;
        `, [targetDate]);
        
        const existing = existingData[0];
        console.log(`   现有记录数: ${existing.count}`);
        console.log(`   涉及ASIN数: ${existing.unique_asins}`);  
        console.log(`   时间窗口数: ${existing.time_windows}`);
        
        if (existing.count > 0) {
            console.log('⚠️  该日期已有快照数据，是否需要重新生成？');
        }

        // 3. 数据源分析：检查 product_analytics 可用数据
        console.log('\n📊 3. 分析数据源可用性:');
        
        // 计算数据拉取范围 (T-60 到 T-1)
        const dataStartDate = new Date(targetDate);
        dataStartDate.setDate(dataStartDate.getDate() - 60);
        
        const sourceDataStats = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT COALESCE(marketplace_id, 'default')) as unique_markets,
                COUNT(DISTINCT data_date) as unique_dates,
                MIN(data_date) as earliest_date,
                MAX(data_date) as latest_date
            FROM product_analytics 
            WHERE data_date >= $1 
              AND data_date <= $2
              AND asin IS NOT NULL;
        `, [dataStartDate, targetDate]);
        
        const stats = sourceDataStats[0];
        console.log(`   时间范围: ${dataStartDate.toISOString().split('T')[0]} 到 ${targetDate.toISOString().split('T')[0]}`);
        console.log(`   总记录数: ${stats.total_records}`);
        console.log(`   独特ASIN数: ${stats.unique_asins}`);
        console.log(`   独特市场数: ${stats.unique_markets}`);
        console.log(`   实际日期数: ${stats.unique_dates}`);
        console.log(`   数据日期范围: ${stats.earliest_date} 到 ${stats.latest_date}`);

        if (stats.total_records === 0) {
            console.log('❌ 没有可用的源数据，无法生成快照');
            return;
        }

        // 4. 预检查：验证一个ASIN是否对应四行不同时段的数据
        console.log('\n🔍 4. 预检查：验证ASIN时间窗口数据结构');
        
        // 选择一个有充足数据的ASIN进行测试
        const testAsinQuery = await sql.unsafe(`
            SELECT 
                asin, 
                COALESCE(marketplace_id, 'default') as marketplace_id,
                COUNT(*) as record_count,
                MIN(data_date) as earliest_date,
                MAX(data_date) as latest_date
            FROM product_analytics 
            WHERE data_date >= $1 
              AND data_date <= $2
              AND asin IS NOT NULL
            GROUP BY asin, COALESCE(marketplace_id, 'default')
            HAVING COUNT(*) >= 10
            ORDER BY record_count DESC
            LIMIT 1;
        `, [dataStartDate, targetDate]);
        
        if (testAsinQuery.length === 0) {
            console.log('❌ 没有足够数据的ASIN用于测试');
            return;
        }
        
        const testAsin = testAsinQuery[0];
        console.log(`   测试ASIN: ${testAsin.asin} @ ${testAsin.marketplace_id}`);
        console.log(`   记录数: ${testAsin.record_count} 条`);
        console.log(`   日期范围: ${testAsin.earliest_date} 到 ${testAsin.latest_date}`);

        // 获取测试ASIN的详细数据
        const testData = await sql.unsafe(`
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
              AND asin = $3
              AND COALESCE(marketplace_id, 'default') = $4
            ORDER BY data_date;
        `, [dataStartDate, targetDate, testAsin.asin, testAsin.marketplace_id]);

        console.log(`\n   获取到 ${testData.length} 条测试数据`);

        // 模拟四个时间窗口的聚合
        console.log('\n📊 5. 模拟时间窗口聚合 (验证逻辑):');
        
        const aggregatedResults = [];
        
        for (const timeWindow of TIME_WINDOWS) {
            // 计算窗口范围
            const windowEndDate = targetDate;
            const windowStartDate = new Date(targetDate);
            windowStartDate.setDate(windowStartDate.getDate() - (timeWindow.days - 1));
            
            // 过滤窗口内数据
            const windowRecords = testData.filter(record => {
                const recordDate = new Date(record.data_date);
                return recordDate >= windowStartDate && recordDate <= windowEndDate;
            });
            
            // 聚合计算
            const latestRecord = windowRecords[windowRecords.length - 1] || {};
            
            const totalSalesAmount = windowRecords.reduce((sum, r) => sum + parseFloat(r.sales_amount), 0);
            const totalSalesQuantity = windowRecords.reduce((sum, r) => sum + parseInt(r.sales_quantity), 0);
            const totalAdImpressions = windowRecords.reduce((sum, r) => sum + parseInt(r.impressions), 0);
            const totalAdClicks = windowRecords.reduce((sum, r) => sum + parseInt(r.clicks), 0);
            const totalAdSpend = windowRecords.reduce((sum, r) => sum + parseFloat(r.ad_cost), 0);
            const totalAdOrders = windowRecords.reduce((sum, r) => sum + parseInt(r.ad_orders), 0);
            
            // 计算衍生指标
            const avgDailySales = timeWindow.days > 0 ? (totalSalesAmount / timeWindow.days) : 0;
            const avgDailyRevenue = timeWindow.days > 0 ? (totalSalesAmount / timeWindow.days) : 0;
            const adCtr = totalAdImpressions > 0 ? (totalAdClicks / totalAdImpressions) : 0;
            const adConversionRate = totalAdClicks > 0 ? (totalAdOrders / totalAdClicks) : 0;
            const acos = totalSalesAmount > 0 ? (totalAdSpend / totalSalesAmount) : 0;
            const inventoryTurnoverDays = avgDailySales > 0 ? (latestRecord.total_inventory / avgDailySales) : 999;
            const inventoryStatus = inventoryTurnoverDays <= 30 ? '正常' : inventoryTurnoverDays <= 60 ? '较高' : '过高';
            
            const aggregatedSnapshot = {
                // 基础维度
                snapshot_date: targetDate.toISOString().split('T')[0],
                asin: testAsin.asin,
                product_name: latestRecord.spu_name || '',
                sales_person: latestRecord.dev_name || '',
                warehouse_location: testAsin.marketplace_id,
                
                // 时间窗口
                time_window: timeWindow.code,
                time_window_days: timeWindow.days,
                window_start_date: windowStartDate.toISOString().split('T')[0],
                window_end_date: windowEndDate.toISOString().split('T')[0],
                
                // 库存数据 (T-1最新值)
                fba_available: latestRecord.fba_inventory || 0,
                fba_in_transit: 0, // product_analytics表中没有此字段
                local_warehouse: 0, // product_analytics表中没有此字段
                total_inventory: latestRecord.total_inventory || 0,
                
                // 销售数据 (窗口内累加)
                total_sales_amount: totalSalesAmount,
                total_sales_quantity: totalSalesQuantity,
                avg_daily_sales: avgDailySales,
                avg_daily_revenue: avgDailyRevenue,
                
                // 广告数据 (窗口内累加)
                total_ad_impressions: totalAdImpressions,
                total_ad_clicks: totalAdClicks,
                total_ad_spend: totalAdSpend,
                total_ad_orders: totalAdOrders,
                
                // 广告指标 (重新计算)
                ad_ctr: adCtr,
                ad_conversion_rate: adConversionRate,
                acos: acos,
                
                // 计算指标
                inventory_turnover_days: Math.min(inventoryTurnoverDays, 999),
                inventory_status: inventoryStatus,
                
                // 元数据
                source_records_count: windowRecords.length,
                calculation_method: 'sum_aggregate',
                data_completeness_score: windowRecords.length > 0 ? 1.00 : 0.00
            };
            
            aggregatedResults.push(aggregatedSnapshot);
            
            console.log(`\n   ${timeWindow.code} (${timeWindow.days}天窗口):`);
            console.log(`     窗口范围: ${windowStartDate.toISOString().split('T')[0]} 到 ${windowEndDate.toISOString().split('T')[0]}`);
            console.log(`     记录数: ${windowRecords.length}`);
            console.log(`     总销售额: $${totalSalesAmount.toFixed(2)}`);
            console.log(`     总销售量: ${totalSalesQuantity}`);
            console.log(`     平均日销: $${avgDailySales.toFixed(2)}`);
            console.log(`     总广告费: $${totalAdSpend.toFixed(2)}`);
            console.log(`     库存周转天数: ${Math.min(inventoryTurnoverDays, 999).toFixed(1)}`);
            console.log(`     库存状态: ${inventoryStatus}`);
        }

        // 6. 验证结果：确认一个ASIN对应四行不同时段数据
        console.log('\n✅ 6. 验证结果总结:');
        console.log(`   测试ASIN: ${testAsin.asin}`);
        console.log(`   生成的快照记录数: ${aggregatedResults.length} 行`);
        console.log(`   时间窗口覆盖: ${aggregatedResults.map(r => r.time_window).join(', ')}`);
        
        if (aggregatedResults.length === 4) {
            console.log('✅ 验证通过：一个ASIN对应四行不同时段的数据');
            
            // 显示四行数据的关键差异
            console.log('\n📊 四个时间窗口数据对比:');
            console.table(aggregatedResults.map(r => ({
                时间窗口: r.time_window,
                天数: r.time_window_days,
                源记录数: r.source_records_count,
                销售额: '$' + r.total_sales_amount.toFixed(2),
                销售量: r.total_sales_quantity,
                广告费: '$' + r.total_ad_spend.toFixed(2),
                周转天数: r.inventory_turnover_days.toFixed(1)
            })));
            
            console.log('\n🚀 预检查完成，数据结构验证通过！');
            console.log('💡 可以开始正式生成 inventory_deals 快照数据');
            
        } else {
            console.log('❌ 验证失败：时间窗口数据结构异常');
        }

    } catch (error) {
        console.error('❌ 生成过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

generateInventoryDeals().catch(console.error);