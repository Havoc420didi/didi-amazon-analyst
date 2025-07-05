import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/config';
import { rpaSystemStatus } from '@/db/schema';
import { desc } from 'drizzle-orm';

/**
 * RPA系统状态API
 * 接收和查询RPA系统运行状态
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // 验证数据
    if (!data.status || !data.timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // 更新RPA状态
    await db.insert(rpaSystemStatus).values({
      status: data.status,
      message: data.message || '',
      timestamp: data.timestamp,
      createdAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'RPA状态更新成功'
    });
    
  } catch (error) {
    console.error('RPA状态更新失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 获取最新的RPA状态
    const latestStatus = await db
      .select()
      .from(rpaSystemStatus)
      .orderBy(desc(rpaSystemStatus.createdAt))
      .limit(1);
    
    return NextResponse.json({
      success: true,
      status: latestStatus[0] || null
    });
    
  } catch (error) {
    console.error('获取RPA状态失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}