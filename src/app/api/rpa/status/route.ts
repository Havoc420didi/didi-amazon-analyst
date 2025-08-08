import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';

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
    
    // TODO: 实现RPA状态存储
    // 当前返回成功响应，后续可以添加数据库存储
    console.log('RPA状态更新:', data);
    
    return NextResponse.json({
      success: true,
      message: 'RPA状态更新成功',
      data: data
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
    // 返回默认的RPA状态信息
    const defaultStatus = {
      status: 'running',
      message: 'RPA系统运行正常',
      timestamp: new Date().toISOString(),
      lastCheck: new Date().toISOString(),
      services: {
        dataSync: 'active',
        scheduler: 'active',
        monitoring: 'active'
      }
    };
    
    return NextResponse.json({
      success: true,
      data: defaultStatus
    });
    
  } catch (error) {
    console.error('获取RPA状态失败:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}