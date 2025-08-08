import { NextResponse } from 'next/server';
import { mysqlClient } from '@/lib/database/mysql-client';

export async function GET() {
  try {
    // 从MySQL的inventory_points表获取库存点列表
    const result = await mysqlClient.query(`
      SELECT DISTINCT marketplace 
      FROM inventory_points 
      WHERE marketplace IS NOT NULL AND marketplace != ''
      ORDER BY marketplace ASC
    `);
    
    const warehouseLocations = result.data?.map((row: any) => row.marketplace) || [];
    
    return NextResponse.json({
      success: true,
      data: warehouseLocations
    });
  } catch (error) {
    console.error('Warehouse locations query error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '获取库存点列表失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';