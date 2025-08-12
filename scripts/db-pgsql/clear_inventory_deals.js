#!/usr/bin/env node

// 清空 inventory_deals 库存点快照表数据
const { Client } = require('pg');

// 数据库连接配置
const config = {
    host: '8.219.185.28',
    port: 5432,
    database: 'amazon_analyst',
    user: 'amazon_analyst',
    password: 'amazon_analyst_2024',
    // 连接超时设置
    connectionTimeoutMillis: 10000,
    query_timeout: 30000
};

async function clearInventoryDeals() {
    const client = new Client(config);
    
    try {
        console.log('🗑️  开始清空 inventory_deals 库存点快照表数据\n');
        
        // 连接数据库
        await client.connect();
        console.log('✅ 数据库连接成功');
        
        // 1. 检查表是否存在
        console.log('\n📋 1. 检查 inventory_deals 表是否存在:');
        
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'inventory_deals'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('❌ inventory_deals 表不存在');
            return;
        }
        
        console.log('✅ inventory_deals 表已存在');

        // 2. 获取当前表数据统计
        console.log('\n📊 2. 获取当前表数据统计:');
        
        const statsQuery = await client.query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT asin) as unique_asins,
                COUNT(DISTINCT snapshot_date) as unique_dates,
                COUNT(DISTINCT time_window) as unique_time_windows,
                MIN(snapshot_date) as earliest_date,
                MAX(snapshot_date) as latest_date
            FROM inventory_deals;
        `);
        
        const stats = statsQuery.rows[0];
        console.log(`   总记录数: ${stats.total_records}`);
        console.log(`   独特ASIN数: ${stats.unique_asins}`);
        console.log(`   快照日期数: ${stats.unique_dates}`);
        console.log(`   时间窗口数: ${stats.unique_time_windows}`);
        console.log(`   日期范围: ${stats.earliest_date || '无'} 到 ${stats.latest_date || '无'}`);

        if (parseInt(stats.total_records) === 0) {
            console.log('✅ 表已经是空的，无需清空');
            return;
        }

        // 3. 确认操作
        console.log('\n⚠️  3. 确认清空操作:');
        console.log(`   即将删除 ${stats.total_records} 条记录`);
        console.log(`   涉及 ${stats.unique_asins} 个ASIN`);
        console.log(`   覆盖 ${stats.unique_dates} 个快照日期`);
        
        // 4. 执行清空操作
        console.log('\n🗑️  4. 执行清空操作...');
        
        const deleteResult = await client.query(`
            DELETE FROM inventory_deals;
        `);
        
        console.log(`✅ 清空操作完成，删除了 ${deleteResult.rowCount} 条记录`);

        // 5. 验证清空结果
        console.log('\n🔍 5. 验证清空结果:');
        
        const verifyResult = await client.query(`
            SELECT COUNT(*) as remaining_records
            FROM inventory_deals;
        `);
        
        const remaining = parseInt(verifyResult.rows[0].remaining_records);
        
        if (remaining === 0) {
            console.log('✅ 验证通过：表已完全清空');
            console.log(`   删除记录数: ${stats.total_records}`);
            console.log(`   剩余记录数: ${remaining}`);
        } else {
            console.log('❌ 验证失败：表中仍有数据');
            console.log(`   剩余记录数: ${remaining}`);
        }

        // 6. 可选：重置自增ID（如果表有自增主键）
        console.log('\n🔄 6. 重置自增ID (如果适用):');
        
        try {
            await client.query(`
                ALTER SEQUENCE IF EXISTS inventory_deals_id_seq RESTART WITH 1;
            `);
            console.log('✅ 自增ID已重置');
        } catch (seqError) {
            console.log('ℹ️  表没有自增序列，或重置失败（这是正常的）');
        }

        console.log('\n🎉 inventory_deals 表清空操作完成！');

    } catch (error) {
        console.error('❌ 清空过程中发生错误:', error.message);
        if (error.code) {
            console.error('错误代码:', error.code);
        }
    } finally {
        try {
            await client.end();
            console.log('🔌 数据库连接已关闭');
        } catch (closeError) {
            console.error('关闭连接时出错:', closeError.message);
        }
    }
}

// 如果直接运行此脚本，则执行清空操作
if (require.main === module) {
    clearInventoryDeals().catch(console.error);
}

module.exports = { clearInventoryDeals };
