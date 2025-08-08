/**
 * 库存点数据API
 * GET /api/ad-data/inventory-points
 */

import { NextRequest, NextResponse } from 'next/server';
import { saiHuAdapter } from '@/lib/adapters/saihu-adapter';
import { inventoryCache, CacheKeys } from '@/lib/database/cache-manager';
import { z } from 'zod';

// 请求参数验证schema
const inventoryPointsQuerySchema = z.object({
  asin: z.string().optional(),
  marketplace: z.string().optional(),
  salesPerson: z.string().optional(),
  isEffective: z.string().transform(val => val === 'true' ? true : val === 'false' ? false : undefined).optional(),
  isTurnoverExceeded: z.string().transform(val => val === 'true' ? true : val === 'false' ? false : undefined).optional(),
  isOutOfStock: z.string().transform(val => val === 'true' ? true : val === 'false' ? false : undefined).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, parseInt(process.env.AD_DATA_MAX_PAGE_SIZE || '100'))).optional(),
  sortBy: z.enum(['dailySalesAmount', 'totalInventory', 'turnoverDays', 'adSpend', 'acoas']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    
    const validationResult = inventoryPointsQuerySchema.safeParse(rawParams);
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
    const cacheKey = inventoryCache.generateKey(CacheKeys.INVENTORY_POINTS, params);
    
    // 尝试从缓存获取数据
    const cachedData = inventoryCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData.data,
        pagination: {
          total: cachedData.total,
          page: cachedData.page,
          limit: cachedData.limit,
          totalPages: cachedData.totalPages,
        },
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // 缓存未命中，从数据库获取数据
    const result = await saiHuAdapter.getInventoryPoints(params);
    
    // 如果需要排序，在内存中进行排序
    if (params.sortBy && result.data.length > 0) {
      const sortField = params.sortBy;
      const sortOrder = params.sortOrder || 'desc';
      
      result.data.sort((a, b) => {
        let aValue: number, bValue: number;
        
        switch (sortField) {
          case 'dailySalesAmount':
            aValue = a.sales.dailySalesAmount;
            bValue = b.sales.dailySalesAmount;
            break;
          case 'totalInventory':
            aValue = a.inventory.total;
            bValue = b.inventory.total;
            break;
          case 'turnoverDays':
            aValue = a.sales.turnoverDays;
            bValue = b.sales.turnoverDays;
            break;
          case 'adSpend':
            aValue = a.advertising.spend;
            bValue = b.advertising.spend;
            break;
          case 'acoas':
            aValue = a.advertising.acoas;
            bValue = b.advertising.acoas;
            break;
          default:
            aValue = 0;
            bValue = 0;
        }
        
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }
    
    // 缓存结果
    inventoryCache.set(cacheKey, result, 5 * 60 * 1000); // 5分钟缓存
    
    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('获取库存点数据失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取库存点数据失败',
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