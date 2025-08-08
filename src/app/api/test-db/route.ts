import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function GET() {
  try {
    console.log('DATABASE_URL环境变量:', process.env.DATABASE_URL ? '已设置' : '未设置');
    console.log('DATABASE_URL值:', process.env.DATABASE_URL);
    
    // 简单测试数据库连接 - 查询用户表
    const result = await db().select().from(users).limit(1);
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
      userCount: result.length,
      result: result
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';