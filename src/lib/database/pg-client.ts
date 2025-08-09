import postgres from 'postgres';

type QueryParams = any[];

export type QueryResult<T = any> = {
  success: boolean;
  data?: T[];
  error?: string;
};

export type PaginatedResult<T = any> = QueryResult<T> & {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const DEFAULT_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://amazon_analyst:amazon_analyst_2024@localhost:5432/amazon_analyst';

// 创建单例连接
const sql = postgres(DEFAULT_DB_URL, {
  prepare: false,
  max: 10,
});

// 将 MySQL 风格的 ? 占位符转为 PostgreSQL $1,$2,...
function toPgPlaceholders(sqlText: string, params: QueryParams) {
  let idx = 0;
  const text = sqlText.replace(/\?/g, () => `$${++idx}`);
  return { text, values: params };
}

// 移除末尾 ORDER BY，用于统计子查询
function stripOrderBy(sqlText: string) {
  const match = sqlText.match(/\border\s+by\b[\s\S]*$/i);
  return match ? sqlText.slice(0, match.index) : sqlText;
}

async function execQuery<T = any>(
  sqlText: string,
  params: QueryParams = []
): Promise<QueryResult<T>> {
  try {
    const { text, values } = toPgPlaceholders(sqlText, params);
    const rows = await sql.unsafe<T[]>(text, values);
    return { success: true, data: rows as T[] };
  } catch (e: any) {
    console.error('PostgreSQL query error:', e);
    return { success: false, error: e?.message || 'DB query error' };
  }
}

async function execQueryWithPagination<T = any>(
  baseSql: string,
  params: QueryParams = [],
  pagination: { page?: number; limit?: number } = {}
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.max(1, pagination.limit || 20);
  const offset = (page - 1) * limit;

  // 统计总数
  const countSql = `SELECT COUNT(*)::int AS total FROM (${stripOrderBy(baseSql)}) AS sub`;
  const countRes = await execQuery<{ total: number }>(countSql, params);
  const total = countRes.success && countRes.data?.[0]?.total ? countRes.data[0].total : 0;

  // 分页查询
  const pageSql = `${baseSql} LIMIT ? OFFSET ?`;
  const pageParams = [...params, limit, offset];
  const pageRes = await execQuery<T>(pageSql, pageParams);

  return {
    success: !!pageRes.success,
    data: pageRes.data,
    error: pageRes.error,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// INSERT 批量导入（如需更新，需提供唯一约束后扩展 ON CONFLICT DO UPDATE）
async function execBatchInsert<T extends Record<string, any>>(
  table: string,
  rows: T[],
  _updateFields?: string
) {
  if (!rows?.length) return { success: true, total: 0 };

  const cols = Object.keys(rows[0]);
  const valuesMatrix = rows.map((r) => cols.map((c) => r[c]));
  const placeholders = valuesMatrix
    .map(
      (_row, rIdx) =>
        `(${cols.map((_c, cIdx) => `$${rIdx * cols.length + cIdx + 1}`).join(',')})`
    )
    .join(',');

  const query = `
    INSERT INTO ${table} (${cols.join(',')})
    VALUES ${placeholders}
    ON CONFLICT DO NOTHING
  `;

  try {
    await sql.unsafe(query, valuesMatrix.flat());
    return { success: true, total: rows.length };
  } catch (e: any) {
    console.error('PostgreSQL batch insert error:', e);
    return { success: false, error: e?.message || 'DB batch insert error' };
  }
}

// 生成 WHERE 子句（键值等值匹配）
function buildWhereClause(filters: Record<string, any>) {
  const parts: string[] = [];
  const params: any[] = [];
  Object.entries(filters).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    parts.push(`${key} = ?`);
    params.push(val);
  });
  const whereClause = parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
  return { whereClause, params };
}

export const pgClient = {
  query: execQuery,
  queryWithPagination: execQueryWithPagination,
  batchInsert: execBatchInsert,
  buildWhereClause,
  async getDatabaseStatus() {
    try {
      const versionRows = await sql`SELECT version()`;
      const version = versionRows?.[0]?.version || '';
      const activityRows = await sql`
        SELECT COUNT(*)::int AS total, 
               SUM(CASE WHEN state = 'active' THEN 1 ELSE 0 END)::int AS active
        FROM pg_stat_activity
      `;
      const totalConnections = activityRows?.[0]?.total ?? 0;
      const activeConnections = activityRows?.[0]?.active ?? 0;
      return { connected: true, version, totalConnections, activeConnections };
    } catch (e: any) {
      return { connected: false, version: '', totalConnections: 0, activeConnections: 0, error: e?.message };
    }
  },
};

export default pgClient;


