/**
 * 缓存管理器
 * 提供内存缓存和可选的Redis缓存支持
 */

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // 生存时间（毫秒）
}

interface CacheConfig {
  defaultTTL: number; // 默认缓存时间（毫秒）
  maxItems: number;   // 最大缓存项数
  cleanupInterval: number; // 清理间隔（毫秒）
}

export class CacheManager {
  private cache = new Map<string, CacheItem>();
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 默认5分钟
      maxItems: 1000,             // 最大1000个缓存项
      cleanupInterval: 60 * 1000, // 每分钟清理一次
      ...config,
    };

    this.startCleanup();
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
    };

    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.config.maxItems) {
      this.evictOldest();
    }

    this.cache.set(key, item);
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (this.isExpired(item)) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    if (this.isExpired(item)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    totalItems: number;
    expiredItems: number;
    memoryUsage: string;
  } {
    let expiredItems = 0;
    
    this.cache.forEach((item, key) => {
      if (this.isExpired(item)) {
        expiredItems++;
      }
    });

    return {
      totalItems: this.cache.size,
      expiredItems,
      memoryUsage: `${Math.round(JSON.stringify([...this.cache]).length / 1024)}KB`,
    };
  }

  /**
   * 获取或设置缓存（如果不存在则通过回调函数获取）
   */
  async getOrSet<T>(
    key: string,
    getter: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 先尝试从缓存获取
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，通过回调函数获取数据
    try {
      const data = await getter();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      console.error('获取数据失败:', { key, error });
      throw error;
    }
  }

  /**
   * 批量设置缓存
   */
  mset<T>(items: Array<{ key: string; data: T; ttl?: number }>): void {
    items.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  /**
   * 批量获取缓存
   */
  mget<T>(keys: string[]): Array<{ key: string; data: T | null }> {
    return keys.map(key => ({
      key,
      data: this.get<T>(key),
    }));
  }

  /**
   * 生成缓存键
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `${prefix}:${sortedParams}`;
  }

  /**
   * 按前缀删除缓存
   */
  deleteByPrefix(prefix: string): number {
    let deleted = 0;
    
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    });

    return deleted;
  }

  /**
   * 检查缓存项是否过期
   */
  private isExpired(item: CacheItem): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  /**
   * 删除最旧的缓存项
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    this.cache.forEach((item, key) => {
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 开始定期清理过期缓存
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanExpiredItems();
    }, this.config.cleanupInterval);
  }

  /**
   * 清理过期的缓存项
   */
  private cleanExpiredItems(): void {
    const expiredKeys: string[] = [];

    this.cache.forEach((item, key) => {
      if (this.isExpired(item)) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`清理了 ${expiredKeys.length} 个过期缓存项`);
    }
  }

  /**
   * 停止缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.clear();
  }
}

// 预定义的缓存配置
export const CacheConfigs = {
  // 广告数据缓存配置
  AD_DATA: {
    defaultTTL: 10 * 60 * 1000, // 10分钟
    maxItems: 500,
  },
  
  // 库存点数据缓存配置
  INVENTORY_POINTS: {
    defaultTTL: 5 * 60 * 1000,  // 5分钟
    maxItems: 1000,
  },
  
  // 统计数据缓存配置
  STATISTICS: {
    defaultTTL: 30 * 60 * 1000, // 30分钟
    maxItems: 100,
  },
  
  // 趋势数据缓存配置
  TRENDS: {
    defaultTTL: 15 * 60 * 1000, // 15分钟
    maxItems: 200,
  },
};

// 缓存键前缀
export const CacheKeys = {
  AD_SUMMARY: 'ad:summary',
  AD_TRENDS: 'ad:trends',
  AD_DISTRIBUTION: 'ad:distribution',
  INVENTORY_POINTS: 'inventory:points',
  INVENTORY_DETAILS: 'inventory:details',
  SYNC_STATUS: 'sync:status',
  PRODUCT_ANALYTICS: 'product:analytics',
  FBA_INVENTORY: 'fba:inventory',
};

// 单例模式导出不同类型的缓存管理器
export const adDataCache = new CacheManager(CacheConfigs.AD_DATA);
export const inventoryCache = new CacheManager(CacheConfigs.INVENTORY_POINTS);
export const statisticsCache = new CacheManager(CacheConfigs.STATISTICS);
export const trendsCache = new CacheManager(CacheConfigs.TRENDS);