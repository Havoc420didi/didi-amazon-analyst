/**
 * 单个ASIN详细数据API
 * GET /api/ad-data/asin/[asin]
 */

import { NextRequest, NextResponse } from 'next/server';
import { saiHuAdapter } from '@/lib/adapters/saihu-adapter';
import { inventoryCache, CacheKeys } from '@/lib/database/cache-manager';
import { z } from 'zod';

// 请求参数验证schema
const asinQuerySchema = z.object({
  marketplace: z.string().optional(),
  includeRelated: z.string().transform(val => val === 'true').default('false'),
  includeTrends: z.string().transform(val => val === 'true').default('true'),
  trendDays: z.string().transform(val => Math.min(parseInt(val) || 30, 365)).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ asin: string }> }
) {
  try {
    const { asin } = await params;
    
    // 验证ASIN格式
    if (!asin || !/^[A-Z0-9]{8,15}$/i.test(asin)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的ASIN格式',
          message: 'ASIN应为8-15位字母数字组合',
        },
        { status: 400 }
      );
    }
    
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    
    const validationResult = asinQuerySchema.safeParse(rawParams);
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

    const params_validated = validationResult.data;
    
    // 生成缓存键
    const cacheKey = inventoryCache.generateKey(`${CacheKeys.INVENTORY_DETAILS}:${asin}`, params_validated);
    
    // 尝试从缓存获取数据
    const cachedData = inventoryCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // 缓存未命中，从数据库获取数据
    const asinDetails = await saiHuAdapter.getAsinDetails(
      asin, 
      params_validated.marketplace
    );
    
    // 扩展数据（可选）
    const responseData: any = {
      basicInfo: asinDetails.basicInfo,
    };
    
    // 添加趋势数据
    if (params_validated.includeTrends) {
      responseData.trends = asinDetails.adTrends;
    }
    
    // 添加相关产品数据
    if (params_validated.includeRelated) {
      responseData.relatedProducts = asinDetails.relatedProducts;
    }
    
    // 添加统计汇总
    responseData.summary = {
      totalInventoryPoints: asinDetails.relatedProducts.length + 1,
      averageInventory: [asinDetails.basicInfo, ...asinDetails.relatedProducts]
        .reduce((sum, item) => sum + item.inventory.total, 0) / (asinDetails.relatedProducts.length + 1),
      totalDailySales: [asinDetails.basicInfo, ...asinDetails.relatedProducts]
        .reduce((sum, item) => sum + item.sales.dailySalesAmount, 0),
      totalAdSpend: [asinDetails.basicInfo, ...asinDetails.relatedProducts]
        .reduce((sum, item) => sum + item.advertising.spend, 0),
      averageACOAS: [asinDetails.basicInfo, ...asinDetails.relatedProducts]
        .reduce((sum, item) => sum + item.advertising.acoas, 0) / (asinDetails.relatedProducts.length + 1),
    };
    
    // 添加性能评级
    responseData.performance = evaluateAsinPerformance(asinDetails.basicInfo);
    
    // 缓存结果
    inventoryCache.set(cacheKey, responseData, 5 * 60 * 1000); // 5分钟缓存
    
    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`获取ASIN详细数据失败:`, error);
    
    // 根据错误类型返回不同状态码
    if (error instanceof Error && error.message.includes('未找到')) {
      return NextResponse.json(
        {
          success: false,
          error: '未找到该ASIN的数据',
          message: error.message,
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'ASIN数据获取失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 评估ASIN性能
 */
function evaluateAsinPerformance(inventoryPoint: any): {
  overall: 'excellent' | 'good' | 'average' | 'poor';
  score: number;
  breakdown: {
    inventory: { score: number; status: string };
    sales: { score: number; status: string };
    advertising: { score: number; status: string };
  };
  recommendations: string[];
} {
  let totalScore = 0;
  const breakdown = {
    inventory: { score: 0, status: '' },
    sales: { score: 0, status: '' },
    advertising: { score: 0, status: '' },
  };
  const recommendations: string[] = [];
  
  // 库存评分 (0-40分)
  const turnoverDays = inventoryPoint.sales.turnoverDays;
  if (turnoverDays <= 30) {
    breakdown.inventory.score = 40;
    breakdown.inventory.status = '优秀';
  } else if (turnoverDays <= 60) {
    breakdown.inventory.score = 30;
    breakdown.inventory.status = '良好';
  } else if (turnoverDays <= 100) {
    breakdown.inventory.score = 20;
    breakdown.inventory.status = '一般';
    recommendations.push('建议优化库存周转，当前周转天数较长');
  } else {
    breakdown.inventory.score = 10;
    breakdown.inventory.status = '较差';
    recommendations.push('库存周转严重超标，需要立即处理');
  }
  
  // 销售评分 (0-30分)
  const dailySales = inventoryPoint.sales.dailySalesAmount;
  if (dailySales >= 50) {
    breakdown.sales.score = 30;
    breakdown.sales.status = '优秀';
  } else if (dailySales >= 25) {
    breakdown.sales.score = 25;
    breakdown.sales.status = '良好';
  } else if (dailySales >= 16.7) {
    breakdown.sales.score = 20;
    breakdown.sales.status = '一般';
  } else {
    breakdown.sales.score = 10;
    breakdown.sales.status = '较差';
    recommendations.push('日均销售额低于有效阈值，需要提升销量');
  }
  
  // 广告评分 (0-30分)
  const { ctr, acoas, roas } = inventoryPoint.advertising;
  let adScore = 0;
  
  // CTR评分 (0-10分)
  if (ctr >= 2) adScore += 10;
  else if (ctr >= 1) adScore += 8;
  else if (ctr >= 0.5) adScore += 6;
  else adScore += 3;
  
  // ACOAS评分 (0-10分)
  if (acoas <= 15) adScore += 10;
  else if (acoas <= 25) adScore += 8;
  else if (acoas <= 35) adScore += 6;
  else adScore += 3;
  
  // ROAS评分 (0-10分)
  if (roas >= 4) adScore += 10;
  else if (roas >= 3) adScore += 8;
  else if (roas >= 2) adScore += 6;
  else adScore += 3;
  
  breakdown.advertising.score = adScore;
  
  if (adScore >= 25) {
    breakdown.advertising.status = '优秀';
  } else if (adScore >= 20) {
    breakdown.advertising.status = '良好';
  } else if (adScore >= 15) {
    breakdown.advertising.status = '一般';
    recommendations.push('广告效果有待提升，建议优化关键词和出价策略');
  } else {
    breakdown.advertising.status = '较差';
    recommendations.push('广告效果较差，需要重新审视广告策略');
  }
  
  // 计算总分
  totalScore = breakdown.inventory.score + breakdown.sales.score + breakdown.advertising.score;
  
  // 确定总体评级
  let overall: 'excellent' | 'good' | 'average' | 'poor';
  if (totalScore >= 80) {
    overall = 'excellent';
  } else if (totalScore >= 65) {
    overall = 'good';
  } else if (totalScore >= 50) {
    overall = 'average';
  } else {
    overall = 'poor';
  }
  
  return {
    overall,
    score: totalScore,
    breakdown,
    recommendations,
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