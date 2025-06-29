import { NextResponse } from 'next/server';
import { db } from '@/db';
import { inventoryRecords } from '@/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db()
      .selectDistinct({ warehouse_location: inventoryRecords.warehouse_location })
      .from(inventoryRecords)
      .orderBy(inventoryRecords.warehouse_location);
    
    const warehouseLocations = result.map(r => r.warehouse_location);
    
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