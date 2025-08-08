/**
 * 广告趋势数据API
 * GET /api/ad-data/trends
 */

import { NextRequest, NextResponse } from 'next/server';
import { saiHuAdapter } from '@/lib/adapters/saihu-adapter';
import { trendsCache, CacheKeys } from '@/lib/database/cache-manager';
import { z } from 'zod';

// 请求参数验证schema
const trendsQuerySchema = z.object({
  asin: z.string().optional(),
  marketplace: z.string().optional(),
  days: z.string().transform(val => Math.min(parseInt(val) || 30, 365)).optional(),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  metrics: z.string().transform(val => val ? val.split(',') : ['impressions', 'clicks', 'spend', 'ctr', 'acoas']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    
    const validationResult = trendsQuerySchema.safeParse(rawParams);
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
    const cacheKey = trendsCache.generateKey(CacheKeys.AD_TRENDS, params);
    
    // 尝试从缓存获取数据
    const cachedData = trendsCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // 缓存未命中，从数据库获取数据
    const trendsData = await saiHuAdapter.getAdTrends({
      asin: params.asin,
      marketplace: params.marketplace,
      days: params.days,
    });
    
    // 根据粒度聚合数据
    let aggregatedData = trendsData;
    
    if (params.granularity !== 'daily' && trendsData.length > 0) {
      aggregatedData = aggregateTrendsByGranularity(trendsData, params.granularity);
    }
    
    // 筛选指定的指标
    if (params.metrics && params.metrics.length > 0) {
      aggregatedData = aggregatedData.map(item => {
        const filteredMetrics: any = { date: item.date };
        
        params.metrics!.forEach(metric => {
          if (metric in item.metrics) {
            filteredMetrics[metric] = (item.metrics as any)[metric];
          }
        });
        
        return {
          date: item.date,
          metrics: filteredMetrics,
        };
      });
    }
    
    // 计算趋势指标
    const trendAnalysis = calculateTrendAnalysis(aggregatedData);
    
    const responseData = {
      trends: aggregatedData,
      analysis: trendAnalysis,
      granularity: params.granularity,
      period: {
        days: params.days || 30,
        startDate: aggregatedData[0]?.date,
        endDate: aggregatedData[aggregatedData.length - 1]?.date,
      },
      metrics: params.metrics,
    };
    
    // 缓存结果
    trendsCache.set(cacheKey, responseData, 15 * 60 * 1000); // 15分钟缓存
    
    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('获取广告趋势数据失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取广告趋势数据失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 按粒度聚合趋势数据
 */
function aggregateTrendsByGranularity(
  data: Array<{ date: string; metrics: any }>,
  granularity: 'weekly' | 'monthly'
): Array<{ date: string; metrics: any }> {
  const groups = new Map<string, Array<{ date: string; metrics: any }>>();
  
  data.forEach(item => {
    const date = new Date(item.date);
    let groupKey: string;
    
    if (granularity === 'weekly') {
      // 按周分组（周一为一周的开始）
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      groupKey = monday.toISOString().split('T')[0];
    } else {
      // 按月分组
      groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(item);
  });
  
  // 聚合每个分组的数据
  return Array.from(groups.entries()).map(([date, items]) => {
    const aggregatedMetrics: any = {};
    
    // 计算累加指标
    const sumMetrics = ['impressions', 'clicks', 'spend', 'sales'];
    sumMetrics.forEach(metric => {
      aggregatedMetrics[metric] = items.reduce((sum, item) => sum + (item.metrics[metric] || 0), 0);
    });
    
    // 计算平均指标
    const avgMetrics = ['ctr', 'cvr', 'cpc', 'roas', 'acoas'];
    avgMetrics.forEach(metric => {
      const values = items.map(item => item.metrics[metric] || 0).filter(v => v > 0);
      aggregatedMetrics[metric] = values.length > 0 
        ? values.reduce((sum, val) => sum + val, 0) / values.length
        : 0;
    });
    
    return {
      date,
      metrics: aggregatedMetrics,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 计算趋势分析
 */
function calculateTrendAnalysis(data: Array<{ date: string; metrics: any }>): any {
  if (data.length < 2) {
    return {
      trend: 'stable',
      growth: 0,
      volatility: 'low',
    };
  }
  
  const recent = data.slice(-7); // 最近7个数据点
  const earlier = data.slice(0, Math.min(7, data.length - 7)); // 之前7个数据点
  
  if (earlier.length === 0) {
    return {
      trend: 'stable',
      growth: 0,
      volatility: 'low',
    };
  }
  
  // 计算平均值
  const recentAvg = recent.reduce((sum, item) => sum + (item.metrics.spend || 0), 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, item) => sum + (item.metrics.spend || 0), 0) / earlier.length;
  
  // 计算增长率
  const growth = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;
  
  // 判断趋势
  let trend: 'up' | 'down' | 'stable';
  if (Math.abs(growth) < 5) {
    trend = 'stable';
  } else {
    trend = growth > 0 ? 'up' : 'down';
  }
  
  // 计算波动性
  const values = data.map(item => item.metrics.spend || 0);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0; // 变异系数
  
  let volatility: 'low' | 'medium' | 'high';
  if (cv < 0.2) {
    volatility = 'low';
  } else if (cv < 0.5) {
    volatility = 'medium';
  } else {
    volatility = 'high';
  }
  
  return {
    trend,
    growth: Math.round(growth * 100) / 100,
    volatility,
    coefficient_of_variation: Math.round(cv * 10000) / 10000,
  };
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