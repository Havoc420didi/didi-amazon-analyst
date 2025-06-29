import { NextResponse } from 'next/server';
import { getSalesPersonList } from '@/models/inventory';

export async function GET() {
  try {
    const salesPersons = await getSalesPersonList();
    
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