#!/usr/bin/env node

// 验证扩展后的product_analytics表结构和数据完整性
const postgres = require('postgres');

const DATABASE_URL = "postgresql://amazon_analyst:amazon_analyst_2024@8.219.185.28:5432/amazon_analyst";

async function verifyExtendedSchema() {
    const sql = postgres(DATABASE_URL, {
        prepare: false,
        max: 10,
    });

    try {
        console.log('🔍 验证扩展后的 product_analytics 表结构\n');

        // 1. 检查新添加字段的存在性
        console.log('📊 1. 字段完整性检查:');
        
        const newFields = [
            // 库存相关字段
            'available_days', 'inbound_working', 'inbound_shipped', 'inbound_receiving',
            'reserved_inventory', 'unfulfillable_inventory', 'total_inbound_inventory',
            
            // 广告相关字段
            'ad_roas', 'organic_sales', 'sponsored_sales', 'organic_orders', 'sponsored_orders',
            'impression_share', 'lost_impression_share_budget', 'lost_impression_share_rank',
            
            // 流量和转化字段
            'unit_session_percentage', 'sessions_percentage_new', 'sessions_percentage_returning',
            'page_views_per_session', 'bounce_rate', 'avg_session_duration',
            
            // 业务表现字段
            'refund_amount', 'return_amount', 'defect_rate', 'review_count_new',
            'five_star_percentage', 'four_star_percentage', 'three_star_percentage',
            'two_star_percentage', 'one_star_percentage', 'customer_acquisition_cost', 'lifetime_value',
            
            // 竞争和市场分析
            'competitor_data', 'market_share', 'price_competitiveness_score',
            'organic_keywords_count', 'sponsored_keywords_count', 'avg_keyword_rank',
            
            // 季节性和趋势
            'seasonality_index', 'trend_indicator', 'trend_strength',
            'yoy_growth_rate', 'mom_growth_rate', 'wow_growth_rate',
            
            // 运营效率
            'inventory_turnover_ratio', 'days_of_supply', 'stockout_probability',
            'lead_time_days', 'reorder_point', 'safety_stock',
            
            // 财务字段
            'cogs', 'shipping_cost', 'fba_fees', 'storage_fees', 'referral_fees',
            'gross_profit', 'gross_margin', 'net_profit', 'net_margin', 'roi',
            
            // 营销字段
            'promotion_sales', 'promotion_orders', 'coupon_redemption_rate', 'lightning_deal_sales',
            'brand_rank', 'category_rank', 'subcategory_rank',
            
            // 数据质量字段
            'data_quality_score', 'data_completeness', 'last_updated_field',
            'api_sync_status', 'api_last_sync', 'api_sync_errors'
        ];

        // 查询表结构
        const tableStructure = await sql.unsafe(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'product_analytics' 
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        `);

        const existingFields = new Set(tableStructure.map(col => col.column_name));
        
        let missingFields = [];
        let presentFields = [];
        
        newFields.forEach(field => {
            if (existingFields.has(field)) {
                presentFields.push(field);
            } else {
                missingFields.push(field);
            }
        });

        console.log(`   ✅ 已添加字段: ${presentFields.length}/${newFields.length} (${(presentFields.length/newFields.length*100).toFixed(1)}%)`);
        
        if (missingFields.length > 0) {
            console.log(`   ❌ 缺失字段 (${missingFields.length}个):`);
            missingFields.forEach(field => console.log(`     - ${field}`));
        }

        // 2. 检查数据统计
        console.log('\n📈 2. 数据统计分析:');
        
        const basicStats = await sql.unsafe(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT data_date) as date_range,
                MIN(data_date) as earliest_date,
                MAX(data_date) as latest_date,
                -- 新字段数据填充情况
                COUNT(CASE WHEN available_days > 0 THEN 1 END) as records_with_available_days,
                COUNT(CASE WHEN ad_roas > 0 THEN 1 END) as records_with_ad_roas,
                COUNT(CASE WHEN organic_sales > 0 THEN 1 END) as records_with_organic_sales,
                COUNT(CASE WHEN unit_session_percentage > 0 THEN 1 END) as records_with_unit_session,
                COUNT(CASE WHEN api_sync_status IS NOT NULL THEN 1 END) as records_with_sync_status,
                -- 计算字段验证
                AVG(CASE WHEN sales_amount > 0 AND gross_margin > 0 THEN gross_margin ELSE NULL END) as avg_gross_margin,
                AVG(CASE WHEN ad_cost > 0 AND ad_roas > 0 THEN ad_roas ELSE NULL END) as avg_ad_roas
            FROM product_analytics;
        `);

        const stats = basicStats[0];
        console.log(`   📝 总记录数: ${stats.total_records}`);
        console.log(`   🏷️ 独特ASIN: ${stats.unique_asins}`);
        console.log(`   📅 数据日期范围: ${stats.earliest_date} 到 ${stats.latest_date}`);
        console.log(`   📊 数据填充情况:`);
        console.log(`     - 可售天数: ${stats.records_with_available_days} 条 (${(stats.records_with_available_days/stats.total_records*100).toFixed(1)}%)`);
        console.log(`     - 广告ROAS: ${stats.records_with_ad_roas} 条 (${(stats.records_with_ad_roas/stats.total_records*100).toFixed(1)}%)`);
        console.log(`     - 自然销售: ${stats.records_with_organic_sales} 条 (${(stats.records_with_organic_sales/stats.total_records*100).toFixed(1)}%)`);
        console.log(`     - 单位会话: ${stats.records_with_unit_session} 条 (${(stats.records_with_unit_session/stats.total_records*100).toFixed(1)}%)`);
        console.log(`     - 同步状态: ${stats.records_with_sync_status} 条 (${(stats.records_with_sync_status/stats.total_records*100).toFixed(1)}%)`);

        if (stats.avg_gross_margin) {
            console.log(`   💰 平均毛利率: ${(parseFloat(stats.avg_gross_margin) * 100).toFixed(2)}%`);
        }
        if (stats.avg_ad_roas) {
            console.log(`   📈 平均广告ROAS: ${parseFloat(stats.avg_ad_roas).toFixed(2)}`);
        }

        // 3. 索引验证
        console.log('\n🔍 3. 索引完整性检查:');
        
        const indexes = await sql.unsafe(`
            SELECT 
                indexname as index_name,
                tablename,
                indexdef
            FROM pg_indexes 
            WHERE tablename = 'product_analytics'
            AND indexname LIKE 'idx_analytics_%'
            ORDER BY indexname;
        `);

        console.log(`   📊 相关索引数量: ${indexes.length}`);
        
        const expectedIndexes = [
            'idx_analytics_inventory_extended',
            'idx_analytics_ad_performance', 
            'idx_analytics_sales_attribution',
            'idx_analytics_trends',
            'idx_analytics_profitability',
            'idx_analytics_competition',
            'idx_analytics_data_quality'
        ];

        expectedIndexes.forEach(expectedIndex => {
            const exists = indexes.find(idx => idx.index_name === expectedIndex);
            if (exists) {
                console.log(`   ✅ ${expectedIndex}`);
            } else {
                console.log(`   ❌ ${expectedIndex} (缺失)`);
            }
        });

        // 4. 数据质量验证
        console.log('\n🔍 4. 数据质量验证:');
        
        const qualityChecks = await sql.unsafe(`
            SELECT 
                -- 数据一致性检查
                COUNT(CASE WHEN sales_amount < 0 THEN 1 END) as negative_sales,
                COUNT(CASE WHEN ad_cost < 0 THEN 1 END) as negative_ad_cost,
                COUNT(CASE WHEN total_inventory < 0 THEN 1 END) as negative_inventory,
                
                -- 逻辑关系验证
                COUNT(CASE WHEN ad_roas > 0 AND ad_cost = 0 THEN 1 END) as invalid_roas,
                COUNT(CASE WHEN unit_session_percentage > 1 THEN 1 END) as invalid_unit_session,
                COUNT(CASE WHEN gross_margin > 1 THEN 1 END) as invalid_margin,
                
                -- 数据范围检查
                COUNT(CASE WHEN available_days > 365 THEN 1 END) as excessive_available_days,
                COUNT(CASE WHEN seasonality_index > 10 THEN 1 END) as excessive_seasonality,
                
                -- 必填字段空值检查
                COUNT(CASE WHEN asin IS NULL OR asin = '' THEN 1 END) as missing_asin,
                COUNT(CASE WHEN data_date IS NULL THEN 1 END) as missing_data_date
            FROM product_analytics;
        `);

        const quality = qualityChecks[0];
        
        // 数据异常报告
        let issueCount = 0;
        if (quality.negative_sales > 0) {
            console.log(`   ⚠️ 发现 ${quality.negative_sales} 条负销售额记录`);
            issueCount++;
        }
        if (quality.negative_ad_cost > 0) {
            console.log(`   ⚠️ 发现 ${quality.negative_ad_cost} 条负广告成本记录`);
            issueCount++;
        }
        if (quality.negative_inventory > 0) {
            console.log(`   ⚠️ 发现 ${quality.negative_inventory} 条负库存记录`);
            issueCount++;
        }
        if (quality.invalid_roas > 0) {
            console.log(`   ⚠️ 发现 ${quality.invalid_roas} 条无效ROAS记录 (ROAS>0但广告成本=0)`);
            issueCount++;
        }
        if (quality.invalid_unit_session > 0) {
            console.log(`   ⚠️ 发现 ${quality.invalid_unit_session} 条无效单位会话百分比 (>100%)`);
            issueCount++;
        }
        if (quality.invalid_margin > 0) {
            console.log(`   ⚠️ 发现 ${quality.invalid_margin} 条无效毛利率 (>100%)`);
            issueCount++;
        }
        if (quality.missing_asin > 0) {
            console.log(`   ❌ 发现 ${quality.missing_asin} 条缺失ASIN的记录`);
            issueCount++;
        }
        if (quality.missing_data_date > 0) {
            console.log(`   ❌ 发现 ${quality.missing_data_date} 条缺失日期的记录`);
            issueCount++;
        }

        if (issueCount === 0) {
            console.log('   ✅ 数据质量检查通过，未发现异常');
        }

        // 5. API字段覆盖率评估
        console.log('\n📋 5. API字段覆盖率评估:');
        
        const apiFieldCoverage = await sql.unsafe(`
            SELECT 
                'Core Product Fields' as category,
                COUNT(CASE WHEN asin IS NOT NULL AND asin != '' THEN 1 END) as covered,
                COUNT(*) as total
            FROM product_analytics
            
            UNION ALL
            
            SELECT 
                'Sales Fields' as category,
                COUNT(CASE WHEN sales_amount > 0 OR sales_quantity > 0 THEN 1 END) as covered,
                COUNT(*) as total
            FROM product_analytics
            
            UNION ALL
            
            SELECT 
                'Inventory Fields' as category,
                COUNT(CASE WHEN total_inventory > 0 OR available_days > 0 THEN 1 END) as covered,
                COUNT(*) as total
            FROM product_analytics
            
            UNION ALL
            
            SELECT 
                'Advertising Fields' as category,
                COUNT(CASE WHEN ad_cost > 0 OR impressions > 0 OR ad_roas > 0 THEN 1 END) as covered,
                COUNT(*) as total
            FROM product_analytics
            
            UNION ALL
            
            SELECT 
                'Traffic Fields' as category,
                COUNT(CASE WHEN sessions > 0 OR page_views > 0 OR unit_session_percentage > 0 THEN 1 END) as covered,
                COUNT(*) as total
            FROM product_analytics;
        `);

        apiFieldCoverage.forEach(coverage => {
            const percentage = coverage.total > 0 ? (coverage.covered / coverage.total * 100).toFixed(1) : '0.0';
            console.log(`   📊 ${coverage.category}: ${coverage.covered}/${coverage.total} (${percentage}%)`);
        });

        // 6. 最新记录样本展示
        console.log('\n📝 6. 最新记录样本:');
        
        const sampleRecords = await sql.unsafe(`
            SELECT 
                asin,
                data_date,
                sales_amount,
                ad_roas,
                available_days,
                gross_margin,
                api_sync_status,
                data_quality_score
            FROM product_analytics
            WHERE data_date = (SELECT MAX(data_date) FROM product_analytics)
            ORDER BY sales_amount DESC
            LIMIT 5;
        `);

        sampleRecords.forEach((record, index) => {
            console.log(`   ${index + 1}. ASIN: ${record.asin}`);
            console.log(`      日期: ${record.data_date}`);
            console.log(`      销售额: $${parseFloat(record.sales_amount || 0).toFixed(2)}`);
            console.log(`      广告ROAS: ${parseFloat(record.ad_roas || 0).toFixed(2)}`);
            console.log(`      可售天数: ${record.available_days || 0} 天`);
            console.log(`      毛利率: ${(parseFloat(record.gross_margin || 0) * 100).toFixed(2)}%`);
            console.log(`      同步状态: ${record.api_sync_status || 'N/A'}`);
            console.log(`      数据质量: ${parseFloat(record.data_quality_score || 0).toFixed(2)}`);
        });

        console.log('\n✅ product_analytics 表扩展验证完成!');
        
        // 总结报告
        console.log('\n📊 验证总结:');
        console.log(`   🔧 字段扩展: ${presentFields.length}/${newFields.length} (${(presentFields.length/newFields.length*100).toFixed(1)}%)`);
        console.log(`   📝 数据记录: ${stats.total_records} 条`);
        console.log(`   🏷️ 产品覆盖: ${stats.unique_asins} 个ASIN`);
        console.log(`   📅 时间范围: ${stats.earliest_date} 到 ${stats.latest_date}`);
        console.log(`   ⚠️ 数据质量问题: ${issueCount} 类`);
        
        if (presentFields.length === newFields.length && issueCount === 0) {
            console.log('   🎉 字段扩展成功，数据质量良好！');
        } else if (presentFields.length === newFields.length) {
            console.log('   ✅ 字段扩展成功，但存在数据质量问题需要处理');
        } else {
            console.log('   ⚠️ 字段扩展不完整，需要重新执行迁移脚本');
        }

    } catch (error) {
        console.error('❌ 验证过程中发生错误:', error.message);
        console.error('错误详情:', error.stack);
    } finally {
        await sql.end();
    }
}

verifyExtendedSchema().catch(console.error);