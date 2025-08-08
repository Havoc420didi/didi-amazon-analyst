import { NextResponse } from 'next/server';
import { mysqlClient } from '@/lib/database/mysql-client';

export async function GET() {
  try {
    // 从MySQL的inventory_points表获取销售人员列表
    const result = await mysqlClient.query(`
      SELECT DISTINCT sales_person 
      FROM inventory_points 
      WHERE sales_person IS NOT NULL AND sales_person != ''
      ORDER BY sales_person ASC
    `);
    
    const salesPersons = result.data?.map((row: any) => row.sales_person) || [];
    
    return NextResponse.json({
      success: true,
      data: salesPersons
    });
  } catch (error) {
    console.error('Sales persons query error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '获取业务员列表失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';