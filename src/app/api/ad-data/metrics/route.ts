/**
 * 广告指标数据API
 * GET /api/ad-data/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { saiHuAdapter } from '@/lib/adapters/saihu-adapter';
import { statisticsCache, CacheKeys } from '@/lib/database/cache-manager';
import { z } from 'zod';

// 响应类型：在汇总结构上可选叠加 filteredMetrics
type SummaryResponse = Awaited<ReturnType<typeof saiHuAdapter.getAdSummary>> & {
  filteredMetrics?: Record<string, number>;
};

// 请求参数验证schema
const metricsQuerySchema = z.object({
  asin: z.string().optional(),
  marketplace: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupBy: z.enum(['date', 'marketplace', 'asin']).optional(),
  metrics: z.string().transform(val => val ? val.split(',') : ['all']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    
    const validationResult = metricsQuerySchema.safeParse(rawParams);
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
    const cacheKey = statisticsCache.generateKey(CacheKeys.AD_SUMMARY, params);
    
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

    // 缓存未命中，从数据库获取数据
    const summaryData = await saiHuAdapter.getAdSummary({
      asin: params.asin,
      marketplace: params.marketplace,
      startDate: params.startDate,
      endDate: params.endDate,
    });
    
    // 根据请求的指标筛选数据
    let responseData: SummaryResponse = summaryData;
    
    if (params.metrics && !params.metrics.includes('all')) {
      const filteredMetrics: Record<string, number> = {};
      
      params.metrics.forEach(metric => {
        switch (metric) {
          case 'impressions':
            filteredMetrics.totalImpressions = summaryData.averageMetrics.impressions;
            break;
          case 'clicks':
            filteredMetrics.totalClicks = summaryData.averageMetrics.clicks;
            break;
          case 'spend':
            filteredMetrics.totalAdSpend = summaryData.totalAdSpend;
            break;
          case 'ctr':
            filteredMetrics.averageCTR = summaryData.averageMetrics.ctr;
            break;
          case 'cvr':
            filteredMetrics.averageCVR = summaryData.averageMetrics.cvr;
            break;
          case 'cpc':
            filteredMetrics.averageCPC = summaryData.averageMetrics.cpc;
            break;
          case 'roas':
            filteredMetrics.averageROAS = summaryData.averageMetrics.roas;
            break;
          case 'acoas':
            filteredMetrics.averageACOAS = summaryData.averageMetrics.acoas;
            break;
        }
      });
      
      responseData = {
        ...summaryData,
        filteredMetrics,
      };
    }
    
    // 缓存结果
    statisticsCache.set(cacheKey, responseData, 30 * 60 * 1000); // 30分钟缓存
    
    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('获取广告指标数据失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取广告指标数据失败',
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