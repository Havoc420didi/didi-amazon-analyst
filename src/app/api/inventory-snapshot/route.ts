/**
 * 库存快照ETL API路由
 * 提供手动触发、批量补数据、状态查询等接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { SnapshotETLController } from '@/lib/etl/inventory-snapshot-scheduler';

// POST: 手动触发快照生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, target_date, start_date, end_date } = body;
    
    if (action === 'manual_snapshot') {
      if (!target_date) {
        return NextResponse.json(
          { error: '请提供target_date参数 (YYYY-MM-DD格式)' },
          { status: 400 }
        );
      }
      
      const result = await SnapshotETLController.triggerManualSnapshot(target_date);
      return NextResponse.json(result);
      
    } else if (action === 'backfill') {
      if (!start_date || !end_date) {
        return NextResponse.json(
          { error: '请提供start_date和end_date参数' },
          { status: 400 }
        );
      }
      
      const result = await SnapshotETLController.triggerBackfill(start_date, end_date);
      return NextResponse.json(result);
      
    } else {
      return NextResponse.json(
        { error: '无效的action参数，支持: manual_snapshot, backfill' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('库存快照API错误:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '服务器内部错误',
        success: false 
      },
      { status: 500 }
    );
  }
}

// GET: 查询任务状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');
    
    const status = await SnapshotETLController.getTaskStatus(taskId || undefined);
    return NextResponse.json(status);
    
  } catch (error) {
    console.error('查询任务状态错误:', error);
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    );
  }
}