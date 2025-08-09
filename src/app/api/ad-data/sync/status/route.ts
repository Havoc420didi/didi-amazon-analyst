/**
 * 数据同步状态API
 * GET /api/ad-data/sync/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { saiHuAdapter } from '@/lib/adapters/saihu-adapter';
import { pgClient as mysqlClient } from '@/lib/database/pg-client';
import { statisticsCache, CacheKeys } from '@/lib/database/cache-manager';

export async function GET(request: NextRequest) {
  try {
    // 生成缓存键
    const cacheKey = CacheKeys.SYNC_STATUS;
    
    // 尝试从缓存获取数据
    const cachedData = statisticsCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // 获取同步状态
    const syncStatuses = await saiHuAdapter.getSyncStatus();
    
    // 获取数据库连接状态
    const dbStatus = await mysqlClient.getDatabaseStatus();
    
    // 获取缓存统计
    const cacheStats = statisticsCache.getStats();
    
    // 构造响应数据
    const responseData = {
      database: {
        connected: dbStatus.connected,
        version: dbStatus.version,
        activeConnections: dbStatus.activeConnections,
        totalConnections: dbStatus.totalConnections,
      },
      syncTasks: syncStatuses,
      cache: {
        totalItems: cacheStats.totalItems,
        expiredItems: cacheStats.expiredItems,
        memoryUsage: cacheStats.memoryUsage,
      },
      system: {
        lastCheckTime: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        environment: process.env.NODE_ENV,
      },
      healthCheck: {
        overall: 'healthy',
        checks: {
          database: dbStatus.connected ? 'pass' : 'fail',
          syncTasks: syncStatuses.some(s => s.status === 'failed') ? 'warning' : 'pass',
          cache: cacheStats.expiredItems > 100 ? 'warning' : 'pass',
        },
      },
    };
    
    // 计算整体健康状态
    const failedChecks = Object.values(responseData.healthCheck.checks).filter(status => status === 'fail').length;
    const warningChecks = Object.values(responseData.healthCheck.checks).filter(status => status === 'warning').length;
    
    if (failedChecks > 0) {
      responseData.healthCheck.overall = 'unhealthy';
    } else if (warningChecks > 0) {
      responseData.healthCheck.overall = 'warning';
    } else {
      responseData.healthCheck.overall = 'healthy';
    }
    
    // 缓存结果（较短的缓存时间，确保状态信息的实时性）
    statisticsCache.set(cacheKey, responseData, 2 * 60 * 1000); // 2分钟缓存
    
    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('获取同步状态失败:', error);
    
    // 返回错误状态但仍提供部分信息
    const errorData = {
      database: {
        connected: false,
        error: error instanceof Error ? error.message : '连接失败',
      },
      syncTasks: [],
      system: {
        lastCheckTime: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
        environment: process.env.NODE_ENV,
      },
      healthCheck: {
        overall: 'unhealthy',
        checks: {
          database: 'fail',
          syncTasks: 'unknown',
          cache: 'unknown',
        },
      },
    };
    
    return NextResponse.json(
      {
        success: false,
        data: errorData,
        error: '获取同步状态失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 支持OPTIONS请求（CORS预检）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}