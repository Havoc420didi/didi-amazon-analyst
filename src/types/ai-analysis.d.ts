// AI分析任务状态枚举
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// AI分析任务基础接口
export interface AIAnalysisTask {
  id: number;
  task_number: string;
  asin: string;
  warehouse_location: string;
  status: AnalysisStatus;
  executor: string;
  product_data: string; // JSON字符串
  analysis_content?: string;
  ai_model: string;
  processing_time?: number;
  tokens_used?: number;
  rating?: number; // 1-5星评价
  rating_feedback?: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

// 创建AI分析任务输入接口
export interface CreateAnalysisTask {
  asin: string;
  warehouse_location: string;
  executor: string;
  product_data: ProductAnalysisData;
  batch_id?: string; // 批量分析批次ID
  analysis_period?: AnalysisPeriod; // 分析周期配置
}

// 分析周期配置
export interface AnalysisPeriod {
  type: 'single_day' | 'multi_day';
  days: number; // 分析天数: 1, 3, 7, 14, 30
  end_date?: string; // 结束日期，默认为今天
  aggregation_method: 'average' | 'sum' | 'latest' | 'trend'; // 聚合方法
}

// 产品分析数据接口
export interface ProductAnalysisData {
  // 产品基本信息
  asin: string;
  product_name: string;
  warehouse_location: string;
  sales_person: string;
  
  // 库存数据
  total_inventory: number;
  fba_available: number;
  fba_in_transit: number;
  local_warehouse: number;
  
  // 销售数据
  avg_sales: number;
  daily_revenue: number;
  inventory_turnover_days?: number;
  inventory_status?: string;
  
  // 广告数据
  ad_impressions: number;
  ad_clicks: number;
  ad_spend: number;
  ad_orders: number;
  ad_ctr?: number;
  ad_conversion_rate?: number;
  acos?: number;
  
  // 趋势数据
  trends?: {
    inventory_change: number;
    revenue_change: number;
    sales_change: number;
  };
  
  // 历史数据(最近几天)
  history?: Array<{
    date: string;
    inventory: number;
    revenue: number;
    sales: number;
  }>;
  
  // 聚合分析元数据
  aggregation_metadata?: {
    analysis_period: AnalysisPeriod;
    data_points_count: number; // 实际聚合的数据点数量
    date_range: {
      start_date: string;
      end_date: string;
    };
    aggregation_quality: 'excellent' | 'good' | 'fair' | 'poor'; // 数据质量评估
    missing_days?: string[]; // 缺失的日期
  };
}

// AI分析结果接口
export interface AIAnalysisResult {
  analysis_content: string;
  processing_time: number;
  tokens_used: number;
  recommendations: {
    inventory_action: string;
    sales_strategy: string;
    ad_optimization: string;
    risk_level: 'low' | 'medium' | 'high';
  };
}

// 分析任务查询参数
export interface AnalysisTaskQueryParams {
  asin?: string;
  warehouse_location?: string;
  status?: AnalysisStatus;
  executor?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: keyof AIAnalysisTask;
  sort_order?: 'asc' | 'desc';
}

// API响应包装器
export interface AnalysisApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 分页响应
export interface PaginatedAnalysisResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// 分析任务统计信息
export interface AnalysisStats {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  failed_tasks: number;
  avg_processing_time: number;
  total_tokens_used: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

// 任务评价输入
export interface TaskRating {
  rating: number; // 1-5
  feedback?: string;
}

// 诊断场景枚举
export type DiagnosisScenario = 
  | 'inventory_shortage'     // 库存不足
  | 'conversion_insufficient' // 转化率不足
  | 'ad_insufficient'        // 广告投放不足
  | 'inventory_excess'       // 库存积压
  | 'ad_cost_high'          // 广告成本过高
  | 'healthy_operation';     // 运营健康

// 增强的产品分析数据接口
export interface EnhancedProductAnalysisData extends ProductAnalysisData {
  enhanced_metrics?: {
    avg_price: number;
    standard_cvr: number;
    actual_cvr: number;
    ctr: number;
    cvr_health: 'good' | 'poor';
    ctr_health: 'good' | 'poor';
    acoas_health: 'good' | 'low' | 'high';
    inventory_health: 'good' | 'low' | 'high';
  };
}