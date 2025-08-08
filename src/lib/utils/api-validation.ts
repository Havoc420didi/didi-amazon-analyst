/**
 * API验证工具
 * 提供通用的请求验证、错误处理和响应格式化功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 通用API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
  cached?: boolean;
  timestamp: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 分页参数验证Schema
export const paginationSchema = z.object({
  page: z.string().transform(val => Math.max(parseInt(val) || 1, 1)).optional(),
  limit: z.string().transform(val => Math.min(Math.max(parseInt(val) || 20, 1), 100)).optional(),
});

// 日期范围验证Schema
export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为YYYY-MM-DD').optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: '开始日期不能晚于结束日期',
});

// ASIN验证Schema
export const asinSchema = z.string().regex(/^[A-Z0-9]{8,15}$/i, 'ASIN格式无效，应为8-15位字母数字组合');

// 市场验证Schema
export const marketplaceSchema = z.string().min(1, '市场不能为空');

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    cached?: boolean;
    pagination?: ApiResponse['pagination'];
    message?: string;
  } = {}
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    cached: options.cached,
    pagination: options.pagination,
    message: options.message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  error: string,
  options: {
    status?: number;
    message?: string;
    details?: any;
  } = {}
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      message: options.message,
      details: options.details,
      timestamp: new Date().toISOString(),
    },
    { status: options.status || 500 }
  );
}

/**
 * 验证请求参数
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: NextResponse } {
  const rawParams = Object.fromEntries(searchParams.entries());
  const validationResult = schema.safeParse(rawParams);
  
  if (!validationResult.success) {
    return {
      success: false,
      error: createErrorResponse('参数验证失败', {
        status: 400,
        details: validationResult.error.errors,
      }),
    };
  }
  
  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * 验证请求体
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const body = await request.json();
    const validationResult = schema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        success: false,
        error: createErrorResponse('请求体验证失败', {
          status: 400,
          details: validationResult.error.errors,
        }),
      };
    }
    
    return {
      success: true,
      data: validationResult.data,
    };
  } catch (error) {
    return {
      success: false,
      error: createErrorResponse('请求体解析失败', {
        status: 400,
        message: error instanceof Error ? error.message : '无效的JSON格式',
      }),
    };
  }
}

/**
 * API错误处理装饰器
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>
) {
  return async (...args: T): Promise<NextResponse<ApiResponse<R>>> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('API错误:', error);
      
      // 根据错误类型返回不同的状态码
      if (error instanceof Error) {
        if (error.message.includes('未找到') || error.message.includes('not found')) {
          return createErrorResponse('资源未找到', {
            status: 404,
            message: error.message,
          });
        }
        
        if (error.message.includes('权限') || error.message.includes('unauthorized')) {
          return createErrorResponse('权限不足', {
            status: 403,
            message: error.message,
          });
        }
        
        if (error.message.includes('数据库') || error.message.includes('connection')) {
          return createErrorResponse('数据库连接失败', {
            status: 503,
            message: '服务暂时不可用，请稍后重试',
          });
        }
      }
      
      return createErrorResponse('内部服务器错误', {
        status: 500,
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  };
}

/**
 * 请求限流检查
 */
export class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // 定期清理过期记录
    setInterval(() => this.cleanup(), this.windowMs);
  }

  /**
   * 检查是否超过限流
   */
  isLimited(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // 清理过期请求
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    // 检查是否超过限制
    if (validRequests.length >= this.maxRequests) {
      return true;
    }
    
    // 记录当前请求
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return false;
  }

  /**
   * 获取剩余请求数
   */
  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    
    this.requests.forEach((requests, identifier) => {
      const validRequests = requests.filter(time => now - time < this.windowMs);
      
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    });
  }
}

// 全局限流器实例
export const globalRateLimiter = new RateLimiter(
  60 * 1000, // 1分钟窗口
  parseInt(process.env.AD_DATA_API_RATE_LIMIT || '100') // 每分钟最大请求数
);

/**
 * 应用限流中间件
 */
export function withRateLimit(handler: Function, identifier?: (request: NextRequest) => string) {
  return async (request: NextRequest, ...args: any[]) => {
    // 确定限流标识符（默认使用IP地址）
    const id = identifier 
      ? identifier(request)
      : request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown';
    
    // 检查限流
    if (globalRateLimiter.isLimited(id)) {
      return createErrorResponse('请求过于频繁', {
        status: 429,
        message: '请求次数超过限制，请稍后重试',
        details: {
          remainingRequests: globalRateLimiter.getRemainingRequests(id),
          resetTime: new Date(Date.now() + 60000).toISOString(),
        },
      });
    }
    
    return handler(request, ...args);
  };
}

/**
 * CORS配置
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24小时
};

/**
 * 创建OPTIONS响应
 */
export function createOptionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}