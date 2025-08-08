'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  Eye, 
  MousePointer, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  BarChart3
} from 'lucide-react';
import { AdMetricsCard } from './ad-metrics-card';
import { AdTrendsChart } from './ad-trends-chart';
import { InventoryPointsTable } from './inventory-points-table';
import { AdDistributionChart } from './ad-distribution-chart';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AdDashboardData {
  summary: {
    totalProducts: number;
    totalInventoryPoints: number;
    totalInventory: number;
    totalDailySales: number;
    totalAdSpend: number;
    averageMetrics: {
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      ctr: number;
      cvr: number;
      cpc: number;
      roas: number;
      acoas: number;
    };
  };
  trends: Array<{
    date: string;
    metrics: any;
  }>;
  distribution: Array<{
    marketplace: string;
    pointCount: number;
    inventory: number;
    dailySales: number;
    adSpend: number;
    averageMetrics: any;
  }>;
  inventoryPoints: any[];
}

interface AdDashboardProps {
  initialFilters?: {
    asin?: string;
    marketplace?: string;
    salesPerson?: string;
    startDate?: string;
    endDate?: string;
  };
}

export function AdDashboard({ initialFilters = {} }: AdDashboardProps) {
  const [data, setData] = useState<AdDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [refreshing, setRefreshing] = useState(false);

  // 获取广告数据
  const fetchAdData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/ad-data/dashboard?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '获取数据失败');
      }

      setData(result.data);
    } catch (err) {
      console.error('获取广告数据失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    fetchAdData();
  }, []);

  // 监听筛选条件变化
  useEffect(() => {
    if (!loading) {
      fetchAdData();
    }
  }, [filters]);

  // 刷新数据
  const handleRefresh = () => {
    fetchAdData(true);
  };

  // 更新筛选条件
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">加载广告数据中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">数据加载失败</span>
          </div>
          <p className="text-red-600 mt-2">{error}</p>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="mt-4"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暂无广告数据</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, trends, distribution, inventoryPoints } = data;

  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">广告数据分析</h1>
          <p className="text-gray-600 mt-1">Amazon广告投放效果监控与分析</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="text-sm">
            {summary.totalProducts} 个产品
          </Badge>
          <Badge variant="outline" className="text-sm">
            {summary.totalInventoryPoints} 个库存点
          </Badge>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AdMetricsCard
          title="广告曝光量"
          value={summary.averageMetrics.impressions}
          format="number"
          icon={<Eye className="h-5 w-5" />}
          trend="up"
          trendValue={12.5}
          description="总曝光次数"
        />
        
        <AdMetricsCard
          title="广告点击量"
          value={summary.averageMetrics.clicks}
          format="number"
          icon={<MousePointer className="h-5 w-5" />}
          trend="up"
          trendValue={8.3}
          description="总点击次数"
        />
        
        <AdMetricsCard
          title="广告花费"
          value={summary.totalAdSpend}
          format="currency"
          icon={<DollarSign className="h-5 w-5" />}
          trend="down"
          trendValue={3.2}
          description="总投入金额"
        />
        
        <AdMetricsCard
          title="点击率 (CTR)"
          value={summary.averageMetrics.ctr}
          format="percentage"
          icon={<Target className="h-5 w-5" />}
          trend="up"
          trendValue={15.7}
          description="平均点击率"
        />
      </div>

      {/* 详细指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">转化率 (CVR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {summary.averageMetrics.cvr.toFixed(2)}%
              </span>
              <div className="flex items-center text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span className="text-sm">+5.2%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">广告转化表现</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">投资回报率 (ROAS)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {summary.averageMetrics.roas.toFixed(2)}
              </span>
              <div className="flex items-center text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span className="text-sm">+12.8%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">广告投资回报</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">ACOAS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {summary.averageMetrics.acoas.toFixed(2)}%
              </span>
              <div className="flex items-center text-red-600">
                <TrendingDown className="h-4 w-4 mr-1" />
                <span className="text-sm">-2.1%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">广告成本占比</p>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">数据概览</TabsTrigger>
          <TabsTrigger value="trends">趋势分析</TabsTrigger>
          <TabsTrigger value="inventory">库存管理</TabsTrigger>
          <TabsTrigger value="distribution">市场分布</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 广告效果趋势图 */}
            <Card>
              <CardHeader>
                <CardTitle>广告效果趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <AdTrendsChart data={trends} />
              </CardContent>
            </Card>

            {/* 健康度检查 */}
            <Card>
              <CardHeader>
                <CardTitle>广告健康度检查</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">点击率水平</span>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm text-green-600">良好</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">成本控制</span>
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                    <span className="text-sm text-yellow-600">需关注</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">投资回报</span>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm text-green-600">优秀</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">转化表现</span>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm text-green-600">良好</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>详细趋势分析</CardTitle>
              <p className="text-sm text-gray-600">过去30天的广告表现变化趋势</p>
            </CardHeader>
            <CardContent>
              <AdTrendsChart 
                data={trends} 
                height={400}
                showLegend={true}
                metrics={['impressions', 'clicks', 'spend', 'ctr', 'acoas']}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>库存点广告数据</CardTitle>
              <p className="text-sm text-gray-600">各库存点的广告投放效果详情</p>
            </CardHeader>
            <CardContent>
              <InventoryPointsTable 
                data={inventoryPoints}
                onFiltersChange={updateFilters}
                currentFilters={filters}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>市场分布分析</CardTitle>
              <p className="text-sm text-gray-600">不同市场的广告投放分布和效果对比</p>
            </CardHeader>
            <CardContent>
              <AdDistributionChart data={distribution} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}