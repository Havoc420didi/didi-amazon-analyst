/**
 * MySQL数据库客户端
 * 用于连接和访问 sync_saihu_erp 数据库
 */

import mysql from 'mysql2/promise';

interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  charset: string;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
}

interface QueryResult<T = any> {
  success: boolean;
  data?: T[];
  total?: number;
  error?: string;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export class MySQLClient {
  private pool: mysql.Pool | null = null;
  private config: MySQLConfig;

  constructor() {
    this.config = {
      host: process.env.SAIHU_MYSQL_HOST || '47.79.123.234',
      port: parseInt(process.env.SAIHU_MYSQL_PORT || '3306'),
      user: process.env.SAIHU_MYSQL_USER || 'saihu_erp_sync',
      password: process.env.SAIHU_MYSQL_PASSWORD || '123456',
      database: process.env.SAIHU_MYSQL_DATABASE || 'saihu_erp_sync',
      charset: 'utf8mb4',
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 30000,
    };

    this.initializePool();
  }

  /**
   * 初始化连接池
   */
  private initializePool(): void {
    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        charset: this.config.charset,
        connectionLimit: this.config.connectionLimit,
        acquireTimeout: this.config.acquireTimeout,
        timeout: this.config.timeout,
        reconnect: true,
        idleTimeout: 900000, // 15分钟
        // 启用多语句支持
        multipleStatements: false,
        // 启用SSL（如果需要）
        ssl: false,
        // 时区设置
        timezone: '+00:00',
        // 类型转换
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: true,
      });

      console.log('MySQL连接池初始化成功');
    } catch (error) {
      console.error('MySQL连接池初始化失败:', error);
      throw new Error('数据库连接初始化失败');
    }
  }

  /**
   * 获取数据库连接
   */
  async getConnection(): Promise<mysql.PoolConnection> {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    try {
      const connection = await this.pool.getConnection();
      return connection;
    } catch (error) {
      console.error('获取数据库连接失败:', error);
      throw new Error('获取数据库连接失败');
    }
  }

  /**
   * 执行查询
   */
  async query<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    const connection = await this.getConnection();
    
    try {
      const [rows, fields] = await connection.execute(sql, params);
      
      return {
        success: true,
        data: rows as T[],
        total: Array.isArray(rows) ? rows.length : 1,
      };
    } catch (error) {
      console.error('SQL查询执行失败:', { sql, params, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询执行失败',
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 执行分页查询
   */
  async queryWithPagination<T = any>(
    sql: string,
    params: any[] = [],
    pagination: PaginationParams = {}
  ): Promise<QueryResult<T> & { page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    // 首先获取总数
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as count_query`;
    const countResult = await this.query<{ total: number }>(countSql, params);
    
    if (!countResult.success || !countResult.data) {
      return {
        success: false,
        error: countResult.error || '获取数据总数失败',
        page,
        limit,
        totalPages: 0,
      };
    }

    const total = parseInt(countResult.data[0]?.total?.toString() || '0');
    const totalPages = Math.ceil(total / limit);

    // 执行分页查询
    const paginatedSql = `${sql} LIMIT ${limit} OFFSET ${offset}`;
    const result = await this.query<T>(paginatedSql, params);

    return {
      ...result,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * 执行批量插入
   */
  async batchInsert<T = any>(
    tableName: string,
    data: T[],
    onDuplicateKey?: string
  ): Promise<QueryResult> {
    if (!data || data.length === 0) {
      return { success: true, data: [], total: 0 };
    }

    const connection = await this.getConnection();
    
    try {
      await connection.beginTransaction();

      const keys = Object.keys(data[0] as any);
      const placeholders = keys.map(() => '?').join(', ');
      const values = data.map(item => keys.map(key => (item as any)[key]));
      
      let sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES `;
      sql += values.map(() => `(${placeholders})`).join(', ');
      
      if (onDuplicateKey) {
        sql += ` ON DUPLICATE KEY UPDATE ${onDuplicateKey}`;
      }

      const flatValues = values.flat();
      const [result] = await connection.execute(sql, flatValues);

      await connection.commit();

      return {
        success: true,
        data: [result],
        total: (result as any).affectedRows || 0,
      };
    } catch (error) {
      await connection.rollback();
      console.error('批量插入失败:', { tableName, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : '批量插入失败',
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 执行事务
   */
  async transaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const connection = await this.getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      
      return { success: true, data: result };
    } catch (error) {
      await connection.rollback();
      console.error('事务执行失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '事务执行失败',
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as test');
      return result.success;
    } catch (error) {
      console.error('数据库连接测试失败:', error);
      return false;
    }
  }

  /**
   * 获取数据库状态
   */
  async getDatabaseStatus(): Promise<{
    connected: boolean;
    activeConnections?: number;
    totalConnections?: number;
    version?: string;
  }> {
    try {
      const [versionResult, statusResult] = await Promise.all([
        this.query('SELECT VERSION() as version'),
        this.query('SHOW STATUS LIKE "Threads_connected"'),
      ]);

      return {
        connected: true,
        version: versionResult.data?.[0]?.version,
        activeConnections: parseInt(statusResult.data?.[0]?.Value || '0'),
        totalConnections: this.config.connectionLimit,
      };
    } catch (error) {
      return { connected: false };
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('MySQL连接池已关闭');
    }
  }

  /**
   * 格式化SQL查询（用于调试）
   */
  formatQuery(sql: string, params: any[]): string {
    let formattedSql = sql;
    params.forEach((param, index) => {
      const value = typeof param === 'string' ? `'${param}'` : param;
      formattedSql = formattedSql.replace('?', value?.toString() || 'NULL');
    });
    return formattedSql;
  }

  /**
   * 构建WHERE条件
   */
  buildWhereClause(conditions: Record<string, any>): { 
    whereClause: string; 
    params: any[] 
  } {
    const clauses: string[] = [];
    const params: any[] = [];

    Object.entries(conditions).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          clauses.push(`${key} IN (${value.map(() => '?').join(', ')})`);
          params.push(...value);
        } else if (typeof value === 'string' && value.includes('%')) {
          clauses.push(`${key} LIKE ?`);
          params.push(value);
        } else {
          clauses.push(`${key} = ?`);
          params.push(value);
        }
      }
    });

    return {
      whereClause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }
}

// 单例模式导出
export const mysqlClient = new MySQLClient();