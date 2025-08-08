/**
 * 广告数据看板API
 * GET /api/ad-data/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { saiHuAdapter } from '@/lib/adapters/saihu-adapter';
import { adDataCache, CacheKeys } from '@/lib/database/cache-manager';
import { z } from 'zod';

// 请求参数验证schema
const dashboardQuerySchema = z.object({
  asin: z.string().optional(),
  marketplace: z.string().optional(),
  salesPerson: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, 100)).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    
    const validationResult = dashboardQuerySchema.safeParse(rawParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '参数验证失败',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const params = validationResult.data;
    
    // 生成缓存键
    const cacheKey = adDataCache.generateKey(CacheKeys.AD_SUMMARY, params);
    
    // 尝试从缓存获取数据
    const cachedData = adDataCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // 缓存未命中，从数据库获取数据
    const dashboardData = await saiHuAdapter.getAdDashboard(params);
    
    // 缓存结果
    adDataCache.set(cacheKey, dashboardData, 10 * 60 * 1000); // 10分钟缓存
    
    return NextResponse.json({
      success: true,
      data: dashboardData,
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('获取广告看板数据失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取广告看板数据失败',
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