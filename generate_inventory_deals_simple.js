#!/usr/bin/env node

// 简化版 inventory_deals 库存点快照表数据生成脚本
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

// 时间窗口配置
const TIME_WINDOWS = [
  { code: 'T1', days: 1, description: 'T-1 (1天)' },
  { code: 'T3', days: 3, description: 'T-3到T-1 (3天)' },
  { code: 'T7', days: 7, description: 'T-7到T-1 (7天)' },
  { code: 'T30', days: 30, description: 'T-30到T-1 (30天)' }
];

async function generateInventoryDealsSimple() {
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

        // 1. 获取前10个ASIN组合进行测试
        console.log('\\n📋 1. 获取测试ASIN-市场组合:');
        
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
            ORDER BY asin, marketplace_id
            LIMIT 10;
        `, [dataStartDate, targetDate]);
        
        console.log(`   找到 ${asinGroups.length} 个ASIN-市场组合进行测试`);

        // 2. 逐个处理ASIN组合
        for (const group of asinGroups) {
            console.log(`\\n🔄 处理 ${group.asin} @ ${group.marketplace_id}:`);
            
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
                try {
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
                        50 // processing_duration_ms
                    ]);
                    
                    console.log(`     ✅ ${timeWindow.code}: $${totalSalesAmount.toFixed(2)} sales, ${totalSalesQuantity} qty, ${windowRecords.length} records`);
                    
                } catch (insertError) {
                    console.error(`     ❌ ${timeWindow.code} 插入失败:`, insertError.message);
                }
            }
        }

        // 3. 验证结果
        console.log('\\n✅ 验证生成结果:');
        const verificationResult = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT time_window) as time_windows,
                SUM(total_sales_amount) as total_sales
            FROM inventory_deals 
            WHERE batch_id = $1;
        `, [batchId]);
        
        const result = verificationResult[0];
        console.log(`   生成记录总数: ${result.total_records}`);
        console.log(`   涉及ASIN数: ${result.unique_asins}`);
        console.log(`   时间窗口数: ${result.time_windows}`);
        console.log(`   总销售额: $${parseFloat(result.total_sales || 0).toFixed(2)}`);

        console.log('\\n🎉 inventory_deals 快照数据生成完成!');

    } catch (error) {
        console.error('❌ 生成过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

generateInventoryDealsSimple().catch(console.error);