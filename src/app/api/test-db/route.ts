import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // 测试数据库连接
    const testQuery = await db().execute(sql`SELECT 1 as test`);
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: testQuery
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';