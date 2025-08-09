/**
 * API日志记录工具
 * 提供结构化的API请求日志记录功能
 */

import { NextRequest } from 'next/server';

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 日志记录接口
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  request?: {
    method: string;
    url: string;
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
  };
  response?: {
    status: number;
    statusText: string;
    duration: number;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class ApiLogger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = (process.env.AD_DATA_LOG_LEVEL as LogLevel) || 'info';
  }

  /**
   * 记录调试日志
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * 记录信息日志
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorMetadata = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...metadata,
    } : metadata;

    this.log('error', message, errorMetadata);
  }

  /**
   * 记录API请求日志
   */
  logRequest(
    request: NextRequest,
    message: string,
    level: LogLevel = 'info',
    metadata?: Record<string, any>
  ): void {
    const requestInfo = {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: this.getClientIp(request),
      headers: process.env.AD_DATA_ENABLE_DEBUG === 'true' 
        ? Object.fromEntries(request.headers.entries())
        : undefined,
    };

    this.log(level, message, {
      request: requestInfo,
      ...metadata,
    });
  }

  /**
   * 记录API响应日志
   */
  logResponse(
    request: NextRequest,
    status: number,
    statusText: string,
    duration: number,
    message?: string,
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    
    const requestInfo = {
      method: request.method,
      url: request.url,
      ip: this.getClientIp(request),
    };

    const responseInfo = {
      status,
      statusText,
      duration,
    };

    this.log(level, message || `${request.method} ${request.url} ${status}`, {
      request: requestInfo,
      response: responseInfo,
      ...metadata,
    });
  }

  /**
   * 记录API错误日志
   */
  logApiError(
    request: NextRequest,
    error: Error,
    message?: string,
    metadata?: Record<string, any>
  ): void {
    const requestInfo = {
      method: request.method,
      url: request.url,
      ip: this.getClientIp(request),
    };

    this.log('error', message || `API错误: ${error.message}`, {
      request: requestInfo,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...metadata,
    });
  }

  /**
   * 创建性能监控装饰器
   */
  withPerformanceMonitoring<T extends any[], R>(
    apiName: string,
    handler: (...args: T) => Promise<R>
  ) {
    return async (...args: T): Promise<R> => {
      const startTime = Date.now();
      const request = args[0] as NextRequest;

      try {
        this.logRequest(request, `开始处理 ${apiName} 请求`);

        const result = await handler(...args);
        const duration = Date.now() - startTime;

        this.logResponse(
          request,
          200,
          'OK',
          duration,
          `${apiName} 请求处理完成`,
          { performance: { duration, apiName } }
        );

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.logApiError(
          request,
          error as Error,
          `${apiName} 请求处理失败`,
          { performance: { duration, apiName } }
        );

        throw error;
      }
    };
  }

  /**
   * 核心日志记录方法
   */
  public log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
    };

    // 格式化日志输出
    const formattedLog = this.formatLog(logEntry);

    // 根据级别选择输出方式
    switch (level) {
      case 'debug':
        console.debug(formattedLog);
        break;
      case 'info':
        console.info(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      case 'error':
        console.error(formattedLog);
        break;
    }

    // 在生产环境中，这里可以添加日志收集逻辑
    // 例如发送到日志收集服务、写入文件等
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogCollector(logEntry);
    }
  }

  /**
   * 检查是否应该记录该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[this.logLevel];
  }

  /**
   * 格式化日志输出
   */
  private formatLog(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.metadata) {
      parts.push(JSON.stringify(entry.metadata, null, 2));
    }

    return parts.join(' ');
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown'
    );
  }

  /**
   * 发送日志到收集服务（占位方法）
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private sendToLogCollector(entry: LogEntry): void {
    // TODO: 实现日志收集逻辑
    // 可以发送到 ELK Stack、Datadog、New Relic 等服务
    
    // 示例：发送到外部日志服务
    // fetch('https://logs.example.com/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(entry),
    // }).catch(err => console.error('Failed to send log:', err));
  }

  /**
   * 创建请求上下文
   */
  createRequestContext(request: NextRequest): RequestContext {
    return new RequestContext(request, this);
  }
}

/**
 * 请求上下文类
 * 用于在单个请求的生命周期内跟踪和记录相关日志
 */
export class RequestContext {
  private startTime: number;
  private requestId: string;

  constructor(
    private request: NextRequest,
    private logger: ApiLogger
  ) {
    this.startTime = Date.now();
    this.requestId = this.generateRequestId();
  }

  /**
   * 记录请求开始
   */
  logStart(apiName: string, metadata?: Record<string, any>): void {
    this.logger.logRequest(
      this.request,
      `开始处理 ${apiName} 请求`,
      'info',
      {
        requestId: this.requestId,
        apiName,
        ...metadata,
      }
    );
  }

  /**
   * 记录请求完成
   */
  logComplete(status: number, statusText: string, metadata?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    
    this.logger.logResponse(
      this.request,
      status,
      statusText,
      duration,
      undefined,
      {
        requestId: this.requestId,
        ...metadata,
      }
    );
  }

  /**
   * 记录请求错误
   */
  logError(error: Error, metadata?: Record<string, any>): void {
    this.logger.logApiError(
      this.request,
      error,
      undefined,
      {
        requestId: this.requestId,
        duration: Date.now() - this.startTime,
        ...metadata,
      }
    );
  }

  /**
   * 记录业务日志
   */
  log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    this.logger.log(level, message, {
      requestId: this.requestId,
      ...metadata,
    });
  }

  /**
   * 获取请求持续时间
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 获取请求ID
   */
  getRequestId(): string {
    return this.requestId;
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 单例模式导出
export const apiLogger = new ApiLogger();