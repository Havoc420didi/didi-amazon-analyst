/**
 * 广告效果对比API
 * POST /api/ad-data/compare
 */

import { NextRequest, NextResponse } from 'next/server';
import { saiHuAdapter } from '@/lib/adapters/saihu-adapter';
import { statisticsCache, CacheKeys } from '@/lib/database/cache-manager';
import { z } from 'zod';

// 请求体验证schema
const compareQuerySchema = z.object({
  asins: z.array(z.string().regex(/^[A-Z0-9]{8,15}$/i)).min(2).max(10),
  marketplaces: z.array(z.string()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metrics: z.array(z.enum(['ctr', 'cvr', 'cpc', 'roas', 'acoas', 'spend', 'sales'])).default(['ctr', 'roas', 'acoas']),
  includeRanking: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    
    const validationResult = compareQuerySchema.safeParse(body);
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

    const params = validationResult.data;
    
    // 生成缓存键
    const cacheKey = statisticsCache.generateKey(`${CacheKeys.AD_SUMMARY}:compare`, params);
    
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

    // 获取对比数据
    const comparisonData = await saiHuAdapter.getAdPerformanceComparison({
      asins: params.asins,
      marketplaces: params.marketplaces,
      startDate: params.startDate,
      endDate: params.endDate,
    });
    
    // 计算对比统计
    const statistics = calculateComparisonStatistics(comparisonData, params.metrics);
    
    // 生成对比洞察
    const insights = generateComparisonInsights(comparisonData, statistics);
    
    const responseData = {
      comparison: comparisonData,
      statistics,
      insights,
      metadata: {
        totalAsins: params.asins.length,
        comparedAsins: comparisonData.length,
        metrics: params.metrics,
        period: {
          startDate: params.startDate,
          endDate: params.endDate,
        },
        includeRanking: params.includeRanking,
      },
    };
    
    // 缓存结果
    statisticsCache.set(cacheKey, responseData, 15 * 60 * 1000); // 15分钟缓存
    
    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('广告效果对比失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '广告效果对比失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 计算对比统计数据
 */
function calculateComparisonStatistics(
  data: Array<{ asin: string; marketplace: string; metrics: any; ranking: number }>,
  selectedMetrics: string[]
): any {
  if (data.length === 0) return {};
  
  const statistics: any = {
    summary: {
      totalProducts: data.length,
      averageRanking: data.reduce((sum, item) => sum + item.ranking, 0) / data.length,
    },
    metrics: {},
  };
  
  // 为每个指标计算统计数据
  selectedMetrics.forEach(metric => {
    const values = data.map(item => (item.metrics as any)[metric] || 0);
    
    statistics.metrics[metric] = {
      min: Math.min(...values),
      max: Math.max(...values),
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: calculateMedian(values),
      standardDeviation: calculateStandardDeviation(values),
    };
  });
  
  // 计算表现分层
  statistics.performanceTiers = {
    excellent: data.filter(item => item.ranking <= Math.ceil(data.length * 0.2)).length,
    good: data.filter(item => item.ranking > Math.ceil(data.length * 0.2) && item.ranking <= Math.ceil(data.length * 0.6)).length,
    average: data.filter(item => item.ranking > Math.ceil(data.length * 0.6) && item.ranking <= Math.ceil(data.length * 0.8)).length,
    poor: data.filter(item => item.ranking > Math.ceil(data.length * 0.8)).length,
  };
  
  return statistics;
}

/**
 * 生成对比洞察
 */
function generateComparisonInsights(
  data: Array<{ asin: string; marketplace: string; metrics: any; ranking: number }>,
  statistics: any
): string[] {
  const insights: string[] = [];
  
  if (data.length === 0) return insights;
  
  // 最佳表现者
  const topPerformer = data.find(item => item.ranking === 1);
  if (topPerformer) {
    insights.push(`表现最佳的产品是 ${topPerformer.asin}，ROAS为 ${topPerformer.metrics.roas.toFixed(2)}`);
  }
  
  // ROAS分析
  if (statistics.metrics.roas) {
    const roasStats = statistics.metrics.roas;
    if (roasStats.max / roasStats.min > 2) {
      insights.push(`产品间ROAS差异显著，最高${roasStats.max.toFixed(2)}，最低${roasStats.min.toFixed(2)}`);
    }
    
    if (roasStats.average < 2) {
      insights.push('整体ROAS偏低，建议优化广告策略以提升投资回报率');
    }
  }
  
  // ACOAS分析
  if (statistics.metrics.acoas) {
    const acoasStats = statistics.metrics.acoas;
    const highAcoasCount = data.filter(item => item.metrics.acoas > 30).length;
    
    if (highAcoasCount > data.length / 2) {
      insights.push(`${highAcoasCount}个产品的ACOAS超过30%，广告成本占比较高`);
    }
  }
  
  // CTR分析
  if (statistics.metrics.ctr) {
    const ctrStats = statistics.metrics.ctr;
    const lowCtrCount = data.filter(item => item.metrics.ctr < 0.5).length;
    
    if (lowCtrCount > data.length / 3) {
      insights.push(`${lowCtrCount}个产品的CTR低于0.5%，建议优化广告创意和关键词`);
    }
  }
  
  // 表现差异分析
  const performanceVariation = statistics.metrics.roas?.standardDeviation || 0;
  if (performanceVariation > 1) {
    insights.push('产品间表现差异较大，建议针对不同产品制定差异化策略');
  }
  
  // 市场分布分析
  const marketplaces = [...new Set(data.map(item => item.marketplace))];
  if (marketplaces.length > 1) {
    insights.push(`产品分布在${marketplaces.length}个市场：${marketplaces.join(', ')}`);
  }
  
  return insights;
}

/**
 * 计算中位数
 */
function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * 计算标准差
 */
function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
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