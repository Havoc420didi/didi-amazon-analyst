import { NextRequest, NextResponse } from 'next/server';
import { mysqlClient } from '@/lib/database/mysql-client';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始测试 inventory_points 数据连接...');
    
    // 1. 测试基本连接
    const connectionTest = await mysqlClient.testConnection();
    console.log('数据库连接测试:', connectionTest);
    
    if (!connectionTest) {
      return NextResponse.json({
        success: false,
        message: '数据库连接失败',
        details: 'MySQL连接测试失败'
      });
    }
    
    // 2. 测试简单查询
    const simpleQuery = await mysqlClient.query('SELECT COUNT(*) as count FROM inventory_points');
    console.log('简单查询结果:', simpleQuery);
    
    // 3. 测试汇总查询（和API相同的查询）
    const summaryQuery = await mysqlClient.query(`
      SELECT 
        COUNT(DISTINCT asin) as total_products,
        COUNT(*) as total_points,
        SUM(total_inventory) as total_inventory,
        SUM(daily_sales_amount) as total_daily_sales,
        SUM(ad_spend) as total_ad_spend,
        SUM(CASE WHEN is_effective_point = 1 THEN 1 ELSE 0 END) as effective_points
      FROM inventory_points 
      WHERE data_date = '2025-07-27'
    `);
    console.log('汇总查询结果:', summaryQuery);
    
    // 4. 获取数据库状态
    const dbStatus = await mysqlClient.getDatabaseStatus();
    console.log('数据库状态:', dbStatus);
    
    return NextResponse.json({
      success: true,
      data: {
        connectionTest,
        simpleQuery: simpleQuery.data,
        summaryQuery: summaryQuery.data,
        dbStatus
      }
    });
    
  } catch (error) {
    console.error('测试API错误:', error);
    return NextResponse.json({
      success: false,
      message: '测试失败',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';