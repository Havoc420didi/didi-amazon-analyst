/**
 * 触发数据同步API
 * POST /api/ad-data/sync/trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 请求体验证schema
const triggerSyncSchema = z.object({
  taskType: z.enum(['product_analytics', 'fba_inventory', 'inventory_details', 'all']),
  force: z.boolean().default(false), // 是否强制同步（忽略上次同步时间）
  dryRun: z.boolean().default(false), // 是否为试运行（不实际执行同步）
});

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    
    const validationResult = triggerSyncSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数验证失败',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { taskType, force, dryRun } = validationResult.data;
    
    // 检查用户权限（这里可以添加认证逻辑）
    // TODO: 添加用户认证和权限检查
    
    // 如果是试运行，返回模拟结果
    if (dryRun) {
      return NextResponse.json({
        success: true,
        data: {
          message: '试运行模式：同步任务配置验证通过',
          taskType,
          estimatedDuration: getEstimatedDuration(taskType),
          affectedTables: getAffectedTables(taskType),
          force,
          dryRun: true,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // 实际触发同步（这里需要调用原始同步系统的接口或方法）
    const syncResult = await triggerActualSync(taskType, force);
    
    return NextResponse.json({
      success: true,
      data: {
        message: '同步任务已触发',
        taskType,
        taskId: syncResult.taskId,
        status: syncResult.status,
        startTime: syncResult.startTime,
        estimatedDuration: getEstimatedDuration(taskType),
        force,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('触发数据同步失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '触发数据同步失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 实际触发同步任务
 * 注意：这是一个占位函数，实际实现需要调用原始sync_saihu_erp系统的接口
 */
async function triggerActualSync(taskType: string, force: boolean): Promise<{
  taskId: string;
  status: string;
  startTime: string;
}> {
  // 生成任务ID
  const taskId = `sync_${taskType}_${Date.now()}`;
  
  // 记录同步任务开始
  console.log(`开始同步任务: ${taskType}, 强制模式: ${force}, 任务ID: ${taskId}`);
  
  // TODO: 这里需要实际调用原始同步系统
  // 可能的实现方式：
  // 1. 通过HTTP请求调用sync_saihu_erp的API接口
  // 2. 通过消息队列发送同步任务
  // 3. 直接调用sync_saihu_erp的Python模块（如果可能）
  
  // 目前返回模拟结果
  return {
    taskId,
    status: 'running',
    startTime: new Date().toISOString(),
  };
}

/**
 * 获取预估同步时间
 */
function getEstimatedDuration(taskType: string): string {
  const durations: Record<string, string> = {
    'product_analytics': '10-15分钟',
    'fba_inventory': '5-8分钟',
    'inventory_details': '8-12分钟',
    'all': '25-40分钟',
  };
  
  return durations[taskType] || '未知';
}

/**
 * 获取受影响的数据表
 */
function getAffectedTables(taskType: string): string[] {
  const tables: Record<string, string[]> = {
    'product_analytics': ['product_analytics'],
    'fba_inventory': ['fba_inventory'],
    'inventory_details': ['inventory_details'],
    'all': ['product_analytics', 'fba_inventory', 'inventory_details', 'inventory_points'],
  };
  
  return tables[taskType] || [];
}

// 支持OPTIONS请求（CORS预检）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}