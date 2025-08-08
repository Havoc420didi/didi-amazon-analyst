'use client';

import { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, TrendingUp, TrendingDown } from 'lucide-react';

interface TrendData {
  date: string;
  metrics: {
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
}

interface AdTrendsChartProps {
  data: TrendData[];
  height?: number;
  showLegend?: boolean;
  metrics?: string[];
  className?: string;
  chartType?: 'line' | 'area';
}

export function AdTrendsChart({
  data,
  height = 300,
  showLegend = false,
  metrics = ['impressions', 'clicks', 'spend'],
  className = '',
  chartType = 'line',
}: AdTrendsChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(metrics);
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d' | 'all'>('30d');
  const [chartMode, setChartMode] = useState<'line' | 'area'>(chartType);

  // 指标配置
  const metricsConfig = {
    impressions: { label: '曝光量', color: '#8884d8', yAxis: 'left', format: 'number' },
    clicks: { label: '点击量', color: '#82ca9d', yAxis: 'left', format: 'number' },
    spend: { label: '花费', color: '#ffc658', yAxis: 'right', format: 'currency' },
    sales: { label: '销售额', color: '#ff7300', yAxis: 'right', format: 'currency' },
    ctr: { label: 'CTR (%)', color: '#0088fe', yAxis: 'left', format: 'percentage' },
    cvr: { label: 'CVR (%)', color: '#00c49f', yAxis: 'left', format: 'percentage' },
    cpc: { label: 'CPC', color: '#ffbb28', yAxis: 'right', format: 'currency' },
    roas: { label: 'ROAS', color: '#ff8042', yAxis: 'left', format: 'number' },
    acoas: { label: 'ACOAS (%)', color: '#8dd1e1', yAxis: 'left', format: 'percentage' },
  };

  // 根据时间范围筛选数据
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (timeRange === 'all') return sortedData;
    
    const days = parseInt(timeRange);
    return sortedData.slice(-days);
  }, [data, timeRange]);

  // 格式化数据用于图表显示
  const chartData = useMemo(() => {
    return filteredData.map(item => ({
      date: new Date(item.date).toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      }),
      fullDate: item.date,
      ...item.metrics,
    }));
  }, [filteredData]);

  // 计算趋势统计
  const trendStats = useMemo(() => {
    if (chartData.length < 2) return {};
    
    const stats: Record<string, any> = {};
    
    selectedMetrics.forEach(metric => {
      const values = chartData.map(d => (d as any)[metric]).filter(v => v != null);
      if (values.length === 0) return;
      
      const current = values[values.length - 1];
      const previous = values[Math.max(0, values.length - 8)]; // 比较一周前
      const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
      
      stats[metric] = {
        current,
        change,
        trend: Math.abs(change) < 1 ? 'stable' : change >= 0 ? 'up' : 'down',
      };
    });
    
    return stats;
  }, [chartData, selectedMetrics]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          const config = (metricsConfig as any)[entry.dataKey];
          if (!config) return null;
          
          let value = entry.value;
          if (config.format === 'currency') {
            value = `$${value.toLocaleString()}`;
          } else if (config.format === 'percentage') {
            value = `${value.toFixed(2)}%`;
          } else if (config.format === 'number') {
            value = value.toLocaleString();
          }
          
          return (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {config.label}: {value}
            </p>
          );
        })}
      </div>
    );
  };

  // 切换指标选择
  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <CalendarDays className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暂无趋势数据</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">广告趋势分析</CardTitle>
          
          <div className="flex items-center space-x-2">
            {/* 图表类型切换 */}
            <div className="flex border rounded-md">
              <Button
                variant={chartMode === 'line' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartMode('line')}
                className="rounded-r-none"
              >
                折线图
              </Button>
              <Button
                variant={chartMode === 'area' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartMode('area')}
                className="rounded-l-none"
              >
                面积图
              </Button>
            </div>
            
            {/* 时间范围选择 */}
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7天</SelectItem>
                <SelectItem value="14d">14天</SelectItem>
                <SelectItem value="30d">30天</SelectItem>
                <SelectItem value="all">全部</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* 指标选择 */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(metricsConfig).map(([key, config]) => (
            <Badge
              key={key}
              variant={selectedMetrics.includes(key) ? 'default' : 'outline'}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => toggleMetric(key)}
            >
              <div 
                className="w-2 h-2 rounded-full mr-2" 
                style={{ backgroundColor: config.color }}
              />
              {config.label}
            </Badge>
          ))}
        </div>
        
        {/* 趋势统计 */}
        {Object.keys(trendStats).length > 0 && (
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t">
            {selectedMetrics.slice(0, 3).map(metric => {
              const stat = trendStats[metric];
              if (!stat) return null;
              
              const config = (metricsConfig as any)[metric];
              const isPositive = stat.trend === 'up';
              
              return (
                <div key={metric} className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600">{config.label}:</span>
                  <div className="flex items-center space-x-1">
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : stat.trend === 'down' ? (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    ) : null}
                    <span className={
                      stat.trend === 'up' ? 'text-green-600' : 
                      stat.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }>
                      {Math.abs(stat.change).toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {chartMode === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              
              {selectedMetrics.map(metric => {
                const config = (metricsConfig as any)[metric];
                return (
                  <Area
                    key={metric}
                    yAxisId={config.yAxis}
                    type="monotone"
                    dataKey={metric}
                    stroke={config.color}
                    fill={config.color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                );
              })}
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              
              {selectedMetrics.map(metric => {
                const config = (metricsConfig as any)[metric];
                return (
                  <Line
                    key={metric}
                    yAxisId={config.yAxis}
                    type="monotone"
                    dataKey={metric}
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: config.color }}
                    activeDot={{ r: 5, fill: config.color }}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}